// Phase 10: 性能与资源测试
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = join(import.meta.dirname, "..");

async function htmlFiles() {
  const { stdout } = await execFileAsync("git", ["ls-files", "*.html"], { cwd: ROOT, windowsHide: true });
  return stdout.trim().split(/\r?\n/).filter(Boolean);
}

// ─── HTML 文件大小检查 ─────────────────────────────────────────────────────────

test("HTML files are reasonably sized (under 200KB each)", async () => {
  const files = await htmlFiles();
  const oversized = [];

  for (const file of files) {
    const fileStat = await stat(join(ROOT, file));
    const sizeKB = fileStat.size / 1024;
    if (sizeKB > 200) {
      oversized.push(`${file}: ${sizeKB.toFixed(1)}KB`);
    }
  }

  assert.deepEqual(oversized, [], "HTML files exceeding 200KB");
});

// ─── JS 文件大小检查 ──────────────────────────────────────────────────────────

test("non-vendor JS files are reasonably sized (under 60KB each)", async () => {
  const jsDir = join(ROOT, "js");
  const files = (await readdir(jsDir)).filter(f => f.endsWith(".js") && !f.includes("vendor"));
  const oversized = [];

  for (const file of files) {
    const fileStat = await stat(join(jsDir, file));
    const sizeKB = fileStat.size / 1024;
    if (sizeKB > 60) {
      oversized.push(`js/${file}: ${sizeKB.toFixed(1)}KB`);
    }
  }

  assert.deepEqual(oversized, [], "Non-vendor JS files exceeding 60KB");
});

// ─── 资源引用完整性 ───────────────────────────────────────────────────────────

test("all referenced CSS files exist", async () => {
  const files = await htmlFiles();
  const missing = [];

  for (const file of files) {
    const html = await readFile(join(ROOT, file), "utf8");
    const cssRefs = html.matchAll(/href="([^"]+\.css)"/g);
    for (const match of cssRefs) {
      const cssPath = match[1].replace(/^\//, "");
      try {
        await stat(join(ROOT, cssPath));
      } catch {
        missing.push(`${file}: ${match[1]}`);
      }
    }
  }

  assert.deepEqual(missing, [], "Referenced CSS files not found");
});

test("all referenced JS files exist", async () => {
  const files = await htmlFiles();
  const missing = [];

  for (const file of files) {
    const html = await readFile(join(ROOT, file), "utf8");
    const jsRefs = html.matchAll(/src="([^"]+\.js)"/g);
    for (const match of jsRefs) {
      const jsPath = match[1].replace(/^\//, "");
      try {
        await stat(join(ROOT, jsPath));
      } catch {
        missing.push(`${file}: ${match[1]}`);
      }
    }
  }

  assert.deepEqual(missing, [], "Referenced JS files not found");
});

// ─── favicon 引用 ─────────────────────────────────────────────────────────────

test("all HTML files reference the favicon", async () => {
  const files = await htmlFiles();
  const missing = [];

  for (const file of files) {
    const html = await readFile(join(ROOT, file), "utf8");
    if (!html.includes('rel="icon"')) {
      missing.push(file);
    }
  }

  assert.deepEqual(missing, [], "HTML files missing favicon reference");
});

test("committed HTML files include third-party resource hints", async () => {
  const files = await htmlFiles();
  const hints = [
    '<link rel="preconnect" href="https://giscus.app">',
    '<link rel="dns-prefetch" href="https://giscus.app">',
    '<link rel="preconnect" href="https://buttondown.com">',
    '<link rel="dns-prefetch" href="https://buttondown.com">',
    '<link rel="dns-prefetch" href="https://www.ifdian.net">',
    '<link rel="dns-prefetch" href="https://paypal.me">',
  ];
  const missing = [];

  for (const file of files) {
    const html = await readFile(join(ROOT, file), "utf8");
    for (const hint of hints) {
      if (!html.includes(hint)) {
        missing.push(`${file}: ${hint}`);
      }
    }
  }

  assert.deepEqual(missing, [], "HTML files missing third-party resource hints");
});

test("favicon file exists", async () => {
  try {
    await stat(join(ROOT, "images", "favicon.png"));
    assert.ok(true, "favicon.png exists");
  } catch {
    assert.fail("favicon.png not found at images/favicon.png");
  }
});

// ─── 重复资源检查 ─────────────────────────────────────────────────────────────

test("no duplicate script references in HTML files", async () => {
  const files = await htmlFiles();
  const duplicates = [];

  for (const file of files) {
    const html = await readFile(join(ROOT, file), "utf8");
    const scripts = [...html.matchAll(/src="([^"]+\.js)"/g)].map(m => m[1]);
    const seen = new Set();
    for (const script of scripts) {
      if (seen.has(script)) {
        duplicates.push(`${file}: duplicate ${script}`);
      }
      seen.add(script);
    }
  }

  assert.deepEqual(duplicates, [], "Duplicate script references found");
});

// ─── 模板输出不包含多余空白 ───────────────────────────────────────────────────

test("committed HTML files do not contain excessive blank lines", async () => {
  const files = await htmlFiles();
  const excessive = [];

  for (const file of files) {
    const html = await readFile(join(ROOT, file), "utf8");
    // 检查连续 5 个以上空行
    if (/\n{6,}/.test(html)) {
      excessive.push(file);
    }
  }

  assert.deepEqual(excessive, [], "HTML files with excessive blank lines");
});

// ─── 搜索索引大小 ─────────────────────────────────────────────────────────────

test("search index JSON is valid and reasonably sized", async () => {
  const content = await readFile(join(ROOT, "search-index.json"), "utf8");
  const sizeKB = content.length / 1024;

  // 搜索索引应该在合理范围内（不超过 500KB）
  assert.ok(sizeKB < 500, `search-index.json is ${sizeKB.toFixed(1)}KB, exceeds 500KB`);

  // 验证是有效的 JSON
  const index = JSON.parse(content);
  assert.ok(Array.isArray(index), "should be an array");
  assert.ok(index.length > 0, "should not be empty");
});

// ─── sitemap.xml 大小 ─────────────────────────────────────────────────────────

test("sitemap.xml is valid and reasonably sized", async () => {
  const content = await readFile(join(ROOT, "sitemap.xml"), "utf8");
  const sizeKB = content.length / 1024;

  // sitemap 应该在合理范围内（不超过 100KB）
  assert.ok(sizeKB < 100, `sitemap.xml is ${sizeKB.toFixed(1)}KB, exceeds 100KB`);
  assert.match(content, /^<\?xml/);
});

// ─── RSS 文件大小 ─────────────────────────────────────────────────────────────

test("RSS feeds are valid and reasonably sized", async () => {
  const feeds = ["index.xml", "post/index.xml", "categories/index.xml"];
  for (const feed of feeds) {
    const content = await readFile(join(ROOT, feed), "utf8");
    const sizeKB = content.length / 1024;
    assert.ok(sizeKB < 100, `${feed} is ${sizeKB.toFixed(1)}KB, exceeds 100KB`);
    assert.match(content, /^<\?xml/);
    assert.match(content, /<rss version="2.0"/);
  }
});

// ─── CSS 文件大小 ─────────────────────────────────────────────────────────────

test("coder.css is reasonably sized (under 130KB)", async () => {
  const fileStat = await stat(join(ROOT, "css", "coder.css"));
  const sizeKB = fileStat.size / 1024;
  assert.ok(sizeKB <= 130, `coder.css is ${sizeKB.toFixed(1)}KB, exceeds 130KB`);
});

// ─── Vendor 脚本存在性 ────────────────────────────────────────────────────────

test("all vendor scripts exist", async () => {
  const vendorScripts = [
    "js/vendor/marked.min.js",
    "js/vendor/purify.min.js",
    "js/vendor/highlight.min.js",
    "js/vendor/qrcode.min.js",
    "js/vendor/fuse.min.js",
  ];
  const missing = [];

  for (const script of vendorScripts) {
    try {
      await stat(join(ROOT, script));
    } catch {
      missing.push(script);
    }
  }

  assert.deepEqual(missing, [], "Missing vendor scripts");
});
