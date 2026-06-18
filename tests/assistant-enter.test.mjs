import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { JSDOM } from "jsdom";

const ROOT = join(import.meta.dirname, "..");

async function loadAssistant() {
  const code = await readFile(join(ROOT, "js", "assistant.js"), "utf8");
  const dom = new JSDOM(
    '<!doctype html><html><body><button class="nav-search-trigger" type="button">Search</button></body></html>',
    {
      runScripts: "outside-only",
      url: "https://wenliang844.github.io/tools/",
    },
  );
  dom.window.localStorage.clear();
  dom.window.eval(code);
  dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded", { bubbles: true }));
  return dom;
}

test("assistant submits the site query when Enter is pressed in the input", async () => {
  const dom = await loadAssistant();
  const { document, KeyboardEvent } = dom.window;
  try {
    document.querySelector(".assistant-fab").click();
    const siteMode = document.querySelector('[data-assistant-mode="site"]');
    if (siteMode) {
      siteMode.click();
    }

    const input = document.querySelector(".assistant-input");
    input.value = "工具箱";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));

    const messages = Array.from(document.querySelectorAll(".assistant-message")).map((node) => node.textContent);
    assert.equal(input.value, "");
    assert.ok(messages.some((message) => message.includes("工具箱")));
    assert.ok(Array.from(document.querySelectorAll(".assistant-message a")).some((link) => link.getAttribute("href") === "/tools/"));
  } finally {
    dom.window.close();
  }
});
