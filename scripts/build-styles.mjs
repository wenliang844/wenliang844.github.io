#!/usr/bin/env node

import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { transform } from "esbuild";
import { PurgeCSS } from "purgecss";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "css", "coder.css");
const CORE_SCRIPTS = [
  "js/error-handler.js",
  "js/utils.js",
  "js/pwa.js",
  "js/analytics.js",
  "js/i18n.js",
  "js/coder.js",
  "js/search-loader.js",
  "js/subscribe.js",
  "js/assistant-loader.js",
];
const POST_SCRIPTS = [
  "js/blog.js",
  "js/post-extras-loader.js",
  "js/toc.js",
  "js/post-next.js",
  "js/share.js",
  "js/giscus.js",
  "js/highlight-loader.js",
];
const DYNAMIC_STATES = [
  "active",
  "copied",
  "error",
  "fullscreen",
  "has-nav-trigger",
  "is-collapsed",
  "is-invalid",
  "is-loading",
  "is-open",
  "open",
  "success",
  "to-top-ready",
  "visible",
];

async function listHtmlFiles(directory) {
  const files = [];
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && entry.name.endsWith(".html")) files.push(path);
    }
  }
  await visit(join(ROOT, directory));
  return files;
}

async function contentEntries(paths, extension) {
  return Promise.all(paths.map(async (path) => ({
    raw: await readFile(resolve(ROOT, path), "utf8"),
    extension,
  })));
}

async function minify(css) {
  const result = await transform(css, { loader: "css", minify: true });
  return result.code;
}

async function writeMinified(name, css) {
  const output = join(ROOT, "css", name);
  const code = await minify(css);
  await writeFile(output, code, "utf8");
  return { name, bytes: Buffer.byteLength(code) };
}

async function writePageStyles(name, htmlPaths, scriptPaths, source) {
  const content = [
    ...(await contentEntries(htmlPaths, "html")),
    ...(await contentEntries(scriptPaths, "js")),
  ];
  const [result] = await new PurgeCSS().purge({
    content,
    css: [{ raw: source }],
    keyframes: true,
    safelist: { standard: DYNAMIC_STATES },
  });
  return writeMinified(name, result.css);
}

export async function buildStyles() {
  const source = await readFile(SOURCE, "utf8");
  const postHtml = (await listHtmlFiles("post")).map((path) => relative(ROOT, path));
  const outputs = await Promise.all([
    writeMinified("coder.min.css", source),
    writeMinified("content.min.css", await readFile(join(ROOT, "css", "content.css"), "utf8")),
    writePageStyles("coder-home.min.css", ["index.html"], CORE_SCRIPTS, source),
    writePageStyles("coder-post.min.css", postHtml, [...CORE_SCRIPTS, ...POST_SCRIPTS], source),
  ]);
  return outputs;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outputs = await buildStyles();
  console.log(`Optimized CSS: ${outputs.map(({ name, bytes }) => `${name} ${(bytes / 1024).toFixed(1)} KiB`).join(", ")}`);
}
