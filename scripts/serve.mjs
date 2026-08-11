import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, isAbsolute, join, relative, resolve } from "node:path";
import { constants as zlibConstants, createBrotliCompress, createGzip } from "node:zlib";

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
const COMPRESSIBLE = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".svg",
  ".webmanifest",
  ".xml",
]);
const BROTLI_OPTIONS = {
  params: {
    [zlibConstants.BROTLI_PARAM_QUALITY]: 4,
  },
};

function acceptedEncoding(request, extension) {
  if (!COMPRESSIBLE.has(extension)) {
    return "";
  }
  const values = String(request.headers["accept-encoding"] || "")
    .split(",")
    .map(function (part) {
      const [name, ...parameters] = part.trim().toLowerCase().split(";");
      const quality = parameters.find((parameter) => parameter.trim().startsWith("q="));
      const parsed = quality ? Number.parseFloat(quality.split("=")[1]) : 1;
      return { name, quality: Number.isFinite(parsed) ? parsed : 0 };
    });
  const qualityFor = (name) => values.find((value) => value.name === name)?.quality || 0;
  const brotliQuality = qualityFor("br");
  const gzipQuality = qualityFor("gzip");
  if (brotliQuality <= 0 && gzipQuality <= 0) {
    return "";
  }
  return brotliQuality >= gzipQuality ? "br" : "gzip";
}

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
  const extension = extname(file).toLowerCase();
  const encoding = acceptedEncoding(request, extension);
  const headers = {
    "Cache-Control": extension === ".html" ? "no-cache" : "public, max-age=3600",
    "Content-Type": MIME[extension] || "application/octet-stream",
  };
  if (COMPRESSIBLE.has(extension)) {
    headers.Vary = "Accept-Encoding";
  }
  if (encoding) {
    headers["Content-Encoding"] = encoding;
  }
  response.writeHead(200, headers);
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  const stream = createReadStream(file);
  if (encoding === "br") {
    stream.pipe(createBrotliCompress(BROTLI_OPTIONS)).pipe(response);
  } else if (encoding === "gzip") {
    stream.pipe(createGzip()).pipe(response);
  } else {
    stream.pipe(response);
  }
});

server.listen(port, host, function () {
  console.log(`CWLBlog preview: http://${host}:${port}/`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, function () {
    server.close(function () { process.exit(0); });
  });
}
