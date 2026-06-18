import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { renderToolsPage } from "../src/templates/tools.mjs";

const ROOT = join(import.meta.dirname, "..");

async function loadToolsWithAssistant(url) {
  const assistantCode = await readFile(join(ROOT, "js", "assistant.js"), "utf8");
  const coreCode = await readFile(join(ROOT, "js", "tools-core.js"), "utf8");
  const toolsCode = await readFile(join(ROOT, "js", "tools.js"), "utf8");
  const dom = new JSDOM(renderToolsPage(), {
    pretendToBeVisual: true,
    runScripts: "outside-only",
    url,
  });
  dom.window.localStorage.clear();
  dom.window.sessionStorage.clear();
  dom.window.eval(assistantCode);
  dom.window.eval(coreCode);
  dom.window.eval(toolsCode);
  dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded", { bubbles: true }));
  return dom;
}

test("toolbox minimizes the assistant panel after page init", async () => {
  const dom = await loadToolsWithAssistant("https://example.test/tools/");
  const { document } = dom.window;
  try {
    assert.equal(document.querySelector(".assistant-panel").hidden, true);
    assert.equal(document.body.classList.contains("assistant-open"), false);
    assert.equal(document.querySelector(".assistant-fab").getAttribute("aria-expanded"), "false");
  } finally {
    dom.window.close();
  }
});

test("toolbox preserves explicit assistant fullscreen startup", async () => {
  const dom = await loadToolsWithAssistant("https://example.test/tools/?assistant=fullscreen");
  const { document } = dom.window;
  try {
    assert.equal(document.querySelector(".assistant-panel").hidden, false);
    assert.equal(document.body.classList.contains("assistant-open"), true);
    assert.equal(document.body.classList.contains("assistant-fullscreen"), true);
  } finally {
    dom.window.close();
  }
});
