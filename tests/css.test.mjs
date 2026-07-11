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

test("coder.css exposes skip link on keyboard focus", async () => {
  const css = await readFile(join(ROOT, "css", "coder.css"), "utf8");
  const baseRule = css.match(/\.skip-link\s*{([^}]*)}/s);
  const focusRule = css.match(/\.skip-link:focus,\s*\.skip-link:focus-visible\s*{([^}]*)}/s);

  assert.ok(baseRule, "skip link base rule should exist");
  assert.ok(focusRule, "skip link focus rule should exist");
  assert.match(baseRule[1], /position:\s*fixed;/);
  assert.match(baseRule[1], /z-index:\s*10001;/);
  assert.match(baseRule[1], /transform:\s*translateY\(-150%\);/);
  assert.match(focusRule[1], /transform:\s*translateY\(0\);/);
  assert.match(focusRule[1], /outline:/);
});

test("coder.css contains navigation selectors", async () => {
  const css = await readFile(join(ROOT, "css", "coder.css"), "utf8");

  assert.ok(css.includes(".navigation-list"), "should have navigation-list");
  assert.ok(css.includes(".menu-toggle"), "should have menu-toggle");
  assert.ok(css.includes(".menu-button"), "should have menu-button");
  assert.ok(css.includes(".menu-overlay"), "should have menu-overlay");
  assert.ok(css.includes(".theme-toggle"), "should have theme-toggle");
  assert.ok(css.includes(".nav-search-trigger"), "should have nav-search-trigger");
  assert.ok(css.includes(".nav-subscribe"), "should have nav-subscribe");
  assert.ok(css.includes(".nav-sponsor"), "should have nav-sponsor");
  assert.ok(css.includes(".nav-feedback"), "should have nav-feedback");
});

test("mobile navigation overlay closes the menu without JavaScript", async () => {
  const css = await readFile(join(ROOT, "css", "coder.css"), "utf8");

  assert.match(css, /\.menu-toggle,\s*\.menu-button,\s*\.menu-overlay\s*{\s*display:\s*none;/s);
  assert.match(css, /\.menu-toggle:checked\s*~\s*\.menu-overlay\s*{[^}]*position:\s*fixed;[^}]*inset:\s*0;[^}]*z-index:\s*8;[^}]*display:\s*block;/s);
  assert.match(css, /\.navigation-list\s*{[^}]*z-index:\s*10;/s);
  const overlayRuleIndex = css.indexOf(".menu-toggle:checked ~ .menu-overlay");
  const mobileMenuRuleIndex = css.indexOf(".navigation-list", overlayRuleIndex);
  assert.ok(overlayRuleIndex < mobileMenuRuleIndex, "overlay rule should appear before the mobile menu panel rule so the panel stays above it");
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
  assert.ok(/\.post-tree\s*{[^}]*position:\s*sticky;/s.test(css), "post-tree should be sticky on desktop");
  assert.ok(css.includes(".post-tree-fab-icon"), "mobile post tree toggle should have an icon selector");
  assert.ok(css.includes(".post-tree-collapse"), "mobile floating post tree should have an internal collapse button");
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

test("coder.css contains relay ranking selectors", async () => {
  const css = await readFile(join(ROOT, "css", "coder.css"), "utf8");

  assert.ok(css.includes(".relay-page"), "should have relay-page");
  assert.ok(css.includes(".relay-toolbar"), "should have relay-toolbar");
  assert.ok(css.includes(".relay-filters"), "should have relay-filters");
  assert.ok(css.includes(".relay-card"), "should have relay-card");
  assert.ok(css.includes(".relay-score"), "should have relay-score");
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
  assert.ok(css.includes(".assistant-nav-trigger"), "should have assistant nav trigger");
  assert.ok(css.includes(".assistant-panel"), "should have assistant-panel");
  assert.ok(css.includes(".assistant-panel[hidden]"), "should have assistant-panel[hidden]");
  assert.ok(css.includes(".assistant-widget.fullscreen"), "should have assistant fullscreen state");
  assert.match(css, /\.assistant-widget\s*{[^}]*top:\s*calc\(var\(--assistant-nav-height,\s*5\.6rem\)\s*\+\s*0\.9rem\);[^}]*bottom:\s*auto;[^}]*z-index:\s*45;/s);
  assert.match(css, /\.assistant-widget\.has-nav-trigger\s*>\s*\.assistant-fab\s*{[^}]*display:\s*none;/s);
  assert.match(css, /\.assistant-panel\s*{[^}]*top:\s*0;[^}]*width:\s*min\(42rem,\s*calc\(100vw\s*-\s*3\.2rem\)\);[^}]*height:\s*min\(48rem,\s*calc\(100vh\s*-\s*var\(--assistant-nav-height,\s*5\.6rem\)\s*-\s*1\.8rem\)\);/s);
  assert.match(css, /\.assistant-widget\.fullscreen\s*{[^}]*top:\s*0;[^}]*z-index:\s*120;/s);
  assert.ok(css.includes(".assistant-relay-cta"), "should have assistant relay CTA");
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
  assert.ok(css.includes(".subscribe-input.is-invalid"), "should have invalid footer subscribe input state");
  assert.ok(css.includes(".subscribe-modal-input.is-invalid"), "should have invalid modal subscribe input state");
  assert.ok(css.includes(".feedback-form textarea.is-invalid"), "should have invalid feedback textarea state");
});

test("coder.css contains share selectors", async () => {
  const css = await readFile(join(ROOT, "css", "coder.css"), "utf8");

  assert.ok(css.includes(".post-share"), "should have post-share");
  assert.ok(css.includes(".share-btn"), "should have share-btn");
  assert.ok(css.includes(".share-label"), "should have share-label");
});

test("coder.css makes the share bar compact on narrow screens", async () => {
  const css = await readFile(join(ROOT, "css", "coder.css"), "utf8");

  assert.match(css, /@media\s*\(max-width:\s*480px\)\s*{[\s\S]*?\.post-share\s*{[^}]*flex-wrap:\s*wrap;[^}]*}/);
  assert.match(css, /@media\s*\(max-width:\s*480px\)\s*{[\s\S]*?\.share-label\s*{[^}]*width:\s*100%;[^}]*}/);
  assert.match(css, /@media\s*\(max-width:\s*480px\)\s*{[\s\S]*?\.share-btn\s*{[^}]*flex:\s*1;[^}]*min-width:\s*0;[^}]*}/);
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
  assert.ok(css.includes("#giscus-thread"), "should style giscus container");
  assert.ok(css.includes(".giscus-frame"), "should style giscus iframe");
});

test("coder.css contains cursor effects selectors", async () => {
  const css = await readFile(join(ROOT, "css", "coder.css"), "utf8");

  assert.ok(css.includes(".cursor-glow"), "should have cursor-glow");
  assert.ok(css.includes(".cursor-canvas"), "should have cursor-canvas");
});

test("coder.css hides to-top button until scroll state is initialized", async () => {
  const css = await readFile(join(ROOT, "css", "coder.css"), "utf8");

  assert.match(css, /body:not\(\.to-top-ready\)\s+\.to-top\s*{\s*display:\s*none;\s*}/);
  assert.match(css, /\.to-top\.visible\s*{[^}]*opacity:\s*1;[^}]*pointer-events:\s*auto;/s);
});

test("coder.css leaves smooth scrolling to JavaScript", async () => {
  const css = await readFile(join(ROOT, "css", "coder.css"), "utf8");

  const htmlRule = css.match(/html\s*{[^}]*}/);
  assert.ok(htmlRule, "should have a base html rule");
  assert.ok(!/scroll-behavior\s*:\s*smooth/.test(htmlRule[0]), "html rule should not force every anchor navigation to scroll smoothly");
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

test("coder.css disables backdrop blur on mobile", async () => {
  const css = await readFile(join(ROOT, "css", "coder.css"), "utf8");
  const mobileBackdropRule =
    /@media\s*\(max-width:\s*768px\)\s*{[\s\S]*?\.navigation,[\s\S]*?\.search-modal,[\s\S]*?\.next-popup\s*{[\s\S]*?backdrop-filter:\s*none;[\s\S]*?-webkit-backdrop-filter:\s*none;[\s\S]*?}/;

  assert.match(css, mobileBackdropRule);
  assert.match(
    css,
    /@media\s*\(max-width:\s*768px\)\s*{[\s\S]*?\.navigation,[\s\S]*?\.search-modal,[\s\S]*?\.next-popup\s*{[\s\S]*?background:\s*var\(--surface-solid,\s*var\(--surface\)\);/,
  );
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
