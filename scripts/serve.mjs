import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, isAbsolute, join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const portIndex = process.argv.indexOf("--port");
const port = Number.parseInt(portIndex >= 0 ? process.argv[portIndex + 1] : process.env.PORT || "8137", 10);
const host = process.env.HOST || "127.0.0.1";
const MIME = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".webp": "image/webp",
  ".xml": "application/xml; charset=utf-8",
};

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("--port must be an integer between 1 and 65535.");
}

async function resolveRequestPath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl || "/", `http://${host}:${port}`).pathname);
  const candidate = resolve(ROOT, `.${pathname.endsWith("/") ? `${pathname}index.html` : pathname}`);
  const rel = relative(ROOT, candidate);
  if (!rel || rel.startsWith("..") || isAbsolute(rel) || rel.split(/[\\/]/).some((part) => part.startsWith("."))) {
    return null;
  }
  try {
    const info = await stat(candidate);
    if (info.isDirectory()) {
      const indexPath = join(candidate, "index.html");
      await access(indexPath);
      return indexPath;
    }
    return info.isFile() ? candidate : null;
  } catch {
    return null;
  }
}

const server = createServer(async function (request, response) {
  const file = await resolveRequestPath(request.url);
  if (!file) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type": MIME[extname(file).toLowerCase()] || "application/octet-stream",
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  createReadStream(file).pipe(response);
});

server.listen(port, host, function () {
  console.log(`CWLBlog preview: http://${host}:${port}/`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, function () {
    server.close(function () { process.exit(0); });
  });
}
