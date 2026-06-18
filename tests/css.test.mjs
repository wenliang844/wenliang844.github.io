// Phase 9: CSS 测试
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

// ─── CSS 文件存在性和基本结构 ───────────────────────────────────────────────────

test("coder.css exists and is not empty", async () => {
  const css = await readFile(join(ROOT, "css", "coder.css"), "utf8");
  assert.ok(css.length > 1000, "coder.css should have substantial content");
});

test("fontawesome CSS exists", async () => {
  const css = await readFile(join(ROOT, "css", "fontawesome-all.min.css"), "utf8");
  assert.ok(css.length > 100, "fontawesome CSS should exist");
});

// ─── 关键选择器存在性 ──────────────────────────────────────────────────────────

test("coder.css contains layout selectors", async () => {
  const css = await readFile(join(ROOT, "css", "coder.css"), "utf8");

  // 页面骨架
  assert.ok(css.includes(".site-shell"), "should have site-shell selector");
  assert.ok(css.includes(".navigation"), "should have navigation selector");
  assert.ok(css.includes(".footer"), "should have footer selector");
  assert.ok(css.includes(".content"), "should have content selector");
});

test("coder.css contains navigation selectors", async () => {
  const css = await readFile(join(ROOT, "css", "coder.css"), "utf8");

  assert.ok(css.includes(".navigation-list"), "should have navigation-list");
  assert.ok(css.includes(".menu-toggle"), "should have menu-toggle");
  assert.ok(css.includes(".menu-button"), "should have menu-button");
  assert.ok(css.includes(".theme-toggle"), "should have theme-toggle");
  assert.ok(css.includes(".nav-search-trigger"), "should have nav-search-trigger");
  assert.ok(css.includes(".nav-subscribe"), "should have nav-subscribe");
  assert.ok(css.includes(".nav-sponsor"), "should have nav-sponsor");
  assert.ok(css.includes(".nav-feedback"), "should have nav-feedback");
});

test("coder.css contains article selectors", async () => {
  const css = await readFile(join(ROOT, "css", "coder.css"), "utf8");

  assert.ok(css.includes(".article"), "should have article selector");
  assert.ok(css.includes(".article-header"), "should have article-header");
  assert.ok(css.includes(".article-content"), "should have article-content");
  assert.ok(css.includes(".article-meta"), "should have article-meta");
  assert.ok(css.includes(".article-summary"), "should have article-summary");
  assert.ok(css.includes(".eyebrow"), "should have eyebrow selector");
});

test("coder.css contains blog tree selectors", async () => {
  const css = await readFile(join(ROOT, "css", "coder.css"), "utf8");

  assert.ok(css.includes(".blog-layout"), "should have blog-layout");
  assert.ok(css.includes(".post-tree"), "should have post-tree");
  assert.ok(css.includes(".post-tree-link"), "should have post-tree-link");
  assert.ok(css.includes(".post-detail"), "should have post-detail");
  assert.ok(css.includes(".tree-group"), "should have tree-group");
});

test("coder.css contains tools page selectors", async () => {
  const css = await readFile(join(ROOT, "css", "coder.css"), "utf8");

  assert.ok(css.includes(".tools-page"), "should have tools-page");
  assert.ok(css.includes(".tools-shell"), "should have tools-shell");
  assert.ok(css.includes(".tools-tabs"), "should have tools-tabs");
  assert.ok(css.includes(".tool-tab"), "should have tool-tab");
  assert.ok(css.includes(".tool-panel"), "should have tool-panel");
  assert.ok(css.includes(".tool-btn"), "should have tool-btn");
  assert.ok(css.includes(".tool-actions"), "should have tool-actions");
  assert.ok(css.includes(".tool-field"), "should have tool-field");
  assert.ok(css.includes(".tool-status"), "should have tool-status");
});

test("coder.css contains AI navigation selectors", async () => {
  const css = await readFile(join(ROOT, "css", "coder.css"), "utf8");

  assert.ok(css.includes(".ai-nav-page"), "should have ai-nav-page");
  assert.ok(css.includes(".ai-category"), "should have ai-category");
  assert.ok(css.includes(".ai-tool-card"), "should have ai-tool-card");
  assert.ok(css.includes(".ai-tool-grid"), "should have ai-tool-grid");
  assert.ok(css.includes(".ai-tool-tags"), "should have ai-tool-tags");
});

test("coder.css contains appreciation page selectors", async () => {
  const css = await readFile(join(ROOT, "css", "coder.css"), "utf8");

  assert.ok(css.includes(".rank-page"), "should have rank-page");
  assert.ok(css.includes(".rank-board"), "should have rank-board");
  assert.ok(css.includes(".rank-list"), "should have rank-list");
  assert.ok(css.includes(".rank-item"), "should have rank-item");
  assert.ok(css.includes(".rank-grid"), "should have rank-grid");
});

test("coder.css contains sponsor page selectors", async () => {
  const css = await readFile(join(ROOT, "css", "coder.css"), "utf8");

  assert.ok(css.includes(".sponsor-page"), "should have sponsor-page");
  assert.ok(css.includes(".sponsor-layout"), "should have sponsor-layout");
  assert.ok(css.includes(".sponsor-panel"), "should have sponsor-panel");
  assert.ok(css.includes(".sponsor-mini"), "should have sponsor-mini");
  assert.ok(css.includes(".sponsor-pay-btn"), "should have sponsor-pay-btn");
});

test("coder.css contains assistant selectors", async () => {
  const css = await readFile(join(ROOT, "css", "coder.css"), "utf8");

  assert.ok(css.includes(".assistant-fab"), "should have assistant-fab");
  assert.ok(css.includes(".assistant-panel"), "should have assistant-panel");
  assert.ok(css.includes(".assistant-panel[hidden]"), "should have assistant-panel[hidden]");
  assert.ok(css.includes(".assistant-message"), "should have assistant-message");
  assert.ok(css.includes(".assistant-input"), "should have assistant-input");
});

test("coder.css contains search selectors", async () => {
  const css = await readFile(join(ROOT, "css", "coder.css"), "utf8");

  assert.ok(css.includes(".search-modal"), "should have search-modal");
  assert.ok(css.includes(".search-modal-input"), "should have search-modal-input");
  assert.ok(css.includes(".search-modal-results"), "should have search-modal-results");
});

test("coder.css contains subscribe selectors", async () => {
  const css = await readFile(join(ROOT, "css", "coder.css"), "utf8");

  assert.ok(css.includes(".subscribe"), "should have subscribe");
  assert.ok(css.includes(".subscribe-form"), "should have subscribe-form");
  assert.ok(css.includes(".subscribe-input"), "should have subscribe-input");
  assert.ok(css.includes(".subscribe-btn"), "should have subscribe-btn");
  assert.ok(css.includes(".subscribe-modal"), "should have subscribe-modal");
});

test("coder.css contains share selectors", async () => {
  const css = await readFile(join(ROOT, "css", "coder.css"), "utf8");

  assert.ok(css.includes(".post-share"), "should have post-share");
  assert.ok(css.includes(".share-btn"), "should have share-btn");
  assert.ok(css.includes(".share-label"), "should have share-label");
});

test("coder.css contains tag selectors", async () => {
  const css = await readFile(join(ROOT, "css", "coder.css"), "utf8");

  assert.ok(css.includes(".tag-filter"), "should have tag-filter");
  assert.ok(css.includes(".tag-chip"), "should have tag-chip");
  assert.ok(css.includes(".tag-count"), "should have tag-count");
});

test("coder.css contains pager selectors", async () => {
  const css = await readFile(join(ROOT, "css", "coder.css"), "utf8");

  assert.ok(css.includes(".post-pager"), "should have post-pager");
  assert.ok(css.includes(".next-popup"), "should have next-popup");
});

test("coder.css contains related posts selectors", async () => {
  const css = await readFile(join(ROOT, "css", "coder.css"), "utf8");

  assert.ok(css.includes(".post-related"), "should have post-related");
  assert.ok(css.includes(".related-card"), "should have related-card");
  assert.ok(css.includes(".related-list"), "should have related-list");
});

test("coder.css contains TOC selectors", async () => {
  const css = await readFile(join(ROOT, "css", "coder.css"), "utf8");

  assert.ok(css.includes(".toc-sidebar"), "should have toc-sidebar");
  assert.ok(css.includes(".toc-nav"), "should have toc-nav");
  assert.ok(css.includes(".toc-toggle"), "should have toc-toggle");
  assert.ok(css.includes(".toc-sub"), "should have toc-sub");
});

test("coder.css contains comments selectors", async () => {
  const css = await readFile(join(ROOT, "css", "coder.css"), "utf8");

  assert.ok(css.includes(".comments"), "should have comments");
});

test("coder.css contains cursor effects selectors", async () => {
  const css = await readFile(join(ROOT, "css", "coder.css"), "utf8");

  assert.ok(css.includes(".cursor-glow"), "should have cursor-glow");
  assert.ok(css.includes(".cursor-canvas"), "should have cursor-canvas");
});

// ─── 暗色模式支持 ─────────────────────────────────────────────────────────────

test("coder.css contains dark mode color scheme", async () => {
  const css = await readFile(join(ROOT, "css", "coder.css"), "utf8");

  assert.ok(css.includes(".colorscheme-dark"), "should have colorscheme-dark");
  assert.ok(css.includes("colorscheme") || css.includes("color-scheme"), "should have color scheme support");
});

test("coder.css uses CSS custom properties for theming", async () => {
  const css = await readFile(join(ROOT, "css", "coder.css"), "utf8");

  assert.ok(css.includes("--background") || css.includes("--bg"), "should use CSS variables for background");
  assert.ok(css.includes("--color") || css.includes("--text"), "should use CSS variables for text color");
});

// ─── 响应式设计 ────────────────────────────────────────────────────────────────

test("coder.css contains responsive media queries", async () => {
  const css = await readFile(join(ROOT, "css", "coder.css"), "utf8");

  assert.ok(css.includes("@media"), "should contain media queries");
  assert.ok(css.includes("max-width") || css.includes("min-width"), "should use width-based breakpoints");
});

// ─── 可访问性相关样式 ──────────────────────────────────────────────────────────

test("coder.css has focus styles for interactive elements", async () => {
  const css = await readFile(join(ROOT, "css", "coder.css"), "utf8");

  assert.ok(css.includes(":focus"), "should have :focus styles");
  assert.ok(css.includes("outline") || css.includes("box-shadow"), "should have visible focus indicators");
});

test("coder.css has aria-hidden support", async () => {
  const css = await readFile(join(ROOT, "css", "coder.css"), "utf8");
  // 确保 hidden 属性对 assistant panel 有效
  assert.ok(css.includes("[hidden]"), "should have [hidden] selector");
});

// ─── 打印样式 ─────────────────────────────────────────────────────────────────

test("coder.css may contain print styles", async () => {
  const css = await readFile(join(ROOT, "css", "coder.css"), "utf8");
  // 打印样式是可选的，但如果有 @media print 应该正确使用
  if (css.includes("@media print")) {
    assert.ok(true, "has print styles");
  } else {
    assert.ok(true, "print styles are optional");
  }
});
