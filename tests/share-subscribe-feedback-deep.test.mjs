// 深度测试: share.js, subscribe.js, feedback.js — 分享、订阅、反馈的边缘情况
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { JSDOM } from "jsdom";

const ROOT = join(import.meta.dirname, "..");

// ═══════════════════════════════════════════════════════════════════════════════
// share.js 测试
// ═══════════════════════════════════════════════════════════════════════════════

function buildShareHtml() {
  return `<!doctype html><html lang="zh-CN"><body class="colorscheme-dark">
  <div class="post-share" data-share-url="/post/test-article/" data-share-title="测试文章" data-share-title-en="Test Article">
    <a data-share="x" href="#">X</a>
    <a data-share="weibo" href="#">Weibo</a>
    <a data-share="copy" href="#">Copy</a>
    <a data-share="wechat" href="#">WeChat</a>
  </div>
</body></html>`;
}

async function loadShare(dom) {
  const utilsCode = await readFile(join(ROOT, "js", "utils.js"), "utf8");
  dom.window.eval(utilsCode);
  const i18nCode = await readFile(join(ROOT, "js", "i18n.js"), "utf8");
  dom.window.eval(i18nCode);
  const code = await readFile(join(ROOT, "js", "share.js"), "utf8");
  dom.window.eval(code);
}

test("share.js converts relative URL to absolute using origin", async () => {
  const dom = new JSDOM(buildShareHtml(), {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/post/test/",
    pretendToBeVisual: true,
  });

  await loadShare(dom);

  const xLink = dom.window.document.querySelector('[data-share="x"]');
  const href = xLink.getAttribute("href");
  // The href should contain the X intent URL with the encoded article path
  assert.ok(href && href.includes("x.com/intent/tweet"), "should be X intent URL");
  // The URL param is encoded, so check for the encoded form
  assert.ok(href.includes(encodeURIComponent("/post/test-article/")),
    "should include URL-encoded article path");

  dom.window.close();
});

test("share.js already absolute URL is kept unchanged", async () => {
  const html = `<!doctype html><html lang="zh-CN"><body class="colorscheme-dark">
  <div class="post-share" data-share-url="https://other.com/post/test/" data-share-title="Test" data-share-title-en="Test">
    <a data-share="x" href="#">X</a>
  </div>
</body></html>`;

  const dom = new JSDOM(html, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
    pretendToBeVisual: true,
  });

  await loadShare(dom);

  const xLink = dom.window.document.querySelector('[data-share="x"]');
  const href = xLink.getAttribute("href");
  assert.ok(href && href.includes("other.com"), "absolute URL should be preserved in X intent");

  dom.window.close();
});

test("share.js English title uses data-share-title-en", async () => {
  const dom = new JSDOM(buildShareHtml(), {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
    pretendToBeVisual: true,
  });

  // Switch to English BEFORE loading share (so updateXLink uses EN title)
  await loadAssistantDepsFn(dom);
  dom.window.cwlSetLang("en");

  const shareCode = await readFile(join(ROOT, "js", "share.js"), "utf8");
  dom.window.eval(shareCode);

  const xLink = dom.window.document.querySelector('[data-share="x"]');
  const href = xLink.getAttribute("href");
  assert.ok(href && href.includes(encodeURIComponent("Test Article")),
    "should use English title in English mode");

  dom.window.close();
});

async function loadAssistantDepsFn(dom) {
  const utilsCode = await readFile(join(ROOT, "js", "utils.js"), "utf8");
  dom.window.eval(utilsCode);
  const i18nCode = await readFile(join(ROOT, "js", "i18n.js"), "utf8");
  dom.window.eval(i18nCode);
}

test("share.js English mode falls back to Chinese title when EN missing", async () => {
  const html = `<!doctype html><html lang="zh-CN"><body class="colorscheme-dark">
  <div class="post-share" data-share-url="/post/test/" data-share-title="中文标题">
    <a data-share="x" href="#">X</a>
  </div>
</body></html>`;

  const dom = new JSDOM(html, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
    pretendToBeVisual: true,
  });

  await loadShare(dom);
  dom.window.cwlSetLang("en");

  const xLink = dom.window.document.querySelector('[data-share="x"]');
  const href = xLink.getAttribute("href");
  assert.ok(href.includes(encodeURIComponent("中文标题")),
    "should fall back to Chinese title when EN is missing");

  dom.window.close();
});

test("share.js weibo button opens share window", async () => {
  const dom = new JSDOM(buildShareHtml(), {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/post/test/",
    pretendToBeVisual: true,
  });

  let openedUrl = null;
  dom.window.open = function (url) { openedUrl = url; };

  await loadShare(dom);

  const weiboBtn = dom.window.document.querySelector('[data-share="weibo"]');
  weiboBtn.click();

  assert.ok(openedUrl, "window.open should be called for weibo");
  assert.ok(openedUrl.includes("service.weibo.com/share"), "should be weibo share URL");
  assert.ok(openedUrl.includes(encodeURIComponent("https://wenliang844.github.io/post/test-article/")),
    "should include article URL");

  dom.window.close();
});

test("share.js QR overlay has correct ARIA attributes", async () => {
  const dom = new JSDOM(buildShareHtml(), {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
    pretendToBeVisual: true,
  });

  // Mock qrcode to return a valid SVG
  dom.window.qrcode = function () {
    return {
      addData: function () {},
      make: function () {},
      createSvgTag: function () { return '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>'; },
    };
  };

  await loadShare(dom);

  const wechatBtn = dom.window.document.querySelector('[data-share="wechat"]');
  wechatBtn.click();

  const card = dom.window.document.querySelector(".share-qr-card");
  assert.ok(card, "QR card should exist");
  assert.equal(card.getAttribute("role"), "dialog", "should have dialog role");
  assert.equal(card.getAttribute("aria-modal"), "true", "should have aria-modal");
  assert.ok(card.getAttribute("aria-label"), "should have aria-label");

  // Cleanup
  const overlay = dom.window.document.querySelector(".share-qr-overlay");
  if (overlay) { overlay.remove(); }
  dom.window.close();
});

test("share.js QR overlay closes on Escape", async () => {
  const dom = new JSDOM(buildShareHtml(), {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
    pretendToBeVisual: true,
  });

  dom.window.qrcode = function () {
    return {
      addData: function () {},
      make: function () {},
      createSvgTag: function () { return '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>'; },
    };
  };

  await loadShare(dom);

  const wechatBtn = dom.window.document.querySelector('[data-share="wechat"]');
  wechatBtn.click();

  let overlay = dom.window.document.querySelector(".share-qr-overlay");
  assert.ok(overlay, "overlay should exist");

  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
  }));

  overlay = dom.window.document.querySelector(".share-qr-overlay");
  assert.ok(!overlay, "overlay should be removed on Escape");

  dom.window.close();
});

test("share.js flashCopied prevents double-click", async () => {
  const dom = new JSDOM(buildShareHtml(), {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
    pretendToBeVisual: true,
  });

  // Load utils first and override copyText BEFORE loading share.js
  const utilsCode = await readFile(join(ROOT, "js", "utils.js"), "utf8");
  dom.window.eval(utilsCode);
  dom.window.CWLUtils.copyText = function () { return Promise.resolve(); };

  const i18nCode = await readFile(join(ROOT, "js", "i18n.js"), "utf8");
  dom.window.eval(i18nCode);
  const shareCode = await readFile(join(ROOT, "js", "share.js"), "utf8");
  dom.window.eval(shareCode);

  const copyBtn = dom.window.document.querySelector('[data-share="copy"]');

  // First click triggers copy → flashCopied
  copyBtn.click();
  await new Promise((r) => setTimeout(r, 20));

  assert.ok(copyBtn.classList.contains("copied"), "should be marked as copied after first click");

  // Second immediate click should be ignored by flashCopied guard
  const innerBefore = copyBtn.innerHTML;
  copyBtn.click();
  assert.equal(copyBtn.innerHTML, innerBefore, "second click should not change content");

  dom.window.close();
});

test("share.js copy falls back to QR on clipboard failure", async () => {
  const dom = new JSDOM(buildShareHtml(), {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
    pretendToBeVisual: true,
  });

  await loadShare(dom);

  // Override CWLUtils.copyText to fail after loading
  dom.window.CWLUtils.copyText = function () { return Promise.reject(new Error("clipboard error")); };

  dom.window.qrcode = function () {
    return {
      addData: function () {},
      make: function () {},
      createSvgTag: function () { return '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>'; },
    };
  };

  const copyBtn = dom.window.document.querySelector('[data-share="copy"]');
  copyBtn.click();

  // Wait for promise rejection and QR fallback
  await new Promise((r) => setTimeout(r, 100));

  const overlay = dom.window.document.querySelector(".share-qr-overlay");
  assert.ok(overlay, "QR overlay should appear as fallback");

  overlay.remove();
  dom.window.close();
});

test("share.js exits without share bars", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    runScripts: "outside-only",
    url: "https://example.com/",
    pretendToBeVisual: true,
  });

  const utilsCode = await readFile(join(ROOT, "js", "utils.js"), "utf8");
  dom.window.eval(utilsCode);
  const i18nCode = await readFile(join(ROOT, "js", "i18n.js"), "utf8");
  dom.window.eval(i18nCode);

  const code = await readFile(join(ROOT, "js", "share.js"), "utf8");
  // Should not throw
  dom.window.eval(code);
  assert.ok(true, "should exit gracefully without share bars");

  dom.window.close();
});

// ═══════════════════════════════════════════════════════════════════════════════
// subscribe.js 测试
// ═══════════════════════════════════════════════════════════════════════════════

function buildSubscribeHtml() {
  return `<!doctype html><html lang="zh-CN"><body class="colorscheme-dark">
  <div class="subscribe">
    <form class="subscribe-form">
      <input class="subscribe-input" type="email" placeholder="Email">
      <button class="subscribe-btn" type="submit">Subscribe</button>
      <p class="subscribe-status"></p>
    </form>
  </div>
  <button data-subscribe-open type="button">Open Modal</button>
</body></html>`;
}

async function loadSubscribe(dom) {
  const utilsCode = await readFile(join(ROOT, "js", "utils.js"), "utf8");
  dom.window.eval(utilsCode);
  const i18nCode = await readFile(join(ROOT, "js", "i18n.js"), "utf8");
  dom.window.eval(i18nCode);
  const code = await readFile(join(ROOT, "js", "subscribe.js"), "utf8");
  dom.window.eval(code);
}

test("subscribe.js sends correct fetch request on valid email", async () => {
  const dom = new JSDOM(buildSubscribeHtml(), {
    runScripts: "outside-only",
    url: "https://example.com/",
    pretendToBeVisual: true,
  });

  let fetchUrl = null;
  let fetchOpts = null;
  dom.window.fetch = async function (url, opts) {
    fetchUrl = url;
    fetchOpts = opts;
    return new Response("", { status: 200 });
  };

  await loadSubscribe(dom);

  const input = dom.window.document.querySelector(".subscribe-input");
  const form = dom.window.document.querySelector(".subscribe-form");

  input.value = "test@example.com";
  form.dispatchEvent(new dom.window.Event("submit", { cancelable: true }));

  // Wait for fetch
  await new Promise((r) => setTimeout(r, 50));

  assert.ok(fetchUrl, "fetch should be called");
  assert.ok(fetchUrl.includes("buttondown.com"), "should call Buttondown endpoint");
  assert.ok(fetchUrl.includes("cwl"), "should include username");
  assert.equal(fetchOpts.method, "POST", "should use POST");
  assert.equal(fetchOpts.mode, "no-cors", "should use no-cors mode");

  dom.window.close();
});

test("subscribe.js shows error for invalid email", async () => {
  const dom = new JSDOM(buildSubscribeHtml(), {
    runScripts: "outside-only",
    url: "https://example.com/",
    pretendToBeVisual: true,
  });

  let fetchCalled = false;
  dom.window.fetch = async function () { fetchCalled = true; return new Response(""); };

  await loadSubscribe(dom);

  const input = dom.window.document.querySelector(".subscribe-input");
  const form = dom.window.document.querySelector(".subscribe-form");

  input.value = "not-an-email";
  form.dispatchEvent(new dom.window.Event("submit", { cancelable: true }));

  await new Promise((r) => setTimeout(r, 20));

  assert.ok(!fetchCalled, "fetch should not be called for invalid email");
  assert.ok(input.classList.contains("is-invalid"), "input should be marked invalid");

  dom.window.close();
});

test("subscribe.js shows success message after submission", async () => {
  const dom = new JSDOM(buildSubscribeHtml(), {
    runScripts: "outside-only",
    url: "https://example.com/",
    pretendToBeVisual: true,
  });

  dom.window.fetch = async function () { return new Response("", { status: 200 }); };

  await loadSubscribe(dom);

  const input = dom.window.document.querySelector(".subscribe-input");
  const form = dom.window.document.querySelector(".subscribe-form");
  const status = dom.window.document.querySelector(".subscribe-status");

  input.value = "user@example.com";
  form.dispatchEvent(new dom.window.Event("submit", { cancelable: true }));

  await new Promise((r) => setTimeout(r, 50));

  assert.ok(status.textContent.length > 0, "should show status message");
  assert.ok(status.textContent.includes("查收") || status.textContent.includes("确认") || status.textContent.includes("success"),
    "should show success message");

  dom.window.close();
});

test("subscribe.js modal opens on trigger click", async () => {
  const dom = new JSDOM(buildSubscribeHtml(), {
    runScripts: "outside-only",
    url: "https://example.com/",
    pretendToBeVisual: true,
  });

  await loadSubscribe(dom);

  const trigger = dom.window.document.querySelector("[data-subscribe-open]");
  trigger.click();

  const modal = dom.window.document.querySelector(".subscribe-modal");
  assert.ok(modal, "modal should be created");
  assert.ok(modal.classList.contains("open"), "modal should be open");

  dom.window.close();
});

test("subscribe.js modal closes on Escape", async () => {
  const dom = new JSDOM(buildSubscribeHtml(), {
    runScripts: "outside-only",
    url: "https://example.com/",
    pretendToBeVisual: true,
  });

  await loadSubscribe(dom);

  dom.window.document.querySelector("[data-subscribe-open]").click();
  const modal = dom.window.document.querySelector(".subscribe-modal");
  assert.ok(modal.classList.contains("open"));

  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
  }));

  assert.ok(!modal.classList.contains("open"), "modal should close on Escape");

  dom.window.close();
});

// ═══════════════════════════════════════════════════════════════════════════════
// feedback.js 测试
// ═══════════════════════════════════════════════════════════════════════════════

function buildFeedbackHtml() {
  return `<!doctype html><html lang="zh-CN"><body class="colorscheme-dark">
  <form id="feedback-form">
    <input id="fb-name" type="text" value="">
    <input id="fb-contact" type="text" value="">
    <textarea id="fb-message"></textarea>
    <button type="submit">Submit</button>
  </form>
  <p id="feedback-status"></p>
  <ul id="feedback-list"></ul>
</body></html>`;
}

async function loadFeedback(dom) {
  const utilsCode = await readFile(join(ROOT, "js", "utils.js"), "utf8");
  dom.window.eval(utilsCode);
  const i18nCode = await readFile(join(ROOT, "js", "i18n.js"), "utf8");
  dom.window.eval(i18nCode);
  const code = await readFile(join(ROOT, "js", "feedback.js"), "utf8");
  dom.window.eval(code);
}

test("feedback.js load handles corrupted localStorage", async () => {
  const dom = new JSDOM(buildFeedbackHtml(), {
    runScripts: "outside-only",
    url: "https://example.com/",
    pretendToBeVisual: true,
  });

  // Store invalid JSON
  dom.window.localStorage.setItem("wenliang-feedback", "not valid json{{{");

  await loadFeedback(dom);

  const list = dom.window.document.getElementById("feedback-list");
  const empty = list.querySelector(".feedback-empty");
  assert.ok(empty, "should show empty state for corrupted data");

  dom.window.close();
});

test("feedback.js load handles non-array localStorage data", async () => {
  const dom = new JSDOM(buildFeedbackHtml(), {
    runScripts: "outside-only",
    url: "https://example.com/",
    pretendToBeVisual: true,
  });

  dom.window.localStorage.setItem("wenliang-feedback", '{"not":"array"}');

  await loadFeedback(dom);

  const list = dom.window.document.getElementById("feedback-list");
  const empty = list.querySelector(".feedback-empty");
  assert.ok(empty, "should show empty state for non-array data");

  dom.window.close();
});

test("feedback.js formatTime returns empty for invalid date", async () => {
  const dom = new JSDOM(buildFeedbackHtml(), {
    runScripts: "outside-only",
    url: "https://example.com/",
    pretendToBeVisual: true,
  });

  await loadFeedback(dom);

  // Add a feedback entry with invalid date
  dom.window.localStorage.setItem("wenliang-feedback", JSON.stringify([{
    id: "1",
    name: "Test",
    message: "msg",
    time: "not-a-valid-date",
  }]));

  // Trigger re-render via language change
  dom.window.document.dispatchEvent(new dom.window.Event("cwl:langchange"));

  const meta = dom.window.document.querySelector(".feedback-item .meta");
  if (meta) {
    const metaText = meta.textContent;
    // Invalid dates should render as empty string
    assert.ok(!metaText.includes("NaN"), "should not show NaN for invalid dates");
  }

  dom.window.close();
});

test("feedback.js form submission creates entry", async () => {
  const dom = new JSDOM(buildFeedbackHtml(), {
    runScripts: "outside-only",
    url: "https://example.com/",
    pretendToBeVisual: true,
  });

  await loadFeedback(dom);

  const nameInput = dom.window.document.getElementById("fb-name");
  const messageInput = dom.window.document.getElementById("fb-message");
  const form = dom.window.document.getElementById("feedback-form");

  nameInput.value = "Test User";
  messageInput.value = "This is a test feedback message";

  form.dispatchEvent(new dom.window.Event("submit", { cancelable: true }));

  const items = dom.window.document.querySelectorAll(".feedback-item");
  assert.ok(items.length >= 1, "should have at least one feedback item");

  const firstItem = items[0];
  assert.ok(firstItem.textContent.includes("Test User"), "should show user name");
  assert.ok(firstItem.textContent.includes("This is a test feedback message"), "should show message");

  dom.window.close();
});

test("feedback.js rejects empty message", async () => {
  const dom = new JSDOM(buildFeedbackHtml(), {
    runScripts: "outside-only",
    url: "https://example.com/",
    pretendToBeVisual: true,
  });

  await loadFeedback(dom);

  const messageInput = dom.window.document.getElementById("fb-message");
  const form = dom.window.document.getElementById("feedback-form");
  const status = dom.window.document.getElementById("feedback-status");

  messageInput.value = "   "; // whitespace only
  form.dispatchEvent(new dom.window.Event("submit", { cancelable: true }));

  assert.ok(status.textContent.length > 0, "should show error status");
  assert.ok(dom.window.document.querySelectorAll(".feedback-item").length === 0, "should not create item");

  dom.window.close();
});

test("feedback.js language change re-renders the list", async () => {
  const dom = new JSDOM(buildFeedbackHtml(), {
    runScripts: "outside-only",
    url: "https://example.com/",
    pretendToBeVisual: true,
  });

  await loadFeedback(dom);

  // Submit a message
  const messageInput = dom.window.document.getElementById("fb-message");
  messageInput.value = "Test message";
  dom.window.document.getElementById("feedback-form")
    .dispatchEvent(new dom.window.Event("submit", { cancelable: true }));

  const initialCount = dom.window.document.querySelectorAll(".feedback-item").length;

  // Trigger language change
  dom.window.document.dispatchEvent(new dom.window.Event("cwl:langchange"));

  const afterCount = dom.window.document.querySelectorAll(".feedback-item").length;
  assert.equal(afterCount, initialCount, "should re-render same number of items");

  dom.window.close();
});
