#!/usr/bin/env node

import { readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { transform } from "esbuild";
import { PurgeCSS } from "purgecss";
import { STATIC_PAGES } from "../src/config.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "css", "coder.css");
const CORE_SCRIPTS = [
  "js/error-handler.js",
  "js/utils.js",
  "js/pwa.js",
  "js/analytics.js",
  "js/i18n.js",
  "src/client/site-runtime.ts",
  "js/search-loader.js",
  "js/subscribe.js",
  "js/assistant-loader.js",
  "js/assistant.js",
];
const POST_SCRIPTS = [
  "src/client/post-list.ts",
  "src/client/post-extras.ts",
  "src/client/article-runtime.ts",
  "src/client/article-reading.ts",
  "src/client/article-enhancements.ts",
  "src/client/code-highlight.ts",
  "src/client/next-post.ts",
  "src/client/article-toc.ts",
  "src/client/share.ts",
  "src/client/giscus.ts",
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

async function listHtmlFiles(directory, root = ROOT) {
  const files = [];
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && entry.name.endsWith(".html")) files.push(path);
    }
  }
  await visit(join(root, directory));
  return files;
}

async function contentEntries(paths, extension) {
  return Promise.all(paths.map(async (path) => ({
    raw: await readFile(resolve(ROOT, path), "utf8"),
    extension: extension || extname(path).slice(1),
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
    ...(await contentEntries(scriptPaths)),
  ];
  const [result] = await new PurgeCSS().purge({
    content,
    css: [{ raw: source }],
    keyframes: true,
    safelist: { standard: DYNAMIC_STATES },
  });
  return writeMinified(name, result.css);
}

export async function versionStylesheets(root = ROOT) {
  const files = (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".html") && entry.name !== "offline.html")
    .map((entry) => join(root, entry.name));
  for (const { path } of STATIC_PAGES) {
    if (path === "/") continue;
    try {
      files.push(...await listHtmlFiles(path.slice(1), root));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  const versions = new Map();
  let updated = 0;
  for (const path of files) {
    const html = await readFile(path, "utf8");
    const links = [...html.matchAll(/<link\b[^>]*>/gi)]
      .filter(([tag]) => /\brel\s*=\s*["']stylesheet["']/i.test(tag));
    let output = html;
    for (const [tag] of links) {
      const href = tag.match(/(\bhref\s*=\s*)(["'])(\/css\/[\w.-]+\.css)(?:[?#][^"'<>]*)?\2/i);
      if (!href) continue;
      const asset = href[3];
      if (!versions.has(asset)) {
        const css = await readFile(join(root, asset.slice(1)));
        versions.set(asset, createHash("sha256").update(css).digest("hex").slice(0, 12));
      }
      const versioned = `${href[1]}${href[2]}${asset}?v=${versions.get(asset)}${href[2]}`;
      output = output.replace(tag, tag.replace(href[0], versioned));
    }
    if (output !== html) {
      await writeFile(path, output, "utf8");
      updated += 1;
    }
  }
  return updated;
}

export async function buildStyles() {
  const source = await readFile(SOURCE, "utf8");
  const postHtml = (await listHtmlFiles("post")).map((path) => relative(ROOT, path));
  const outputs = await Promise.all([
    writeMinified("coder.min.css", source),
    writeMinified("content.min.css", await readFile(join(ROOT, "css", "content.css"), "utf8")),
    writePageStyles("coder-home.min.css", ["index.html"], [...CORE_SCRIPTS, "js/honor-gallery.js", "scripts/build-honor-gallery.mjs"], source),
    writePageStyles("coder-post.min.css", postHtml, [...CORE_SCRIPTS, ...POST_SCRIPTS], source),
  ]);
  await versionStylesheets();
  return outputs;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outputs = await buildStyles();
  console.log(`Optimized CSS: ${outputs.map(({ name, bytes }) => `${name} ${(bytes / 1024).toFixed(1)} KiB`).join(", ")}`);
}
