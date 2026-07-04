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
  const editorCode = await readFile(join(ROOT, "js", "editor.js"), "utf8");
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
      ...dom.window.CWLUtils,
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
  if (options.fetch) {
    dom.window.fetch = options.fetch;
  }
  if (Object.prototype.hasOwnProperty.call(options, "Worker")) {
    Object.defineProperty(dom.window, "Worker", {
      configurable: true,
      value: options.Worker,
    });
  }
  dom.window.eval(toolsCode);
  dom.window.eval(editorCode);
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

async function loadGestureRuntime() {
  const code = await readFile(join(ROOT, "js", "gesture.js"), "utf8");
  const dom = new JSDOM(`<!doctype html><html><body>
    <button id="gesture-start" type="button" disabled>start</button>
    <button id="gesture-stop" type="button" disabled>stop</button>
    <button id="gesture-clear" type="button">clear</button>
    <input id="gesture-allow-remote-runtime" type="checkbox">
    <input id="gesture-haptics" type="checkbox">
    <input id="gesture-sound" type="checkbox">
    <video id="gesture-video"></video>
    <canvas id="gesture-canvas"></canvas>
    <div id="gesture-overlay"></div>
    <span id="gesture-status"></span>
    <span id="gesture-label"></span>
    <span id="gesture-fps"></span>
    <span id="gesture-face"></span>
    <section data-tool-panel="gesture"></section>
  </body></html>`, {
    pretendToBeVisual: true,
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/tools/",
  });
  dom.window.HTMLCanvasElement.prototype.getContext = () => ({
    clearRect() {},
    setTransform() {},
  });
  let cameraRequests = 0;
  Object.defineProperty(dom.window.navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia() {
        cameraRequests += 1;
        return Promise.reject(new Error("camera should not be requested"));
      },
    },
  });
  dom.window.eval(code);
  return {
    cameraRequests() {
      return cameraRequests;
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

test("tools core UUID generation uses getRandomValues when randomUUID fails", async () => {
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

  const result = tools.generateUuid();
  assert.equal(result.ok, true);
  assert.equal(result.value, "00010203-0405-4607-8809-0a0b0c0d0e0f");
});

test("tools core UUID generation fails clearly when secure crypto is unavailable", async () => {
  const tools = await loadToolsCore({ cryptoThrows: true });
  const result = tools.generateUuid();

  assert.equal(result.ok, false);
  assert.equal(result.code, "uuidCrypto");
  assert.match(result.error, /安全随机数/);
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
  const uuid = tools.generateUuid();
  assert.equal(uuid.ok, true);
  assert.match(uuid.value, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

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

  const jsonDiff = tools.diffJson('{"data":[{"score":97}]}', '{"data":[{"score":100,"name":"CWL"}]}');
  assert.equal(jsonDiff.ok, true);
  assert.match(jsonDiff.value, /\~ \$\.data\[0\]\.score: 97 -> 100/);
  assert.match(jsonDiff.value, /\+ \$\.data\[0\]\.name: "CWL"/);

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
  assert.equal(tools.generateCronExpression({ minuteStep: 15, hourStart: 9, hourEnd: 18, dayOfMonth: "*", month: "*", weekdays: ["1", "2", "3", "4", "5"] }).value, "*/15 9-18 * * 1,2,3,4,5");

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
  assert.equal(tools.queryJsonPath('{"deep":{"value":1}}', "$.deep.value trailing").code, "jsonPathSyntax");
  assert.equal(tools.queryJsonPath('{"deep":{"value":0}}', "$.deep.value").value, "0");

  assert.match(tools.textStats("Hello 世界\nCodex").value, /Lines: 2/);
  assert.equal(tools.cleanText(" b \n\na\n b ", { trim: true, removeEmpty: true, removeDupes: true, sort: true }).value, "a\nb");
  assert.match(tools.convertUnit(1, "length", "km").value, /m: 1000/);
  assert.match(tools.convertCssUnit(16, "px", 16, 16, 1440, 900).value, /rem: 1rem/);
  assert.match(tools.convertCssUnit(10, "vw", 16, 20, 1000, 800).value, /px: 100px/);
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
    const yamlTab = document.querySelector('[data-tool-tab="yaml"]');
    const timeTab = document.querySelector('[data-tool-tab="time"]');
    const uaTab = document.querySelector('[data-tool-tab="ua"]');
    const galaxyTab = document.querySelector('[data-tool-tab="galaxy"]');
    const gestureTab = document.querySelector('[data-tool-tab="gesture"]');

    const tabList = document.querySelector(".tools-tabs");
    assert.equal(tabList.getAttribute("role"), "tablist");
    assert.equal(tabList.getAttribute("data-i18n-aria"), "tools.tabs");
    assert.equal(tabList.getAttribute("data-i18n-en-aria"), "Categorized tool list");
    assert.equal(document.querySelectorAll(".tool-category").length, 7);
    assert.equal(document.querySelector(".tool-category").getAttribute("data-tool-category"), "visual");
    assert.match(document.querySelector('[data-tool-category="data"]').textContent, /数据格式/);
    assert.match(document.querySelector('[data-tool-category="security"]').textContent, /编码与安全/);
    assert.match(document.querySelector('[data-tool-category="visual"]').textContent, /星河/);
    assert.equal(document.querySelector('[data-tool-category="visual"] .tool-category-count').textContent, "2");
    assert.equal(document.querySelector('[data-tool-category="data"]').tagName, "DETAILS");
    assert.equal(document.querySelector('[data-tool-category="data"]').open, true);
    assert.equal(document.querySelector('[data-tool-category="frontend"]').open, true);
    assert.equal(document.querySelectorAll("[data-tool-tab]").length, 31);
    assert.equal(document.querySelectorAll("[data-tool-panel]").length, 1);
    assert.equal(document.querySelectorAll("template[data-tool-template]").length, 30);
    assert.ok(document.querySelector('[data-tool-tab="api"]'));
    assert.ok(document.querySelector('[data-tool-tab="jsondiff"]'));
    assert.ok(document.querySelector('[data-tool-tab="cssunit"]'));
    assert.ok(galaxyTab);
    assert.equal(document.querySelector("#json-input").getAttribute("aria-label"), "输入 JSON");
    assert.equal(jsonTab.getAttribute("role"), "tab");
    assert.equal(document.querySelector("#tool-json").getAttribute("role"), "tabpanel");
    assert.equal(jsonTab.getAttribute("aria-selected"), "true");
    assert.equal(timeTab.getAttribute("aria-selected"), "false");

    jsonTab.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
    assert.equal(yamlTab.getAttribute("aria-selected"), "true");
    assert.equal(document.querySelector("#tool-yaml").hidden, false);
    assert.equal(document.querySelector("#tool-json").hidden, true);
    assert.equal(document.querySelectorAll("template[data-tool-template=\"yaml\"]").length, 0);

    yamlTab.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true }));
    assert.equal(uaTab.getAttribute("aria-selected"), "true");
    assert.equal(document.querySelector("#tool-ua").hidden, false);

    uaTab.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true, cancelable: true }));
    assert.equal(galaxyTab.getAttribute("aria-selected"), "true");
    assert.equal(document.querySelector("#tool-galaxy").hidden, false);
    assert.equal(document.querySelector("#tool-galaxy .galaxy-canvas").id, "galaxy-canvas");
    assert.equal(document.querySelector("#galaxy-theme [data-galaxy-theme].active").getAttribute("data-galaxy-theme"), "bluePurple");
    assert.equal(document.querySelector("#galaxy-count [data-galaxy-count].active").getAttribute("data-galaxy-count"), "1000");
    assert.equal(document.querySelector('[data-tool-category="visual"]').open, true);
    const galaxyScript = Array.from(document.querySelectorAll("script")).find((script) => script.getAttribute("src") === "/js/galaxy.js");
    assert.ok(galaxyScript);
    galaxyScript.dispatchEvent(new dom.window.Event("load"));

    document.querySelector('[data-tool-tab="base64"]').click();
    assert.equal(document.querySelector("#base64-input").getAttribute("data-i18n-ph"), "tools.base64.placeholder");
    assert.equal(document.querySelector("#base64-input").getAttribute("data-i18n-en-ph"), "Text to encode or decode");
    document.querySelector('[data-tool-tab="api"]').click();
    assert.equal(document.querySelector("#api-url").getAttribute("aria-label"), "URL");
    assert.equal(document.querySelector("#api-allow-risky-target").getAttribute("aria-label"), "允许本机/内网/非 HTTPS 请求");
    document.querySelector('[data-tool-tab="random"]').click();
    assert.match(document.querySelector("#tool-random .random-warning").textContent, /普通伪随机数/);
    document.querySelector('[data-tool-tab="cron"]').click();
    assert.equal(document.querySelector("#cron-minute-step").getAttribute("aria-label"), "分钟间隔");
    document.querySelector('[data-tool-tab="url"]').click();
    assert.equal(document.querySelector("#url-input").getAttribute("data-i18n-en-ph"), "https://example.com/?q=search");
    document.querySelector('[data-tool-tab="html"]').click();
    assert.equal(document.querySelector("#html-input").getAttribute("data-i18n-ph"), "tools.html.placeholder");
    document.querySelector('[data-tool-tab="jwt"]').click();
    assert.equal(document.querySelector("#tool-jwt .jwt-warning").getAttribute("data-i18n"), "tools.jwt.warning");
    assert.match(document.querySelector("#tool-jwt .jwt-warning").textContent, /未经签名验证/);

    gestureTab.click();
    const premiumScript = Array.from(document.querySelectorAll("script")).find((script) => script.getAttribute("src") === "/js/gesture-premium.js");
    assert.ok(premiumScript);
    assert.equal(Array.from(document.querySelectorAll("script")).some((script) => script.getAttribute("src") === "/js/gesture.js"), false);
    premiumScript.dispatchEvent(new dom.window.Event("load"));
    await new Promise((resolve) => {
      dom.window.setTimeout(resolve, 0);
    });
    assert.ok(Array.from(document.querySelectorAll("script")).some((script) => script.getAttribute("src") === "/js/gesture.js"));
  } finally {
    dom.window.close();
  }
});

test("gesture runtime gates camera start on supply-chain acknowledgement", async () => {
  const { cameraRequests, dom } = await loadGestureRuntime();
  const { document, Event } = dom.window;
  try {
    const start = document.querySelector("#gesture-start");
    const consent = document.querySelector("#gesture-allow-remote-runtime");
    const status = document.querySelector("#gesture-status");

    assert.equal(start.disabled, true);
    assert.equal(status.textContent, "等待确认资源说明");

    start.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));
    assert.equal(cameraRequests(), 0);
    assert.equal(status.textContent, "请先确认第三方视觉资源和本地处理说明");

    consent.checked = true;
    consent.dispatchEvent(new Event("change", { bubbles: true }));
    assert.equal(start.disabled, false);
    assert.equal(status.textContent, "就绪");

    consent.checked = false;
    consent.dispatchEvent(new Event("change", { bubbles: true }));
    assert.equal(start.disabled, true);
    assert.equal(status.textContent, "等待确认资源说明");
  } finally {
    dom.window.close();
  }
});

test("gesture runtime releases camera when the page is hidden", async () => {
  const code = await readFile(join(ROOT, "js", "gesture.js"), "utf8");

  assert.match(code, /document\.addEventListener\("visibilitychange", function \(\) \{/);
  assert.match(code, /if \(document\.hidden && running\) \{\s*stopCamera\(\);\s*setStatus\("ready", "页面已隐藏，摄像头已关闭"\);/);
  assert.doesNotMatch(code, /pause detection but keep stream alive/);
});

test("gesture startup reports camera initialization and video stream phases", async () => {
  const code = await readFile(join(ROOT, "js", "gesture.js"), "utf8");

  assert.match(code, /setStatus\("loading", "初始化摄像头…"\);\s*try \{\s*cameraStream = await navigator\.mediaDevices\.getUserMedia/);
  assert.match(code, /\$video\.srcObject = cameraStream;\s*setStatus\("loading", "启动视频流…"\);\s*await \$video\.play\(\);/);
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
    const lastTab = document.querySelector('[data-tool-tab="ua"]');
    assert.equal(lastTab.classList.contains("active"), true);
    assert.equal(lastTab.getAttribute("aria-selected"), "true");

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
    document.querySelector('[data-tool-tab="base64"]').click();
    assert.equal(document.querySelector("#base64-input").getAttribute("placeholder"), "输入要编码或解码的文本");

    document.querySelector(".lang-toggle").click();
    assert.equal(document.documentElement.getAttribute("lang"), "en");
    assert.equal(document.querySelector(".tools-header h1").textContent, "Toolbox");
    assert.equal(document.querySelector(".tools-tabs").getAttribute("aria-label"), "Categorized tool list");
    assert.equal(document.querySelector('[data-tool-tab="galaxy"] span').textContent, "Galaxy");
    assert.equal(document.querySelector("#base64-input").getAttribute("placeholder"), "Text to encode or decode");
    document.querySelector('[data-tool-tab="url"]').click();
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

    document.querySelector('[data-tool-tab="hash"]').click();
    document.querySelector("#hash-input").value = "hello";
    document.querySelector("[data-hash-generate]").click();
    await new Promise((resolve) => {
      dom.window.setTimeout(resolve, 0);
    });
    assert.equal(document.querySelector("#hash-output").value, "cafe");
    assert.equal(document.querySelector("#hash-status").classList.contains("is-ok"), true);

    document.querySelector('[data-tool-tab="password"]').click();
    document.querySelector("#password-length").value = "16";
    document.querySelector("[data-password-generate]").click();
    assert.equal(document.querySelector("#password-output").value.length, 16);
    assert.equal(document.querySelector("#password-status").classList.contains("is-ok"), true);

    document.querySelector('[data-tool-tab="color"]').click();
    document.querySelector("#color-input").value = "#2563eb";
    document.querySelector("[data-color-convert]").click();
    assert.match(document.querySelector("#color-output").value, /HEX: #2563EB/);
    assert.equal(document.querySelector("#color-swatch").style.backgroundColor, "rgb(37, 99, 235)");
    assert.equal(document.querySelectorAll("#color-palette [data-color-value]").length, 7);

    document.querySelector('[data-tool-tab="regex"]').click();
    document.querySelector("#regex-pattern").value = "(\\w+)@(example\\.com)";
    document.querySelector("#regex-flags").value = "gi";
    document.querySelector("#regex-input").value = "a@example.com";
    document.querySelector("[data-regex-test]").click();
    assert.match(document.querySelector("#regex-output").value, /Matches: 1/);

    document.querySelector('[data-tool-tab="markdown"]').click();
    document.querySelector("#markdown-input").value = "# Title\n\n<script>alert(1)</script>";
    document.querySelector("#markdown-input").dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    await new Promise((resolve) => {
      dom.window.setTimeout(resolve, 180);
    });
    assert.equal(document.querySelector("#markdown-preview h1"), null);
    assert.match(document.querySelector("#markdown-preview").innerHTML, /preview-heading-1/);
    assert.equal(document.querySelector("#markdown-preview script"), null);

    document.querySelector('[data-tool-tab="diff"]').click();
    document.querySelector("#diff-left").value = "a\nb";
    document.querySelector("#diff-right").value = "a\nc";
    document.querySelector("[data-diff-run]").click();
    assert.match(document.querySelector("#diff-output").value, /\+ c/);

    document.querySelector('[data-tool-tab="jsondiff"]').click();
    document.querySelector("#jsondiff-left").value = '{"score":97}';
    document.querySelector("#jsondiff-right").value = '{"score":100,"name":"CWL"}';
    document.querySelector('[data-tool-run="json-diff"]').click();
    assert.match(document.querySelector("#jsondiff-output").value, /\$\.score: 97 -> 100/);

    document.querySelector('[data-tool-tab="case"]').click();
    document.querySelector("#case-input").value = "user profile id";
    document.querySelector("[data-case-convert]").click();
    assert.match(document.querySelector("#case-output").value, /camelCase: userProfileId/);

    document.querySelector('[data-tool-tab="html"]').click();
    document.querySelector("#html-input").value = "<b>CWL & Codex</b>";
    document.querySelector('[data-codec-action="html-encode"]').click();
    assert.equal(document.querySelector("#html-output").value, "&lt;b&gt;CWL &amp; Codex&lt;/b&gt;");

    document.querySelector('[data-tool-tab="cron"]').click();
    document.querySelector("#cron-input").value = "*/30 9-10 * * mon-fri";
    document.querySelector("[data-cron-parse]").click();
    assert.match(document.querySelector("#cron-output").value, /Next 5 runs:/);

    document.querySelector("#cron-minute-step").value = "15";
    document.querySelector("#cron-hour-start").value = "9";
    document.querySelector("#cron-hour-end").value = "18";
    document.querySelector("[data-cron-generate]").click();
    assert.equal(document.querySelector("#cron-input").value, "*/15 9-18 * * 1,2,3,4,5");
    assert.match(document.querySelector("#cron-output").value, /Next 5 runs:/);

    document.querySelector('[data-tool-tab="qr"]').click();
    document.querySelector("#qr-input").value = "https://wenliang844.github.io/tools/";
    document.querySelector("[data-qr-generate]").click();
    assert.match(document.querySelector("#qr-output").value, /^data:image\/gif;base64,/);
    assert.equal(document.querySelector("#qr-image").hidden, false);
    assert.equal(document.querySelector("#qr-empty").hidden, true);

    document.querySelector('[data-tool-tab="cssunit"]').click();
    document.querySelector("#cssunit-value").value = "16";
    document.querySelector("#cssunit-from").value = "px";
    document.querySelector('[data-tool-run="css-unit-convert"]').click();
    assert.match(document.querySelector("#cssunit-output").value, /rem: 1rem/);
  } finally {
    dom.window.close();
  }
});

test("regex tester runs inside a worker when available", async () => {
  const workerMessages = [];
  const workerUrls = [];
  class FakeWorker {
    constructor(url) {
      this.url = url;
      workerUrls.push(url);
      this.terminated = false;
    }

    postMessage(message) {
      workerMessages.push(message);
      setTimeout(() => {
        this.onmessage({
          data: {
            ok: true,
            value: 'Matches: 1\n#1: "a@example.com"',
          },
        });
      }, 0);
    }

    terminate() {
      this.terminated = true;
    }
  }

  const { dom } = await loadToolsPage({ Worker: FakeWorker });
  const { document } = dom.window;
  try {
    document.querySelector('[data-tool-tab="regex"]').click();
    document.querySelector("#regex-pattern").value = "(\\w+)@(example\\.com)";
    document.querySelector("#regex-flags").value = "gi";
    document.querySelector("#regex-input").value = "a@example.com";
    document.querySelector("[data-regex-test]").click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(workerUrls[0], "/js/regex-worker.js");
    assert.deepEqual(JSON.parse(JSON.stringify(workerMessages[0])), {
      pattern: "(\\w+)@(example\\.com)",
      flags: "gi",
      input: "a@example.com",
    });
    assert.match(document.querySelector("#regex-output").value, /Matches: 1/);
    assert.equal(document.querySelector("#regex-status").classList.contains("is-ok"), true);
  } finally {
    dom.window.close();
  }
});

test("regex tester times out stalled worker execution", async () => {
  const terminated = [];
  class HangingWorker {
    postMessage() {}

    terminate() {
      terminated.push(true);
    }
  }

  const { dom } = await loadToolsPage({ Worker: HangingWorker });
  const { document } = dom.window;
  const originalSetTimeout = dom.window.setTimeout;
  try {
    dom.window.setTimeout = function (callback, delay) {
      if (delay === 250) {
        callback();
        return 1;
      }
      return originalSetTimeout.call(this, callback, delay);
    };

    document.querySelector('[data-tool-tab="regex"]').click();
    document.querySelector("#regex-pattern").value = "(a+)+$";
    document.querySelector("#regex-input").value = "aaaaaaaaaaaaaaaaaaaa!";
    document.querySelector("[data-regex-test]").click();

    assert.equal(terminated.length, 1);
    assert.equal(document.querySelector("#regex-output").value, "");
    assert.equal(document.querySelector("#regex-status").textContent, "正则执行超时，请简化表达式或缩短测试文本");
    assert.equal(document.querySelector("#regex-status").classList.contains("is-error"), true);
  } finally {
    dom.window.setTimeout = originalSetTimeout;
    dom.window.close();
  }
});

test("mini API tester fills relay presets, sends requests and stores history", async () => {
  const fetchCalls = [];
  const { dom } = await loadToolsPage({
    fetch(url, init) {
      fetchCalls.push({ url: String(url), init });
      if (String(url).includes("/data/relay-providers.json")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            providers: [{
              name: "Relay One",
              format: "chatgpt",
              formatLabel: "ChatGPT/OpenAI",
              endpoint: "https://relay.example/v1",
              models: ["gpt-test"],
              score: 99,
            }],
            commercialProviders: [],
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        url: String(url),
        headers: {
          forEach(callback) {
            callback("application/json", "content-type");
          },
        },
        text: () => Promise.resolve('{"ok":true}'),
      });
    },
  });
  const { document } = dom.window;
  try {
    document.querySelector('[data-tool-tab="api"]').click();
    await new Promise((resolve) => {
      dom.window.setTimeout(resolve, 0);
    });
    await new Promise((resolve) => {
      dom.window.setTimeout(resolve, 0);
    });
    assert.match(document.querySelector("#api-relay-select").textContent, /Relay One/);

    document.querySelector("[data-api-relay-fill]").click();
    assert.equal(document.querySelector("#api-method").value, "POST");
    assert.equal(document.querySelector("#api-url").value, "https://relay.example/v1/chat/completions");
    assert.match(document.querySelector("#api-headers").value, /Authorization: Bearer/);
    assert.match(document.querySelector("#api-body").value, /gpt-test/);

    document.querySelector("[data-api-send]").click();
    await new Promise((resolve) => {
      dom.window.setTimeout(resolve, 0);
    });
    await new Promise((resolve) => {
      dom.window.setTimeout(resolve, 0);
    });

    assert.equal(fetchCalls[1].url, "https://relay.example/v1/chat/completions");
    assert.equal(fetchCalls[1].init.method, "POST");
    assert.match(document.querySelector("#api-response").value, /Status: 200 OK/);
    assert.match(document.querySelector("#api-response").value, /"ok": true/);
    assert.match(document.querySelector("#api-history").textContent, /POST https:\/\/relay\.example/);
    const history = JSON.parse(dom.window.localStorage.getItem("cwl.tools.apiHistory"));
    assert.equal(history.length, 1);
    assert.match(history[0].headers, /Authorization: \[redacted\]/);
    assert.doesNotMatch(history[0].headers, /YOUR_API_KEY/);
    assert.equal(history[0].body, "");
  } finally {
    dom.window.close();
  }
});

test("mini API tester can explicitly save request bodies while redacting sensitive headers", async () => {
  const { dom } = await loadToolsPage();
  const { document } = dom.window;
  try {
    document.querySelector('[data-tool-tab="api"]').click();
    document.querySelector("#api-method").value = "POST";
    document.querySelector("#api-url").value = "https://api.example.test/v1/messages";
    document.querySelector("#api-headers").value = [
      "Content-Type: application/json",
      "x-api-key: secret-key",
      "Cookie: session=secret",
      "x-trace-id: visible",
    ].join("\n");
    document.querySelector("#api-body").value = '{"keep":true}';
    document.querySelector("#api-save-body-history").checked = true;
    document.querySelector("[data-api-save]").click();

    const history = JSON.parse(dom.window.localStorage.getItem("cwl.tools.apiHistory"));
    assert.equal(history[0].body, '{"keep":true}');
    assert.match(history[0].headers, /x-api-key: \[redacted\]/);
    assert.match(history[0].headers, /Cookie: \[redacted\]/);
    assert.match(history[0].headers, /x-trace-id: visible/);
    assert.equal(document.querySelector("#api-status").textContent, "请求已安全保存");
  } finally {
    dom.window.close();
  }
});

test("mini API tester redacts sensitive history by default and saves body only when opted in", async () => {
  const { dom } = await loadToolsPage();
  const { document, localStorage } = dom.window;
  try {
    document.querySelector('[data-tool-tab="api"]').click();
    document.querySelector("#api-method").value = "POST";
    document.querySelector("#api-url").value = "https://api.example.test/v1/messages";
    document.querySelector("#api-headers").value = [
      "Content-Type: application/json",
      "Authorization: Bearer real-token",
      "Cookie: sid=secret-cookie",
      "x-api-key: live-key",
    ].join("\n");
    document.querySelector("#api-body").value = '{"secret":"body-value"}';

    document.querySelector("[data-api-save]").click();
    let history = JSON.parse(localStorage.getItem("cwl.tools.apiHistory"));
    assert.equal(history.length, 1);
    assert.match(history[0].headers, /Authorization: \[redacted\]/);
    assert.match(history[0].headers, /Cookie: \[redacted\]/);
    assert.match(history[0].headers, /x-api-key: \[redacted\]/);
    assert.doesNotMatch(history[0].headers, /real-token|secret-cookie|live-key/);
    assert.equal(history[0].body, "");
    assert.equal(document.querySelector("#api-status").textContent, "请求已安全保存");

    document.querySelector("#api-save-body-history").checked = true;
    document.querySelector("#api-headers").value = '{"Authorization":"Bearer json-token","X-Api-Key":"json-key","Accept":"application/json"}';
    document.querySelector("[data-api-save]").click();
    history = JSON.parse(localStorage.getItem("cwl.tools.apiHistory"));
    assert.equal(history.length, 2);
    assert.match(history[0].headers, /"Authorization": "\[redacted\]"/);
    assert.match(history[0].headers, /"X-Api-Key": "\[redacted\]"/);
    assert.match(history[0].headers, /"Accept": "application\/json"/);
    assert.doesNotMatch(history[0].headers, /json-token|json-key/);
    assert.equal(history[0].body, '{"secret":"body-value"}');
  } finally {
    dom.window.close();
  }
});

test("mini API tester reports local history save failures", async () => {
  const fetchCalls = [];
  const { dom } = await loadToolsPage({
    fetch(url, init) {
      fetchCalls.push({ url: String(url), init });
      return Promise.resolve({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        url: String(url),
        headers: new Map(),
        text: () => Promise.resolve('{"ok":true}'),
      });
    },
  });
  const { document, localStorage, Storage } = dom.window;
  const originalSetItem = Storage.prototype.setItem;
  try {
    document.querySelector('[data-tool-tab="api"]').click();
    document.querySelector("#api-method").value = "POST";
    document.querySelector("#api-url").value = "https://api.example.test/v1/messages";
    document.querySelector("#api-headers").value = "Authorization: Bearer real-token";
    document.querySelector("#api-body").value = '{"secret":"body-value"}';

    Storage.prototype.setItem = function (key, value) {
      if (key === "cwl.tools.apiHistory") {
        throw new Error("QuotaExceeded");
      }
      return originalSetItem.call(this, key, value);
    };

    document.querySelector("[data-api-save]").click();
    assert.equal(localStorage.getItem("cwl.tools.apiHistory"), null);
    assert.equal(
      document.querySelector("#api-status").textContent,
      "请求未保存：浏览器阻止了本地历史写入",
    );

    document.querySelector("[data-api-send]").click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(fetchCalls.filter((call) => call.url === "https://api.example.test/v1/messages").length, 1);
    assert.match(document.querySelector("#api-response").value, /Status: 500 Internal Server Error/);
    assert.equal(
      document.querySelector("#api-status").textContent,
      "请求完成，但浏览器阻止了本地历史写入",
    );
  } finally {
    Storage.prototype.setItem = originalSetItem;
    dom.window.close();
  }
});

test("mini API tester requires opt-in for local private or non-HTTPS targets", async () => {
  const fetchCalls = [];
  const { dom } = await loadToolsPage({
    fetch(url, init) {
      fetchCalls.push({ url: String(url), init });
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        url: String(url),
        headers: new Map(),
        text: () => Promise.resolve("pong"),
      });
    },
  });
  const { document } = dom.window;
  try {
    document.querySelector('[data-tool-tab="api"]').click();
    [
      "http://api.example.test/ping",
      "https://192.168.1.20/ping",
      "https://[fd00::1]/ping",
      "https://localhost:3000/ping",
      "https://printer.local/ping",
    ].forEach((url) => {
      document.querySelector("#api-url").value = url;
      document.querySelector("[data-api-send]").click();
      assert.equal(fetchCalls.filter((call) => call.url === url).length, 0);
      assert.equal(
        document.querySelector("#api-status").textContent,
        "目标是本机、内网或非 HTTPS 地址，请先勾选允许后再发送",
      );
    });

    document.querySelector("#api-allow-risky-target").checked = true;
    document.querySelector("#api-url").value = "http://127.0.0.1:3000/ping";
    document.querySelector("[data-api-send]").click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(fetchCalls.filter((call) => call.url === "http://127.0.0.1:3000/ping").length, 1);
    assert.match(document.querySelector("#api-response").value, /Status: 200 OK/);
  } finally {
    dom.window.close();
  }
});

test("mini API tester limits oversized responses before reading the body", async () => {
  let bodyRead = false;
  const { dom } = await loadToolsPage({
    fetch(url) {
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        url: String(url),
        headers: new Map([["content-length", "500001"]]),
        text: () => {
          bodyRead = true;
          return Promise.resolve("x".repeat(500001));
        },
      });
    },
  });
  const { document } = dom.window;
  try {
    document.querySelector('[data-tool-tab="api"]').click();
    document.querySelector("#api-url").value = "https://api.example.test/large";
    document.querySelector("[data-api-send]").click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(bodyRead, false);
    assert.match(document.querySelector("#api-response").value, /已跳过读取/);
    assert.equal(
      document.querySelector("#api-status").textContent,
      "请求完成，响应过大已限制显示，历史已脱敏保存",
    );
  } finally {
    dom.window.close();
  }
});

test("mini API tester reports request timeout distinctly", async () => {
  const { dom } = await loadToolsPage({
    fetch(_url, init) {
      if (!init || !init.signal) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ providers: [] }),
        });
      }
      if (init.signal.aborted) {
        const error = new Error("Aborted");
        error.name = "AbortError";
        return Promise.reject(error);
      }
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          const error = new Error("Aborted");
          error.name = "AbortError";
          reject(error);
        });
      });
    },
  });
  const { document } = dom.window;
  const originalSetTimeout = dom.window.setTimeout;
  try {
    dom.window.setTimeout = function (callback, delay) {
      if (delay === 15000) {
        callback();
        return 1;
      }
      return originalSetTimeout.call(this, callback, delay);
    };

    document.querySelector('[data-tool-tab="api"]').click();
    document.querySelector("#api-url").value = "https://api.example.test/slow";
    document.querySelector("[data-api-send]").click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(document.querySelector("#api-response").value, "请求超时: 15000 ms");
    assert.equal(document.querySelector("#api-status").textContent, "请求超时，请检查目标服务或缩小响应内容");
  } finally {
    dom.window.setTimeout = originalSetTimeout;
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

test("tool reset buttons restore controls and generated previews", async () => {
  const { dom } = await loadToolsPage({ i18n: true });
  const { document } = dom.window;
  try {
    const jsonReset = document.querySelector('#tool-json [data-tool-reset]');
    assert.ok(jsonReset, "json tool should receive a reset button");
    assert.match(jsonReset.textContent, /重置/);

    document.querySelector("#json-input").value = '{"ok":true}';
    document.querySelector('[data-json-action="format"]').click();
    assert.match(document.querySelector("#json-output").value, /"ok": true/);

    jsonReset.click();
    assert.equal(document.querySelector("#json-input").value, "");
    assert.equal(document.querySelector("#json-output").value, "");
    assert.equal(document.querySelector("#json-status").textContent, "已重置");
    assert.equal(document.querySelector("#json-status").classList.contains("is-ok"), true);

    document.querySelector(".lang-toggle").click();
    assert.equal(document.documentElement.getAttribute("lang"), "en");
    assert.match(jsonReset.innerHTML, /fa-eraser/);
    assert.equal(jsonReset.textContent.trim(), "Reset");
    assert.equal(document.querySelector("#json-status").textContent, "Reset complete");

    document.querySelector('[data-tool-tab="time"]').click();
    document.querySelector("#timestamp-input").value = "1718697600";
    document.querySelector('[data-time-action="from-timestamp"]').click();
    assert.match(document.querySelector("#timestamp-output").textContent, /1718697600000/);
    document.querySelector('#tool-time [data-tool-reset]').click();
    assert.equal(document.querySelector("#timestamp-input").value, "");
    assert.equal(document.querySelector("#timestamp-output").textContent, "");
    document.querySelector(".lang-toggle").click();
    assert.equal(document.querySelector("#timestamp-output").textContent, "");

    document.querySelector('[data-tool-tab="uuid"]').click();
    document.querySelector("[data-uuid-generate]").click();
    assert.equal(document.querySelector("#uuid-output").hasAttribute("data-empty"), false);
    document.querySelector('#tool-uuid [data-tool-reset]').click();
    assert.equal(document.querySelector("#uuid-output").getAttribute("data-empty"), "true");
    assert.match(document.querySelector("#uuid-output").textContent, /点击生成 UUID/);

    document.querySelector('[data-tool-tab="color"]').click();
    document.querySelector("#color-input").value = "#2563eb";
    document.querySelector("[data-color-convert]").click();
    assert.equal(document.querySelector("#color-swatch").style.backgroundColor, "rgb(37, 99, 235)");
    assert.equal(document.querySelectorAll("#color-palette [data-color-value]").length, 7);
    document.querySelector('#tool-color [data-tool-reset]').click();
    assert.equal(document.querySelector("#color-swatch").style.backgroundColor, "");
    assert.equal(document.querySelectorAll("#color-palette [data-color-value]").length, 0);
    assert.match(document.querySelector("#color-preview-text").textContent, /等待转换颜色/);

    document.querySelector('[data-tool-tab="qr"]').click();
    document.querySelector("#qr-input").value = "https://wenliang844.github.io/tools/";
    document.querySelector("[data-qr-generate]").click();
    assert.equal(document.querySelector("#qr-image").hidden, false);
    assert.equal(document.querySelector("#qr-empty").hidden, true);
    document.querySelector('#tool-qr [data-tool-reset]').click();
    assert.equal(document.querySelector("#qr-output").value, "");
    assert.equal(document.querySelector("#qr-image").hidden, true);
    assert.equal(document.querySelector("#qr-image").hasAttribute("src"), false);
    assert.equal(document.querySelector("#qr-empty").hidden, false);
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

test("tool reset buttons restore initial values and rerender after language changes", async () => {
  const { dom } = await loadToolsPage({ i18n: true });
  const { document } = dom.window;
  try {
    const input = document.querySelector("#json-input");
    const output = document.querySelector("#json-output");
    const status = document.querySelector("#json-status");
    const reset = document.querySelector('#tool-json [data-tool-reset="json"]');
    const initialValue = input.value;

    assert.ok(reset, "reset button should be installed for panels with controls");
    assert.equal(reset.querySelector('[data-i18n="tools.btn.reset"]').textContent, "重置");

    input.value = '{"ok":true}';
    document.querySelector('[data-json-action="format"]').click();
    assert.match(output.value, /"ok": true/);

    reset.click();
    assert.equal(input.value, initialValue);
    assert.equal(output.value, "");
    assert.equal(status.textContent, "已重置");
    assert.equal(status.classList.contains("is-ok"), true);

    document.querySelector(".lang-toggle").click();
    assert.equal(reset.querySelector('[data-i18n="tools.btn.reset"]').textContent, "Reset");
    assert.equal(status.textContent, "Reset complete");
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
    document.querySelector('[data-tool-tab="random"]').click();
    assert.match(document.querySelector("#tool-random .random-warning").textContent, /普通伪随机数/);

    document.querySelector(".lang-toggle").click();

    assert.equal(document.querySelector("#json-status").textContent, "Done");
    assert.equal(document.querySelector("#uuid-status").textContent, "Copied");
    assert.match(document.querySelector("#tool-random .random-warning").textContent, /regular pseudo-random numbers/);
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

test("uuid generator reports unavailable secure randomness without weak fallback", async () => {
  const { dom } = await loadToolsPage({ i18n: true });
  const { document } = dom.window;
  try {
    Object.defineProperty(dom.window, "crypto", {
      configurable: true,
      get() {
        throw new Error("crypto blocked");
      },
    });

    document.querySelector('[data-tool-tab="uuid"]').click();
    document.querySelector("[data-uuid-generate]").click();

    assert.equal(document.querySelector("#uuid-output").getAttribute("data-empty"), "true");
    assert.match(document.querySelector("#uuid-output").textContent, /点击生成 UUID/);
    assert.equal(document.querySelector("#uuid-status").classList.contains("is-error"), true);
    assert.match(document.querySelector("#uuid-status").textContent, /安全随机数/);

    document.querySelector(".lang-toggle").click();
    assert.equal(
      document.querySelector("#uuid-status").textContent,
      "Secure random numbers are unavailable in this browser, so a safe UUID cannot be generated.",
    );
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
