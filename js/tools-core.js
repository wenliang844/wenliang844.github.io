(function (root) {
  function ok(value) {
    return { ok: true, value: value };
  }

  function fail(message, code) {
    return { ok: false, error: message, code: code || "unknown" };
  }

  function text(value) {
    return String(value === null || value === undefined ? "" : value);
  }

  function getGlobal(name) {
    try {
      return root[name];
    } catch (error) {
      return undefined;
    }
  }

  function bytesToBinary(bytes) {
    const chunkSize = 0x8000;
    let binary = "";
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return binary;
  }

  function parseJson(input) {
    try {
      return ok(JSON.parse(text(input)));
    } catch (error) {
      return fail("JSON 解析失败：" + error.message, "json");
    }
  }

  function formatJson(input) {
    const parsed = parseJson(input);
    return parsed.ok ? ok(JSON.stringify(parsed.value, null, 2)) : parsed;
  }

  function minifyJson(input) {
    const parsed = parseJson(input);
    return parsed.ok ? ok(JSON.stringify(parsed.value)) : parsed;
  }

  function jsonType(value) {
    if (value === null) {
      return "null";
    }
    if (Array.isArray(value)) {
      return "array";
    }
    return typeof value;
  }

  function jsonPreview(value) {
    const raw = JSON.stringify(value);
    return raw && raw.length > 120 ? raw.slice(0, 117) + "..." : raw;
  }

  function jsonPathJoin(path, key) {
    if (typeof key === "number") {
      return path + "[" + key + "]";
    }
    return /^[A-Za-z_$][\w$-]*$/.test(key) ? path + "." + key : path + "[" + JSON.stringify(key) + "]";
  }

  const MAX_DIFF_DEPTH = 50;
  const MAX_DIFF_LINES = 500;

  function collectJsonDiff(left, right, path, lines, depth) {
    if (depth === undefined) {depth = 0;}
    if (depth > MAX_DIFF_DEPTH) {
      lines.push("~ " + path + ": (深度超过限制，已截断)");
      return;
    }
    if (lines.length >= MAX_DIFF_LINES) {return;}
    const leftType = jsonType(left);
    const rightType = jsonType(right);
    if (leftType !== rightType) {
      lines.push("~ " + path + " type: " + leftType + " -> " + rightType);
      lines.push("  - " + jsonPreview(left));
      lines.push("  + " + jsonPreview(right));
      return;
    }
    if (leftType === "array") {
      const max = Math.max(left.length, right.length);
      for (let index = 0; index < max && lines.length < MAX_DIFF_LINES; index += 1) {
        const nextPath = jsonPathJoin(path, index);
        if (index >= left.length) {
          lines.push("+ " + nextPath + ": " + jsonPreview(right[index]));
        } else if (index >= right.length) {
          lines.push("- " + nextPath + ": " + jsonPreview(left[index]));
        } else {
          collectJsonDiff(left[index], right[index], nextPath, lines, depth + 1);
        }
      }
      return;
    }
    if (leftType === "object") {
      const keys = Array.from(new Set(Object.keys(left).concat(Object.keys(right)))).sort();
      keys.forEach(function (key) {
        if (lines.length >= MAX_DIFF_LINES) {return;}
        const nextPath = jsonPathJoin(path, key);
        if (!Object.prototype.hasOwnProperty.call(left, key)) {
          lines.push("+ " + nextPath + ": " + jsonPreview(right[key]));
        } else if (!Object.prototype.hasOwnProperty.call(right, key)) {
          lines.push("- " + nextPath + ": " + jsonPreview(left[key]));
        } else {
          collectJsonDiff(left[key], right[key], nextPath, lines, depth + 1);
        }
      });
      return;
    }
    if (!Object.is(left, right)) {
      lines.push("~ " + path + ": " + jsonPreview(left) + " -> " + jsonPreview(right));
    }
  }

  function diffJson(leftInput, rightInput) {
    const left = parseJson(leftInput);
    if (!left.ok) {return left;}
    const right = parseJson(rightInput);
    if (!right.ok) {return right;}
    const lines = [];
    collectJsonDiff(left.value, right.value, "$", lines);
    return ok(lines.length ? lines.join("\n") : "No JSON differences");
  }

  function encodeBase64(input) {
    try {
      const raw = text(input);
      let binary = "";
      const TextEncoder = getGlobal("TextEncoder");
      if (typeof TextEncoder === "function") {
        const bytes = new TextEncoder().encode(raw);
        binary = bytesToBinary(bytes);
      } else {
        const unescape = getGlobal("unescape");
        if (typeof unescape !== "function") {
          return fail("Base64 编码失败：当前浏览器缺少文本编码能力", "base64Encode");
        }
        binary = unescape(encodeURIComponent(raw));
      }
      const btoa = getGlobal("btoa");
      if (typeof btoa !== "function") {
        return fail("Base64 编码失败：当前浏览器不支持 btoa", "base64Encode");
      }
      return ok(btoa(binary));
    } catch (error) {
      return fail("Base64 编码失败：" + error.message, "base64Encode");
    }
  }

  function decodeBase64(input) {
    try {
      const clean = text(input).replace(/\s+/g, "");
      const atob = getGlobal("atob");
      if (typeof atob !== "function") {
        return fail("Base64 解码失败：当前浏览器不支持 atob", "base64Decode");
      }
      const binary = atob(clean);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      const TextDecoder = getGlobal("TextDecoder");
      if (typeof TextDecoder === "function") {
        return ok(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      }
      const escape = getGlobal("escape");
      if (typeof escape !== "function") {
        return fail("Base64 解码失败：当前浏览器缺少文本解码能力", "base64Decode");
      }
      return ok(decodeURIComponent(escape(binary)));
    } catch (error) {
      return fail("Base64 解码失败：请输入合法的 Base64 文本", "base64Decode");
    }
  }

  function encodeUrl(input) {
    try {
      return ok(encodeURIComponent(text(input)));
    } catch (error) {
      return fail("URL 编码失败：请输入可编码的文本", "urlEncode");
    }
  }

  function decodeUrl(input) {
    try {
      return ok(decodeURIComponent(text(input)));
    } catch (error) {
      return fail("URL 解码失败：请输入合法的 URL 编码文本", "urlDecode");
    }
  }

  function getCrypto() {
    return getGlobal("crypto") || null;
  }

  function generateUuid() {
    const crypto = getCrypto();
    if (crypto && typeof crypto.randomUUID === "function") {
      try {
        return crypto.randomUUID();
      } catch (error) {
        // Fall back to getRandomValues or Math.random below.
      }
    }
    const bytes = new Uint8Array(16);
    let filled = false;
    if (crypto && typeof crypto.getRandomValues === "function") {
      try {
        crypto.getRandomValues(bytes);
        filled = true;
      } catch (error) {
        filled = false;
      }
    }
    if (!filled) {
      for (let i = 0; i < bytes.length; i += 1) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, function (byte) {
      return byte.toString(16).padStart(2, "0");
    }).join("");
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ].join("-");
  }

  function normalizeTimestamp(value) {
    const raw = text(value).trim();
    if (!/^-?\d+$/.test(raw)) {
      return fail("请输入秒或毫秒时间戳", "timestampInput");
    }
    const num = Number(raw);
    const ms = Math.abs(num) < 1e12 ? num * 1000 : num;
    const date = new Date(ms);
    if (Number.isNaN(date.getTime())) {
      return fail("时间戳无法转换为有效日期", "timestampDate");
    }
    return ok({
      milliseconds: ms,
      seconds: Math.floor(ms / 1000),
      iso: date.toISOString(),
      local: date.toLocaleString(),
    });
  }

  function parseLocalDateTime(raw) {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(raw);
    if (!match) {
      return null;
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = match[6] === undefined ? 0 : Number(match[6]);
    const millisecond = match[7] === undefined ? 0 : Number(match[7].padEnd(3, "0"));
    if (
      month < 1 || month > 12 ||
      day < 1 || day > 31 ||
      hour < 0 || hour > 23 ||
      minute < 0 || minute > 59 ||
      second < 0 || second > 59
    ) {
      return null;
    }
    const date = new Date(0);
    date.setFullYear(year, month - 1, day);
    date.setHours(hour, minute, second, millisecond);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day ||
      date.getHours() !== hour ||
      date.getMinutes() !== minute ||
      date.getSeconds() !== second ||
      date.getMilliseconds() !== millisecond
    ) {
      return null;
    }
    return date;
  }

  function dateToTimestamp(value) {
    const raw = text(value).trim();
    if (!raw) {
      return fail("请选择或输入日期时间", "dateRequired");
    }
    const date = parseLocalDateTime(raw);
    if (!date) {
      return fail("日期时间格式无效", "dateInvalid");
    }
    const ms = date.getTime();
    return ok({
      milliseconds: ms,
      seconds: Math.floor(ms / 1000),
      local: date.toLocaleString(),
    });
  }

  function isBase64UrlText(raw) {
    const match = /^([A-Za-z0-9_-]*)(={0,2})$/.exec(raw);
    if (!match) {
      return false;
    }
    const body = match[1];
    const padding = match[2];
    return body.length % 4 !== 1 && (!padding || (body.length + padding.length) % 4 === 0);
  }

  function base64UrlDecode(part) {
    const raw = text(part);
    if (!isBase64UrlText(raw)) {
      return fail("Base64URL 片段无效", "base64Url");
    }
    const unpadded = raw.replace(/=+$/, "");
    const padded = unpadded.replace(/-/g, "+").replace(/_/g, "/")
      .padEnd(Math.ceil(unpadded.length / 4) * 4, "=");
    return decodeBase64(padded);
  }

  function isJsonObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function decodeJwt(input) {
    const token = text(input).trim();
    const parts = token.split(".");
    if (parts.length < 2 || parts.length > 3 || !parts[0] || !parts[1]) {
      return fail("JWT 需要包含 header 和 payload，可选 signature", "jwtParts");
    }
    const header = base64UrlDecode(parts[0]);
    const payload = base64UrlDecode(parts[1]);
    if (!header.ok || !payload.ok) {
      return fail("JWT 解码失败：header 或 payload 不是合法的 Base64URL", "jwtBase64");
    }
    try {
      const headerJson = JSON.parse(header.value);
      const payloadJson = JSON.parse(payload.value);
      if (!isJsonObject(headerJson) || !isJsonObject(payloadJson)) {
        return fail("JWT 解析失败：header 或 payload 不是合法 JSON 对象", "jwtJson");
      }
      return ok({
        header: JSON.stringify(headerJson, null, 2),
        payload: JSON.stringify(payloadJson, null, 2),
      });
    } catch (error) {
      return fail("JWT 解析失败：header 或 payload 不是合法 JSON", "jwtJson");
    }
  }

  function bufferToHex(buffer) {
    return Array.prototype.map.call(new Uint8Array(buffer), function (byte) {
      return byte.toString(16).padStart(2, "0");
    }).join("");
  }

  function normalizeHashAlgorithm(value) {
    const raw = text(value).trim().toUpperCase().replace(/^SHA(\d)/, "SHA-$1");
    const allowed = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"];
    return allowed.indexOf(raw) === -1 ? null : raw;
  }

  async function hashText(input, algorithm) {
    const algo = normalizeHashAlgorithm(algorithm || "SHA-256");
    if (!algo) {
      return fail("不支持的摘要算法", "hashAlgorithm");
    }
    const TextEncoder = getGlobal("TextEncoder");
    if (typeof TextEncoder !== "function") {
      return fail("当前浏览器缺少文本编码能力", "hashRuntime");
    }
    const crypto = getCrypto();
    if (!crypto || !crypto.subtle || typeof crypto.subtle.digest !== "function") {
      return fail("当前浏览器不支持 Web Crypto 摘要", "hashRuntime");
    }
    try {
      const digest = await crypto.subtle.digest(algo, new TextEncoder().encode(text(input)));
      return ok(bufferToHex(digest));
    } catch (error) {
      return fail("哈希摘要生成失败：" + error.message, "hashRuntime");
    }
  }

  function secureRandomBytes(length) {
    const crypto = getCrypto();
    if (!crypto || typeof crypto.getRandomValues !== "function") {
      return fail("当前浏览器缺少安全随机数能力", "passwordRandom");
    }
    try {
      const bytes = new Uint8Array(length);
      crypto.getRandomValues(bytes);
      return ok(bytes);
    } catch (error) {
      return fail("安全随机数生成失败：" + error.message, "passwordRandom");
    }
  }

  function secureRandomInt(max) {
    if (!Number.isInteger(max) || max <= 0 || max > 256) {
      return fail("随机数范围无效", "passwordRandom");
    }
    const limit = Math.floor(256 / max) * max;
    for (let i = 0; i < 1024; i += 1) {
      const bytes = secureRandomBytes(1);
      if (!bytes.ok) {
        return bytes;
      }
      if (bytes.value[0] < limit) {
        return ok(bytes.value[0] % max);
      }
    }
    return fail("安全随机数采样失败", "passwordRandom");
  }

  function pickRandomChar(pool) {
    const index = secureRandomInt(pool.length);
    return index.ok ? ok(pool.charAt(index.value)) : index;
  }

  function generatePassword(options) {
    const opts = options || {};
    const length = Number(opts.length);
    const pools = [
      { enabled: opts.lower !== false, chars: "abcdefghijklmnopqrstuvwxyz" },
      { enabled: opts.upper !== false, chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ" },
      { enabled: opts.number !== false, chars: "0123456789" },
      { enabled: opts.symbol !== false, chars: "!@#$%^&*()-_=+[]{};:,.?/|~" },
    ].filter(function (entry) {
      return entry.enabled;
    });
    if (!Number.isInteger(length) || length < 8 || length > 128) {
      return fail("密码长度需要在 8 到 128 之间", "passwordLength");
    }
    if (!pools.length) {
      return fail("至少选择一种字符集", "passwordCharset");
    }
    if (length < pools.length) {
      return fail("密码长度不能小于已选择的字符集数量", "passwordLength");
    }

    const allChars = pools.map(function (entry) {
      return entry.chars;
    }).join("");
    const chars = [];
    for (const pool of pools) {
      const picked = pickRandomChar(pool.chars);
      if (!picked.ok) {
        return picked;
      }
      chars.push(picked.value);
    }
    while (chars.length < length) {
      const picked = pickRandomChar(allChars);
      if (!picked.ok) {
        return picked;
      }
      chars.push(picked.value);
    }
    for (let i = chars.length - 1; i > 0; i -= 1) {
      const picked = secureRandomInt(i + 1);
      if (!picked.ok) {
        return picked;
      }
      const tmp = chars[i];
      chars[i] = chars[picked.value];
      chars[picked.value] = tmp;
    }
    return ok({
      password: chars.join(""),
      entropy: Math.round(length * Math.log2(allChars.length)),
      poolSize: allChars.length,
      sets: pools.length,
    });
  }

  function toHexPart(value) {
    return Math.round(value).toString(16).padStart(2, "0").toUpperCase();
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function rgbToHsl(r, g, b) {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const lightness = (max + min) / 2;
    let hue = 0;
    let saturation = 0;
    if (max !== min) {
      const delta = max - min;
      saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
      if (max === rn) {
        hue = (gn - bn) / delta + (gn < bn ? 6 : 0);
      } else if (max === gn) {
        hue = (bn - rn) / delta + 2;
      } else {
        hue = (rn - gn) / delta + 4;
      }
      hue *= 60;
    }
    return {
      h: Math.round(hue),
      s: Math.round(saturation * 100),
      l: Math.round(lightness * 100),
    };
  }

  function hueToRgb(p, q, t) {
    let next = t;
    if (next < 0) {next += 1;}
    if (next > 1) {next -= 1;}
    if (next < 1 / 6) {return p + (q - p) * 6 * next;}
    if (next < 1 / 2) {return q;}
    if (next < 2 / 3) {return p + (q - p) * (2 / 3 - next) * 6;}
    return p;
  }

  function hslToRgb(h, s, l) {
    const hue = (((h % 360) + 360) % 360) / 360;
    const saturation = clamp(s, 0, 100) / 100;
    const lightness = clamp(l, 0, 100) / 100;
    if (saturation === 0) {
      const gray = Math.round(lightness * 255);
      return { r: gray, g: gray, b: gray };
    }
    const q = lightness < 0.5
      ? lightness * (1 + saturation)
      : lightness + saturation - lightness * saturation;
    const p = 2 * lightness - q;
    return {
      r: Math.round(hueToRgb(p, q, hue + 1 / 3) * 255),
      g: Math.round(hueToRgb(p, q, hue) * 255),
      b: Math.round(hueToRgb(p, q, hue - 1 / 3) * 255),
    };
  }

  function parseColor(input) {
    const raw = text(input).trim();
    let match = /^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(raw);
    if (match) {
      const hex = match[1].length === 3
        ? match[1].split("").map(function (part) { return part + part; }).join("")
        : match[1];
      return ok({
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        ...(hex.length === 8 ? { a: parseInt(hex.slice(6, 8), 16) / 255 } : {}),
      });
    }
    match = /^rgba?\(\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)/i.exec(raw);
    if (match) {
      const rgb = [Number(match[1]), Number(match[2]), Number(match[3])];
      if (rgb.every(function (value) { return Number.isFinite(value) && value >= 0 && value <= 255; })) {
        return ok({ r: Math.round(rgb[0]), g: Math.round(rgb[1]), b: Math.round(rgb[2]) });
      }
    }
    match = /^hsla?\(\s*([+-]?\d+(?:\.\d+)?)(?:deg)?[\s,]+([+-]?\d+(?:\.\d+)?)%[\s,]+([+-]?\d+(?:\.\d+)?)%/i.exec(raw);
    if (match) {
      const h = Number(match[1]);
      const s = Number(match[2]);
      const l = Number(match[3]);
      if (Number.isFinite(h) && Number.isFinite(s) && Number.isFinite(l) && s >= 0 && s <= 100 && l >= 0 && l <= 100) {
        return ok(hslToRgb(h, s, l));
      }
    }
    return fail("请输入合法的 HEX、RGB 或 HSL 颜色", "colorInput");
  }

  function relativeLuminance(r, g, b) {
    return [r, g, b].map(function (value) {
      const channel = value / 255;
      return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    }).reduce(function (sum, channel, index) {
      return sum + channel * [0.2126, 0.7152, 0.0722][index];
    }, 0);
  }

  function convertColor(input) {
    const parsed = parseColor(input);
    if (!parsed.ok) {
      return parsed;
    }
    const rgb = parsed.value;
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const hex = "#" + toHexPart(rgb.r) + toHexPart(rgb.g) + toHexPart(rgb.b);
    const luminance = relativeLuminance(rgb.r, rgb.g, rgb.b);
    const foreground = luminance > 0.45 ? "#111827" : "#FFFFFF";
    const palette = colorPalette(hsl.h, hsl.s, hsl.l);
    return ok({
      hex: hex,
      foreground: foreground,
      palette: palette,
      lines: [
        "HEX: " + hex,
        "RGB: rgb(" + rgb.r + ", " + rgb.g + ", " + rgb.b + ")",
        "HSL: hsl(" + hsl.h + ", " + hsl.s + "%, " + hsl.l + "%)",
        "Luminance: " + luminance.toFixed(3),
        "Readable foreground: " + foreground,
        "Palette: " + palette.join(" "),
      ].join("\n"),
    });
  }

  function rgbToHex(rgb) {
    return "#" + toHexPart(rgb.r) + toHexPart(rgb.g) + toHexPart(rgb.b);
  }

  function colorPalette(h, s, l) {
    return [
      hslToRgb(h, s, clamp(l - 24, 8, 92)),
      hslToRgb(h, s, clamp(l - 12, 8, 92)),
      hslToRgb(h, s, l),
      hslToRgb(h, s, clamp(l + 12, 8, 92)),
      hslToRgb(h, s, clamp(l + 24, 8, 92)),
      hslToRgb(h + 30, s, l),
      hslToRgb(h + 180, s, l),
    ].map(rgbToHex);
  }

  function uniqueFlags(flags) {
    const raw = text(flags).trim();
    if (!/^[dgimsuvy]*$/.test(raw)) {
      return fail("正则 flags 只能包含 d g i m s u v y", "regexFlags");
    }
    const seen = Object.create(null);
    for (const flag of raw) {
      if (seen[flag]) {
        return fail("正则 flags 不能重复", "regexFlags");
      }
      seen[flag] = true;
    }
    return ok(raw);
  }

  function previewText(value) {
    const normalized = text(value).replace(/\n/g, "\\n");
    return normalized.length > 120 ? normalized.slice(0, 117) + "..." : normalized;
  }

  function testRegex(pattern, flags, input) {
    const source = text(pattern);
    const target = text(input);
    if (source.length > 500) {
      return fail("正则表达式不能超过 500 个字符", "regexPattern");
    }
    if (target.length > 50000) {
      return fail("测试文本不能超过 50000 个字符", "regexInput");
    }
    const checkedFlags = uniqueFlags(flags);
    if (!checkedFlags.ok) {
      return checkedFlags;
    }
    const runFlags = checkedFlags.value.indexOf("g") === -1 ? checkedFlags.value + "g" : checkedFlags.value;
    let regex;
    try {
      regex = new RegExp(source, runFlags);
    } catch (error) {
      return fail("正则表达式无效：" + error.message, "regexPattern");
    }
    const matches = [];
    let match;
    while ((match = regex.exec(target)) !== null) {
      matches.push(match);
      if (matches.length >= 500) {
        break;
      }
      if (match[0] === "") {
        regex.lastIndex += 1;
      }
    }
    if (!matches.length) {
      return ok("Matches: 0");
    }
    const lines = ["Matches: " + matches.length + (matches.length >= 500 ? " (limited)" : "")];
    matches.forEach(function (entry, index) {
      const start = entry.index;
      const end = entry.index + entry[0].length;
      lines.push("#" + (index + 1) + " [" + start + "-" + end + "] \"" + previewText(entry[0]) + "\"");
      for (let i = 1; i < entry.length; i += 1) {
        if (entry[i] !== undefined) {
          lines.push("  $" + i + ": \"" + previewText(entry[i]) + "\"");
        }
      }
      if (entry.groups) {
        Object.keys(entry.groups).forEach(function (name) {
          lines.push("  " + name + ": \"" + previewText(entry.groups[name]) + "\"");
        });
      }
    });
    return ok(lines.join("\n"));
  }

  function escapeHtmlText(value) {
    return text(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderMarkdown(input) {
    const raw = text(input);
    const marked = getGlobal("marked");
    const purifier = getGlobal("DOMPurify");
    if (marked && purifier && typeof purifier.sanitize === "function") {
      try {
        const html = typeof marked.parse === "function" ? marked.parse(raw) : marked(raw);
        return ok({ html: purifier.sanitize(html), fallback: false });
      } catch (error) {
        return fail("Markdown 渲染失败：" + error.message, "markdown");
      }
    }
    return ok({ html: "<pre>" + escapeHtmlText(raw) + "</pre>", fallback: true });
  }

  function splitLines(value) {
    return text(value).replace(/\r\n/g, "\n").split("\n");
  }

  function diffLines(left, right) {
    const a = splitLines(left);
    const b = splitLines(right);
    if (a.length > 300 || b.length > 300) {
      return fail("文本 Diff 每侧最多支持 300 行", "diffSize");
    }
    const dp = Array.from({ length: a.length + 1 }, function () {
      return Array(b.length + 1).fill(0);
    });
    for (let i = a.length - 1; i >= 0; i -= 1) {
      for (let j = b.length - 1; j >= 0; j -= 1) {
        dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const rows = [];
    let i = 0;
    let j = 0;
    let added = 0;
    let removed = 0;
    let same = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) {
        rows.push("  " + a[i]);
        i += 1;
        j += 1;
        same += 1;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        rows.push("- " + a[i]);
        i += 1;
        removed += 1;
      } else {
        rows.push("+ " + b[j]);
        j += 1;
        added += 1;
      }
    }
    while (i < a.length) {
      rows.push("- " + a[i]);
      i += 1;
      removed += 1;
    }
    while (j < b.length) {
      rows.push("+ " + b[j]);
      j += 1;
      added += 1;
    }
    if (!added && !removed) {
      return ok("No differences");
    }
    return ok(["Summary: +" + added + " -" + removed + " unchanged " + same].concat(rows).join("\n"));
  }

  function wordsFromText(value) {
    const normalized = text(value)
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[_./-]+/g, " ");
    return normalized.match(/[A-Za-z0-9]+|[\u4e00-\u9fff]+/g) || [];
  }

  function capitalizeWord(value) {
    const lower = value.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }

  function convertCase(input) {
    const words = wordsFromText(input);
    if (!words.length) {
      return fail("请输入要转换的文本", "caseInput");
    }
    const lowerWords = words.map(function (word) {
      return word.toLowerCase();
    });
    const pascal = lowerWords.map(capitalizeWord).join("");
    const camel = lowerWords[0] + lowerWords.slice(1).map(capitalizeWord).join("");
    return ok([
      "lower: " + lowerWords.join(" "),
      "UPPER: " + words.join(" ").toUpperCase(),
      "Title: " + lowerWords.map(capitalizeWord).join(" "),
      "camelCase: " + camel,
      "PascalCase: " + pascal,
      "snake_case: " + lowerWords.join("_"),
      "kebab-case: " + lowerWords.join("-"),
      "CONSTANT_CASE: " + lowerWords.join("_").toUpperCase(),
    ].join("\n"));
  }

  function encodeHtmlEntities(input) {
    return ok(text(input)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;"));
  }

  function decodeHtmlEntities(input) {
    const raw = text(input);
    const document = getGlobal("document");
    if (document && typeof document.createElement === "function") {
      const textarea = document.createElement("textarea");
      textarea.innerHTML = raw;
      return ok(textarea.value);
    }
    return ok(raw
      .replace(/&#x([0-9a-f]+);?/gi, function (_match, hex) {
        return String.fromCodePoint(parseInt(hex, 16));
      })
      .replace(/&#(\d+);?/g, function (_match, decimal) {
        return String.fromCodePoint(Number(decimal));
      })
      .replace(/&quot;/g, "\"")
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&"));
  }

  const MONTH_NAMES = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };
  const DOW_NAMES = {
    sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
  };

  function cronNumber(token, min, max, names, normalize) {
    const raw = text(token).trim().toLowerCase();
    const nameValue = names && Object.prototype.hasOwnProperty.call(names, raw.slice(0, 3)) ? names[raw.slice(0, 3)] : null;
    const value = nameValue === null ? (/^\d+$/.test(raw) ? Number(raw) : NaN) : nameValue;
    if (!Number.isInteger(value) || value < min || value > max) {
      return null;
    }
    return normalize ? normalize(value) : value;
  }

  function parseCronField(rawValue, min, max, names, normalize) {
    const raw = text(rawValue).trim().toLowerCase();
    if (!raw) {
      return fail("Cron 字段不能为空", "cronField");
    }
    const values = new Set();
    const chunks = raw.split(",");
    for (const chunk of chunks) {
      const stepParts = chunk.split("/");
      if (stepParts.length > 2) {
        return fail("Cron 步长格式无效", "cronField");
      }
      const step = stepParts[1] === undefined ? 1 : Number(stepParts[1]);
      if (!Number.isInteger(step) || step <= 0) {
        return fail("Cron 步长需要为正整数", "cronField");
      }
      const range = stepParts[0];
      let start;
      let end;
      if (range === "*") {
        start = min;
        end = max;
      } else if (range.indexOf("-") !== -1) {
        const bounds = range.split("-");
        if (bounds.length !== 2) {
          return fail("Cron 范围格式无效", "cronField");
        }
        start = cronNumber(bounds[0], min, max, names, null);
        end = cronNumber(bounds[1], min, max, names, null);
      } else {
        start = cronNumber(range, min, max, names, null);
        end = start;
      }
      if (start === null || end === null || start > end) {
        return fail("Cron 字段范围无效", "cronField");
      }
      for (let value = start; value <= end; value += step) {
        values.add(normalize ? normalize(value) : value);
      }
    }
    return ok({
      raw: raw,
      wildcard: raw === "*",
      values: values,
    });
  }

  function matchCronDay(date, dayOfMonth, dayOfWeek) {
    const dom = dayOfMonth.values.has(date.getDate());
    const dow = dayOfWeek.values.has(date.getDay());
    if (!dayOfMonth.wildcard && !dayOfWeek.wildcard) {
      return dom || dow;
    }
    return dom && dow;
  }

  function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  function hasPossibleDayOfMonth(dayOfMonth, month, startYear) {
    for (const monthValue of month.values) {
      const yearsToCheck = monthValue === 2 ? [startYear, startYear + 1, startYear + 2, startYear + 3] : [startYear];
      for (const year of yearsToCheck) {
        const maxDay = daysInMonth(year, monthValue);
        for (const day of dayOfMonth.values) {
          if (day <= maxDay) {
            return true;
          }
        }
      }
    }
    return false;
  }

  function formatLocalDateTime(date) {
    const pad = function (value) { return String(value).padStart(2, "0"); };
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) +
      " " + pad(date.getHours()) + ":" + pad(date.getMinutes());
  }

  function parseCronExpression(expression, nowValue) {
    const parts = text(expression).trim().split(/\s+/);
    if (parts.length !== 5) {
      return fail("请输入 5 段 Cron 表达式：分 时 日 月 周", "cronParts");
    }
    const minute = parseCronField(parts[0], 0, 59);
    const hour = parseCronField(parts[1], 0, 23);
    const dayOfMonth = parseCronField(parts[2], 1, 31);
    const month = parseCronField(parts[3], 1, 12, MONTH_NAMES);
    const dayOfWeek = parseCronField(parts[4], 0, 7, DOW_NAMES, function (value) {
      return value === 7 ? 0 : value;
    });
    const fields = [minute, hour, dayOfMonth, month, dayOfWeek];
    const failed = fields.find(function (field) {
      return !field.ok;
    });
    if (failed) {
      return failed;
    }

    const now = nowValue === undefined ? new Date() : new Date(nowValue);
    if (Number.isNaN(now.getTime())) {
      return fail("当前时间无效", "cronNow");
    }
    if (!dayOfMonth.value.wildcard && dayOfWeek.value.wildcard && !hasPossibleDayOfMonth(dayOfMonth.value, month.value, now.getFullYear())) {
      return fail("日期字段永远无法匹配", "cronNoRuns");
    }
    const cursor = new Date(now.getTime() + 60000);
    cursor.setSeconds(0, 0);
    const nextRuns = [];
    for (let i = 0; i < 1051200 && nextRuns.length < 5; i += 1) {
      if (
        minute.value.values.has(cursor.getMinutes()) &&
        hour.value.values.has(cursor.getHours()) &&
        month.value.values.has(cursor.getMonth() + 1) &&
        matchCronDay(cursor, dayOfMonth.value, dayOfWeek.value)
      ) {
        nextRuns.push(formatLocalDateTime(cursor));
      }
      cursor.setMinutes(cursor.getMinutes() + 1);
    }
    if (!nextRuns.length) {
      return fail("未来两年内没有匹配的执行时间", "cronNoRuns");
    }
    return ok([
      "Expression: " + parts.join(" "),
      "Minute: " + parts[0],
      "Hour: " + parts[1],
      "Day of month: " + parts[2],
      "Month: " + parts[3],
      "Day of week: " + parts[4],
      "Day rule: when both day fields are restricted, either one may match",
      "Next 5 runs:",
    ].concat(nextRuns.map(function (run, index) {
      return (index + 1) + ". " + run;
    })).join("\n"));
  }

  function cronFieldText(value, fallback) {
    const raw = text(value).trim();
    return raw || fallback;
  }

  function generateCronExpression(options) {
    const opts = options || {};
    const step = Number(opts.minuteStep);
    const start = Number(opts.hourStart);
    const end = Number(opts.hourEnd);
    if (!Number.isInteger(step) || step < 1 || step > 59) {
      return fail("分钟间隔需要在 1 到 59 之间", "cronField");
    }
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start > 23 || end < 0 || end > 23 || start > end) {
      return fail("小时范围需要在 0 到 23 之间，且开始不能大于结束", "cronField");
    }
    const weekdays = Array.isArray(opts.weekdays) ? opts.weekdays.filter(function (value) {
      return /^[0-7]$/.test(String(value));
    }) : [];
    const minute = step === 1 ? "*" : "*/" + step;
    const hour = start === end ? String(start) : start + "-" + end;
    const day = cronFieldText(opts.dayOfMonth, "*");
    const month = cronFieldText(opts.month, "*");
    const week = weekdays.length ? weekdays.join(",") : "*";
    return ok([minute, hour, day, month, week].join(" "));
  }

  function jsonToYaml(input) {
    const parsed = parseJson(input);
    if (!parsed.ok) {
      return parsed;
    }
    function dump(value, level) {
      const indent = "  ".repeat(level);
      if (Array.isArray(value)) {
        return value.map(function (item) {
          if (item && typeof item === "object") {
            return indent + "-\n" + dump(item, level + 1);
          }
          return indent + "- " + yamlScalar(item);
        }).join("\n");
      }
      if (value && typeof value === "object") {
        return Object.keys(value).map(function (key) {
          const item = value[key];
          if (item && typeof item === "object") {
            return indent + key + ":\n" + dump(item, level + 1);
          }
          return indent + key + ": " + yamlScalar(item);
        }).join("\n");
      }
      return indent + yamlScalar(value);
    }
    return ok(dump(parsed.value, 0));
  }

  function yamlScalar(value) {
    if (value === null) {return "null";}
    if (typeof value === "number" || typeof value === "boolean") {return String(value);}
    const raw = text(value);
    return /^[\w.-]+$/.test(raw) ? raw : JSON.stringify(raw);
  }

  function parseYamlScalar(raw) {
    const value = text(raw).trim();
    if (value === "null" || value === "~") {return null;}
    if (value === "true") {return true;}
    if (value === "false") {return false;}
    if (/^-?\d+(?:\.\d+)?$/.test(value)) {return Number(value);}
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      try { return JSON.parse(value.replace(/^'/, "\"").replace(/'$/, "\"")); } catch (error) { return value.slice(1, -1); }
    }
    return value;
  }

  function yamlToJson(input) {
    const lines = splitLines(input).map(function (line) {
      return line.replace(/\s+#.*$/, "");
    }).filter(function (line) {
      return line.trim();
    });
    if (!lines.length) {
      return fail("请输入 YAML 文本", "yamlInput");
    }
    const rootIsArray = lines[0].trim().startsWith("- ");
    const rootValue = rootIsArray ? [] : {};
    lines.forEach(function (line) {
      const raw = line.trim();
      if (rootIsArray) {
        if (!raw.startsWith("- ")) {throw new Error("mixed root");}
        rootValue.push(parseYamlScalar(raw.slice(2)));
      } else {
        const index = raw.indexOf(":");
        if (index === -1) {throw new Error("missing colon");}
        const key = raw.slice(0, index).trim();
        if (!key) {throw new Error("missing key");}
        rootValue[key] = parseYamlScalar(raw.slice(index + 1));
      }
    });
    return ok(JSON.stringify(rootValue, null, 2));
  }

  function safeYamlToJson(input) {
    try {
      return yamlToJson(input);
    } catch (error) {
      return fail("YAML 解析失败：仅支持常见的 key: value 或 - value 片段", "yamlInput");
    }
  }

  function parseUrl(input) {
    try {
      const url = new URL(text(input).trim());
      const params = Array.from(url.searchParams.entries()).map(function (pair) {
        return pair[0] + " = " + pair[1];
      });
      return ok([
        "href: " + url.href,
        "protocol: " + url.protocol,
        "username: " + url.username,
        "password: " + (url.password ? "***" : ""),
        "host: " + url.host,
        "hostname: " + url.hostname,
        "port: " + url.port,
        "pathname: " + url.pathname,
        "search: " + url.search,
        "hash: " + url.hash,
        "query params:",
        params.length ? params.map(function (line) { return "  " + line; }).join("\n") : "  (none)",
      ].join("\n"));
    } catch (error) {
      return fail("请输入完整有效的 URL", "urlParse");
    }
  }

  function convertQuery(input) {
    const raw = text(input).trim();
    if (!raw) {
      return fail("请输入查询参数", "queryInput");
    }
    if (raw.indexOf("\n") !== -1) {
      const params = new URLSearchParams();
      splitLines(raw).map(text).filter(Boolean).forEach(function (line) {
        const index = line.indexOf("=");
        params.append(index === -1 ? line : line.slice(0, index), index === -1 ? "" : line.slice(index + 1));
      });
      return ok(params.toString());
    }
    const query = raw.replace(/^\?/, "");
    const params = new URLSearchParams(query);
    return ok(Array.from(params.entries()).map(function (pair) {
      return pair[0] + "=" + pair[1];
    }).join("\n"));
  }

  function queryJsonPath(input, path) {
    const parsed = parseJson(input);
    if (!parsed.ok) {return parsed;}
    const rawPath = text(path).trim();
    if (!/^\$/.test(rawPath)) {
      return fail("JSONPath 需要以 $ 开头", "jsonPath");
    }
    const tokens = rawPath.match(/(?:\.[A-Za-z_$][\w$-]*)|(?:\[['"][^'"]+['"]\])|(?:\[\d+\])/g) || [];
    let cursor = parsed.value;
    for (const token of tokens) {
      const key = token.charAt(0) === "."
        ? token.slice(1)
        : token.replace(/^\[['"]?/, "").replace(/['"]?\]$/, "");
      cursor = cursor && cursor[key];
      if (cursor === undefined) {
        return fail("路径没有匹配到值", "jsonPath");
      }
    }
    return ok(JSON.stringify(cursor, null, 2));
  }

  function textStats(input) {
    const raw = text(input);
    const lines = raw ? splitLines(raw).length : 0;
    const words = (raw.match(/[A-Za-z0-9]+|[\u4e00-\u9fff]/g) || []).length;
    const noSpace = raw.replace(/\s/g, "").length;
    const encoder = getGlobal("TextEncoder");
    let bytes;
    try {
      bytes = typeof encoder === "function" ? new encoder().encode(raw).length : unescape(encodeURIComponent(raw)).length;
    } catch (_e) {
      bytes = raw.length;
    }
    return ok([
      "Characters: " + raw.length,
      "Characters without spaces: " + noSpace,
      "Words / CJK chars: " + words,
      "Lines: " + lines,
      "Bytes (UTF-8): " + bytes,
      "Reading time: " + Math.max(1, Math.ceil(words / 350)) + " min",
    ].join("\n"));
  }

  function cleanText(input, options) {
    const opts = options || {};
    let lines = splitLines(input);
    if (opts.trim) {lines = lines.map(function (line) { return line.trim(); });}
    if (opts.removeEmpty) {lines = lines.filter(Boolean);}
    if (opts.removeDupes) {
      const seen = Object.create(null);
      lines = lines.filter(function (line) {
        if (seen[line]) {return false;}
        seen[line] = true;
        return true;
      });
    }
    if (opts.sort) {lines = lines.slice().sort();}
    return ok(lines.join("\n"));
  }

  const UNIT_GROUPS = {
    length: { base: "m", units: { mm: 0.001, cm: 0.01, m: 1, km: 1000, in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344 } },
    weight: { base: "kg", units: { mg: 0.000001, g: 0.001, kg: 1, t: 1000, oz: 0.028349523125, lb: 0.45359237 } },
    data: { base: "B", units: { b: 1, kb: 1024, mb: 1048576, gb: 1073741824, tb: 1099511627776 } },
  };

  function convertUnit(value, type, fromUnit) {
    const amount = Number(value);
    const kind = text(type).trim();
    const from = text(fromUnit).trim().toLowerCase();
    if (!Number.isFinite(amount)) {
      return fail("请输入有效数值", "unitValue");
    }
    if (kind === "temperature") {
      const normFrom = from === "℃" ? "c" : from === "℉" ? "f" : from;
      const c = normFrom === "f" ? (amount - 32) * 5 / 9 : normFrom === "k" ? amount - 273.15 : amount;
      if (["c", "f", "k"].indexOf(normFrom) === -1) {return fail("温度单位支持 c/f/k", "unitType");}
      return ok(["C: " + c.toFixed(4), "F: " + (c * 9 / 5 + 32).toFixed(4), "K: " + (c + 273.15).toFixed(4)].join("\n"));
    }
    const group = UNIT_GROUPS[kind];
    if (!group || !group.units[from]) {
      return fail("单位类型或来源单位无效", "unitType");
    }
    const base = amount * group.units[from];
    return ok(Object.keys(group.units).map(function (unit) {
      return unit + ": " + (base / group.units[unit]).toFixed(6).replace(/\.?0+$/, "");
    }).join("\n"));
  }

  function formatCssNumber(value) {
    return Number(value.toFixed(6)).toString();
  }

  function convertCssUnit(value, fromUnit, rootFont, contextFont, viewportWidth, viewportHeight) {
    const amount = Number(value);
    const unit = text(fromUnit).trim().toLowerCase();
    const rootSize = Number(rootFont);
    const contextSize = Number(contextFont);
    const vw = Number(viewportWidth);
    const vh = Number(viewportHeight);
    if (![amount, rootSize, contextSize, vw, vh].every(Number.isFinite) || rootSize <= 0 || contextSize <= 0 || vw <= 0 || vh <= 0) {
      return fail("请输入有效数值", "unitValue");
    }
    let px;
    if (unit === "px") {
      px = amount;
    } else if (unit === "rem") {
      px = amount * rootSize;
    } else if (unit === "em") {
      px = amount * contextSize;
    } else if (unit === "vw") {
      px = amount * vw / 100;
    } else if (unit === "vh") {
      px = amount * vh / 100;
    } else {
      return fail("CSS 单位支持 px/rem/em/vw/vh", "unitType");
    }
    return ok([
      "px: " + formatCssNumber(px) + "px",
      "rem: " + formatCssNumber(px / rootSize) + "rem",
      "em: " + formatCssNumber(px / contextSize) + "em",
      "vw: " + formatCssNumber(px / vw * 100) + "vw",
      "vh: " + formatCssNumber(px / vh * 100) + "vh",
      "Context: root " + rootSize + "px, current " + contextSize + "px, viewport " + vw + "x" + vh,
    ].join("\n"));
  }

  function generateRandom(options) {
    const opts = options || {};
    const min = Number(opts.min);
    const max = Number(opts.max);
    const count = Number(opts.count);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min > max || !Number.isInteger(count) || count < 1 || count > 1000) {
      return fail("随机数范围或数量无效", "randomInput");
    }
    if (opts.integer && opts.unique && (Math.floor(max) - Math.ceil(min) + 1) < count) {
      return fail("整数不重复数量超过可用范围", "randomInput");
    }
    const values = [];
    while (values.length < count) {
      const next = opts.integer
        ? Math.floor(Math.random() * (Math.floor(max) - Math.ceil(min) + 1)) + Math.ceil(min)
        : min + Math.random() * (max - min);
      const value = opts.integer ? next : Number(next.toFixed(8));
      if (!opts.unique || values.indexOf(value) === -1) {
        values.push(value);
      }
    }
    return ok(values.join("\n"));
  }

  function dateDiff(startValue, endValue) {
    const start = new Date(text(startValue));
    const end = new Date(text(endValue));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return fail("请选择有效的开始和结束日期", "dateDiff");
    }
    const ms = end.getTime() - start.getTime();
    const abs = Math.abs(ms);
    const days = Math.floor(abs / 86400000);
    const hours = Math.floor(abs % 86400000 / 3600000);
    const minutes = Math.floor(abs % 3600000 / 60000);
    return ok([
      "Milliseconds: " + ms,
      "Seconds: " + Math.floor(ms / 1000),
      "Days: " + (ms / 86400000).toFixed(4),
      "Absolute duration: " + days + "d " + hours + "h " + minutes + "m",
    ].join("\n"));
  }

  function parseUserAgent(input) {
    const ua = text(input).trim();
    if (!ua) {
      return fail("请输入 User-Agent", "uaInput");
    }
    const browser = /Edg\/([\d.]+)/.exec(ua) ? "Edge " + /Edg\/([\d.]+)/.exec(ua)[1]
      : /Chrome\/([\d.]+)/.exec(ua) ? "Chrome " + /Chrome\/([\d.]+)/.exec(ua)[1]
        : /Firefox\/([\d.]+)/.exec(ua) ? "Firefox " + /Firefox\/([\d.]+)/.exec(ua)[1]
          : /Version\/([\d.]+).*Safari/.exec(ua) ? "Safari " + /Version\/([\d.]+).*Safari/.exec(ua)[1]
            : "Unknown";
    const os = /Windows NT ([\d.]+)/.test(ua) ? "Windows NT " + /Windows NT ([\d.]+)/.exec(ua)[1]
      : /Android ([\d.]+)/.test(ua) ? "Android " + /Android ([\d.]+)/.exec(ua)[1]
        : /iPhone|iPad/.test(ua) ? "iOS"
          : /Mac OS X ([\d_]+)/.test(ua) ? "macOS " + /Mac OS X ([\d_]+)/.exec(ua)[1].replace(/_/g, ".")
            : /Linux/.test(ua) ? "Linux" : "Unknown";
    const device = /Mobile|Android|iPhone/.test(ua) ? "Mobile" : /iPad|Tablet/.test(ua) ? "Tablet" : "Desktop";
    const engine = /AppleWebKit\/([\d.]+)/.exec(ua) ? "WebKit " + /AppleWebKit\/([\d.]+)/.exec(ua)[1]
      : /Gecko\/([\d.]+)/.exec(ua) ? "Gecko " + /Gecko\/([\d.]+)/.exec(ua)[1] : "Unknown";
    return ok(["Browser: " + browser, "OS: " + os, "Device: " + device, "Engine: " + engine, "UA: " + ua].join("\n"));
  }

  function createQrCode(input) {
    const raw = text(input);
    if (!raw.trim()) {
      return fail("请输入要生成二维码的文本", "qrInput");
    }
    if (raw.length > 1000) {
      return fail("二维码文本不能超过 1000 个字符", "qrLength");
    }
    const factory = getGlobal("qrcode");
    if (typeof factory !== "function") {
      return fail("二维码生成库未加载", "qrRuntime");
    }
    try {
      if (factory.stringToBytesFuncs && factory.stringToBytesFuncs["UTF-8"]) {
        factory.stringToBytes = factory.stringToBytesFuncs["UTF-8"];
      }
      const qr = factory(0, "M");
      qr.addData(raw);
      qr.make();
      return ok(qr.createDataURL(4, 8));
    } catch (error) {
      return fail("二维码生成失败：" + error.message, "qrGenerate");
    }
  }

  root.CWLToolsCore = {
    formatJson: formatJson,
    minifyJson: minifyJson,
    diffJson: diffJson,
    encodeBase64: encodeBase64,
    decodeBase64: decodeBase64,
    encodeUrl: encodeUrl,
    decodeUrl: decodeUrl,
    generateUuid: generateUuid,
    normalizeTimestamp: normalizeTimestamp,
    dateToTimestamp: dateToTimestamp,
    decodeJwt: decodeJwt,
    hashText: hashText,
    generatePassword: generatePassword,
    convertColor: convertColor,
    testRegex: testRegex,
    renderMarkdown: renderMarkdown,
    diffLines: diffLines,
    convertCase: convertCase,
    encodeHtmlEntities: encodeHtmlEntities,
    decodeHtmlEntities: decodeHtmlEntities,
    parseCronExpression: parseCronExpression,
    generateCronExpression: generateCronExpression,
    createQrCode: createQrCode,
    jsonToYaml: jsonToYaml,
    yamlToJson: safeYamlToJson,
    parseUrl: parseUrl,
    convertQuery: convertQuery,
    queryJsonPath: queryJsonPath,
    textStats: textStats,
    cleanText: cleanText,
    convertUnit: convertUnit,
    convertCssUnit: convertCssUnit,
    generateRandom: generateRandom,
    dateDiff: dateDiff,
    parseUserAgent: parseUserAgent,
  };
})(typeof window !== "undefined" ? window : this);
