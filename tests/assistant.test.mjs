import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { JSDOM } from "jsdom";

const ROOT = join(import.meta.dirname, "..");
const DISMISS_KEY = "cwl.assistant.dismissed";

async function loadAssistant(options = {}) {
  const code = await readFile(join(ROOT, "js", "assistant.js"), "utf8");
  const body = options.body || '<button class="nav-search-trigger" type="button">Search</button>';
  const dom = new JSDOM(
    `<!doctype html><html><body>${body}</body></html>`,
    {
      runScripts: "outside-only",
      url: options.url || "https://assistant-test-" + Math.random().toString(36).slice(2) + ".example/",
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
  if (options.fetch) {
    dom.window.fetch = options.fetch;
  }
  dom.window.localStorage.clear();
  dom.window.sessionStorage.clear();
  if (options.sessionStorage) {
    Object.entries(options.sessionStorage).forEach(([key, value]) => {
      dom.window.sessionStorage.setItem(key, value);
    });
  }
  dom.window.eval(code);
  dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded", { bubbles: true }));
  return dom;
}

function wait(ms = 20) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

test("assistant starts open, answers locally and escapes user input", async () => {
  const dom = await loadAssistant();
  const { document, KeyboardEvent, Event } = dom.window;

  const toggle = document.querySelector(".assistant-fab");
  assert.ok(toggle, "assistant floating button should be created");
  assert.equal(document.body.classList.contains("assistant-open"), true);
  assert.equal(toggle.getAttribute("aria-expanded"), "true");
  const panel = document.querySelector(".assistant-panel");
  assert.equal(panel.hidden, false);
  assert.equal(panel.getAttribute("role"), "dialog");
  assert.equal(panel.getAttribute("aria-labelledby"), "assistant-title");
  assert.equal(panel.getAttribute("aria-describedby"), "assistant-privacy");
  assert.equal(document.querySelector('[data-assistant-mode="llm"]').classList.contains("active"), true);
  assert.equal(document.querySelector(".assistant-config").hidden, false);
  assert.equal(document.querySelector(".assistant-config-body").hidden, true);
  assert.equal(document.querySelector(".assistant-config-toggle").getAttribute("aria-expanded"), "false");
  assert.equal(document.querySelector(".assistant-format").value, "anthropic");
  assert.equal(document.querySelector(".assistant-relay-cta").getAttribute("href"), "/ai/#relay");

  document.querySelector('[data-assistant-mode="site"]').click();

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

test("assistant remembers dismissal on non-home pages for the current session", async () => {
  const dom = await loadAssistant({ url: "https://example.test/post/" });
  const { document, sessionStorage } = dom.window;

  document.querySelector(".assistant-close").click();

  assert.equal(sessionStorage.getItem(DISMISS_KEY), "1");
  assert.equal(document.body.classList.contains("assistant-open"), false);

  const dismissedDom = await loadAssistant({
    url: "https://example.test/post/",
    sessionStorage: {
      [DISMISS_KEY]: "1",
    },
  });

  assert.equal(dismissedDom.window.document.querySelector(".assistant-panel").hidden, true);
  assert.equal(dismissedDom.window.document.body.classList.contains("assistant-open"), false);
});

test("assistant opens on the homepage even after a session dismissal", async () => {
  const dom = await loadAssistant({
    url: "https://example.test/",
    sessionStorage: {
      [DISMISS_KEY]: "1",
    },
  });
  const { document } = dom.window;

  assert.equal(document.querySelector(".assistant-panel").hidden, false);
  assert.equal(document.body.classList.contains("assistant-open"), true);
});

test("assistant ranks partial page title matches ahead of generic keywords", async () => {
  const dom = await loadAssistant();
  const { document, Event } = dom.window;

  document.querySelector('[data-assistant-mode="site"]').click();
  const input = document.querySelector(".assistant-input");
  input.value = "工具";
  document.querySelector(".assistant-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

  const firstLink = document.querySelector(".assistant-links a");
  assert.equal(firstLink.textContent, "工具箱");
  assert.equal(firstLink.getAttribute("href"), "/tools/");
});

test("assistant keeps AI websites discoverable for AI queries", async () => {
  const dom = await loadAssistant();
  const { document, Event } = dom.window;

  document.querySelector('[data-assistant-mode="site"]').click();
  const input = document.querySelector(".assistant-input");
  input.value = "AI";
  document.querySelector(".assistant-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

  const firstLink = document.querySelector(".assistant-links a");
  assert.match(firstLink.textContent, /^AI导航/);
  assert.equal(firstLink.getAttribute("href"), "/ai/#nav");
});

test("assistant caps message history to avoid unbounded DOM growth", async () => {
  const dom = await loadAssistant();
  const { document, Event } = dom.window;

  document.querySelector('[data-assistant-mode="site"]').click();
  const input = document.querySelector(".assistant-input");
  const form = document.querySelector(".assistant-form");
  for (let i = 0; i < 45; i += 1) {
    input.value = "工具箱 " + i;
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  }

  const messages = document.querySelectorAll(".assistant-message");
  assert.equal(messages.length, 40);
  assert.match(messages[messages.length - 1].textContent, /工具箱/);
});

test("assistant keeps conversation history and can start a new chat", async () => {
  const dom = await loadAssistant();
  const { document, Event, localStorage } = dom.window;

  document.querySelector('[data-assistant-mode="site"]').click();
  const input = document.querySelector(".assistant-input");
  const form = document.querySelector(".assistant-form");
  input.value = "工具箱在哪里";
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

  const firstChat = Array.from(document.querySelectorAll(".assistant-history-item"))
    .find((item) => item.textContent.includes("工具箱在哪里"));
  assert.ok(firstChat, "the first user message should title the current chat");
  assert.match(document.querySelector(".assistant-messages").textContent, /工具箱在哪里/);

  document.querySelector(".assistant-new-chat").click();
  assert.equal(document.querySelectorAll(".assistant-history-item").length, 2);
  assert.doesNotMatch(document.querySelector(".assistant-messages").textContent, /工具箱在哪里/);

  input.value = "低代码";
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  assert.match(document.querySelector(".assistant-messages").textContent, /低代码/);

  Array.from(document.querySelectorAll(".assistant-history-item"))
    .find((item) => item.textContent.includes("工具箱在哪里"))
    .click();

  assert.match(document.querySelector(".assistant-messages").textContent, /工具箱在哪里/);
  assert.doesNotMatch(document.querySelector(".assistant-messages").textContent, /低代码/);
  assert.equal(JSON.parse(localStorage.getItem("cwl.assistant.conversations")).length, 2);
});

test("assistant can render English labels through the i18n bridge", async () => {
  const dom = await loadAssistant({
    lang: "en",
    translations: {
      "assistant.title": "AI Assistant",
      "assistant.privacy": "Local rules only.",
      "assistant.quick.tools": "Open toolbox",
      "assistant.open": "Open AI assistant",
      "assistant.minimize": "Minimize AI assistant",
      "assistant.config.toggle": "Settings",
      "assistant.opacity": "Opacity",
    },
  });
  const { document } = dom.window;

  assert.equal(document.querySelector(".assistant-head strong").textContent, "AI Assistant");
  assert.equal(document.querySelector('[data-assistant-action="tools"]').textContent, "Open toolbox");
  assert.equal(document.querySelector(".assistant-config-toggle").textContent, "Settings");
  assert.equal(document.querySelector(".assistant-opacity > span").textContent, "Opacity");
  assert.equal(document.querySelector(".assistant-fab").getAttribute("aria-label"), "Minimize AI assistant");
});

test("assistant config is collapsible and opacity is adjustable", async () => {
  const dom = await loadAssistant();
  const { document, Event, localStorage } = dom.window;

  const configToggle = document.querySelector(".assistant-config-toggle");
  const configBody = document.querySelector(".assistant-config-body");
  assert.equal(configBody.hidden, true);
  assert.equal(configToggle.getAttribute("aria-expanded"), "false");

  configToggle.click();
  assert.equal(configBody.hidden, false);
  assert.equal(configToggle.getAttribute("aria-expanded"), "true");

  const opacity = document.querySelector(".assistant-opacity-range");
  assert.equal(opacity.value, "100");
  assert.equal(document.querySelector(".assistant-widget").style.getPropertyValue("--assistant-opacity"), "1");
  assert.equal(document.querySelector(".assistant-opacity-value").textContent, "100%");

  opacity.value = "75";
  opacity.dispatchEvent(new Event("input", { bubbles: true }));

  assert.equal(document.querySelector(".assistant-widget").style.getPropertyValue("--assistant-opacity"), "0.75");
  assert.equal(document.querySelector(".assistant-opacity-value").textContent, "75%");
  assert.equal(localStorage.getItem("cwl.assistant.opacity"), "75");
});

test("assistant requires an explicit OpenAI API key before sending requests", async () => {
  const calls = [];
  const dom = await loadAssistant({
    fetch: async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ output_text: "pong" }),
      };
    },
  });
  const { document, Event, localStorage } = dom.window;

  const format = document.querySelector(".assistant-format");
  format.value = "openai";
  format.dispatchEvent(new Event("change", { bubbles: true }));

  assert.equal(document.querySelector(".assistant-format").value, "openai");
  assert.equal(document.querySelector(".assistant-endpoint").value, "https://free.lyclaude.site/v1/responses");
  assert.equal(document.querySelector(".assistant-api-key").value, "");
  assert.equal(document.querySelector(".assistant-stream input").checked, true);
  assert.equal(document.querySelector(".assistant-api-key").getAttribute("placeholder"), "请输入你自己的 API key");

  document.querySelector('[data-assistant-mode="llm"]').click();
  const input = document.querySelector(".assistant-input");
  input.value = "你好";
  document.querySelector(".assistant-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

  await wait();

  assert.equal(calls.length, 0);
  assert.match(document.querySelector(".assistant-messages").textContent, /请先填写 API key/);
  assert.equal(JSON.parse(localStorage.getItem("cwl.assistant.llmConfig")).apiKey, "");
});

test("assistant defaults LLM mode to Claude without a bundled API key", async () => {
  const calls = [];
  const dom = await loadAssistant();
  const { document, Event } = dom.window;

  dom.window.fetch = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ content: [{ type: "text", text: "pong" }] }),
    };
  };

  assert.equal(document.querySelector('[data-assistant-mode="llm"]').classList.contains("active"), true);
  assert.equal(document.querySelector(".assistant-config").hidden, false);
  assert.equal(document.querySelector(".assistant-config-body").hidden, true);
  assert.equal(document.querySelector(".assistant-format").value, "anthropic");
  assert.equal(document.querySelector(".assistant-endpoint").value, "https://token-plan-cn.xiaomimimo.com/anthropic");
  assert.equal(document.querySelector(".assistant-model").value, "mimo-v2.5-pro");
  assert.equal(document.querySelector(".assistant-api-key").value, "");
  assert.equal(document.querySelector(".assistant-stream input").checked, true);

  const input = document.querySelector(".assistant-input");
  input.value = "你好";
  document.querySelector(".assistant-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

  await wait();

  assert.equal(calls.length, 0);
  assert.match(document.querySelector(".assistant-messages").textContent, /请先填写 API key/);
});

test("assistant source does not bundle LLM API keys", async () => {
  const code = await readFile(join(ROOT, "js", "assistant.js"), "utf8");
  assert.doesNotMatch(code, /LLM_DEMO_KEYS/);
  assert.doesNotMatch(code, /sk-[A-Za-z0-9_-]{20,}/);
  assert.doesNotMatch(code, /tp-[A-Za-z0-9_-]{20,}/);
  assert.doesNotMatch(code, /留空使用内置体验 key/);
});

test("assistant supports fullscreen mode", async () => {
  const dom = await loadAssistant();
  const { document, KeyboardEvent } = dom.window;

  const fullscreen = document.querySelector(".assistant-fullscreen");
  const initialIcon = fullscreen.innerHTML;
  assert.ok(fullscreen.querySelector("svg.assistant-fullscreen-icon"), "fullscreen button should render an inline icon");
  assert.equal(fullscreen.querySelector(".fa-expand"), null);
  fullscreen.click();

  assert.equal(document.querySelector(".assistant-widget").classList.contains("fullscreen"), true);
  assert.equal(document.body.classList.contains("assistant-fullscreen"), true);
  assert.equal(fullscreen.getAttribute("aria-pressed"), "true");
  assert.notEqual(fullscreen.innerHTML, initialIcon);
  assert.equal(document.querySelector(".assistant-panel").hidden, false);

  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.equal(document.querySelector(".assistant-widget").classList.contains("fullscreen"), false);
  assert.equal(document.body.classList.contains("assistant-fullscreen"), false);
  assert.equal(document.querySelector(".assistant-panel").hidden, false);
});

test("assistant fullscreen starts below the navigation", async () => {
  const dom = await loadAssistant({
    body: '<header class="navigation"><div class="container"></div></header><button class="nav-search-trigger" type="button">Search</button>',
  });
  const { document, KeyboardEvent } = dom.window;
  const nav = document.querySelector(".navigation");
  Object.defineProperty(nav, "getBoundingClientRect", {
    value: () => ({ height: 104 }),
  });

  document.querySelector(".assistant-fullscreen").click();

  const widget = document.querySelector(".assistant-widget");
  assert.equal(widget.style.getPropertyValue("--assistant-fullscreen-top"), "104px");

  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.equal(widget.style.getPropertyValue("--assistant-fullscreen-top"), "");
});

test("assistant query parameter starts fullscreen", async () => {
  const dom = await loadAssistant({ url: "https://example.test/?assistant=fullscreen" });
  const { document } = dom.window;

  assert.equal(document.querySelector(".assistant-widget").classList.contains("fullscreen"), true);
  assert.equal(document.body.classList.contains("assistant-fullscreen"), true);
  assert.equal(document.querySelector(".assistant-panel").hidden, false);
});

test("assistant exposes a prominent relay ranking entry", async () => {
  const dom = await loadAssistant();
  const { document } = dom.window;

  const relay = document.querySelector(".assistant-relay-cta");
  assert.ok(relay, "relay CTA should be rendered near the top of the assistant");
  assert.equal(relay.getAttribute("href"), "/ai/#relay");
  assert.match(relay.textContent, /中转站/);
  assert.ok(relay.querySelector(".fa-network-wired"), "relay CTA should include an icon");
});

test("assistant sends OpenAI-compatible chat completion requests", async () => {
  const calls = [];
  const dom = await loadAssistant({
    fetch: async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ choices: [{ message: { content: "pong" } }] }),
      };
    },
  });
  const { document, Event } = dom.window;

  document.querySelector('[data-assistant-mode="llm"]').click();
  const format = document.querySelector(".assistant-format");
  format.value = "openai";
  format.dispatchEvent(new Event("change", { bubbles: true }));
  document.querySelector(".assistant-endpoint").value = "https://relay.example/v1";
  document.querySelector(".assistant-api-key").value = "local-test-key";
  document.querySelector(".assistant-model").value = "gpt-test";
  const input = document.querySelector(".assistant-input");
  input.value = "你好";
  document.querySelector(".assistant-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

  await wait();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://relay.example/v1/chat/completions");
  assert.equal(calls[0].init.headers.Authorization, "Bearer local-test-key");
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.model, "gpt-test");
  assert.equal(body.stream, true);
  assert.deepEqual(body.messages, [{ role: "user", content: "你好" }]);
});

test("assistant retries Codex-style OpenAI responses requests", async () => {
  const calls = [];
  const dom = await loadAssistant({
    fetch: async (url, init) => {
      calls.push({ url, init });
      if (calls.length === 1) {
        return {
          ok: false,
          status: 400,
          text: async () => JSON.stringify({ error: { message: "invalid codex request" } }),
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ output_text: "pong" }),
      };
    },
  });
  const { document, Event } = dom.window;

  document.querySelector('[data-assistant-mode="llm"]').click();
  const format = document.querySelector(".assistant-format");
  format.value = "openai";
  format.dispatchEvent(new Event("change", { bubbles: true }));
  document.querySelector(".assistant-api-key").value = "local-test-key";
  document.querySelector(".assistant-model").value = "gpt-test";
  const input = document.querySelector(".assistant-input");
  input.value = "你好";
  document.querySelector(".assistant-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

  await wait(40);

  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "https://free.lyclaude.site/v1/responses");
  assert.equal(calls[1].url, "https://free.lyclaude.site/v1/responses");

  const firstBody = JSON.parse(calls[0].init.body);
  assert.equal(firstBody.store, false);
  assert.equal(firstBody.input[0].content[0].type, "input_text");
  assert.equal(firstBody.input[0].content[0].text, "你好");

  const retryBody = JSON.parse(calls[1].init.body);
  assert.equal(retryBody.instructions, "You are a helpful assistant.");
  assert.equal(retryBody.input[0].type, "message");
  assert.equal(retryBody.input[0].content[0].type, "input_text");
});

test("assistant sends Anthropic-compatible messages requests", async () => {
  const calls = [];
  const dom = await loadAssistant({
    fetch: async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ content: [{ type: "text", text: "pong" }] }),
      };
    },
  });
  const { document, Event } = dom.window;

  document.querySelector('[data-assistant-mode="llm"]').click();
  const format = document.querySelector(".assistant-format");
  format.value = "anthropic";
  format.dispatchEvent(new Event("change", { bubbles: true }));
  document.querySelector(".assistant-endpoint").value = "https://claude.example/anthropic";
  document.querySelector(".assistant-api-key").value = "local-claude-key";
  document.querySelector(".assistant-model").value = "claude-test";
  const input = document.querySelector(".assistant-input");
  input.value = "你好";
  document.querySelector(".assistant-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

  await wait();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://claude.example/anthropic/v1/messages");
  assert.equal(calls[0].init.headers["x-api-key"], "local-claude-key");
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.model, "claude-test");
  assert.equal(body.stream, true);
  assert.equal(body.max_tokens, 1024);
  assert.deepEqual(body.messages, [{ role: "user", content: "你好" }]);
});

test("assistant panel keeps the hidden attribute effective in CSS", async () => {
  const css = await readFile(join(ROOT, "css", "coder.css"), "utf8");
  assert.match(css, /\.assistant-panel\[hidden\]\s*{\s*display:\s*none;/);
});
