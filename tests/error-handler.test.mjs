// Deep test: error-handler.js — error logging, toast, max logs, resource errors
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { JSDOM } from "jsdom";

const ROOT = join(import.meta.dirname, "..");

async function loadErrorHandler(dom) {
  const code = await readFile(join(ROOT, "js", "error-handler.js"), "utf8");
  dom.window.eval(code);
  return dom.window.CWLErrorHandler;
}

// ─── Exports ──────────────────────────────────────────────────────────────

test("error-handler.js exports CWLErrorHandler with expected methods", async () => {
  const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  const handler = await loadErrorHandler(dom);

  assert.ok(handler, "CWLErrorHandler should be exported");
  assert.equal(typeof handler.log, "function", "should have log method");
  assert.equal(typeof handler.showUserMessage, "function", "should have showUserMessage method");
  assert.equal(typeof handler.getLogs, "function", "should have getLogs method");
  assert.equal(typeof handler.clearLogs, "function", "should have clearLogs method");
  assert.equal(handler.debug, false, "debug should be false by default");
  assert.equal(handler.maxLogs, 50, "maxLogs should be 50");
  dom.window.close();
});

// ─── Error logging ────────────────────────────────────────────────────────

test("error-handler.js logs errors with time, context and message", async () => {
  const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  const handler = await loadErrorHandler(dom);

  const entry = handler.log(new Error("test error"), "unit-test");

  assert.ok(entry.time, "entry should have time");
  assert.equal(entry.context, "unit-test", "entry should have context");
  assert.equal(entry.message, "test error", "entry should have message");
  assert.ok(entry.stack, "entry should have stack");
  assert.ok(entry.userAgent, "entry should have userAgent");
  dom.window.close();
});

// ─── Max logs limit ───────────────────────────────────────────────────────

test("error-handler.js limits logs to maxLogs entries", async () => {
  const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  const handler = await loadErrorHandler(dom);

  for (let i = 0; i < 60; i++) {
    handler.log(new Error(`error ${i}`), "test");
  }

  const logs = handler.getLogs();
  assert.ok(logs.length <= handler.maxLogs, `logs should not exceed ${handler.maxLogs}, got ${logs.length}`);
  // The most recent error should be the last one added
  assert.ok(logs[logs.length - 1].message.includes("error 59"), "most recent log should be preserved");
  dom.window.close();
});

// ─── getLogs returns a copy ───────────────────────────────────────────────

test("error-handler.js getLogs returns a copy of the logs array", async () => {
  const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  const handler = await loadErrorHandler(dom);

  handler.log(new Error("test"), "test");
  const logs1 = handler.getLogs();
  const logs2 = handler.getLogs();

  assert.notEqual(logs1, logs2, "getLogs should return a new array each time");
  assert.deepEqual(logs1, logs2, "contents should be equal");
  dom.window.close();
});

// ─── clearLogs ────────────────────────────────────────────────────────────

test("error-handler.js clearLogs empties the log array", async () => {
  const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  const handler = await loadErrorHandler(dom);

  handler.log(new Error("test"), "test");
  assert.ok(handler.getLogs().length > 0, "should have logs");

  handler.clearLogs();
  assert.equal(handler.getLogs().length, 0, "logs should be empty after clear");
  dom.window.close();
});

// ─── showUserMessage creates toast ────────────────────────────────────────

test("error-handler.js showUserMessage creates a toast element", async () => {
  const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  const handler = await loadErrorHandler(dom);
  const { document } = dom.window;

  handler.showUserMessage("Something went wrong");

  const toast = document.querySelector(".global-error-toast");
  assert.ok(toast, "toast should be created");
  assert.equal(toast.getAttribute("role"), "alert", "toast should have role=alert");
  assert.equal(toast.getAttribute("aria-live"), "assertive", "toast should have aria-live=assertive");

  const text = toast.querySelector("span");
  assert.ok(text, "toast should have text element");
  assert.equal(text.textContent, "Something went wrong", "text should match message");

  const closeBtn = toast.querySelector("button");
  assert.ok(closeBtn, "toast should have close button");
  dom.window.close();
});

// ─── showUserMessage removes existing toast ───────────────────────────────

test("error-handler.js showUserMessage replaces existing toast", async () => {
  const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  const handler = await loadErrorHandler(dom);
  const { document } = dom.window;

  handler.showUserMessage("First message");
  handler.showUserMessage("Second message");

  const toasts = document.querySelectorAll(".global-error-toast");
  assert.equal(toasts.length, 1, "should only have one toast at a time");
  assert.equal(toasts[0].querySelector("span").textContent, "Second message", "should show latest message");
  dom.window.close();
});

// ─── Toast close button ──────────────────────────────────────────────────

test("error-handler.js toast close button removes the toast", async () => {
  const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  const handler = await loadErrorHandler(dom);
  const { document } = dom.window;

  handler.showUserMessage("Test message");
  const toast = document.querySelector(".global-error-toast");
  assert.ok(toast, "toast should exist");

  const closeBtn = toast.querySelector("button");
  closeBtn.click();

  const removed = document.querySelector(".global-error-toast");
  assert.equal(removed, null, "toast should be removed after close click");
  dom.window.close();
});

// ─── Toast uses textContent not innerHTML ──────────────────────────────────

test("error-handler.js toast uses safe DOM APIs", async () => {
  const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  const handler = await loadErrorHandler(dom);
  const { document } = dom.window;

  handler.showUserMessage('<script>alert("xss")</script>');

  const toast = document.querySelector(".global-error-toast");
  assert.ok(!toast.innerHTML.includes('<script>alert("xss")</script>'), "XSS should not be executed");
  // textContent should contain the literal text
  assert.ok(toast.textContent.includes('<script>alert("xss")</script>'), "should contain escaped text");
  dom.window.close();
});

// ─── Error handler registers global listeners ─────────────────────────────

test("error-handler.js registers global error and unhandledrejection handlers", async () => {
  const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  const code = await readFile(join(ROOT, "js", "error-handler.js"), "utf8");
  dom.window.eval(code);
  const { document } = dom.window;

  // Injected style tag for toast
  const styles = document.querySelectorAll("style");
  const hasToastStyle = Array.from(styles).some((s) => s.textContent.includes(".global-error-toast"));
  assert.ok(hasToastStyle, "should inject toast styles");
  dom.window.close();
});

// ─── String error logging ─────────────────────────────────────────────────

test("error-handler.js handles string errors gracefully", async () => {
  const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  const handler = await loadErrorHandler(dom);

  const entry = handler.log("plain string error", "test");
  assert.equal(entry.message, "plain string error", "should handle string errors");
  dom.window.close();
});
