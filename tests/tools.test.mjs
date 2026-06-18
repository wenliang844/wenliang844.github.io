import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { renderToolsPage } from "../src/templates/tools.mjs";

const ROOT = join(import.meta.dirname, "..");

async function loadToolsCore() {
  const code = await readFile(join(ROOT, "js", "tools-core.js"), "utf8");
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/tools/",
  });
  dom.window.eval(code);
  return dom.window.CWLToolsCore;
}

async function loadToolsPage(options = {}) {
  const coreCode = await readFile(join(ROOT, "js", "tools-core.js"), "utf8");
  const toolsCode = await readFile(join(ROOT, "js", "tools.js"), "utf8");
  let copiedText = null;
  const dom = new JSDOM(renderToolsPage(), {
    pretendToBeVisual: true,
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/tools/",
  });
  dom.window.eval(coreCode);
  if (options.copyText !== false) {
    dom.window.CWLUtils = {
      copyText(value) {
        copiedText = value;
        return Promise.resolve();
      },
    };
  } else {
    Object.defineProperty(dom.window.navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
  }
  dom.window.eval(toolsCode);
  return {
    copiedText() {
      return copiedText;
    },
    dom,
  };
}

test("tools core formats and minifies JSON with clear errors", async () => {
  const tools = await loadToolsCore();
  const formatted = tools.formatJson('{"name":"CWL"}');
  assert.equal(formatted.ok, true);
  assert.equal(formatted.value, '{\n  "name": "CWL"\n}');
  const minified = tools.minifyJson('{"name":"CWL"}');
  assert.equal(minified.ok, true);
  assert.equal(minified.value, '{"name":"CWL"}');
  assert.equal(tools.formatJson("{bad").ok, false);
  assert.match(tools.formatJson("{bad").error, /JSON 解析失败/);
});

test("tools core handles Base64, URL, timestamps, UUID and JWT", async () => {
  const tools = await loadToolsCore();
  const encoded = tools.encodeBase64("你好 Codex");
  assert.equal(encoded.ok, true);
  const decodedBase64 = tools.decodeBase64(encoded.value);
  assert.equal(decodedBase64.ok, true);
  assert.equal(decodedBase64.value, "你好 Codex");
  assert.equal(tools.decodeBase64("%%bad").ok, false);
  assert.equal(tools.decodeBase64("/w==").ok, false);

  const largeText = "chunk-safe-base64-".repeat(6000);
  const encodedLarge = tools.encodeBase64(largeText);
  assert.equal(encodedLarge.ok, true);
  assert.equal(tools.decodeBase64(encodedLarge.value).value, largeText);

  const encodedUrl = tools.encodeUrl("a b/中文");
  assert.equal(encodedUrl.ok, true);
  assert.equal(encodedUrl.value, "a%20b%2F%E4%B8%AD%E6%96%87");
  const decodedUrl = tools.decodeUrl("a%20b%2F%E4%B8%AD%E6%96%87");
  assert.equal(decodedUrl.ok, true);
  assert.equal(decodedUrl.value, "a b/中文");
  assert.equal(tools.decodeUrl("%E0%A4%A").ok, false);

  const timestamp = tools.normalizeTimestamp("1718697600");
  assert.equal(timestamp.ok, true);
  assert.equal(timestamp.value.seconds, 1718697600);
  assert.equal(timestamp.value.milliseconds, 1718697600000);
  assert.equal(tools.dateToTimestamp("2026-06-18T00:00:00").ok, true);
  assert.equal(tools.dateToTimestamp("2026-06-18T23:59:58.123").ok, true);
  assert.equal(tools.dateToTimestamp("0099-01-01T00:00").ok, true);
  assert.equal(tools.dateToTimestamp("2026-02-30T00:00").ok, false);
  assert.equal(tools.dateToTimestamp("2026-06-18T24:00").ok, false);
  assert.equal(tools.dateToTimestamp("2026-06-18 00:00").ok, false);
  assert.match(tools.generateUuid(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

  const jwt = [
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
    "eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkNXTCJ9",
    "signature",
  ].join(".");
  const decoded = tools.decodeJwt(jwt);
  assert.equal(decoded.ok, true);
  assert.match(decoded.value.header, /"typ": "JWT"/);
  assert.match(decoded.value.payload, /"name": "CWL"/);
  assert.equal(tools.decodeJwt("bad").ok, false);
});

test("tools tabs expose selected state and support keyboard navigation", async () => {
  const { dom } = await loadToolsPage();
  const { document, KeyboardEvent } = dom.window;
  try {
    const jsonTab = document.querySelector('[data-tool-tab="json"]');
    const timeTab = document.querySelector('[data-tool-tab="time"]');
    const jwtTab = document.querySelector('[data-tool-tab="jwt"]');

    const tabList = document.querySelector(".tools-tabs");
    assert.equal(tabList.getAttribute("role"), "tablist");
    assert.equal(tabList.getAttribute("data-i18n-aria"), "tools.tabs");
    assert.equal(tabList.getAttribute("data-i18n-en-aria"), "Tool list");
    assert.equal(document.querySelector("#base64-input").getAttribute("data-i18n-ph"), "tools.base64.placeholder");
    assert.equal(document.querySelector("#base64-input").getAttribute("data-i18n-en-ph"), "Text to encode or decode");
    assert.equal(document.querySelector("#url-input").getAttribute("data-i18n-en-ph"), "https://example.com/?q=search");
    assert.equal(jsonTab.getAttribute("role"), "tab");
    assert.equal(document.querySelector("#tool-json").getAttribute("role"), "tabpanel");
    assert.equal(jsonTab.getAttribute("aria-selected"), "true");
    assert.equal(timeTab.getAttribute("aria-selected"), "false");

    jsonTab.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
    assert.equal(timeTab.getAttribute("aria-selected"), "true");
    assert.equal(document.querySelector("#tool-time").hidden, false);
    assert.equal(document.querySelector("#tool-json").hidden, true);

    timeTab.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true }));
    assert.equal(jwtTab.getAttribute("aria-selected"), "true");
    assert.equal(document.querySelector("#tool-jwt").hidden, false);
  } finally {
    dom.window.close();
  }
});

test("navigation can wrap translated toolbox labels", async () => {
  const css = await readFile(join(ROOT, "css", "coder.css"), "utf8");

  assert.match(css, /\.navigation-list\s*{\s*min-width:\s*0;/);
  assert.match(css, /\.navigation-list ul\s*{[^}]*flex-wrap:\s*wrap;[^}]*justify-content:\s*flex-end;/s);
});

test("failed tool operations clear stale outputs", async () => {
  const { dom } = await loadToolsPage();
  const { document } = dom.window;
  try {
    document.querySelector("#json-input").value = '{"ok":true}';
    document.querySelector('[data-json-action="format"]').click();
    assert.match(document.querySelector("#json-output").value, /"ok": true/);

    document.querySelector("#json-input").value = "{bad";
    document.querySelector('[data-json-action="format"]').click();
    assert.equal(document.querySelector("#json-output").value, "");
    assert.equal(document.querySelector("#json-status").classList.contains("is-error"), true);

    document.querySelector('[data-tool-tab="time"]').click();
    document.querySelector("#timestamp-input").value = "1718697600";
    document.querySelector('[data-time-action="from-timestamp"]').click();
    assert.match(document.querySelector("#timestamp-output").textContent, /1718697600000/);

    document.querySelector("#timestamp-input").value = "not-a-time";
    document.querySelector('[data-time-action="from-timestamp"]').click();
    assert.equal(document.querySelector("#timestamp-output").textContent, "");
    assert.equal(document.querySelector("#time-status").classList.contains("is-error"), true);

    document.querySelector('[data-tool-tab="jwt"]').click();
    document.querySelector("#jwt-input").value = [
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
      "eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkNXTCJ9",
      "signature",
    ].join(".");
    document.querySelector("[data-jwt-decode]").click();
    assert.match(document.querySelector("#jwt-header-output").value, /"typ": "JWT"/);
    assert.match(document.querySelector("#jwt-payload-output").value, /"name": "CWL"/);

    document.querySelector("#jwt-input").value = "bad";
    document.querySelector("[data-jwt-decode]").click();
    assert.equal(document.querySelector("#jwt-header-output").value, "");
    assert.equal(document.querySelector("#jwt-payload-output").value, "");
    assert.equal(document.querySelector("#jwt-status").classList.contains("is-error"), true);
  } finally {
    dom.window.close();
  }
});

test("uuid placeholder is not copied and generated UUID survives i18n updates", async () => {
  const { copiedText, dom } = await loadToolsPage();
  const { document } = dom.window;
  try {
    document.querySelector('[data-tool-tab="uuid"]').click();
    document.querySelector('[data-copy-target="uuid-output"]').click();
    await Promise.resolve();

    assert.equal(copiedText(), null);
    assert.equal(document.querySelector("#uuid-status").classList.contains("is-error"), true);
    assert.match(document.querySelector("#uuid-status").textContent, /没有可复制的内容/);

    document.querySelector("[data-uuid-generate]").click();
    const generated = document.querySelector("#uuid-output").textContent;
    assert.match(generated, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.equal(document.querySelector("#uuid-output").hasAttribute("data-empty"), false);
    assert.equal(document.querySelector("#uuid-output").hasAttribute("data-i18n"), false);

    document.querySelector('[data-copy-target="uuid-output"]').click();
    await Promise.resolve();
    assert.equal(copiedText(), generated);
  } finally {
    dom.window.close();
  }
});

test("copy failures are reported when clipboard APIs are unavailable", async () => {
  const { dom } = await loadToolsPage({ copyText: false });
  const { document } = dom.window;
  try {
    document.querySelector('[data-tool-tab="uuid"]').click();
    document.querySelector("[data-uuid-generate]").click();
    document.querySelector('[data-copy-target="uuid-output"]').click();
    await new Promise((resolve) => {
      dom.window.setTimeout(resolve, 0);
    });

    assert.match(document.querySelector("#uuid-status").textContent, /复制失败/);
    assert.equal(document.querySelector("#uuid-status").classList.contains("is-error"), true);
  } finally {
    dom.window.close();
  }
});
