// Phase 6: i18n 和可访问性测试
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { JSDOM } from "jsdom";

const execFileAsync = promisify(execFile);
const ROOT = join(import.meta.dirname, "..");
const HAND_AUTHORED_SHELL_PAGES = [
  "about/index.html",
  "contact/index.html",
  "editor/index.html",
  "overleaf/index.html",
  "404.html",
];
const REQUIRED_MORE_LINKS = ["/tools/", "/overleaf/", "/trust/"];
const REQUIRED_FOOTER_LINKS = ["/trust/", "/contact/", "/sponsor/"];
const REQUIRED_NAV_HREFS = [
  "/post/",
  "/ai/",
  "/appreciation/",
  "/tools/",
  "/overleaf/",
  "/trust/",
  "/contact/",
  "/sponsor/",
];
const REQUIRED_FOOTER_HREFS = ["/trust/", "/contact/", "/sponsor/"];

async function htmlFiles() {
  const { stdout } = await execFileAsync("git", ["ls-files", "*.html"], { cwd: ROOT, windowsHide: true });
  return stdout.trim().split(/\r?\n/).filter(Boolean);
}

function accessibleName(element) {
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => element.ownerDocument.getElementById(id)?.textContent || "")
      .join(" ")
      .trim();
    if (text) {
      return text;
    }
  }
  return (
    element.getAttribute("aria-label") ||
    element.getAttribute("title") ||
    element.textContent ||
    ""
  ).trim();
}

function describeButton(button) {
  const id = button.id ? `#${button.id}` : "";
  const classes = button.className ? `.${String(button.className).trim().split(/\s+/).join(".")}` : "";
  const type = button.getAttribute("type") ? `[type="${button.getAttribute("type")}"]` : "";
  return `button${id}${classes}${type}`;
}

function hrefsIn(root) {
  return Array.from(root.querySelectorAll("a[href]"), (link) => link.getAttribute("href"));
}

function missingHrefs(actual, required) {
  return required.filter((href) => !actual.includes(href));
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

test("all HTML files have exactly one h1", async () => {
  const failures = [];
  for (const file of await htmlFiles()) {
    const html = await readFile(join(ROOT, file), "utf8");
    const count = (html.match(/<h1\b/gi) || []).length;
    if (count !== 1) {
      failures.push(`${file}: expected 1 h1, found ${count}`);
    }
  }
  assert.deepEqual(failures, []);
});

test("contact page h1 matches the contact route semantics", async () => {
  const html = await readFile(join(ROOT, "contact", "index.html"), "utf8");
  const dom = new JSDOM(html);
  const h1 = dom.window.document.querySelector("main h1");

  assert.equal(h1?.getAttribute("data-i18n"), "contact.h1");
  assert.match(h1?.textContent || "", /联系/);
  dom.window.close();
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

test("mobile navigation has a click-outside overlay", async () => {
  const failures = [];
  for (const file of await htmlFiles()) {
    const html = await readFile(join(ROOT, file), "utf8");
    if (html.includes('id="menu-toggle"') && !html.includes('class="menu-overlay" for="menu-toggle" aria-hidden="true"')) {
      failures.push(`${file}: missing mobile menu overlay`);
    }
  }
  assert.deepEqual(failures, []);
});

test("all HTML files include a skip link to the main content", async () => {
  const failures = [];
  for (const file of await htmlFiles()) {
    const html = await readFile(join(ROOT, file), "utf8");
    if (!html.includes('class="skip-link" href="#main-content"')) {
      failures.push(`${file}: missing skip link`);
    }
    if (!/<main\b[^>]*\bid="main-content"/.test(html)) {
      failures.push(`${file}: missing main-content target`);
    }
  }
  assert.deepEqual(failures, []);
});

test("interactive elements have accessible labels", async () => {
  const failures = [];
  for (const file of await htmlFiles()) {
    const html = await readFile(join(ROOT, file), "utf8");
    const dom = new JSDOM(html);
    for (const button of dom.window.document.querySelectorAll("button")) {
      if (!accessibleName(button)) {
        failures.push(`${file}: ${describeButton(button)} missing accessible name`);
      }
    }
    dom.window.close();
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

test("navigation includes the required site-wide destinations", async () => {
  const failures = [];
  for (const file of await htmlFiles()) {
    const html = await readFile(join(ROOT, file), "utf8");
    const dom = new JSDOM(html);
    const nav = dom.window.document.querySelector(".navigation-list");
    if (nav) {
      const missing = missingHrefs(hrefsIn(nav), REQUIRED_NAV_HREFS);
      if (missing.length) {
        failures.push(`${file}: navigation missing ${missing.join(", ")}`);
      }
    }
    dom.window.close();
  }
  assert.deepEqual(failures, []);
});

test("hand-authored pages expose the shared more-menu routes", async () => {
  const failures = [];
  for (const file of HAND_AUTHORED_SHELL_PAGES) {
    const html = await readFile(join(ROOT, file), "utf8");
    const dom = new JSDOM(html);
    const hrefs = [...dom.window.document.querySelectorAll(".nav-more-menu a")]
      .map((link) => link.getAttribute("href"))
      .filter(Boolean);
    const missing = REQUIRED_MORE_LINKS.filter((href) => !hrefs.includes(href));
    if (missing.length) {
      failures.push(`${file}: missing more-menu links ${missing.join(", ")}`);
    }
    dom.window.close();
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

test("hand-authored pages expose the shared footer links", async () => {
  const failures = [];
  for (const file of HAND_AUTHORED_SHELL_PAGES) {
    const html = await readFile(join(ROOT, file), "utf8");
    const dom = new JSDOM(html);
    const footerLinks = dom.window.document.querySelector(".footer-links");
    const hrefs = [...dom.window.document.querySelectorAll(".footer-links a")]
      .map((link) => link.getAttribute("href"))
      .filter(Boolean);
    const missing = REQUIRED_FOOTER_LINKS.filter((href) => !hrefs.includes(href));
    if (!footerLinks) {
      failures.push(`${file}: missing footer-links nav`);
    } else if (missing.length) {
      failures.push(`${file}: missing footer links ${missing.join(", ")}`);
    }
    dom.window.close();
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

test("all pages expose the web app manifest and theme color", async () => {
  const failures = [];
  for (const file of await htmlFiles()) {
    const html = await readFile(join(ROOT, file), "utf8");
    if (!html.includes('rel="manifest" href="/manifest.webmanifest"')) {
      failures.push(`${file}: missing web app manifest link`);
    }
    if (!html.includes('name="theme-color" content="#0f172a"')) {
      failures.push(`${file}: missing theme-color meta`);
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

test("footer includes the required site-wide explanation links", async () => {
  const failures = [];
  for (const file of await htmlFiles()) {
    const html = await readFile(join(ROOT, file), "utf8");
    const dom = new JSDOM(html);
    const footer = dom.window.document.querySelector("footer.footer");
    if (footer) {
      const links = footer.querySelector(".footer-links");
      if (!links) {
        failures.push(`${file}: missing footer-links`);
      } else {
        const missing = missingHrefs(hrefsIn(links), REQUIRED_FOOTER_HREFS);
        if (missing.length) {
          failures.push(`${file}: footer-links missing ${missing.join(", ")}`);
        }
      }
    }
    dom.window.close();
  }
  assert.deepEqual(failures, []);
});
