import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { JSDOM } from "jsdom";

const ROOT = join(import.meta.dirname, "..");

async function loadAssistant(options = {}) {
  const code = await readFile(join(ROOT, "js", "assistant.js"), "utf8");
  const dom = new JSDOM(
    "<!doctype html><html><body><button class=\"nav-search-trigger\" type=\"button\">Search</button></body></html>",
    {
      runScripts: "outside-only",
      url: "https://wenliang844.github.io/",
    },
  );
  if (options.lang) {
    dom.window.cwlLang = function () { return options.lang; };
  }
  if (options.translations) {
    dom.window.cwlT = function (key, fallback) {
      return Object.prototype.hasOwnProperty.call(options.translations, key)
        ? options.translations[key]
        : fallback;
    };
  }
  dom.window.eval(code);
  dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded", { bubbles: true }));
  return dom;
}

test("assistant opens, answers locally and escapes user input", async () => {
  const dom = await loadAssistant();
  const { document, KeyboardEvent, Event } = dom.window;

  const toggle = document.querySelector(".assistant-fab");
  assert.ok(toggle, "assistant floating button should be created");
  toggle.click();
  assert.equal(document.body.classList.contains("assistant-open"), true);
  const panel = document.querySelector(".assistant-panel");
  assert.equal(panel.hidden, false);
  assert.equal(panel.getAttribute("role"), "dialog");
  assert.equal(panel.getAttribute("aria-labelledby"), "assistant-title");
  assert.equal(panel.getAttribute("aria-describedby"), "assistant-privacy");

  const input = document.querySelector(".assistant-input");
  input.value = '<img src=x onerror=alert(1)> 工具箱在哪里';
  document.querySelector(".assistant-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

  assert.equal(document.querySelectorAll(".assistant-message.user img").length, 0);
  assert.match(document.querySelector(".assistant-message.user p").textContent, /工具箱在哪里/);
  assert.match([...document.querySelectorAll(".assistant-message.bot p")].pop().textContent, /JSON/);
  assert.ok(
    [...document.querySelectorAll(".assistant-links a")].some((link) => link.getAttribute("href") === "/tools/"),
    "toolbox link should be recommended",
  );

  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.equal(document.querySelector(".assistant-panel").hidden, true);
  assert.equal(document.body.classList.contains("assistant-open"), false);
  assert.equal(document.activeElement, toggle);
});

test("assistant quick search uses the existing search trigger", async () => {
  const dom = await loadAssistant();
  const { document } = dom.window;
  let opened = false;
  document.querySelector(".nav-search-trigger").addEventListener("click", () => {
    opened = true;
  });

  document.querySelector('[data-assistant-action="search"]').click();
  assert.equal(opened, true);
});

test("assistant ranks partial page title matches ahead of generic keywords", async () => {
  const dom = await loadAssistant();
  const { document, Event } = dom.window;

  document.querySelector(".assistant-fab").click();
  const input = document.querySelector(".assistant-input");
  input.value = "工具";
  document.querySelector(".assistant-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

  const firstLink = document.querySelector(".assistant-links a");
  assert.equal(firstLink.textContent, "工具箱");
  assert.equal(firstLink.getAttribute("href"), "/tools/");
});

test("assistant keeps AI navigation discoverable for AI queries", async () => {
  const dom = await loadAssistant();
  const { document, Event } = dom.window;

  document.querySelector(".assistant-fab").click();
  const input = document.querySelector(".assistant-input");
  input.value = "AI";
  document.querySelector(".assistant-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

  const firstLink = document.querySelector(".assistant-links a");
  assert.equal(firstLink.textContent, "AI导航");
  assert.equal(firstLink.getAttribute("href"), "/ai/");
});

test("assistant can render English labels through the i18n bridge", async () => {
  const dom = await loadAssistant({
    lang: "en",
    translations: {
      "assistant.title": "AI Assistant",
      "assistant.privacy": "Local rules only.",
      "assistant.quick.tools": "Open toolbox",
      "assistant.open": "Open AI assistant",
    },
  });
  const { document } = dom.window;

  assert.equal(document.querySelector(".assistant-head strong").textContent, "AI Assistant");
  assert.equal(document.querySelector('[data-assistant-action="tools"]').textContent, "Open toolbox");
  assert.equal(document.querySelector(".assistant-fab").getAttribute("aria-label"), "Open AI assistant");
});

test("assistant panel keeps the hidden attribute effective in CSS", async () => {
  const css = await readFile(join(ROOT, "css", "coder.css"), "utf8");
  assert.match(css, /\.assistant-panel\[hidden\]\s*{\s*display:\s*none;/);
});
