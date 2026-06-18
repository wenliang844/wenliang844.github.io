(function (root) {
  function ok(value) {
    return { ok: true, value: value };
  }

  function fail(message, code) {
    return { ok: false, error: message, code: code || "unknown" };
  }

  function parseJson(input) {
    try {
      return ok(JSON.parse(String(input || "")));
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
      const raw = String(input || "");
      let binary = "";
      if (root.TextEncoder) {
        const bytes = new root.TextEncoder().encode(raw);
        bytes.forEach(function (byte) {
          binary += String.fromCharCode(byte);
        });
      } else {
        binary = unescape(encodeURIComponent(raw));
      }
      return ok(btoa(binary));
    } catch (error) {
      return fail("Base64 编码失败：" + error.message, "base64Encode");
    }
  }

  function decodeBase64(input) {
    try {
      const clean = String(input || "").trim();
      const binary = atob(clean);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      if (root.TextDecoder) {
        return ok(new root.TextDecoder().decode(bytes));
      }
      return ok(decodeURIComponent(escape(binary)));
    } catch (error) {
      return fail("Base64 解码失败：请输入合法的 Base64 文本", "base64Decode");
    }
  }

  function encodeUrl(input) {
    try {
      return ok(encodeURIComponent(String(input || "")));
    } catch (error) {
      return fail("URL 编码失败：" + error.message);
    }
  }

  function decodeUrl(input) {
    try {
      return ok(decodeURIComponent(String(input || "")));
    } catch (error) {
      return fail("URL 解码失败：请输入合法的 URL 编码文本", "urlDecode");
    }
  }

  function generateUuid() {
    if (root.crypto && root.crypto.randomUUID) {
      return root.crypto.randomUUID();
    }
    const bytes = new Uint8Array(16);
    if (root.crypto && root.crypto.getRandomValues) {
      root.crypto.getRandomValues(bytes);
    } else {
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
    const raw = String(value || "").trim();
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

  function dateToTimestamp(value) {
    const raw = String(value || "").trim();
    if (!raw) {
      return fail("请选择或输入日期时间", "dateRequired");
    }
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      return fail("日期时间格式无效", "dateInvalid");
    }
    const ms = date.getTime();
    return ok({
      milliseconds: ms,
      seconds: Math.floor(ms / 1000),
      local: date.toLocaleString(),
    });
  }

  function base64UrlDecode(part) {
    const padded = String(part || "").replace(/-/g, "+").replace(/_/g, "/")
      .padEnd(Math.ceil(String(part || "").length / 4) * 4, "=");
    return decodeBase64(padded);
  }

  function decodeJwt(input) {
    const token = String(input || "").trim();
    const parts = token.split(".");
    if (parts.length < 2) {
      return fail("JWT 至少需要包含 header 和 payload 两段", "jwtParts");
    }
    const header = base64UrlDecode(parts[0]);
    const payload = base64UrlDecode(parts[1]);
    if (!header.ok || !payload.ok) {
      return fail("JWT 解码失败：header 或 payload 不是合法的 Base64URL", "jwtBase64");
    }
    try {
      return ok({
        header: JSON.stringify(JSON.parse(header.value), null, 2),
        payload: JSON.stringify(JSON.parse(payload.value), null, 2),
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
