(function (root) {
  function ok(value) {
    return { ok: true, value: value };
  }

  function fail(message, code) {
    return { ok: false, error: message, code: code || "unknown" };
  }

  function text(value) {
    return String(value == null ? "" : value);
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
        binary = unescape(encodeURIComponent(raw));
      }
      const btoa = getGlobal("btoa");
      return ok(btoa(binary));
    } catch (error) {
      return fail("Base64 编码失败：" + error.message, "base64Encode");
    }
  }

  function decodeBase64(input) {
    try {
      const clean = text(input).trim();
      const atob = getGlobal("atob");
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
    const ms = Math.abs(num) < 100000000000 ? num * 1000 : num;
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

  root.CWLToolsCore = {
    formatJson: formatJson,
    minifyJson: minifyJson,
    encodeBase64: encodeBase64,
    decodeBase64: decodeBase64,
    encodeUrl: encodeUrl,
    decodeUrl: decodeUrl,
    generateUuid: generateUuid,
    normalizeTimestamp: normalizeTimestamp,
    dateToTimestamp: dateToTimestamp,
    decodeJwt: decodeJwt,
  };
})(typeof window !== "undefined" ? window : this);
