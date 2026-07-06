import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { JSDOM } from "jsdom";

const ROOT = join(import.meta.dirname, "..");

async function loadLoader(url = "https://example.test/") {
  const code = await readFile(join(ROOT, "js", "assistant-loader.js"), "utf8");
  const dom = new JSDOM(
    '<!doctype html><button type="button" data-assistant-toggle>AI</button>',
    {
      runScripts: "outside-only",
      url,
    },
  );
  dom.window.eval(code);
  return dom;
}

test("assistant-loader does not fetch the assistant runtime until needed", async () => {
  const dom = await loadLoader();
  try {
    assert.equal(dom.window.document.querySelector('link[href="/css/assistant.css"]'), null);
    assert.equal(dom.window.document.querySelector('script[src="/js/assistant.js"]'), null);
  } finally {
    dom.window.close();
  }
});

test("assistant-loader loads runtime on demand and replays the trigger click", async () => {
  const dom = await loadLoader();
  const { document, Event } = dom.window;
  const trigger = document.querySelector("[data-assistant-toggle]");
  let replayed = 0;
  trigger.addEventListener("click", () => {
    replayed += 1;
  });

  trigger.click();
  const style = document.querySelector('link[href="/css/assistant.css"]');
  assert.ok(style, "assistant stylesheet should be injected on first click");
  assert.equal(style.rel, "stylesheet");
  assert.equal(style.dataset.assistantStyle, "true");

  const script = document.querySelector('script[src="/js/assistant.js"]');
  assert.ok(script, "assistant runtime script should be injected on first click");
  assert.equal(script.defer, true);
  assert.equal(script.dataset.assistantRuntime, "true");
  assert.equal(replayed, 0, "initial click should wait for the runtime");

  document.body.appendChild(document.createElement("section")).className = "assistant-widget";
  style.dispatchEvent(new Event("load"));
  script.dispatchEvent(new Event("load"));
  await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

  assert.equal(replayed, 1, "click should replay once after the runtime is ready");
  dom.window.close();
});

test("assistant-loader eagerly loads runtime for fullscreen startup URLs", async () => {
  const dom = await loadLoader("https://example.test/?assistant=fullscreen");
  try {
    assert.ok(dom.window.document.querySelector('link[href="/css/assistant.css"]'));
    assert.ok(dom.window.document.querySelector('script[src="/js/assistant.js"]'));
  } finally {
    dom.window.close();
  }
});
