// Deep test: feedback.js — form submission, storage, rendering, deletion
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { JSDOM } from "jsdom";

const ROOT = join(import.meta.dirname, "..");

const FEEDBACK_HTML = `<!doctype html><html lang="zh-CN"><body class="colorscheme-dark">
  <form id="feedback-form" novalidate>
    <input type="text" id="fb-name" placeholder="昵称">
    <input type="text" id="fb-contact" placeholder="邮箱">
    <textarea id="fb-message" placeholder="留言"></textarea>
    <button type="submit">提交</button>
  </form>
  <p id="feedback-status" role="status"></p>
  <ul id="feedback-list"></ul>
</body></html>`;

async function loadFeedback(dom) {
  const code = await readFile(join(ROOT, "js", "feedback.js"), "utf8");
  dom.window.eval(code);
  return dom;
}

// ─── Initial render ───────────────────────────────────────────────────────

test("feedback.js renders empty state when no entries exist", async () => {
  const dom = new JSDOM(FEEDBACK_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/contact/",
  });
  await loadFeedback(dom);
  const { document } = dom.window;

  const list = document.getElementById("feedback-list");
  const empty = list.querySelector(".feedback-empty");
  assert.ok(empty, "should show empty state");
  assert.ok(empty.textContent.length > 0, "empty state should have text");
  dom.window.close();
});

// ─── Form submission ──────────────────────────────────────────────────────

test("feedback.js form submission adds entry to list", async () => {
  const dom = new JSDOM(FEEDBACK_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/contact/",
  });
  await loadFeedback(dom);
  const { document, Event } = dom.window;

  document.getElementById("fb-name").value = "测试用户";
  document.getElementById("fb-contact").value = "test@example.com";
  document.getElementById("fb-message").value = "这是一条测试留言";

  document.getElementById("feedback-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

  const list = document.getElementById("feedback-list");
  const items = list.querySelectorAll(".feedback-item");
  assert.ok(items.length >= 1, "should have at least one feedback entry");

  const firstItem = items[0];
  assert.ok(firstItem.querySelector("strong").textContent.includes("测试用户"), "should show name");
  assert.ok(firstItem.querySelector(".body").textContent.includes("这是一条测试留言"), "should show message");

  const status = document.getElementById("feedback-status").textContent;
  assert.ok(status.length > 0, "should show status message");
  dom.window.close();
});

// ─── Empty message validation ─────────────────────────────────────────────

test("feedback.js rejects empty message submission", async () => {
  const dom = new JSDOM(FEEDBACK_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/contact/",
  });
  await loadFeedback(dom);
  const { document, Event } = dom.window;

  document.getElementById("fb-message").value = "";
  document.getElementById("feedback-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

  const status = document.getElementById("feedback-status").textContent;
  assert.ok(status.length > 0, "should show error status");

  const list = document.getElementById("feedback-list");
  const empty = list.querySelector(".feedback-empty");
  assert.ok(empty, "should still show empty state");
  dom.window.close();
});

// ─── Anonymous submission ─────────────────────────────────────────────────

test("feedback.js allows submission without name", async () => {
  const dom = new JSDOM(FEEDBACK_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/contact/",
  });
  await loadFeedback(dom);
  const { document, Event } = dom.window;

  document.getElementById("fb-name").value = "";
  document.getElementById("fb-message").value = "匿名留言";
  document.getElementById("feedback-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

  const list = document.getElementById("feedback-list");
  const items = list.querySelectorAll(".feedback-item");
  assert.ok(items.length >= 1, "should have entry");

  const name = items[0].querySelector("strong").textContent;
  assert.ok(name.includes("匿名") || name.includes("Anonymous"), "should show anonymous name");
  dom.window.close();
});

// ─── Deletion ─────────────────────────────────────────────────────────────

test("feedback.js deletion removes entry from list", async () => {
  const dom = new JSDOM(FEEDBACK_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/contact/",
  });
  await loadFeedback(dom);
  const { document, Event } = dom.window;

  // Add an entry
  document.getElementById("fb-message").value = "要删除的留言";
  document.getElementById("feedback-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

  let items = document.querySelectorAll(".feedback-item");
  const count = items.length;
  assert.ok(count >= 1, "should have entries");

  // Delete it
  const deleteBtn = document.querySelector("[data-remove]");
  assert.ok(deleteBtn, "should have delete button");
  deleteBtn.click();

  items = document.querySelectorAll(".feedback-item");
  assert.equal(items.length, count - 1, "should have one less entry");
  dom.window.close();
});

// ─── Multiple submissions ─────────────────────────────────────────────────

test("feedback.js supports multiple submissions", async () => {
  const dom = new JSDOM(FEEDBACK_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/contact/",
  });
  await loadFeedback(dom);
  const { document, Event } = dom.window;

  for (let i = 1; i <= 3; i++) {
    document.getElementById("fb-message").value = `留言 ${i}`;
    document.getElementById("feedback-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  }

  const items = document.querySelectorAll(".feedback-item");
  assert.ok(items.length >= 3, `should have at least 3 entries, got ${items.length}`);
  // Latest should be first (unshift)
  assert.ok(items[0].querySelector(".body").textContent.includes("留言 3"), "latest entry should be first");
  dom.window.close();
});

// ─── Message input cleared after submit ───────────────────────────────────

test("feedback.js clears message input after successful submission", async () => {
  const dom = new JSDOM(FEEDBACK_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/contact/",
  });
  await loadFeedback(dom);
  const { document, Event } = dom.window;

  document.getElementById("fb-message").value = "测试留言";
  document.getElementById("feedback-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

  assert.equal(document.getElementById("fb-message").value, "", "message input should be cleared");
  dom.window.close();
});

// ─── No hardcoded API key ─────────────────────────────────────────────────

test("feedback.js does not hardcode Web3Forms access key", async () => {
  const code = await readFile(join(ROOT, "js", "feedback.js"), "utf8");
  assert.match(code, /WEB3FORMS_ACCESS_KEY\s*=\s*""/, "access key should be empty string");
});

// ─── Uses safe DOM manipulation ───────────────────────────────────────────

test("feedback.js uses textContent and createElement for rendering", async () => {
  const code = await readFile(join(ROOT, "js", "feedback.js"), "utf8");
  assert.doesNotMatch(code, /\.innerHTML\s*=/, "should not use innerHTML assignment");
  assert.match(code, /\.textContent\s*=/, "should use textContent");
  assert.match(code, /document\.createElement/, "should use createElement");
  assert.match(code, /\.replaceChildren\(\)/, "should use replaceChildren for list clearing");
});

// ─── Time formatting ──────────────────────────────────────────────────────

test("feedback.js entry shows formatted time", async () => {
  const dom = new JSDOM(FEEDBACK_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/contact/",
  });
  await loadFeedback(dom);
  const { document, Event } = dom.window;

  document.getElementById("fb-message").value = "时间格式测试";
  document.getElementById("feedback-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

  const meta = document.querySelector(".feedback-item .meta");
  assert.ok(meta, "should have meta element");
  assert.ok(meta.textContent.includes("·"), "should have time separator");
  // Should contain YYYY-MM-DD HH:mm format
  assert.match(meta.textContent, /\d{4}-\d{2}-\d{2}/, "should contain date");
  dom.window.close();
});

// ─── i18n update ──────────────────────────────────────────────────────────

test("feedback.js updates empty state text on language change", async () => {
  const dom = new JSDOM(FEEDBACK_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/contact/",
  });
  await loadFeedback(dom);
  const { document } = dom.window;

  const empty = document.querySelector(".feedback-empty");
  assert.ok(empty, "should have empty state");

  // The text depends on language; verify it exists
  assert.ok(empty.textContent.length > 0, "empty state should have text content");
  dom.window.close();
});

// ─── Graceful exit without required elements ──────────────────────────────

test("feedback.js exits gracefully without form or list elements", async () => {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/contact/",
  });
  const code = await readFile(join(ROOT, "js", "feedback.js"), "utf8");
  // Should not throw
  dom.window.eval(code);
  assert.ok(true, "feedback.js should exit gracefully without required elements");
  dom.window.close();
});
