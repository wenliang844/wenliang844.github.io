import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import assert from "node:assert/strict";

const ROOT = join(import.meta.dirname, "..");
const execFileAsync = promisify(execFile);

function targetForHref(href) {
  if (!href.startsWith("/") || href.startsWith("//")) {
    return null;
  }

  const path = href.split(/[?#]/)[0];
  if (!path || path === "/") {
    return "index.html";
  }
  if (path.endsWith("/")) {
    return join(path.slice(1), "index.html");
  }
  return path.slice(1);
}

async function exists(relPath) {
  try {
    await access(join(ROOT, relPath));
    return true;
  } catch {
    return false;
  }
}

async function htmlFiles() {
  const { stdout } = await execFileAsync("git", ["ls-files", "*.html"], {
    cwd: ROOT,
    windowsHide: true,
  });
  return stdout.trim().split(/\r?\n/).filter(Boolean);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function scriptSources(html) {
  return Array.from(html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g), (match) => match[1]);
}

test("committed HTML files do not contain broken root-relative links", async () => {
  const broken = [];

  for (const file of await htmlFiles()) {
    const html = await readFile(join(ROOT, file), "utf8");
    for (const match of html.matchAll(/\bhref="([^"]+)"/g)) {
      const target = targetForHref(match[1]);
      if (target && !(await exists(target))) {
        broken.push(`${file}: ${match[1]} -> ${target}`);
      }
    }
  }

  assert.deepEqual(broken, []);
});

test("HTML files load common scripts in a consistent order", async () => {
  const requiredCoreScripts = [
    "/js/error-handler.js",
    "/js/utils.js",
    "/js/i18n.js",
    "/js/coder.js",
    "/js/search-loader.js",
    "/js/subscribe.js",
    "/js/assistant-loader.js",
  ];
  const failures = [];

  for (const file of await htmlFiles()) {
    const html = await readFile(join(ROOT, file), "utf8");
    const commonScripts = scriptSources(html).filter((src) => requiredCoreScripts.includes(src));
    const missing = requiredCoreScripts.filter((src) => !commonScripts.includes(src));
    if (missing.length) {
      failures.push(`${file}: missing ${missing.join(", ")}`);
    } else if (commonScripts.join("\n") !== requiredCoreScripts.join("\n")) {
      failures.push(`${file}: common script order drifted (${commonScripts.join(" -> ")})`);
    }
    if (html.includes('class="navigation-list"') && !html.includes('class="nav-search-trigger"')) {
      failures.push(`${file}: missing global search trigger`);
    }
  }

  assert.deepEqual(failures, []);
});

test("links opened in new tabs include noopener", async () => {
  const failures = [];

  for (const file of await htmlFiles()) {
    const html = await readFile(join(ROOT, file), "utf8");
    for (const match of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) {
      const tag = match[0];
      if (!/\brel="[^"]*\bnoopener\b[^"]*"/.test(tag)) {
        failures.push(`${file}: ${tag}`);
      }
    }
  }

  assert.deepEqual(failures, []);
});

test("HTML files lazy-load the search bundle through search-loader", async () => {
  const failures = [];

  for (const file of await htmlFiles()) {
    const html = await readFile(join(ROOT, file), "utf8");
    if (!html.includes('src="/js/search-loader.js"')) {
      continue;
    }
    if (html.includes('src="/js/vendor/fuse.min.js"')) {
      failures.push(`${file}: eagerly loads fuse.min.js`);
    }
    if (html.includes('src="/js/search.js"')) {
      failures.push(`${file}: eagerly loads search.js`);
    }
  }

  assert.deepEqual(failures, []);
});

test("root-relative anchor links point to existing targets", async () => {
  const failures = [];
  const cache = new Map();

  for (const file of await htmlFiles()) {
    const html = await readFile(join(ROOT, file), "utf8");
    for (const match of html.matchAll(/\bhref="([^"]*#[^"]+)"/g)) {
      const href = match[1];
      if (!href.startsWith("/") || href.startsWith("//")) {
        continue;
      }

      const hash = href.slice(href.indexOf("#") + 1);
      if (!hash) {
        continue;
      }

      const target = targetForHref(href);
      if (!target || !(await exists(target))) {
        continue;
      }

      let targetHtml = cache.get(target);
      if (!targetHtml) {
        targetHtml = await readFile(join(ROOT, target), "utf8");
        cache.set(target, targetHtml);
      }

      const anchor = decodeURIComponent(hash);
      const pattern = new RegExp(`\\b(?:id|name)="${escapeRegExp(anchor)}"`);
      if (!pattern.test(targetHtml)) {
        failures.push(`${file}: ${href} -> ${target}#${anchor}`);
      }
    }
  }

  assert.deepEqual(failures, []);
});
