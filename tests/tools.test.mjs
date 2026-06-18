import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { renderToolsPage } from "../src/templates/tools.mjs";

const ROOT = join(import.meta.dirname, "..");

async function loadToolsCore(options = {}) {
  const code = await readFile(join(ROOT, "js", "tools-core.js"), "utf8");
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/tools/",
  });
  if (options.noTextCodec) {
    dom.window.TextEncoder = undefined;
    dom.window.TextDecoder = undefined;
  }
  if (options.crypto) {
    Object.defineProperty(dom.window, "crypto", {
      configurable: true,
      value: options.crypto,
    });
  }
  dom.window.eval(code);
  return dom.window.CWLToolsCore;
}

async function loadToolsPage(options = {}) {
  const coreCode = await readFile(join(ROOT, "js", "tools-core.js"), "utf8");
  const toolsCode = await readFile(join(ROOT, "js", "tools.js"), "utf8");
  const i18nCode = options.i18n ? await readFile(join(ROOT, "js", "i18n.js"), "utf8") : "";
  let copiedText = null;
  const dom = new JSDOM(renderToolsPage(), {
    pretendToBeVisual: true,
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/tools/",
  });
  dom.window.localStorage.clear();
  dom.window.eval(coreCode);
  if (i18nCode) {
    dom.window.eval(i18nCode);
  }
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

test("tools core preserves falsey non-empty direct inputs", async () => {
  const tools = await loadToolsCore();

  assert.equal(tools.formatJson(0).value, "0");
  assert.equal(tools.minifyJson(false).value, "false");
  assert.equal(tools.encodeBase64(0).value, "MA==");
  assert.equal(tools.encodeUrl(0).value, "0");
  assert.equal(tools.normalizeTimestamp(0).value.milliseconds, 0);
});

test("tools core Base64 fallback works without TextEncoder and TextDecoder", async () => {
  const tools = await loadToolsCore({ noTextCodec: true });
  const encoded = tools.encodeBase64("你好 fallback");

  assert.equal(encoded.ok, true);
  assert.equal(tools.decodeBase64(encoded.value).value, "你好 fallback");
});

test("tools core UUID generation falls back when crypto methods fail", async () => {
  const tools = await loadToolsCore({
    crypto: {
      randomUUID() {
        throw new Error("randomUUID blocked");
      },
      getRandomValues(bytes) {
        for (let i = 0; i < bytes.length; i += 1) {
          bytes[i] = i;
        }
        return bytes;
      },
    },
  });

  assert.equal(tools.generateUuid(), "00010203-0405-4607-8809-0a0b0c0d0e0f");
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
  const badUrlEncode = tools.encodeUrl("\uD800");
  assert.equal(badUrlEncode.ok, false);
  assert.equal(badUrlEncode.code, "urlEncode");
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

  const urlSafeJwt = [
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
    "eyJ4Ijoi4KC-In0",
    "signature",
  ].join(".");
  const decodedUrlSafe = tools.decodeJwt(urlSafeJwt);
  assert.equal(decodedUrlSafe.ok, true);
  assert.match(decodedUrlSafe.value.payload, /"x": "࠾"/);

  const standardBase64Jwt = [
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
    "eyJ4Ijoi4KC+In0",
    "signature",
  ].join(".");
  const invalidAlphabet = tools.decodeJwt(standardBase64Jwt);
  assert.equal(invalidAlphabet.ok, false);
  assert.equal(invalidAlphabet.code, "jwtBase64");

  const primitiveJwt = ["bnVsbA", "bnVsbA", "signature"].join(".");
  const primitiveDecoded = tools.decodeJwt(primitiveJwt);
  assert.equal(primitiveDecoded.ok, false);
  assert.equal(primitiveDecoded.code, "jwtJson");

  const extraSegmentJwt = [
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
    "eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkNXTCJ9",
    "signature",
    "extra",
  ].join(".");
  const extraSegmentDecoded = tools.decodeJwt(extraSegmentJwt);
  assert.equal(extraSegmentDecoded.ok, false);
  assert.equal(extraSegmentDecoded.code, "jwtParts");
  assert.equal(tools.decodeJwt(".eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature").code, "jwtParts");
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

test("tools page ignores delegated events from non-element targets", async () => {
  const { dom } = await loadToolsPage();
  const { document, Event, KeyboardEvent } = dom.window;
  const errors = [];
  dom.window.addEventListener("error", (event) => {
    errors.push(event.error || event.message);
  });
  try {
    document.dispatchEvent(new Event("click", { bubbles: true }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));

    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});

test("tools page localizes English placeholders and dynamic statuses", async () => {
  const { dom } = await loadToolsPage({ i18n: true });
  const { document } = dom.window;
  try {
    assert.equal(document.querySelector("#base64-input").getAttribute("placeholder"), "输入要编码或解码的文本");

    document.querySelector(".lang-toggle").click();
    assert.equal(document.documentElement.getAttribute("lang"), "en");
    assert.equal(document.querySelector(".tools-header h1").textContent, "Toolbox");
    assert.equal(document.querySelector(".tools-tabs").getAttribute("aria-label"), "Tool list");
    assert.equal(document.querySelector("#base64-input").getAttribute("placeholder"), "Text to encode or decode");
    assert.equal(document.querySelector("#url-input").getAttribute("placeholder"), "https://example.com/?q=search");
    document.querySelector('[data-tool-tab="jwt"]').click();
    assert.match(document.querySelector("[data-jwt-decode]").textContent, /Decode JWT/);

    const localeCalls = [];
    dom.window.Date.prototype.toLocaleString = function (localeArg) {
      localeCalls.push(localeArg);
      return localeArg === "en-US" ? "EN_LOCAL_TIME" : "DEFAULT_LOCAL_TIME";
    };
    document.querySelector('[data-tool-tab="time"]').click();
    document.querySelector("#timestamp-input").value = "1718697600";
    document.querySelector('[data-time-action="from-timestamp"]').click();
    assert.match(document.querySelector("#timestamp-output").textContent, /Local time: EN_LOCAL_TIME/);
    assert.ok(localeCalls.includes("en-US"));

    document.querySelector('[data-tool-tab="uuid"]').click();
    document.querySelector('[data-copy-target="uuid-output"]').click();
    await new Promise((resolve) => {
      dom.window.setTimeout(resolve, 0);
    });
    assert.equal(document.querySelector("#uuid-status").textContent, "Nothing to copy");
    assert.equal(document.querySelector("#uuid-status").classList.contains("is-error"), true);
  } finally {
    dom.window.close();
  }
});

test("time conversion output rerenders after language changes", async () => {
  const { dom } = await loadToolsPage({ i18n: true });
  const { document } = dom.window;
  dom.window.Date.prototype.toLocaleString = function (localeArg) {
    return localeArg === "en-US" ? "EN_LOCAL_TIME" : "ZH_LOCAL_TIME";
  };
  try {
    document.querySelector('[data-tool-tab="time"]').click();
    document.querySelector("#timestamp-input").value = "1718697600";
    document.querySelector('[data-time-action="from-timestamp"]').click();
    assert.match(document.querySelector("#timestamp-output").textContent, /本地时间: ZH_LOCAL_TIME/);

    document.querySelector(".lang-toggle").click();
    assert.equal(document.documentElement.getAttribute("lang"), "en");
    assert.match(document.querySelector("#timestamp-output").textContent, /Milliseconds: 1718697600000/);
    assert.match(document.querySelector("#timestamp-output").textContent, /Local time: EN_LOCAL_TIME/);
  } finally {
    dom.window.close();
  }
});

test("navigation can wrap translated toolbox labels", async () => {
  const css = await readFile(join(ROOT, "css", "coder.css"), "utf8");

  assert.match(css, /\.navigation-list\s*{\s*min-width:\s*0;/);
  assert.match(css, /\.navigation-list ul\s*{[^}]*flex-wrap:\s*wrap;[^}]*justify-content:\s*flex-end;/s);
});

test("toolbox i18n includes URL encode error text", async () => {
  const i18n = await readFile(join(ROOT, "js", "i18n.js"), "utf8");

  assert.match(i18n, /"tools\.error\.urlEncode": "URL encoding failed\./);
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

test("copy utility cleans up legacy textarea when copy fails", async () => {
  const code = await readFile(join(ROOT, "js", "utils.js"), "utf8");
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/tools/",
  });
  const { document } = dom.window;
  try {
    Object.defineProperty(dom.window.navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    document.execCommand = function () {
      throw new Error("copy denied");
    };
    dom.window.eval(code);

    await assert.rejects(dom.window.CWLUtils.copyText("copy me"), /copy denied/);
    assert.equal(document.querySelectorAll("textarea").length, 0);
  } finally {
    dom.window.close();
  }
});

test("copy utility falls back when clipboard access throws", async () => {
  const code = await readFile(join(ROOT, "js", "utils.js"), "utf8");
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/tools/",
  });
  const { document } = dom.window;
  let execCalls = 0;
  try {
    Object.defineProperty(dom.window.navigator, "clipboard", {
      configurable: true,
      get() {
        throw new Error("clipboard blocked");
      },
    });
    document.execCommand = function (command) {
      execCalls += 1;
      assert.equal(command, "copy");
      return true;
    };
    dom.window.eval(code);

    await assert.doesNotReject(() => dom.window.CWLUtils.copyText("copy me"));
    assert.equal(execCalls, 1);
    assert.equal(document.querySelectorAll("textarea").length, 0);
  } finally {
    dom.window.close();
  }
});
