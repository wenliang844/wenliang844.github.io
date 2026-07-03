#!/usr/bin/env node

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const HOST = "127.0.0.1";
const ROUTES = ["/", "/tools/", "/ai/", "/post/", "/contact/"];
const VIEWPORTS = [
  { name: "desktop", width: 1366, height: 768, routes: ROUTES },
  { name: "mobile", width: 390, height: 844, routes: ["/", "/tools/", "/post/"] },
];
const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".xml", "application/xml; charset=utf-8"],
]);

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
    if (isSameOrigin(request.url(), localOrigin)) {
      errors.push(`requestfailed: ${request.url()} ${request.failure()?.errorText || ""}`.trim());
    }
  });
  return errors;
}

async function assertVisible(locator, label) {
  await locator.waitFor({ state: "visible", timeout: 5000 }).catch((error) => {
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
    await assertNoHorizontalOverflow(page, label);
    if (errors.length > 0) {
      throw new Error(`${label} runtime errors:\n${errors.join("\n")}`);
    }
    console.log(`✓ ${label}`);
  } finally {
    await page.close();
  }
}

async function smokeToolInteractions(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = collectRuntimeErrors(page, new URL(baseUrl).origin);
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

    await assertNoHorizontalOverflow(page, "desktop /tools/ interactions");
    if (errors.length > 0) {
      throw new Error(`/tools/ interaction runtime errors:\n${errors.join("\n")}`);
    }
    console.log("✓ /tools/ interactions");
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
    console.log("Browser smoke passed.");
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
