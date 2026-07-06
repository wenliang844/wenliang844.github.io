#!/usr/bin/env node

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const HOST = "127.0.0.1";
let serviceWorkerBodyOverride = null;
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
  if (url.pathname === "/service-worker.js" && serviceWorkerBodyOverride) {
    const body = Buffer.from(serviceWorkerBodyOverride);
    res.writeHead(200, {
      "cache-control": "no-store",
      "content-length": body.length,
      "content-type": "text/javascript; charset=utf-8",
    });
    res.end(req.method === "HEAD" ? null : body);
    return;
  }

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
      `Playwright is required for PWA smoke. Run through npm script or install playwright. ${error.message}`,
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
        // Keep the original Playwright error for clearer CI diagnostics.
      }
    }
    throw error;
  }
}

async function waitForServiceWorker(page) {
  await page.waitForFunction(() => navigator.serviceWorker?.ready, null, { timeout: 10000 });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), null, { timeout: 10000 });
}

async function expectVisibleText(page, selector, pattern, label) {
  const text = await page.locator(selector).innerText({ timeout: 5000 });
  if (!pattern.test(text)) {
    throw new Error(`${label} did not match ${pattern}: ${text}`);
  }
}

function serviceWorkerUpgradeBody(body) {
  const match = body.match(/var VERSION = "([^"]+)";/);
  if (!match) {
    throw new Error("service-worker.js is missing a VERSION declaration");
  }
  return {
    previousVersion: match[1],
    nextVersion: `${match[1]}-smoke-upgrade`,
    body: body.replace(match[0], `var VERSION = "${match[1]}-smoke-upgrade";`),
  };
}

async function pwaCacheKeys(page) {
  return page.evaluate(() => caches.keys());
}

function wait(ms) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

async function waitForCacheUpgrade(page, oldKeys, newKeys) {
  const deadline = Date.now() + 10000;
  let keys = [];
  do {
    keys = await pwaCacheKeys(page);
    const oldGone = oldKeys.every((key) => !keys.includes(key));
    const newPresent = newKeys.every((key) => keys.includes(key));
    if (oldGone && newPresent) {
      return keys;
    }
    await wait(250);
  } while (Date.now() < deadline);
  return keys;
}

async function smokeServiceWorkerUpgrade(page) {
  const originalBody = await readFile(resolve(ROOT, "service-worker.js"), "utf8");
  const upgrade = serviceWorkerUpgradeBody(originalBody);
  const oldKeys = await pwaCacheKeys(page);
  if (!oldKeys.includes(`cwlblog-precache-${upgrade.previousVersion}`)) {
    throw new Error(`current precache was not created before upgrade: ${oldKeys.join(", ")}`);
  }

  serviceWorkerBodyOverride = upgrade.body;
  await page.evaluate(() => new Promise((resolveUpgrade, rejectUpgrade) => {
    const timeout = setTimeout(() => rejectUpgrade(new Error("service worker upgrade timed out")), 10000);
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      clearTimeout(timeout);
      resolveUpgrade();
    }, { once: true });
    navigator.serviceWorker.getRegistration()
      .then((registration) => {
        if (!registration) {
          throw new Error("service worker registration missing");
        }
        return registration.update();
      })
      .catch((error) => {
        clearTimeout(timeout);
        rejectUpgrade(error);
      });
  }));
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), null, { timeout: 10000 });
  await page.evaluate(() =>
    fetch(`/?upgrade-cache-probe=${Date.now()}`).then((response) => {
      if (!response.ok) {
        throw new Error(`upgrade cache probe failed with ${response.status}`);
      }
    })
  );

  const expectedOldKeys = [
    `cwlblog-precache-${upgrade.previousVersion}`,
    `cwlblog-runtime-${upgrade.previousVersion}`,
  ];
  const expectedNewKeys = [
    `cwlblog-precache-${upgrade.nextVersion}`,
    `cwlblog-runtime-${upgrade.nextVersion}`,
  ];
  const upgradedKeys = await waitForCacheUpgrade(page, expectedOldKeys, expectedNewKeys);
  const oldCwlKeys = expectedOldKeys.filter((key) => upgradedKeys.includes(key));
  const missingNewKeys = expectedNewKeys.filter((key) => !upgradedKeys.includes(key));
  if (oldCwlKeys.length > 0 || missingNewKeys.length > 0) {
    throw new Error(
      `service worker cache upgrade mismatch: old=${oldCwlKeys.join(", ") || "none"} missing=${missingNewKeys.join(", ") || "none"}`,
    );
  }
}

async function main() {
  const { chromium } = await loadPlaywright();
  const { server, port } = await startServer();
  const baseUrl = `http://${HOST}:${port}`;
  let browser;

  try {
    browser = await launchChromium(chromium);
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();

    await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
    await waitForServiceWorker(page);
    console.log("✓ service worker registered and controls the page");

    await context.setOffline(true);
    const uncachedSearchResult = await page.evaluate(() =>
      fetch(`/search-index.json?offline-probe=${Date.now()}`)
        .then(() => "resolved")
        .catch(() => "rejected")
    );
    if (uncachedSearchResult !== "rejected") {
      throw new Error(`uncached search index should reject while offline, got ${uncachedSearchResult}`);
    }
    console.log("✓ uncached search index is unavailable while offline");

    await context.setOffline(false);
    const onlineSearchResult = await page.evaluate(() =>
      fetch("/search-index.json")
        .then((response) => (response.ok ? "resolved" : `bad-status-${response.status}`))
        .catch(() => "rejected")
    );
    if (onlineSearchResult !== "resolved") {
      throw new Error(`online search index should load before offline cache check, got ${onlineSearchResult}`);
    }

    await context.setOffline(true);
    const cachedSearchResult = await page.evaluate(() =>
      fetch("/search-index.json")
        .then((response) => (response.ok ? "resolved" : `bad-status-${response.status}`))
        .catch(() => "rejected")
    );
    if (cachedSearchResult !== "resolved") {
      throw new Error(`cached search index should resolve while offline, got ${cachedSearchResult}`);
    }
    console.log("✓ cached search index is available offline");

    await context.setOffline(false);
    await page.goto(`${baseUrl}/post/`, { waitUntil: "networkidle" });
    await expectVisibleText(page, "main#main-content h1", /文章|Posts|Blog/, "online /post/");
    console.log("✓ /post/ cached after online visit");

    await page.goto(`${baseUrl}/post/manage-system/`, { waitUntil: "networkidle" });
    await expectVisibleText(page, "main#main-content h1", /智能分析预警平台|Intelligent Analysis/, "online article");
    await expectVisibleText(page, ".post-offline-status", /可离线阅读|available offline/, "online article offline status");
    await page.evaluate(() => window.cwlSetLang && window.cwlSetLang("en"));
    await expectVisibleText(page, ".post-offline-status", /available offline/, "online article offline status in English");
    console.log("✓ article offline status visible after online visit");

    await context.setOffline(true);
    await page.goto(`${baseUrl}/post/`, { waitUntil: "domcontentloaded" });
    await expectVisibleText(page, "main#main-content h1", /文章|Posts|Blog/, "offline cached /post/");
    console.log("✓ cached navigation works offline");

    await page.goto(`${baseUrl}/post/manage-system/`, { waitUntil: "domcontentloaded" });
    await expectVisibleText(page, "main#main-content h1", /智能分析预警平台|Intelligent Analysis/, "offline cached article");
    await expectVisibleText(page, ".post-offline-status", /离线阅读|Reading this article offline/, "offline article status");
    console.log("✓ cached article shows offline reading status");

    await page.goto(`${baseUrl}/not-cached-route/`, { waitUntil: "domcontentloaded" });
    await expectVisibleText(page, "main#main-content h1", /离线|Offline/, "offline fallback");
    console.log("✓ uncached navigation falls back to /offline.html");

    const relayResult = await page.evaluate(() =>
      fetch("/data/relay-providers.json")
        .then(() => "resolved")
        .catch(() => "rejected")
    );
    if (relayResult !== "rejected") {
      throw new Error(`network-only relay data should reject while offline, got ${relayResult}`);
    }
    console.log("✓ network-only relay data is not served from cache while offline");

    await context.setOffline(false);
    await smokeServiceWorkerUpgrade(page);
    console.log("✓ service worker upgrade clears old CWL caches");

    await context.close();
    console.log("PWA smoke passed.");
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
  console.error(`PWA smoke failed: ${error.message}`);
  process.exit(1);
});
