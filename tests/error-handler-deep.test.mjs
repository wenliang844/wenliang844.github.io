// Deep test: error-handler.js — 错误日志、toast 渲染、maxLogs 限制、资源错误处理
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { JSDOM } from "jsdom";

const ROOT = join(import.meta.dirname, "..");

async function loadErrorHandler(dom) {
  const code = await readFile(join(ROOT, "js", "error-handler.js"), "utf8");
  dom.window.eval(code);
  return dom;
}

// ─── 初始状态 ──────────────────────────────────────────────────────────────

test("error-handler.js initializes with empty logs", async () => {
  const dom = new JSDOM(`<!doctype html><html><head></head><body></body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  await loadErrorHandler(dom);
  const handler = dom.window.CWLErrorHandler;
  assert.ok(handler, "should export CWLErrorHandler");
  assert.equal(handler.getLogs().length, 0, "should start with no logs");
  assert.equal(handler.debug, false);
  dom.window.close();
});

// ─── log 函数记录错误 ──────────────────────────────────────────────────────

test("error-handler.js log records error entries", async () => {
  const dom = new JSDOM(`<!doctype html><html><head></head><body></body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  await loadErrorHandler(dom);
  const handler = dom.window.CWLErrorHandler;

  const entry = handler.log(new Error("test error"), "test-context");
  assert.ok(entry.time, "should have timestamp");
  assert.equal(entry.context, "test-context");
  assert.equal(entry.message, "test error");
  assert.ok(entry.stack, "should have stack trace");

  const logs = handler.getLogs();
  assert.equal(logs.length, 1);
  dom.window.close();
});

// ─── maxLogs 限制 ──────────────────────────────────────────────────────────

test("error-handler.js caps logs at maxLogs (50)", async () => {
  const dom = new JSDOM(`<!doctype html><html><head></head><body></body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  await loadErrorHandler(dom);
  const handler = dom.window.CWLErrorHandler;

  for (let i = 0; i < 60; i++) {
    handler.log(new Error(`error ${i}`), "test");
  }

  const logs = handler.getLogs();
  assert.equal(logs.length, 50, "should cap at 50 entries");
  // 最早的应该被移除
  assert.ok(logs[0].message.includes("error 10"), "oldest entries should be shifted out");
  dom.window.close();
});

// ─── clearLogs 清空日志 ────────────────────────────────────────────────────

test("error-handler.js clearLogs empties the log array", async () => {
  const dom = new JSDOM(`<!doctype html><html><head></head><body></body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  await loadErrorHandler(dom);
  const handler = dom.window.CWLErrorHandler;

  handler.log(new Error("err1"), "ctx");
  handler.log(new Error("err2"), "ctx");
  assert.equal(handler.getLogs().length, 2);

  handler.clearLogs();
  assert.equal(handler.getLogs().length, 0);
  dom.window.close();
});

// ─── getLogs 返回副本 ──────────────────────────────────────────────────────

test("error-handler.js getLogs returns a copy", async () => {
  const dom = new JSDOM(`<!doctype html><html><head></head><body></body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  await loadErrorHandler(dom);
  const handler = dom.window.CWLErrorHandler;

  handler.log(new Error("err"), "ctx");
  const logs1 = handler.getLogs();
  const logs2 = handler.getLogs();
  assert.notEqual(logs1, logs2, "should return different array instances");
  assert.equal(logs1.length, logs2.length);
  dom.window.close();
});

// ─── showUserMessage 创建 toast ─────────────────────────────────────────────

test("error-handler.js showUserMessage creates error toast", async () => {
  const dom = new JSDOM(`<!doctype html><html><head></head><body></body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  await loadErrorHandler(dom);
  const { document } = dom.window;

  dom.window.CWLErrorHandler.showUserMessage("Something went wrong");

  const toast = document.querySelector(".global-error-toast");
  assert.ok(toast, "should create toast element");
  assert.equal(toast.getAttribute("role"), "alert");
  assert.equal(toast.getAttribute("aria-live"), "assertive");

  const text = toast.querySelector("span");
  assert.equal(text.textContent, "Something went wrong");

  const closeBtn = toast.querySelector(".error-toast-close");
  assert.ok(closeBtn, "should have close button");
  dom.window.close();
});

// ─── toast 关闭按钮 ────────────────────────────────────────────────────────

test("error-handler.js toast close button removes toast", async () => {
  const dom = new JSDOM(`<!doctype html><html><head></head><body></body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  await loadErrorHandler(dom);
  const { document } = dom.window;

  dom.window.CWLErrorHandler.showUserMessage("Error");
  assert.ok(document.querySelector(".global-error-toast"), "toast should exist");

  document.querySelector(".error-toast-close").click();
  assert.ok(!document.querySelector(".global-error-toast"), "toast should be removed");
  dom.window.close();
});

// ─── 重复调用 showUserMessage 替换旧 toast ──────────────────────────────────

test("error-handler.js replaces existing toast on repeated calls", async () => {
  const dom = new JSDOM(`<!doctype html><html><head></head><body></body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  await loadErrorHandler(dom);
  const { document } = dom.window;

  dom.window.CWLErrorHandler.showUserMessage("First error");
  dom.window.CWLErrorHandler.showUserMessage("Second error");

  const toasts = document.querySelectorAll(".global-error-toast");
  assert.equal(toasts.length, 1, "should only have one toast");
  assert.equal(toasts[0].querySelector("span").textContent, "Second error");
  dom.window.close();
});

// ─── 错误处理注入样式 ──────────────────────────────────────────────────────

test("error-handler.js injects toast styles into document head", async () => {
  const dom = new JSDOM(`<!doctype html><html><head></head><body></body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  await loadErrorHandler(dom);
  const { document } = dom.window;

  const style = document.querySelector("head style");
  assert.ok(style, "should inject style element");
  assert.ok(style.textContent.includes(".global-error-toast"), "style should include toast CSS");
  assert.ok(style.textContent.includes("@keyframes slideInRight"), "style should include animation");
  dom.window.close();
});

// ─── 静态分析：不使用 innerHTML ─────────────────────────────────────────────

test("error-handler.js uses safe DOM methods", async () => {
  const code = await readFile(join(ROOT, "js", "error-handler.js"), "utf8");
  // toast 渲染应使用 createElement 和 textContent
  assert.match(code, /document\.createElement/, "should use createElement");
  assert.match(code, /\.textContent\s*=/, "should use textContent");
  assert.doesNotMatch(code, /\.innerHTML\s*=/, "should not use innerHTML assignment");
});

// ─── userAgent 记录 ─────────────────────────────────────────────────────────

test("error-handler.js includes userAgent in log entries", async () => {
  const dom = new JSDOM(`<!doctype html><html><head></head><body></body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  await loadErrorHandler(dom);
  const handler = dom.window.CWLErrorHandler;

  handler.log(new Error("test"), "ctx");
  const entry = handler.getLogs()[0];
  assert.ok(typeof entry.userAgent === "string", "should include userAgent");
  dom.window.close();
});

// ─── 字符串错误也能记录 ─────────────────────────────────────────────────────

test("error-handler.js handles non-Error objects gracefully", async () => {
  const dom = new JSDOM(`<!doctype html><html><head></head><body></body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  await loadErrorHandler(dom);
  const handler = dom.window.CWLErrorHandler;

  // 传入一个简单对象
  const entry = handler.log({ message: "simple error" }, "ctx");
  assert.equal(entry.message, "simple error");
  dom.window.close();
});
