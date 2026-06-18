// Deep test: share.js — 分享链接、复制链接、微信二维码
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { JSDOM } from "jsdom";

const ROOT = join(import.meta.dirname, "..");

function buildShareHtml(options = {}) {
  const title = options.title || "测试文章标题";
  const titleEn = options.titleEn || "Test Post Title";
  const url = options.url || "/post/test-post/";
  return `<!doctype html><html lang="zh-CN"><body class="colorscheme-dark">
  <div class="post-share" data-share-url="${url}" data-share-title="${title}" data-share-title-en="${titleEn}">
    <a data-share="x" href="#">X</a>
    <button data-share="weibo">微博</button>
    <button data-share="copy">复制链接</button>
    <button data-share="wechat">微信</button>
  </div>
</body></html>`;
}

async function loadShare(dom) {
  const utilsCode = await readFile(join(ROOT, "js", "utils.js"), "utf8");
  const code = await readFile(join(ROOT, "js", "share.js"), "utf8");
  dom.window.eval(utilsCode);
  dom.window.eval(code);
  return dom;
}

// ─── X 分享链接生成 ─────────────────────────────────────────────────────────

test("share.js generates correct X (Twitter) share URL", async () => {
  const dom = new JSDOM(buildShareHtml(), {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/post/test-post/",
  });
  await loadShare(dom);
  const { document } = dom.window;

  const xLink = document.querySelector('a[data-share="x"]');
  assert.ok(xLink, "should have X share link");
  const href = xLink.getAttribute("href");
  assert.ok(href.includes("x.com/intent/tweet"), "should point to x.com intent");
  assert.ok(href.includes(encodeURIComponent("测试文章标题")), "should include encoded title");
  dom.window.close();
});

// ─── X 分享链接英文模式 ─────────────────────────────────────────────────────

test("share.js uses English title for X share in English mode", async () => {
  const dom = new JSDOM(buildShareHtml(), {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/post/test-post/",
  });
  // 先加载 i18n 并切换到英文
  const i18nCode = await readFile(join(ROOT, "js", "i18n.js"), "utf8");
  dom.window.localStorage.setItem("cwl-lang", "en");
  dom.window.eval(i18nCode);

  // 再加载 share.js（此时 cwlLang() 返回 "en"）
  await loadShare(dom);
  const { document } = dom.window;

  const xLink = document.querySelector('a[data-share="x"]');
  const href = xLink.getAttribute("href");
  // 在英文模式下应使用英文标题
  assert.ok(href.includes(encodeURIComponent("Test Post Title")), "should include English title");
  dom.window.close();
});

// ─── 复制链接使用 textContent 而非 innerHTML ─────────────────────────────────

test("share.js uses safe DOM for QR code title", async () => {
  const code = await readFile(join(ROOT, "js", "share.js"), "utf8");
  // 确保使用 textContent 而非 innerHTML 写入标题
  assert.ok(code.includes(".textContent"), "should use textContent for safe rendering");
  // 确保 QR overlay 标题使用 textContent
  assert.match(code, /name\.textContent\s*=\s*title/, "should use textContent for QR name");
  assert.doesNotMatch(code, /overlay\.innerHTML\s*=/, "should not build QR overlay from an HTML string");
});

// ─── 无 .post-share 时静默退出 ─────────────────────────────────────────────

test("share.js exits gracefully when no share bars exist", async () => {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  const code = await readFile(join(ROOT, "js", "share.js"), "utf8");
  dom.window.eval(code);
  assert.ok(true, "share.js should not throw without share bars");
  dom.window.close();
});

// ─── 微信二维码浮层创建 ─────────────────────────────────────────────────────

test("share.js creates QR overlay on wechat button click", async () => {
  const dom = new JSDOM(buildShareHtml(), {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/post/test-post/",
  });
  await loadShare(dom);
  const { document } = dom.window;

  const wechatBtn = document.querySelector('[data-share="wechat"]');
  wechatBtn.click();

  const overlay = document.querySelector(".share-qr-overlay");
  assert.ok(overlay, "should create QR overlay");
  assert.ok(overlay.querySelector(".share-qr-card"), "should have QR card");

  // 标题使用 textContent
  const nameEl = overlay.querySelector(".share-qr-name");
  assert.ok(nameEl.textContent.includes("测试文章标题"), "should show post title in QR");
  dom.window.close();
});

// ─── 微信二维码 ESC 关闭 ────────────────────────────────────────────────────

test("share.js QR overlay closes on ESC key", async () => {
  const dom = new JSDOM(buildShareHtml(), {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/post/test-post/",
  });
  await loadShare(dom);
  const { document } = dom.window;

  document.querySelector('[data-share="wechat"]').click();
  assert.ok(document.querySelector(".share-qr-overlay"), "overlay should exist");

  document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.ok(!document.querySelector(".share-qr-overlay"), "overlay should be removed on ESC");
  dom.window.close();
});

// ─── 微信二维码关闭按钮 ────────────────────────────────────────────────────

test("share.js QR overlay closes on close button click", async () => {
  const dom = new JSDOM(buildShareHtml(), {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/post/test-post/",
  });
  await loadShare(dom);
  const { document } = dom.window;

  document.querySelector('[data-share="wechat"]').click();
  const closeBtn = document.querySelector(".share-qr-close");
  assert.ok(closeBtn, "should have close button");
  closeBtn.click();
  assert.ok(!document.querySelector(".share-qr-overlay"), "overlay should be removed");
  dom.window.close();
});

// ─── 微信二维码点击遮罩关闭 ─────────────────────────────────────────────────

test("share.js QR overlay closes on overlay background click", async () => {
  const dom = new JSDOM(buildShareHtml(), {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/post/test-post/",
  });
  await loadShare(dom);
  const { document } = dom.window;

  document.querySelector('[data-share="wechat"]').click();
  const overlay = document.querySelector(".share-qr-overlay");
  // 模拟点击遮罩自身（非卡片内部）
  overlay.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  assert.ok(!document.querySelector(".share-qr-overlay"), "overlay should be removed on background click");
  dom.window.close();
});

// ─── 多次打开微信二维码只保留一个 ───────────────────────────────────────────

test("share.js replaces previous QR overlay when opening new one", async () => {
  const dom = new JSDOM(buildShareHtml(), {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/post/test-post/",
  });
  await loadShare(dom);
  const { document } = dom.window;

  document.querySelector('[data-share="wechat"]').click();
  document.querySelector('[data-share="wechat"]').click();

  const overlays = document.querySelectorAll(".share-qr-overlay");
  assert.equal(overlays.length, 1, "should only have one overlay at a time");
  dom.window.close();
});

// ─── 复制链接按钮不含 XSS ──────────────────────────────────────────────────

test("share.js share bar with XSS in title is safe", async () => {
  const dom = new JSDOM(buildShareHtml({
    title: '<script>alert("XSS")</script>',
    titleEn: '<img src=x onerror=alert(1)>',
  }), {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/post/test-post/",
  });
  await loadShare(dom);
  const { document } = dom.window;

  const xLink = document.querySelector('a[data-share="x"]');
  const href = xLink.getAttribute("href");
  // URL 编码后不应包含原始 <script> 标签
  assert.ok(!href.includes("<script>"), "X share URL should not contain unescaped script tag");
  dom.window.close();
});

test("share.js QR overlay escapes translated labels", async () => {
  const dom = new JSDOM(buildShareHtml(), {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/post/test-post/",
  });
  dom.window.cwlT = function (key, fallback) {
    if (key === "post.qr.title") {
      return '<img src=x onerror="alert(1)">';
    }
    if (key === "post.qr.fail") {
      return '<script>alert("xss")</script>';
    }
    return fallback;
  };
  await loadShare(dom);
  const { document } = dom.window;

  document.querySelector('[data-share="wechat"]').click();
  const overlay = document.querySelector(".share-qr-overlay");
  assert.ok(overlay, "should create overlay");
  assert.equal(overlay.querySelectorAll("img, script").length, 0, "translated labels should not create HTML nodes");
  assert.ok(overlay.textContent.includes("<img"), "translated title should render as text");
  assert.ok(overlay.textContent.includes("<script>"), "translated fallback should render as text");
  dom.window.close();
});

// ─── share.js 不使用 innerHTML 写入用户可控内容 ──────────────────────────────

test("share.js does not use innerHTML for user-controlled content", async () => {
  const code = await readFile(join(ROOT, "js", "share.js"), "utf8");
  // QR overlay 的标题通过 textContent 设置
  assert.match(code, /\.textContent\s*=\s*title/, "should set QR title via textContent");
});
