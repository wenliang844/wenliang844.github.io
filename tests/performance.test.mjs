// Phase 10: 性能与资源测试
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { gzipSync } from "node:zlib";

import { PAGE_ASSETS } from "../src/page-assets.mjs";

const execFileAsync = promisify(execFile);
const ROOT = join(import.meta.dirname, "..");

async function htmlFiles() {
  const { stdout } = await execFileAsync("git", ["ls-files", "*.html"], { cwd: ROOT, windowsHide: true });
  return stdout.trim().split(/\r?\n/).filter(Boolean);
}

async function trackedFiles() {
  const { stdout } = await execFileAsync("git", ["ls-files"], { cwd: ROOT, windowsHide: true });
  return new Set(stdout.trim().split(/\r?\n/).filter(Boolean));
}

function localAssetPath(ref) {
  if (/^(?:https?:)?\/\//i.test(ref) || ref.startsWith("data:")) {
    return "";
  }
  return ref.replace(/[?#].*$/, "").replace(/^\//, "");
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

test("non-vendor JS files are reasonably sized (under 90KB each)", async () => {
  const jsDir = join(ROOT, "js");
  const files = (await readdir(jsDir)).filter(f => f.endsWith(".js") && !f.includes("vendor"));
  const oversized = [];

  for (const file of files) {
    const fileStat = await stat(join(jsDir, file));
    const sizeKB = fileStat.size / 1024;
    if (sizeKB > 90) {
      oversized.push(`js/${file}: ${sizeKB.toFixed(1)}KB`);
    }
  }

  assert.deepEqual(oversized, [], "Non-vendor JS files exceeding 90KB");
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

test("referenced local CSS and JS files are tracked by git", async () => {
  const files = await htmlFiles();
  const tracked = await trackedFiles();
  const untracked = [];

  for (const file of files) {
    const html = await readFile(join(ROOT, file), "utf8");
    const refs = [
      ...html.matchAll(/href="([^"]+\.css(?:[?#][^"]*)?)"/g),
      ...html.matchAll(/src="([^"]+\.js(?:[?#][^"]*)?)"/g),
    ];

    for (const match of refs) {
      const assetPath = localAssetPath(match[1]);
      if (assetPath && !tracked.has(assetPath)) {
        untracked.push(`${file}: ${match[1]}`);
      }
    }
  }

  assert.deepEqual(untracked, [], "Referenced local CSS/JS files not tracked by git");
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

test("committed HTML files include low-cost third-party DNS resource hints", async () => {
  const files = await htmlFiles();
  const hints = [
    '<link rel="dns-prefetch" href="https://giscus.app">',
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

  assert.deepEqual(missing, [], "HTML files missing low-cost third-party DNS hints");
});

test("committed HTML files scope heavier third-party preconnect hints", async () => {
  const files = await htmlFiles();
  const violations = [];

  for (const file of files) {
    const html = await readFile(join(ROOT, file), "utf8");
    const hasGiscusPreconnect = html.includes('<link rel="preconnect" href="https://giscus.app">');
    const loadsGiscus = html.includes('src="/js/giscus.js"');
    const hasButtondownPreconnect = html.includes('<link rel="preconnect" href="https://buttondown.com">');

    if (hasGiscusPreconnect !== loadsGiscus) {
      violations.push(`${file}: giscus preconnect should match giscus script usage`);
    }
    if (hasButtondownPreconnect) {
      violations.push(`${file}: buttondown preconnect should be inserted only after user intent`);
    }
  }

  assert.deepEqual(violations, [], "HTML files with unscoped third-party preconnect hints");
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

test("coder.css is reasonably sized (under 140KB)", async () => {
  const fileStat = await stat(join(ROOT, "css", "coder.css"));
  const sizeKB = fileStat.size / 1024;
  assert.ok(sizeKB <= 140, `coder.css is ${sizeKB.toFixed(1)}KB, exceeds 140KB`);
});

function cssRefsFromHtml(html) {
  return [...html.matchAll(/href="([^"]+\.css)"/g)].map((match) => match[1]);
}

function routeAssetType(assetPath) {
  if (/\.css$/i.test(assetPath)) return "css";
  if (/\.js$/i.test(assetPath)) return "js";
  if (/\.(?:png|jpe?g|webp|avif|gif|svg)$/i.test(assetPath)) return "image";
  return "other";
}

function localRouteAssetRefs(html) {
  const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)]
    .map((match) => localAssetPath(match[1]))
    .filter((assetPath) => /\.(?:css|js|png|jpe?g|webp|avif|gif|svg)$/i.test(assetPath));
  return [...new Set(refs)];
}

async function routeBudget(htmlFile) {
  const html = await readFile(join(ROOT, htmlFile), "utf8");
  const htmlBytes = Buffer.from(html);
  const budget = {
    html: { rawBytes: htmlBytes.length, gzipBytes: gzipSync(htmlBytes).length },
    css: { rawBytes: 0, gzipBytes: 0 },
    js: { rawBytes: 0, gzipBytes: 0 },
    image: { rawBytes: 0, gzipBytes: 0 },
    other: { rawBytes: 0, gzipBytes: 0 },
    total: { rawBytes: htmlBytes.length, gzipBytes: gzipSync(htmlBytes).length },
    assets: localRouteAssetRefs(html),
  };

  for (const assetPath of budget.assets) {
    const asset = await readFile(join(ROOT, assetPath));
    const type = routeAssetType(assetPath);
    budget[type].rawBytes += asset.length;
    budget[type].gzipBytes += gzipSync(asset).length;
    budget.total.rawBytes += asset.length;
    budget.total.gzipBytes += gzipSync(asset).length;
  }

  return budget;
}

test("route CSS budgets reflect page-level stylesheet split", async () => {
  const routes = {
    "/": { html: "index.html", rawKb: 132, gzipKb: 24, styles: [] },
    "/tools/": { html: "tools/index.html", rawKb: 145, gzipKb: 26, styles: PAGE_ASSETS["/tools/"].styles },
    "/trust/": { html: "trust/index.html", rawKb: 132, gzipKb: 24, styles: PAGE_ASSETS["/trust/"].styles },
  };

  for (const [route, budget] of Object.entries(routes)) {
    const html = await readFile(join(ROOT, budget.html), "utf8");
    const refs = cssRefsFromHtml(html);
    const expectedRefs = ["/css/fontawesome-all.min.css", "/css/coder.css", ...budget.styles];
    assert.deepEqual(refs, expectedRefs, `${route} CSS references should match the page asset manifest`);

    let rawBytes = 0;
    let gzipBytes = 0;
    for (const href of refs) {
      const css = await readFile(join(ROOT, href.replace(/^\//, "")));
      rawBytes += css.length;
      gzipBytes += gzipSync(css).length;
    }

    const rawKb = rawBytes / 1024;
    const gzipKb = gzipBytes / 1024;
    assert.ok(rawKb <= budget.rawKb, `${route} CSS raw size is ${rawKb.toFixed(1)}KB, exceeds ${budget.rawKb}KB`);
    assert.ok(gzipKb <= budget.gzipKb, `${route} CSS gzip size is ${gzipKb.toFixed(1)}KB, exceeds ${budget.gzipKb}KB`);
  }
});

test("route asset budgets cover real HTML CSS JS and image references", async () => {
  const routes = {
    "/": {
      html: "index.html",
      totalRawKb: 270,
      totalGzipKb: 65,
      jsRawKb: 112,
      jsGzipKb: 34,
      maxAssets: 11,
    },
    "/post/rule-engine-alerts/": {
      html: "post/rule-engine-alerts/index.html",
      totalRawKb: 315,
      totalGzipKb: 82,
      jsRawKb: 150,
      jsGzipKb: 48,
      maxAssets: 16,
    },
    "/tools/": {
      html: "tools/index.html",
      totalRawKb: 690,
      totalGzipKb: 178,
      jsRawKb: 430,
      jsGzipKb: 132,
      maxAssets: 19,
    },
  };

  for (const [route, expected] of Object.entries(routes)) {
    const budget = await routeBudget(expected.html);
    const totalRawKb = budget.total.rawBytes / 1024;
    const totalGzipKb = budget.total.gzipBytes / 1024;
    const jsRawKb = budget.js.rawBytes / 1024;
    const jsGzipKb = budget.js.gzipBytes / 1024;

    assert.ok(budget.assets.length <= expected.maxAssets, `${route} references ${budget.assets.length} local assets, exceeds ${expected.maxAssets}`);
    assert.ok(totalRawKb <= expected.totalRawKb, `${route} route raw size is ${totalRawKb.toFixed(1)}KB, exceeds ${expected.totalRawKb}KB`);
    assert.ok(totalGzipKb <= expected.totalGzipKb, `${route} route gzip size is ${totalGzipKb.toFixed(1)}KB, exceeds ${expected.totalGzipKb}KB`);
    assert.ok(jsRawKb <= expected.jsRawKb, `${route} JS raw size is ${jsRawKb.toFixed(1)}KB, exceeds ${expected.jsRawKb}KB`);
    assert.ok(jsGzipKb <= expected.jsGzipKb, `${route} JS gzip size is ${jsGzipKb.toFixed(1)}KB, exceeds ${expected.jsGzipKb}KB`);
  }
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
