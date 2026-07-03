#!/usr/bin/env node

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const HOST = "127.0.0.1";
const ROUTES = ["/", "/tools/", "/ai/", "/post/", "/contact/"];
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

async function main() {
  const { server, port } = await startServer();
  const baseUrl = `http://${HOST}:${port}`;
  try {
    for (const route of ROUTES) {
      await smokeRoute(baseUrl, route);
    }
    console.log(`HTTP smoke passed for ${ROUTES.length} route(s).`);
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
