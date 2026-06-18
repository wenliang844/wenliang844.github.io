import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const ROOT = join(import.meta.dirname, "..");

async function loadAiTabs(url = "https://example.test/ai/") {
  const code = await readFile(join(ROOT, "js", "ai-tabs.js"), "utf8");
  const dom = new JSDOM(`<!doctype html><html><body>
    <button id="ai-tab-nav" data-ai-tab="nav" aria-selected="true" tabindex="0"></button>
    <button id="ai-tab-relay" data-ai-tab="relay" aria-selected="false" tabindex="-1"></button>
    <section id="ai-panel-nav" data-ai-panel="nav"></section>
    <section id="ai-panel-relay" data-ai-panel="relay" hidden></section>
  </body></html>`, {
    runScripts: "outside-only",
    url,
  });
  dom.window.eval(code);
  dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded", { bubbles: true }));
  return dom;
}

test("AI tabs open relay ranking from hash and hashchange", async () => {
  const dom = await loadAiTabs("https://example.test/ai/#relay");
  const { document, Event } = dom.window;

  assert.equal(document.getElementById("ai-tab-relay").classList.contains("active"), true);
  assert.equal(document.getElementById("ai-panel-relay").hidden, false);

  dom.window.location.hash = "#nav";
  dom.window.dispatchEvent(new Event("hashchange"));

  assert.equal(document.getElementById("ai-tab-nav").classList.contains("active"), true);
  assert.equal(document.getElementById("ai-panel-nav").hidden, false);
});

test("AI tab clicks keep the URL hash in sync", async () => {
  const dom = await loadAiTabs();
  const { document } = dom.window;

  document.getElementById("ai-tab-relay").click();
  assert.equal(dom.window.location.hash, "#relay");
  assert.equal(document.getElementById("ai-panel-relay").hidden, false);

  document.getElementById("ai-tab-nav").click();
  assert.equal(dom.window.location.hash, "#nav");
  assert.equal(document.getElementById("ai-panel-nav").hidden, false);
});
