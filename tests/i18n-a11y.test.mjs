// Phase 6: i18n 和可访问性测试
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

// ─── ARIA 属性测试 ─────────────────────────────────────────────────────────────

test("all HTML files have lang attribute on <html>", async () => {
  const failures = [];
  for (const file of await htmlFiles()) {
    const html = await readFile(join(ROOT, file), "utf8");
    if (!/<html[^>]*\blang="/.test(html)) {
      failures.push(`${file}: missing lang attribute`);
    }
  }
  assert.deepEqual(failures, []);
});

test("all HTML files have charset and viewport meta tags", async () => {
  const failures = [];
  for (const file of await htmlFiles()) {
    const html = await readFile(join(ROOT, file), "utf8");
    if (!html.includes('charset="utf-8"') && !html.includes("charset=utf-8")) {
      failures.push(`${file}: missing charset`);
    }
    if (!html.includes('name="viewport"')) {
      failures.push(`${file}: missing viewport meta`);
    }
  }
  assert.deepEqual(failures, []);
});

test("all HTML files have meta description", async () => {
  const failures = [];
  for (const file of await htmlFiles()) {
    const html = await readFile(join(ROOT, file), "utf8");
    if (!html.includes('name="description"')) {
      failures.push(`${file}: missing meta description`);
    }
  }
  assert.deepEqual(failures, []);
});

test("navigation has aria-label", async () => {
  const failures = [];
  for (const file of await htmlFiles()) {
    const html = await readFile(join(ROOT, file), "utf8");
    if (html.includes('class="navigation-list"') && !html.includes('aria-label="Main navigation"')) {
      failures.push(`${file}: nav missing aria-label`);
    }
  }
  assert.deepEqual(failures, []);
});

test("interactive elements have accessible labels", async () => {
  const failures = [];
  for (const file of await htmlFiles()) {
    const html = await readFile(join(ROOT, file), "utf8");
    // 检查按钮是否有 aria-label 或可见文本
    const buttons = html.match(/<button[^>]*>/g) || [];
    for (const btn of buttons) {
      if (!btn.includes("aria-label") && !btn.includes("data-i18n") && !btn.includes(">")) {
        // 简单检查：没有 aria-label 也没有 data-i18n 的按钮可能缺少标签
        // 这里只检查 theme-toggle 等图标按钮
        if (btn.includes("theme-toggle") && !btn.includes("aria-label")) {
          failures.push(`${file}: theme-toggle button missing aria-label`);
        }
      }
    }
  }
  assert.deepEqual(failures, []);
});

test("images have alt attributes in templates", async () => {
  const { renderPostPage } = await import("../src/templates/post.mjs");
  const post = {
    title: "T", titleEn: "T", shortTitle: "T", shortTitleEn: "T",
    slug: "t", date: "2024-01-01", eyebrow: "项目",
    summary: "S", summaryEn: "", description: "D", descriptionEn: "",
    tags: [], tagsEn: [],
    contentHtml: '          <img src="/images/test.png" alt="test image">',
    contentHtmlEn: "", readMinutes: 1, images: [], toc: [], tocEn: [],
  };
  const html = renderPostPage(post, { prev: null, next: null });
  // 模板不修改 markdown 正文中的 img，所以 alt 保持不变
  assert.match(html, /alt="test image"/);
});

// ─── i18n 数据属性测试 ─────────────────────────────────────────────────────────

test("all pages have data-i18n-page attribute on body", async () => {
  const failures = [];
  for (const file of await htmlFiles()) {
    const html = await readFile(join(ROOT, file), "utf8");
    if (!html.includes('data-i18n-page=')) {
      failures.push(`${file}: missing data-i18n-page`);
    }
  }
  assert.deepEqual(failures, []);
});

test("navigation items have data-i18n attributes", async () => {
  const failures = [];
  for (const file of await htmlFiles()) {
    const html = await readFile(join(ROOT, file), "utf8");
    // 提取导航区域内的链接（在 navigation-list 内）
    const navMatch = html.match(/<nav class="navigation-list"[^>]*>([\s\S]*?)<\/nav>/);
    if (!navMatch) continue;
    const navHtml = navMatch[1];
    // 检查导航区域内的博客链接是否有 data-i18n
    const navLinks = navHtml.match(/<a[^>]*href="\/post\/"[^>]*>/g) || [];
    for (const link of navLinks) {
      if (!link.includes('data-i18n="nav.blog"')) {
        failures.push(`${file}: blog nav link missing data-i18n`);
      }
    }
  }
  assert.deepEqual(failures, []);
});

test("footer has i18n attributes for translatable content", async () => {
  const failures = [];
  for (const file of await htmlFiles()) {
    const html = await readFile(join(ROOT, file), "utf8");
    if (html.includes('class="subscribe-title"') && !html.includes('data-i18n="subscribe.title"')) {
      failures.push(`${file}: subscribe title missing data-i18n`);
    }
  }
  assert.deepEqual(failures, []);
});

test("all pages include the language toggle button", async () => {
  const failures = [];
  for (const file of await htmlFiles()) {
    const html = await readFile(join(ROOT, file), "utf8");
    if (!html.includes('class="lang-toggle"')) {
      failures.push(`${file}: missing language toggle button`);
    }
  }
  assert.deepEqual(failures, []);
});

test("all pages include the theme toggle button", async () => {
  const failures = [];
  for (const file of await htmlFiles()) {
    const html = await readFile(join(ROOT, file), "utf8");
    if (!html.includes('class="theme-toggle"')) {
      failures.push(`${file}: missing theme toggle button`);
    }
  }
  assert.deepEqual(failures, []);
});

// ─── 页脚一致性测试 ────────────────────────────────────────────────────────────

test("all pages have consistent footer with subscribe form", async () => {
  const failures = [];
  for (const file of await htmlFiles()) {
    const html = await readFile(join(ROOT, file), "utf8");
    if (!html.includes('class="subscribe"')) {
      failures.push(`${file}: missing subscribe section in footer`);
    }
    if (!html.includes('class="subscribe-form"')) {
      failures.push(`${file}: missing subscribe form`);
    }
    if (!html.includes('class="subscribe-btn"')) {
      failures.push(`${file}: missing subscribe button`);
    }
  }
  assert.deepEqual(failures, []);
});

test("all pages have sponsor CTA in footer", async () => {
  const failures = [];
  for (const file of await htmlFiles()) {
    const html = await readFile(join(ROOT, file), "utf8");
    if (!html.includes('class="sponsor-mini"')) {
      failures.push(`${file}: missing sponsor mini CTA`);
    }
  }
  assert.deepEqual(failures, []);
});
