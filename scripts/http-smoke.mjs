#!/usr/bin/env node

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ERROR_SMOKE_ROUTES, FULL_SMOKE_ROUTES, SMOKE_ROUTES } from "../src/config.mjs";

const DEFAULT_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const ROOT = resolveSmokeRoot();
const HOST = "127.0.0.1";
const SMOKE_SCOPE = resolveSmokeScope();
const ROUTES = routesForScope(SMOKE_SCOPE);
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

function resolveSmokeRoot() {
  const rootIdx = process.argv.indexOf("--root");
  if (rootIdx !== -1) {
    const rootArg = process.argv[rootIdx + 1];
    if (!rootArg || rootArg.startsWith("--")) {
      throw new Error("Missing --root <dir> argument.");
    }
    return resolve(process.cwd(), rootArg);
  }

  if (process.env.SMOKE_ROOT) {
    return resolve(process.cwd(), process.env.SMOKE_ROOT);
  }

  return DEFAULT_ROOT;
}

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

function extractLocalScriptSources(html) {
  const sources = [];
  const scriptPattern = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  for (const match of html.matchAll(scriptPattern)) {
    const src = match[1];
    if (src.startsWith("/")) {
      sources.push(src);
    }
  }
  return [...new Set(sources)];
}

async function assertOk(response, label) {
  if (!response.ok) {
    throw new Error(`${label} returned HTTP ${response.status}`);
  }
}

async function smokeRoute(baseUrl, route) {
  const response = await fetch(`${baseUrl}${route}`);
  await assertOk(response, route);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    throw new Error(`${route} returned unexpected content-type: ${contentType || "(missing)"}`);
  }

  const html = await response.text();
  if (!/<main\b[^>]*\bid=["']main-content["']/i.test(html)) {
    throw new Error(`${route} is missing main#main-content`);
  }
  if (!/<h1\b/i.test(html)) {
    throw new Error(`${route} is missing an h1`);
  }
  if (!html.includes('rel="manifest" href="/manifest.webmanifest"')) {
    throw new Error(`${route} is missing the web app manifest link`);
  }
  if (!html.includes('name="theme-color" content="#0f172a"')) {
    throw new Error(`${route} is missing theme-color meta`);
  }
  if (ERROR_SMOKE_ROUTES.includes(route)) {
    if (!/<meta\b[^>]*\bname=["']robots["'][^>]*\bcontent=["']noindex,follow["']/i.test(html)) {
      throw new Error(`${route} is missing noindex,follow robots meta`);
    }
    for (const token of ['class="nav-search-trigger"', 'class="subscribe-form"', 'src="/js/assistant-loader.js"']) {
      if (!html.includes(token)) {
        throw new Error(`${route} is missing recovery surface token: ${token}`);
      }
    }
  }

  const scripts = extractLocalScriptSources(html);
  if (scripts.length === 0) {
    throw new Error(`${route} has no local runtime scripts`);
  }

  await Promise.all(scripts.map(async (src) => {
    const scriptResponse = await fetch(`${baseUrl}${src}`, { method: "HEAD" });
    await assertOk(scriptResponse, `${route} script ${src}`);
  }));

  console.log(`✓ ${route} reachable (${scripts.length} script refs)`);
}

async function smokeManifest(baseUrl) {
  const response = await fetch(`${baseUrl}/manifest.webmanifest`);
  await assertOk(response, "/manifest.webmanifest");
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/manifest+json")) {
    throw new Error(`/manifest.webmanifest returned unexpected content-type: ${contentType || "(missing)"}`);
  }

  const manifest = await response.json();
  for (const key of ["name", "short_name", "start_url", "scope", "display", "theme_color", "icons"]) {
    if (!(key in manifest)) {
      throw new Error(`/manifest.webmanifest is missing ${key}`);
    }
  }
  if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
    throw new Error("/manifest.webmanifest has no icons");
  }

  await Promise.all(manifest.icons.map(async (icon) => {
    if (!icon.src?.startsWith("/")) {
      throw new Error(`/manifest.webmanifest icon must use a root-relative src: ${icon.src || "(missing)"}`);
    }
    const iconResponse = await fetch(`${baseUrl}${icon.src}`, { method: "HEAD" });
    await assertOk(iconResponse, `/manifest.webmanifest icon ${icon.src}`);
  }));

  console.log("✓ /manifest.webmanifest reachable");
}

async function smokePwaArtifacts(baseUrl) {
  const offlineResponse = await fetch(`${baseUrl}/offline.html`);
  await assertOk(offlineResponse, "/offline.html");
  const offlineHtml = await offlineResponse.text();
  if (!/<main\b[^>]*\bid=["']main-content["']/i.test(offlineHtml) || !/<h1\b/i.test(offlineHtml)) {
    throw new Error("/offline.html is missing the fallback document structure");
  }
  if (!/<meta\b[^>]*\bname=["']robots["'][^>]*\bcontent=["']noindex,follow["']/i.test(offlineHtml)) {
    throw new Error("/offline.html should be noindex,follow");
  }

  const serviceWorkerResponse = await fetch(`${baseUrl}/service-worker.js`, { method: "HEAD" });
  await assertOk(serviceWorkerResponse, "/service-worker.js");

  const registerResponse = await fetch(`${baseUrl}/js/pwa-register.js`, { method: "HEAD" });
  await assertOk(registerResponse, "/js/pwa-register.js");

  console.log("✓ PWA offline and service worker artifacts reachable");
}

async function main() {
  const { server, port } = await startServer();
  const baseUrl = `http://${HOST}:${port}`;
  try {
    await smokeManifest(baseUrl);
    await smokePwaArtifacts(baseUrl);
    for (const route of ROUTES) {
      await smokeRoute(baseUrl, route);
    }
    console.log(`HTTP smoke (${SMOKE_SCOPE}) passed for ${ROUTES.length} route(s).`);
  } finally {
    await new Promise((resolveClose, rejectClose) => {
      server.close((error) => (error ? rejectClose(error) : resolveClose()));
    });
  }
}

main().catch((error) => {
  console.error(`HTTP smoke failed: ${error.message}`);
  process.exit(1);
});
