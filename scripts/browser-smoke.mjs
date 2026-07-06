#!/usr/bin/env node

import { createServer } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ERROR_SMOKE_ROUTES, FULL_SMOKE_ROUTES, MOBILE_SMOKE_ROUTES, SMOKE_ROUTES } from "../src/config.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const HOST = "127.0.0.1";
const STRICT_CLIPBOARD_SMOKE = process.env.STRICT_CLIPBOARD_SMOKE === "1";
const SMOKE_SCOPE = resolveSmokeScope();
const ROUTES = routesForScope(SMOKE_SCOPE);
const MOBILE_ROUTES = mobileRoutesForScope(SMOKE_SCOPE);
const ARTIFACT_DIR = resolve(ROOT, process.env.BROWSER_SMOKE_ARTIFACT_DIR || "temp/browser-smoke");
const VISIBLE_TIMEOUT_MS = 10000;
const SEARCH_NAVIGATION_TIMEOUT_MS = 10000;
const VIEWPORTS = [
  { name: "desktop", width: 1366, height: 768, routes: ROUTES },
  { name: "mobile", width: 390, height: 844, routes: MOBILE_ROUTES },
];
const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".xml", "application/xml; charset=utf-8"],
]);

function resolveSmokeScope() {
  const scopeIdx = process.argv.indexOf("--scope");
  const scope = scopeIdx === -1 ? process.env.SMOKE_SCOPE || "critical" : process.argv[scopeIdx + 1];
  if (!scope || scope.startsWith("--")) {
    throw new Error("Missing --scope <critical|full> argument.");
  }
  if (!["critical", "full"].includes(scope)) {
    throw new Error(`Unsupported smoke scope: ${scope}`);
  }
  return scope;
}

function routesForScope(scope) {
  const routes = scope === "full" ? FULL_SMOKE_ROUTES : SMOKE_ROUTES;
  return [...routes, ...ERROR_SMOKE_ROUTES];
}

function mobileRoutesForScope(scope) {
  return scope === "full" ? FULL_SMOKE_ROUTES : MOBILE_SMOKE_ROUTES;
}

function resolveStaticPath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const normalized = decoded.endsWith("/") ? `${decoded}index.html` : decoded;
  const filePath = resolve(ROOT, `.${normalized}`);
  const rel = relative(ROOT, filePath);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    return null;
  }
  return filePath;
}

async function serveStatic(req, res) {
  const url = new URL(req.url || "/", `http://${HOST}`);
  const filePath = resolveStaticPath(url.pathname);
  if (!filePath) {
    res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
    res.end("Bad request");
    return;
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) {
      throw new Error("Not a file");
    }
    const body = req.method === "HEAD" ? null : await readFile(filePath);
    const contentType = MIME_TYPES.get(extname(filePath).toLowerCase()) || "application/octet-stream";
    res.writeHead(200, {
      "cache-control": "no-store",
      "content-length": info.size,
      "content-type": contentType,
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

function startServer() {
  const server = createServer((req, res) => {
    serveStatic(req, res).catch((error) => {
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end(error.message);
    });
  });

  return new Promise((resolveStart, rejectStart) => {
    server.once("error", rejectStart);
    server.listen(0, HOST, () => {
      server.off("error", rejectStart);
      const address = server.address();
      resolveStart({ server, port: address.port });
    });
  });
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch (error) {
    throw new Error(
      `Playwright is required for browser smoke. Run through npm script or install playwright. ${error.message}`,
    );
  }
}

async function launchChromium(chromium) {
  const channel = process.env.PLAYWRIGHT_CHANNEL;
  if (channel) {
    return chromium.launch({ channel });
  }

  try {
    return await chromium.launch();
  } catch (error) {
    if (process.platform === "win32") {
      try {
        return await chromium.launch({ channel: "msedge" });
      } catch {
        // Fall through to the original error so Linux CI gets the clearer install hint.
      }
    }
    throw error;
  }
}

function isSameOrigin(url, origin) {
  try {
    return new URL(url).origin === origin;
  } catch {
    return false;
  }
}

function collectRuntimeErrors(page, localOrigin) {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      if (/^Failed to load resource:/.test(message.text())) {
        return;
      }
      errors.push(`console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    errors.push(`pageerror: ${error.message}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && isSameOrigin(response.url(), localOrigin)) {
      errors.push(`http ${response.status()}: ${response.url()}`);
    }
  });
  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText || "";
    if (isSameOrigin(request.url(), localOrigin) && errorText !== "net::ERR_ABORTED") {
      errors.push(`requestfailed: ${request.url()} ${errorText}`.trim());
    }
  });
  return errors;
}

function artifactName(label) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "browser-smoke";
}

async function saveFailureArtifact(page, label, details = {}) {
  await mkdir(ARTIFACT_DIR, { recursive: true });
  const name = artifactName(label);
  const screenshotPath = resolve(ARTIFACT_DIR, `${name}.png`);
  const htmlPath = resolve(ARTIFACT_DIR, `${name}.html`);
  const metaPath = resolve(ARTIFACT_DIR, `${name}.json`);
  const metadata = {
    label,
    url: page.url(),
    capturedAt: new Date().toISOString(),
    error: details.error?.message || String(details.error || ""),
    runtimeErrors: details.runtimeErrors || [],
  };

  await Promise.all([
    page.screenshot({ path: screenshotPath, fullPage: true }).catch((error) => {
      metadata.screenshotError = error.message;
    }),
    page.content().then((html) => writeFile(htmlPath, html)),
  ]);
  await writeFile(metaPath, `${JSON.stringify(metadata, null, 2)}\n`);

  const artifactRoot = relative(ROOT, ARTIFACT_DIR).replaceAll("\\", "/");
  console.error(`Saved browser smoke failure artifacts: ${artifactRoot}/${name}.{png,html,json}`);
}

async function assertVisible(locator, label) {
  await locator.waitFor({ state: "visible", timeout: VISIBLE_TIMEOUT_MS }).catch((error) => {
    throw new Error(`${label} is not visible: ${error.message}`);
  });
}

async function assertNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() =>
    Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)
  );
  if (overflow > 2) {
    throw new Error(`${label} has ${overflow}px horizontal overflow`);
  }
}

async function assertCanvasHasPixels(page, selector, label) {
  await assertVisible(page.locator(selector), label);
  await page.waitForFunction(
    (canvasSelector) => {
      const canvas = document.querySelector(canvasSelector);
      if (!canvas || canvas.clientWidth <= 0 || canvas.clientHeight <= 0 || canvas.width <= 0 || canvas.height <= 0) {
        return false;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return false;
      }
      const samples = [
        [Math.floor(canvas.width / 2), Math.floor(canvas.height / 2)],
        [Math.floor(canvas.width / 4), Math.floor(canvas.height / 4)],
        [Math.floor(canvas.width * 0.75), Math.floor(canvas.height * 0.75)],
      ];
      return samples.some(([x, y]) => Array.from(ctx.getImageData(x, y, 1, 1).data).some((value) => value !== 0));
    },
    selector,
    { timeout: 5000 },
  ).catch((error) => {
    throw new Error(`${label} did not render non-empty canvas pixels: ${error.message}`);
  });
}

async function smokeRoute(browser, baseUrl, viewport, route) {
  const page = await browser.newPage({ viewport });
  const errors = collectRuntimeErrors(page, new URL(baseUrl).origin);
  const label = `${viewport.name} ${route}`;

  try {
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "load" });
    if (!response?.ok()) {
      throw new Error(`${label} returned HTTP ${response?.status() ?? "unknown"}`);
    }
    await assertVisible(page.locator("main#main-content"), `${label} main`);
    await assertVisible(page.locator("main#main-content h1:visible").first(), `${label} h1`);
    if (ERROR_SMOKE_ROUTES.includes(route)) {
      const robotsMetaCount = await page.locator('meta[name="robots"][content="noindex,follow"]').count();
      if (robotsMetaCount === 0) {
        throw new Error(`${label} is missing noindex,follow robots meta`);
      }
      await assertVisible(page.locator(".nav-search-trigger"), `${label} search trigger`);
      await assertVisible(page.locator(".subscribe-form"), `${label} subscribe form`);
      await assertVisible(page.locator(".assistant-nav-trigger"), `${label} assistant trigger`);
    }
    await assertNoHorizontalOverflow(page, label);
    if (errors.length > 0) {
      throw new Error(`${label} runtime errors:\n${errors.join("\n")}`);
    }
    console.log(`✓ ${label}`);
  } catch (error) {
    await saveFailureArtifact(page, label, { error, runtimeErrors: errors });
    throw error;
  } finally {
    await page.close();
  }
}

async function smokeToolInteractions(browser, baseUrl) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  const errors = collectRuntimeErrors(page, new URL(baseUrl).origin);
  const label = "desktop /tools/ interactions";
  try {
    await page.goto(`${baseUrl}/tools/`, { waitUntil: "load" });
    await page.fill("#json-input", '{"ok":true}');
    await page.click('[data-json-action="format"]');
    await page.locator("#json-status").waitFor({ state: "visible", timeout: 5000 });
    const status = await page.locator("#json-status").innerText();
    if (!/处理完成|Done/.test(status)) {
      throw new Error(`JSON formatter status did not report success: ${status}`);
    }

    await page.click('[data-tool-tab="random"]');
    const warning = await page.locator("#tool-random .random-warning").innerText();
    if (!/普通伪随机数|regular pseudo-random numbers/.test(warning)) {
      throw new Error(`Random warning missing or unexpected: ${warning}`);
    }

    await page.click('[data-tool-tab="galaxy"]');
    await assertCanvasHasPixels(page, "#galaxy-canvas", "Galaxy canvas");

    await page.click('[data-tool-tab="uuid"]');
    await page.click("[data-uuid-generate]");
    const uuid = (await page.locator("#uuid-output").innerText()).trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid)) {
      throw new Error(`UUID generator returned unexpected value: ${uuid}`);
    }
    await page.click('[data-copy-target="uuid-output"]');
    await page.waitForFunction(() => /已复制|Copied/.test(document.querySelector("#uuid-status")?.textContent || ""), null, {
      timeout: 5000,
    });
    const canReadClipboard = await page.evaluate(() => Boolean(navigator.clipboard?.readText));
    if (!canReadClipboard) {
      if (STRICT_CLIPBOARD_SMOKE) {
        throw new Error("Strict clipboard smoke requires navigator.clipboard.readText");
      }
      console.warn("Clipboard readText is unavailable; skipped UUID clipboard readback.");
    } else {
      let clipboardText;
      try {
        clipboardText = await page.evaluate(() => navigator.clipboard.readText());
      } catch (error) {
        const message = `Clipboard readback failed: ${error.message}`;
        if (STRICT_CLIPBOARD_SMOKE) {
          throw new Error(message);
        }
        console.warn(message);
      }
      if (clipboardText !== undefined && clipboardText !== uuid) {
        const message = `Clipboard did not receive generated UUID: ${clipboardText}`;
        if (STRICT_CLIPBOARD_SMOKE) {
          throw new Error(message);
        }
        console.warn(message);
      }
    }

    await page.click('[data-tool-tab="gesture"]');
    await assertVisible(page.locator("#gesture-canvas"), "Gesture canvas");
    await assertVisible(page.locator(".gesture-resource-status"), "Gesture resource governance status");
    const resourceItems = await page.locator(".gesture-resource-item").count();
    const watchedResourceItems = await page.locator('.gesture-resource-item[data-resource-status="watch"]').count();
    const resourceSummary = await page.locator(".gesture-resource-status").innerText();
    if (resourceItems !== 7 || watchedResourceItems !== 3 || !/latest|Upstream latest|自托管|Self-hosting/.test(resourceSummary)) {
      throw new Error(`Gesture resource governance status is incomplete: ${resourceItems} items, ${watchedResourceItems} watched, ${resourceSummary}`);
    }
    if (await page.locator("#gesture-start").isEnabled()) {
      throw new Error("Gesture camera start should be disabled until the remote-runtime notice is acknowledged");
    }
    await page.locator(".gesture-consent").click();
    await page.waitForFunction(() => !document.querySelector("#gesture-start")?.disabled, null, { timeout: 5000 });

    await assertNoHorizontalOverflow(page, label);
    if (errors.length > 0) {
      throw new Error(`/tools/ interaction runtime errors:\n${errors.join("\n")}`);
    }
    console.log("✓ /tools/ interactions");
  } catch (error) {
    await saveFailureArtifact(page, label, { error, runtimeErrors: errors });
    throw error;
  } finally {
    await context.close();
  }
}

async function smokePostListSearchInteractions(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = collectRuntimeErrors(page, new URL(baseUrl).origin);
  const label = "desktop /post/ search interactions";
  try {
    await page.goto(`${baseUrl}/post/`, { waitUntil: "load" });
    await page.fill("#post-search-input", "ESClient");
    await page.waitForFunction(() => {
      const link = document.querySelector('[data-post-target="post-finance-saas-backend"]');
      const other = document.querySelector('[data-post-target="post-activiti-workflow-engine"]');
      const empty = document.querySelector(".tree-empty");
      return location.search.includes("q=ESClient") &&
        link && link.offsetParent !== null &&
        other && other.offsetParent === null &&
        empty && empty.hidden;
    }, null, { timeout: 5000 });

    await page.fill("#post-search-input", "Web Worker");
    await page.waitForFunction(() => {
      const link = document.querySelector('[data-post-target="post-lowcode-schema-codegen"]');
      const other = document.querySelector('[data-post-target="post-finance-saas-backend"]');
      const empty = document.querySelector(".tree-empty");
      return /q=Web\+Worker|q=Web%20Worker/.test(location.search) &&
        link && link.offsetParent !== null &&
        other && other.offsetParent === null &&
        empty && empty.hidden;
    }, null, { timeout: 5000 });

    await assertNoHorizontalOverflow(page, label);
    if (errors.length > 0) {
      throw new Error(`/post/ search interaction runtime errors:\n${errors.join("\n")}`);
    }
    console.log("✓ /post/ search interactions");
  } catch (error) {
    await saveFailureArtifact(page, label, { error, runtimeErrors: errors });
    throw error;
  } finally {
    await page.close();
  }
}

async function smokeRelatedPostReasons(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = collectRuntimeErrors(page, new URL(baseUrl).origin);
  const label = "desktop related post reasons";
  try {
    await page.goto(`${baseUrl}/post/manage-system/`, { waitUntil: "load" });
    const reason = page.locator(".post-related .related-reason").first();
    await reason.waitFor({ state: "visible", timeout: 5000 });
    const text = await reason.innerText();
    if (!/共同标签|Shared tags|同属|Same/.test(text)) {
      throw new Error(`Related post reason is unexpected: ${text}`);
    }

    await page.evaluate(() => window.cwlSetLang && window.cwlSetLang("en"));
    const textEn = await reason.innerText();
    if (!/Shared tags|Same/.test(textEn)) {
      throw new Error(`Related post reason did not localize: ${textEn}`);
    }

    await assertNoHorizontalOverflow(page, label);
    if (errors.length > 0) {
      throw new Error(`related post reason runtime errors:\n${errors.join("\n")}`);
    }
    console.log("✓ related post reasons");
  } catch (error) {
    await saveFailureArtifact(page, label, { error, runtimeErrors: errors });
    throw error;
  } finally {
    await page.close();
  }
}

async function smokeSearchInteractions(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = collectRuntimeErrors(page, new URL(baseUrl).origin);
  const label = "desktop search interactions";
  try {
    await page.goto(`${baseUrl}/`, { waitUntil: "load" });
    await page.click(".nav-search-trigger");
    await page.locator(".search-modal-status").waitFor({ state: "visible", timeout: 5000 });
    await page.waitForFunction(() => /搜索索引已就绪|Search index ready/.test(
      document.querySelector(".search-modal-status")?.textContent || "",
    ), null, { timeout: 5000 });
    await page.fill(".search-modal-input", "BPMN");
    const sectionResult = page.locator(".search-modal-results li", {
      has: page.locator(".search-result-section"),
    }).first();
    await sectionResult.waitFor({ state: "visible", timeout: 5000 });
    const kind = await sectionResult.locator(".search-result-kind").innerText();
    if (!/章节|Section/.test(kind)) {
      throw new Error(`Search section result kind is unexpected: ${kind}`);
    }
    const reason = await sectionResult.locator(".search-result-reason").innerText();
    if (!/命中|Matched/.test(reason)) {
      throw new Error(`Search section result reason is missing: ${reason}`);
    }
    const path = await sectionResult.locator(".search-result-meta").innerText();
    if (!/\/post\/.+#toc-/.test(path)) {
      throw new Error(`Search section result does not expose a heading anchor: ${path}`);
    }
    await sectionResult.click();
    await page.waitForURL(/\/post\/.+#toc-/, { timeout: SEARCH_NAVIGATION_TIMEOUT_MS });

    await page.goto(`${baseUrl}/`, { waitUntil: "load" });
    await page.click(".nav-search-trigger");
    await page.fill(".search-modal-input", "Cron");
    const toolResult = page.locator(".search-modal-results li")
      .filter({ hasText: "/tools/#tool-tab-cron" })
      .first();
    await toolResult.waitFor({ state: "visible", timeout: 5000 });
    const toolKind = await toolResult.locator(".search-result-kind").innerText();
    if (!/章节|Section/.test(toolKind)) {
      throw new Error(`Search page section result kind is unexpected: ${toolKind}`);
    }
    const toolReason = await toolResult.locator(".search-result-reason").innerText();
    if (!/章节|section|标签|tags|正文|body/.test(toolReason)) {
      throw new Error(`Search page section result reason is unexpected: ${toolReason}`);
    }
    await toolResult.click();
    await page.waitForURL(/\/tools\/#tool-tab-cron$/, { timeout: SEARCH_NAVIGATION_TIMEOUT_MS });
    await page.locator('[data-tool-panel="cron"].active').waitFor({ state: "visible", timeout: 5000 }).catch((error) => {
      throw new Error(`Tool hash search did not activate Cron: ${error.message}`);
    });

    await assertNoHorizontalOverflow(page, label);
    if (errors.length > 0) {
      throw new Error(`search interaction runtime errors:\n${errors.join("\n")}`);
    }
    console.log("✓ search interactions");
  } catch (error) {
    await saveFailureArtifact(page, label, { error, runtimeErrors: errors });
    throw error;
  } finally {
    await page.close();
  }
}

async function main() {
  const { chromium } = await loadPlaywright();
  const { server, port } = await startServer();
  const baseUrl = `http://${HOST}:${port}`;
  let browser;

  try {
    browser = await launchChromium(chromium);
    for (const viewport of VIEWPORTS) {
      for (const route of viewport.routes) {
        await smokeRoute(browser, baseUrl, viewport, route);
      }
    }
    await smokeToolInteractions(browser, baseUrl);
    await smokePostListSearchInteractions(browser, baseUrl);
    await smokeRelatedPostReasons(browser, baseUrl);
    await smokeSearchInteractions(browser, baseUrl);
    console.log(`Browser smoke (${SMOKE_SCOPE}) passed.`);
  } finally {
    if (browser) {
      await browser.close();
    }
    await new Promise((resolveClose, rejectClose) => {
      server.close((error) => (error ? rejectClose(error) : resolveClose()));
    });
  }
}

main().catch((error) => {
  console.error(`Browser smoke failed: ${error.message}`);
  process.exit(1);
});
