// Phase 5: 安全性测试
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = join(import.meta.dirname, "..");

async function htmlFiles() {
  const { stdout } = await execFileAsync("git", ["ls-files", "*.html"], { cwd: ROOT, windowsHide: true });
  return stdout.trim().split(/\r?\n/).filter(Boolean);
}

// ─── 关键安全文件不使用 innerHTML 赋值 ──────────────────────────────────────────

test("critical JS files avoid innerHTML assignments (use textContent/DOM API instead)", async () => {
  // 反馈和错误处理是安全关键路径，必须用安全 API
  const criticalFiles = ["js/feedback.js", "js/error-handler.js"];
  const violations = [];

  for (const file of criticalFiles) {
    const code = await readFile(join(ROOT, file), "utf8");
    if (/\.innerHTML\s*=/.test(code)) {
      violations.push(`${file}: uses innerHTML assignment`);
    }
  }

  assert.deepEqual(violations, []);
});

test("assistant.js does not use innerHTML for user input rendering", async () => {
  const code = await readFile(join(ROOT, "js", "assistant.js"), "utf8");
  assert.doesNotMatch(code, /\.innerHTML\s*=/);
});

// ─── HTML 模板安全 ────────────────────────────────────────────────────────────

test("committed HTML files do not contain inline event handlers", async () => {
  const files = await htmlFiles();
  const violations = [];

  for (const file of files) {
    const html = await readFile(join(ROOT, file), "utf8");
    // 检查内联事件处理器（onclick, onerror, onload 等）
    const inlineHandlers = html.match(/\bon\w+\s*=\s*["']/g);
    if (inlineHandlers) {
      violations.push(`${file}: ${inlineHandlers.length} inline event handler(s)`);
    }
  }

  assert.deepEqual(violations, [], "HTML files with inline event handlers");
});

test("committed HTML files do not contain javascript: protocol URLs", async () => {
  const files = await htmlFiles();
  const violations = [];

  for (const file of files) {
    const html = await readFile(join(ROOT, file), "utf8");
    const jsUrls = html.match(/href\s*=\s*["']javascript:/gi);
    if (jsUrls) {
      violations.push(`${file}: ${jsUrls.length} javascript: URL(s)`);
    }
  }

  assert.deepEqual(violations, [], "HTML files with javascript: protocol URLs");
});

// ─── 工具核心函数安全 ──────────────────────────────────────────────────────────

test("tools-core.js does not use eval or Function constructor", async () => {
  const code = await readFile(join(ROOT, "js", "tools-core.js"), "utf8");
  assert.doesNotMatch(code, /\beval\s*\(/);
  assert.doesNotMatch(code, /new\s+Function\s*\(/);
});

test("assistant.js does not use eval or Function constructor", async () => {
  const code = await readFile(join(ROOT, "js", "assistant.js"), "utf8");
  assert.doesNotMatch(code, /\beval\s*\(/);
  assert.doesNotMatch(code, /new\s+Function\s*\(/);
});

test("assistant-loader.js does not use eval or Function constructor", async () => {
  const code = await readFile(join(ROOT, "js", "assistant-loader.js"), "utf8");
  assert.doesNotMatch(code, /\beval\s*\(/);
  assert.doesNotMatch(code, /new\s+Function\s*\(/);
});

test("tools.js does not use eval or Function constructor", async () => {
  const code = await readFile(join(ROOT, "js", "tools.js"), "utf8");
  assert.doesNotMatch(code, /\beval\s*\(/);
  assert.doesNotMatch(code, /new\s+Function\s*\(/);
});

// ─── 模板 XSS 防护 ────────────────────────────────────────────────────────────

test("post template escapes XSS payloads in metadata attributes", async () => {
  const { renderPostPage } = await import("../src/templates/post.mjs");
  const malicious = {
    title: '<img src=x onerror=alert("XSS")>',
    titleEn: '<script>document.cookie</script>',
    shortTitle: '"><script>alert(1)</script>',
    shortTitleEn: "Safe",
    slug: "xss-test",
    date: "2024-01-01",
    eyebrow: '<svg onload=alert(1)>',
    summary: '"><img src=x onerror=alert(1)>',
    summaryEn: "Safe",
    description: '<meta http-equiv="refresh" content="0;url=evil.com">',
    descriptionEn: "Safe",
    tags: ['<script>alert(1)</script>'],
    tagsEn: ['<script>alert(1)</script>'],
    contentHtml: "          <p>Safe content</p>",
    contentHtmlEn: "",
    readMinutes: 1,
    images: [],
    toc: [],
    tocEn: [],
  };

  const html = renderPostPage(malicious, { prev: null, next: null });

  // 确保恶意标签被转义为文本实体
  assert.ok(html.includes("&lt;script&gt;"), "Script tags should be escaped");
  assert.ok(html.includes("&lt;img"), "Img tags should be escaped");
  assert.ok(html.includes("&lt;svg"), "Svg tags should be escaped");

  // 确保转义后不会形成可执行的 HTML 属性
  // 检查是否存在未转义的 onerror 属性（在 HTML 标签内）
  const unescapedHandlers = html.match(/<[^>]*\bon\w+\s*=\s*alert/g);
  assert.equal(unescapedHandlers, null, "Should not have unescaped event handlers in HTML tags");
});

test("layout renderPage escapes malicious title and description in attributes", async () => {
  const { renderPage } = await import("../src/templates/layout.mjs");
  const html = renderPage({
    title: '<script>alert("XSS")</script>',
    description: '"><img src=x onerror=alert(1)>',
    active: "",
    scripts: [],
    bodyClass: "colorscheme-dark",
    page: "",
    main: "<main></main>",
  });

  // Title 应该被转义
  assert.match(html, /<title>&lt;script&gt;alert\(&quot;XSS&quot;\)&lt;\/script&gt;<\/title>/);

  // Description 应该被转义在属性中
  assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"), "Description should be escaped");

  // 不应该有未转义的 script 标签
  assert.doesNotMatch(html, /<script>alert\("XSS"\)<\/script>/);
});

// ─── 第三方脚本安全 ────────────────────────────────────────────────────────────

test("vendor scripts are loaded from local files, not CDNs", async () => {
  const files = await htmlFiles();
  const violations = [];

  for (const file of files) {
    const html = await readFile(join(ROOT, file), "utf8");
    // 检查是否从外部 CDN 加载核心脚本（排除 giscus.app 评论系统）
    const cdnScripts = html.match(/src\s*=\s*["']https?:\/\/(?!giscus\.app)[^"']+\.js["']/g);
    if (cdnScripts) {
      violations.push(`${file}: loads external JS: ${cdnScripts.join(", ")}`);
    }
  }

  assert.deepEqual(violations, [], "HTML files loading external JS from CDNs");
});

test("all script tags with src have defer attribute", async () => {
  const files = await htmlFiles();
  const violations = [];

  for (const file of files) {
    const html = await readFile(join(ROOT, file), "utf8");
    const scriptTags = html.match(/<script\s[^>]*src="[^"]+">/g) || [];
    for (const tag of scriptTags) {
      if (!tag.includes("defer") && !tag.includes("type=")) {
        violations.push(`${file}: script without defer: ${tag}`);
      }
    }
  }

  assert.deepEqual(violations, [], "Script tags missing defer attribute");
});

// ─── 内容安全策略检查 ─────────────────────────────────────────────────────────

test("committed HTML files include the shared Content Security Policy", async () => {
  const files = await htmlFiles();
  const missing = [];
  const incomplete = [];

  for (const file of files) {
    const html = await readFile(join(ROOT, file), "utf8");
    const match = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
    if (!match) {
      missing.push(file);
      continue;
    }

    const policy = match[1];
    const connectDirective = policy.match(/(?:^|; )connect-src ([^;]+)/)?.[1] || "";
    for (const directive of [
      "default-src 'self'",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://giscus.app https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://giscus.app",
      "frame-src https://giscus.app",
    ]) {
      if (!policy.includes(directive)) {
        incomplete.push(`${file}: missing ${directive}`);
      }
    }
    const expectedConnect = file === "tools/index.html" ? "'self' https: http:" : "'self' https:";
    if (connectDirective !== expectedConnect) {
      incomplete.push(`${file}: expected connect-src ${expectedConnect}, got ${connectDirective || "<missing>"}`);
    }
  }

  assert.deepEqual(missing, [], "HTML files missing CSP meta tag");
  assert.deepEqual(incomplete, [], "HTML files with incomplete CSP directives");
});

test("no HTML files contain data: protocol in href attributes", async () => {
  const files = await htmlFiles();
  const violations = [];

  for (const file of files) {
    const html = await readFile(join(ROOT, file), "utf8");
    const dataUrls = html.match(/href\s*=\s*["']data:/gi);
    if (dataUrls) {
      violations.push(`${file}: ${dataUrls.length} data: URL(s)`);
    }
  }

  assert.deepEqual(violations, [], "HTML files with data: protocol URLs");
});
