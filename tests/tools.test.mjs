import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { renderToolsPage } from "../src/templates/tools.mjs";

const ROOT = join(import.meta.dirname, "..");

async function loadToolsCore(options = {}) {
  const code = await readFile(join(ROOT, "js", "tools-core.js"), "utf8");
  const markedCode = options.vendors ? await readFile(join(ROOT, "js", "vendor", "marked.min.js"), "utf8") : "";
  const purifyCode = options.vendors ? await readFile(join(ROOT, "js", "vendor", "purify.min.js"), "utf8") : "";
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/tools/",
  });
  if (options.noTextCodec) {
    dom.window.TextEncoder = undefined;
    dom.window.TextDecoder = undefined;
  }
  if (options.textCodecThrows) {
    Object.defineProperty(dom.window, "TextEncoder", {
      configurable: true,
      get() {
        throw new Error("TextEncoder blocked");
      },
    });
    Object.defineProperty(dom.window, "TextDecoder", {
      configurable: true,
      get() {
        throw new Error("TextDecoder blocked");
      },
    });
  }
  if (options.globalThrows) {
    options.globalThrows.forEach((name) => {
      Object.defineProperty(dom.window, name, {
        configurable: true,
        get() {
          throw new Error(name + " blocked");
        },
      });
    });
  }
  if (options.cryptoThrows) {
    Object.defineProperty(dom.window, "crypto", {
      configurable: true,
      get() {
        throw new Error("crypto blocked");
      },
    });
  } else if (Object.prototype.hasOwnProperty.call(options, "crypto")) {
    Object.defineProperty(dom.window, "crypto", {
      configurable: true,
      value: options.crypto,
    });
  }
  if (options.globals) {
    Object.entries(options.globals).forEach(([name, value]) => {
      Object.defineProperty(dom.window, name, {
        configurable: true,
        value,
      });
    });
  }
  if (markedCode) {
    dom.window.eval(markedCode);
  }
  if (purifyCode) {
    dom.window.eval(purifyCode);
  }
  dom.window.eval(code);
  return dom.window.CWLToolsCore;
}

async function loadToolsPage(options = {}) {
  const markedCode = await readFile(join(ROOT, "js", "vendor", "marked.min.js"), "utf8");
  const purifyCode = await readFile(join(ROOT, "js", "vendor", "purify.min.js"), "utf8");
  const qrCode = await readFile(join(ROOT, "js", "vendor", "qrcode.min.js"), "utf8");
  const utilsCode = await readFile(join(ROOT, "js", "utils.js"), "utf8");
  const coreCode = await readFile(join(ROOT, "js", "tools-core.js"), "utf8");
  const toolsCode = await readFile(join(ROOT, "js", "tools.js"), "utf8");
  const i18nCode = options.i18n ? await readFile(join(ROOT, "js", "i18n.js"), "utf8") : "";
  let copiedText = null;
  const timerCalls = [];
  const clearedTimers = [];
  const dom = new JSDOM(renderToolsPage(), {
    pretendToBeVisual: true,
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/tools/",
  });
  dom.window.localStorage.clear();
  dom.window.eval(markedCode);
  dom.window.eval(purifyCode);
  dom.window.eval(qrCode);
  dom.window.eval(utilsCode);
  dom.window.eval(coreCode);
  if (i18nCode) {
    dom.window.eval(i18nCode);
  }
  if (options.copyText !== false) {
    dom.window.CWLUtils = {
      t: dom.window.CWLUtils.t,
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
  if (options.timerSpy) {
    let nextTimerId = 1;
    Object.defineProperty(dom.window.document, "hidden", {
      configurable: true,
      value: false,
    });
    dom.window.setInterval = function (callback, delay) {
      const id = nextTimerId;
      nextTimerId += 1;
      timerCalls.push({ callback, delay, id });
      return id;
    };
    dom.window.clearInterval = function (id) {
      clearedTimers.push(id);
    };
  }
  dom.window.eval(toolsCode);
  return {
    clearedTimers() {
      return clearedTimers.slice();
    },
    copiedText() {
      return copiedText;
    },
    dom,
    setHidden(hidden) {
      Object.defineProperty(dom.window.document, "hidden", {
        configurable: true,
        value: hidden,
      });
    },
    timerCalls() {
      return timerCalls.slice();
    },
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

test("tools core Base64 fallback works when text codec access is blocked", async () => {
  const tools = await loadToolsCore({ textCodecThrows: true });
  const encoded = tools.encodeBase64("你好 blocked codec");

  assert.equal(encoded.ok, true);
  assert.equal(tools.decodeBase64(encoded.value).value, "你好 blocked codec");
});

test("tools core reports unavailable Base64 runtime APIs clearly", async () => {
  let tools = await loadToolsCore({ globals: { btoa: undefined } });
  let result = tools.encodeBase64("x");
  assert.equal(result.ok, false);
  assert.equal(result.code, "base64Encode");
  assert.match(result.error, /不支持 btoa/);

  tools = await loadToolsCore({ globals: { atob: undefined } });
  result = tools.decodeBase64("eA==");
  assert.equal(result.ok, false);
  assert.equal(result.code, "base64Decode");
  assert.match(result.error, /不支持 atob/);

  tools = await loadToolsCore({ noTextCodec: true, globals: { unescape: undefined } });
  result = tools.encodeBase64("x");
  assert.equal(result.ok, false);
  assert.equal(result.code, "base64Encode");
  assert.match(result.error, /缺少文本编码能力/);

  tools = await loadToolsCore({ noTextCodec: true, globals: { escape: undefined } });
  result = tools.decodeBase64("eA==");
  assert.equal(result.ok, false);
  assert.equal(result.code, "base64Decode");
  assert.match(result.error, /缺少文本解码能力/);
});

test("tools core reports blocked Base64 runtime API access clearly", async () => {
  let tools = await loadToolsCore({ globalThrows: ["btoa"] });
  let result = tools.encodeBase64("x");
  assert.equal(result.ok, false);
  assert.equal(result.code, "base64Encode");
  assert.match(result.error, /不支持 btoa/);

  tools = await loadToolsCore({ globalThrows: ["atob"] });
  result = tools.decodeBase64("eA==");
  assert.equal(result.ok, false);
  assert.equal(result.code, "base64Decode");
  assert.match(result.error, /不支持 atob/);
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

test("tools core UUID generation survives blocked crypto access", async () => {
  const tools = await loadToolsCore({ cryptoThrows: true });

  assert.match(tools.generateUuid(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
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

test("tools core handles the expanded toolbox utilities", async () => {
  let randomByte = 0;
  const tools = await loadToolsCore({
    vendors: true,
    globals: { TextEncoder: globalThis.TextEncoder },
    crypto: {
      getRandomValues(bytes) {
        for (let i = 0; i < bytes.length; i += 1) {
          bytes[i] = randomByte % 251;
          randomByte += 1;
        }
        return bytes;
      },
      subtle: {
        digest(algorithm, bytes) {
          assert.equal(algorithm, "SHA-256");
          assert.ok(bytes.byteLength > 0);
          return Promise.resolve(Uint8Array.from([0xde, 0xad, 0xbe, 0xef]).buffer);
        },
      },
    },
  });

  assert.equal((await tools.hashText("hello", "SHA-256")).value, "deadbeef");
  assert.equal((await tools.hashText("hello", "MD5")).code, "hashAlgorithm");

  const password = tools.generatePassword({ length: 16, lower: true, upper: true, number: true, symbol: true });
  assert.equal(password.ok, true);
  assert.equal(password.value.password.length, 16);
  assert.match(password.value.password, /[a-z]/);
  assert.match(password.value.password, /[A-Z]/);
  assert.match(password.value.password, /\d/);
  assert.match(password.value.password, /[!@#$%^&*()\-_=+\[\]{};:,.?/|~]/);
  assert.equal(tools.generatePassword({ length: 6, lower: true }).code, "passwordLength");
  assert.equal(tools.generatePassword({ length: 12, lower: false, upper: false, number: false, symbol: false }).code, "passwordCharset");

  const color = tools.convertColor("#2563eb");
  assert.equal(color.ok, true);
  assert.match(color.value.lines, /RGB: rgb\(37, 99, 235\)/);
  assert.equal(tools.convertColor("not-a-color").code, "colorInput");

  const regex = tools.testRegex("(\\w+)@(example\\.com)", "gi", "a@example.com b@test.dev");
  assert.equal(regex.ok, true);
  assert.match(regex.value, /Matches: 1/);
  assert.match(regex.value, /\$1: "a"/);
  assert.equal(tools.testRegex("[", "g", "x").code, "regexPattern");
  assert.equal(tools.testRegex("x", "gg", "x").code, "regexFlags");

  const markdown = tools.renderMarkdown("# Title\n\n<script>alert(1)</script>");
  assert.equal(markdown.ok, true);
  assert.match(markdown.value.html, /<h1>Title<\/h1>/);
  assert.doesNotMatch(markdown.value.html, /<script>/);

  const diff = tools.diffLines("a\nb", "a\nc");
  assert.equal(diff.ok, true);
  assert.match(diff.value, /\+ c/);
  assert.match(diff.value, /- b/);

  const cases = tools.convertCase("user profile ID");
  assert.equal(cases.ok, true);
  assert.match(cases.value, /camelCase: userProfileId/);
  assert.match(cases.value, /snake_case: user_profile_id/);

  assert.equal(tools.encodeHtmlEntities("<b>CWL & Codex</b>").value, "&lt;b&gt;CWL &amp; Codex&lt;/b&gt;");
  assert.equal(tools.decodeHtmlEntities("&lt;b&gt;CWL&lt;/b&gt;").value, "<b>CWL</b>");

  const cron = tools.parseCronExpression("*/30 9-10 * * mon-fri", "2026-06-18T08:58:00");
  assert.equal(cron.ok, true);
  assert.match(cron.value, /2026-06-18 09:00/);
  assert.equal(tools.parseCronExpression("* * *").code, "cronParts");

  const yaml = tools.jsonToYaml('{"name":"CWL","enabled":true}');
  assert.equal(yaml.ok, true);
  assert.match(yaml.value, /name: CWL/);
  assert.equal(tools.yamlToJson("name: CWL\nenabled: true").value, '{\n  "name": "CWL",\n  "enabled": true\n}');

  assert.match(tools.parseUrl("https://example.com/docs?q=CWL#top").value, /hostname: example\.com/);
  assert.equal(tools.convertQuery("name=CWL\nq=工具箱").value, "name=CWL&q=%E5%B7%A5%E5%85%B7%E7%AE%B1");
  assert.match(tools.convertQuery("name=CWL&q=toolbox").value, /q=toolbox/);

  const jsonPath = tools.queryJsonPath('{"users":[{"name":"CWL"}]}', "$.users[0].name");
  assert.equal(jsonPath.value, '"CWL"');
  assert.equal(tools.queryJsonPath("{}", "users").code, "jsonPath");

  assert.match(tools.textStats("Hello 世界\nCodex").value, /Lines: 2/);
  assert.equal(tools.cleanText(" b \n\na\n b ", { trim: true, removeEmpty: true, removeDupes: true, sort: true }).value, "a\nb");
  assert.match(tools.convertUnit(1, "length", "km").value, /m: 1000/);
  assert.match(tools.generateRandom({ min: 1, max: 3, count: 3, integer: true, unique: true }).value, /^[1-3]\n[1-3]\n[1-3]$/);
  assert.match(tools.dateDiff("2026-06-01T00:00", "2026-06-08T00:00").value, /Absolute duration: 7d/);
  assert.match(tools.parseUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36").value, /Browser: Chrome 126/);
});

test("tools core QR generator uses local vendor runtime", async () => {
  const qrCode = await readFile(join(ROOT, "js", "vendor", "qrcode.min.js"), "utf8");
  const toolsCode = await readFile(join(ROOT, "js", "tools-core.js"), "utf8");
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/tools/",
  });
  try {
    dom.window.eval(qrCode);
    dom.window.eval(toolsCode);

    const result = dom.window.CWLToolsCore.createQrCode("https://wenliang844.github.io/tools/");
    assert.equal(result.ok, true);
    assert.match(result.value, /^data:image\/gif;base64,/);
    assert.equal(dom.window.CWLToolsCore.createQrCode("").code, "qrInput");
  } finally {
    dom.window.close();
  }
});

test("tools tabs expose selected state and support keyboard navigation", async () => {
  const { dom } = await loadToolsPage();
  const { document, KeyboardEvent } = dom.window;
  try {
    const jsonTab = document.querySelector('[data-tool-tab="json"]');
    const timeTab = document.querySelector('[data-tool-tab="time"]');
    const uaTab = document.querySelector('[data-tool-tab="ua"]');

    const tabList = document.querySelector(".tools-tabs");
    assert.equal(tabList.getAttribute("role"), "tablist");
    assert.equal(tabList.getAttribute("data-i18n-aria"), "tools.tabs");
    assert.equal(tabList.getAttribute("data-i18n-en-aria"), "Tool list");
    assert.equal(document.querySelectorAll("[data-tool-tab]").length, 26);
    assert.equal(document.querySelector("#base64-input").getAttribute("data-i18n-ph"), "tools.base64.placeholder");
    assert.equal(document.querySelector("#base64-input").getAttribute("data-i18n-en-ph"), "Text to encode or decode");
    assert.equal(document.querySelector("#url-input").getAttribute("data-i18n-en-ph"), "https://example.com/?q=search");
    assert.equal(document.querySelector("#html-input").getAttribute("data-i18n-ph"), "tools.html.placeholder");
    assert.equal(document.querySelector("#tool-jwt .jwt-warning").getAttribute("data-i18n"), "tools.jwt.warning");
    assert.match(document.querySelector("#tool-jwt .jwt-warning").textContent, /未经签名验证/);
    assert.equal(jsonTab.getAttribute("role"), "tab");
    assert.equal(document.querySelector("#tool-json").getAttribute("role"), "tabpanel");
    assert.equal(jsonTab.getAttribute("aria-selected"), "true");
    assert.equal(timeTab.getAttribute("aria-selected"), "false");

    jsonTab.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
    assert.equal(timeTab.getAttribute("aria-selected"), "true");
    assert.equal(document.querySelector("#tool-time").hidden, false);
    assert.equal(document.querySelector("#tool-json").hidden, true);

    timeTab.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true }));
    assert.equal(uaTab.getAttribute("aria-selected"), "true");
    assert.equal(document.querySelector("#tool-ua").hidden, false);
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

test("tools page ignores unknown tab targets without clearing selection", async () => {
  const { dom } = await loadToolsPage();
  const { document, KeyboardEvent } = dom.window;
  try {
    const jsonTab = document.querySelector('[data-tool-tab="json"]');
    const uaTab = document.querySelector('[data-tool-tab="ua"]');
    const jsonPanel = document.querySelector('[data-tool-panel="json"]');

    const outsideTab = document.createElement("button");
    outsideTab.setAttribute("data-tool-tab", "time");
    document.body.appendChild(outsideTab);
    outsideTab.click();

    assert.equal(jsonTab.classList.contains("active"), true);
    assert.equal(jsonTab.getAttribute("aria-selected"), "true");
    assert.equal(jsonPanel.hidden, false);

    const unknownTab = document.createElement("button");
    unknownTab.setAttribute("data-tool-tab", "missing");
    document.querySelector(".tools-tabs").appendChild(unknownTab);
    unknownTab.click();

    assert.equal(jsonTab.classList.contains("active"), true);
    assert.equal(jsonTab.getAttribute("aria-selected"), "true");
    assert.equal(jsonPanel.hidden, false);

    jsonTab.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true }));
    assert.equal(uaTab.classList.contains("active"), true);
    assert.equal(uaTab.getAttribute("aria-selected"), "true");

    const duplicateJsonTab = document.createElement("button");
    duplicateJsonTab.setAttribute("data-tool-tab", "json");
    document.querySelector(".tools-tabs").appendChild(duplicateJsonTab);
    jsonTab.click();

    assert.equal(jsonTab.classList.contains("active"), true);
    assert.equal(duplicateJsonTab.classList.contains("active"), false);
    assert.equal(document.querySelectorAll('.tools-tabs [data-tool-tab="json"].active').length, 1);
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
    assert.match(document.querySelector("#tool-jwt .jwt-warning").textContent, /signature-verified/);

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

test("expanded tools page runs all new tool actions locally", async () => {
  const { dom } = await loadToolsPage();
  const { document } = dom.window;
  let randomByte = 0;
  try {
    Object.defineProperty(dom.window, "crypto", {
      configurable: true,
      value: {
        getRandomValues(bytes) {
          for (let i = 0; i < bytes.length; i += 1) {
            bytes[i] = randomByte % 251;
            randomByte += 1;
          }
          return bytes;
        },
        subtle: {
          digest() {
            return Promise.resolve(Uint8Array.from([0xca, 0xfe]).buffer);
          },
        },
      },
    });
    dom.window.TextEncoder = globalThis.TextEncoder;

    document.querySelector("#hash-input").value = "hello";
    document.querySelector("[data-hash-generate]").click();
    await new Promise((resolve) => {
      dom.window.setTimeout(resolve, 0);
    });
    assert.equal(document.querySelector("#hash-output").value, "cafe");
    assert.equal(document.querySelector("#hash-status").classList.contains("is-ok"), true);

    document.querySelector("#password-length").value = "16";
    document.querySelector("[data-password-generate]").click();
    assert.equal(document.querySelector("#password-output").value.length, 16);
    assert.equal(document.querySelector("#password-status").classList.contains("is-ok"), true);

    document.querySelector("#color-input").value = "#2563eb";
    document.querySelector("[data-color-convert]").click();
    assert.match(document.querySelector("#color-output").value, /HEX: #2563EB/);
    assert.equal(document.querySelector("#color-swatch").style.backgroundColor, "rgb(37, 99, 235)");

    document.querySelector("#regex-pattern").value = "(\\w+)@(example\\.com)";
    document.querySelector("#regex-flags").value = "gi";
    document.querySelector("#regex-input").value = "a@example.com";
    document.querySelector("[data-regex-test]").click();
    assert.match(document.querySelector("#regex-output").value, /Matches: 1/);

    document.querySelector("#markdown-input").value = "# Title\n\n<script>alert(1)</script>";
    document.querySelector("[data-markdown-render]").click();
    assert.match(document.querySelector("#markdown-output").value, /<h1>Title<\/h1>/);
    assert.equal(document.querySelector("#markdown-preview script"), null);

    document.querySelector("#diff-left").value = "a\nb";
    document.querySelector("#diff-right").value = "a\nc";
    document.querySelector("[data-diff-run]").click();
    assert.match(document.querySelector("#diff-output").value, /\+ c/);

    document.querySelector("#case-input").value = "user profile id";
    document.querySelector("[data-case-convert]").click();
    assert.match(document.querySelector("#case-output").value, /camelCase: userProfileId/);

    document.querySelector("#html-input").value = "<b>CWL & Codex</b>";
    document.querySelector('[data-codec-action="html-encode"]').click();
    assert.equal(document.querySelector("#html-output").value, "&lt;b&gt;CWL &amp; Codex&lt;/b&gt;");

    document.querySelector("#cron-input").value = "*/30 9-10 * * mon-fri";
    document.querySelector("[data-cron-parse]").click();
    assert.match(document.querySelector("#cron-output").value, /Next 5 runs:/);

    document.querySelector("#qr-input").value = "https://wenliang844.github.io/tools/";
    document.querySelector("[data-qr-generate]").click();
    assert.match(document.querySelector("#qr-output").value, /^data:image\/gif;base64,/);
    assert.equal(document.querySelector("#qr-image").hidden, false);
    assert.equal(document.querySelector("#qr-empty").hidden, true);
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
    assert.equal(document.querySelector("#time-status").textContent, "Converted");
  } finally {
    dom.window.close();
  }
});

test("current time timer pauses while the tools page is hidden", async () => {
  const { clearedTimers, dom, setHidden, timerCalls } = await loadToolsPage({ timerSpy: true });
  const { document, Event } = dom.window;
  try {
    assert.equal(timerCalls().length, 1);
    assert.equal(timerCalls()[0].delay, 1000);
    assert.deepEqual(clearedTimers(), []);

    setHidden(true);
    document.dispatchEvent(new Event("visibilitychange"));

    assert.deepEqual(clearedTimers(), [1]);

    setHidden(false);
    document.dispatchEvent(new Event("visibilitychange"));

    assert.equal(timerCalls().length, 2);
    assert.equal(timerCalls()[1].delay, 1000);

    document.dispatchEvent(new Event("visibilitychange"));
    assert.equal(timerCalls().length, 2);
  } finally {
    dom.window.close();
  }
});

test("tool success and copy statuses rerender after language changes", async () => {
  const { dom } = await loadToolsPage({ i18n: true });
  const { document } = dom.window;
  try {
    document.querySelector("#json-input").value = '{"ok":true}';
    document.querySelector('[data-json-action="format"]').click();
    assert.equal(document.querySelector("#json-status").textContent, "处理完成");

    document.querySelector('[data-tool-tab="uuid"]').click();
    document.querySelector("[data-uuid-generate]").click();
    document.querySelector('[data-copy-target="uuid-output"]').click();
    await new Promise((resolve) => {
      dom.window.setTimeout(resolve, 0);
    });
    assert.equal(document.querySelector("#uuid-status").textContent, "已复制");

    document.querySelector('[data-tool-tab="jwt"]').click();
    document.querySelector("#jwt-input").value = [
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
      "eyJzdWIiOiIxMjM0NTY3ODkwIn0",
      "signature",
    ].join(".");
    document.querySelector("[data-jwt-decode]").click();
    assert.match(document.querySelector("#jwt-status").textContent, /JWT 已解码/);

    document.querySelector(".lang-toggle").click();

    assert.equal(document.querySelector("#json-status").textContent, "Done");
    assert.equal(document.querySelector("#uuid-status").textContent, "Copied");
    assert.equal(
      document.querySelector("#jwt-status").textContent,
      "JWT decoded. The content has not been signature-verified; do not use it for security decisions.",
    );
  } finally {
    dom.window.close();
  }
});

test("tool error statuses rerender after language changes", async () => {
  const { dom } = await loadToolsPage({ i18n: true });
  const { document } = dom.window;
  try {
    document.querySelector("#json-input").value = "{bad";
    document.querySelector('[data-json-action="format"]').click();
    assert.match(document.querySelector("#json-status").textContent, /^JSON 解析失败：/);

    document.querySelector('[data-tool-tab="url"]').click();
    document.querySelector("#url-input").value = "%E0%A4%A";
    document.querySelector('[data-codec-action="url-decode"]').click();
    assert.equal(document.querySelector("#url-status").textContent, "URL 解码失败：请输入合法的 URL 编码文本");

    document.querySelector(".lang-toggle").click();

    assert.match(document.querySelector("#json-status").textContent, /^JSON parse failed: /);
    assert.equal(document.querySelector("#url-status").textContent, "URL decoding failed. Please enter valid URL-encoded text.");
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

test("copy actions report missing targets in the source panel", async () => {
  const { copiedText, dom } = await loadToolsPage();
  const { document } = dom.window;
  try {
    document.querySelector('[data-tool-tab="uuid"]').click();
    const invalidCopy = document.createElement("button");
    invalidCopy.type = "button";
    invalidCopy.setAttribute("data-copy-target", "missing-output");
    document.querySelector("#tool-uuid .tool-actions").appendChild(invalidCopy);
    invalidCopy.click();

    assert.equal(copiedText(), null);
    assert.equal(document.querySelector("#uuid-status").classList.contains("is-error"), true);
    assert.match(document.querySelector("#uuid-status").textContent, /没有可复制的内容/);
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

test("copy utility preserves falsey values in legacy fallback", async () => {
  const code = await readFile(join(ROOT, "js", "utils.js"), "utf8");
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/tools/",
  });
  const { document } = dom.window;
  let copiedValue = null;
  try {
    Object.defineProperty(dom.window.navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    document.execCommand = function () {
      copiedValue = document.querySelector("textarea").value;
      return true;
    };
    dom.window.eval(code);

    await assert.doesNotReject(() => dom.window.CWLUtils.copyText(0));
    assert.equal(copiedValue, "0");
    assert.equal(document.querySelectorAll("textarea").length, 0);
  } finally {
    dom.window.close();
  }
});

test("copy utility works when document body is unavailable", async () => {
  const code = await readFile(join(ROOT, "js", "utils.js"), "utf8");
  const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/tools/",
  });
  const { document } = dom.window;
  let copiedValue = null;
  try {
    document.body.remove();
    Object.defineProperty(dom.window.navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    document.execCommand = function () {
      copiedValue = document.querySelector("textarea").value;
      return true;
    };
    dom.window.eval(code);

    await assert.doesNotReject(() => dom.window.CWLUtils.copyText("bodyless copy"));
    assert.equal(copiedValue, "bodyless copy");
    assert.equal(document.querySelectorAll("textarea").length, 0);
  } finally {
    dom.window.close();
  }
});
