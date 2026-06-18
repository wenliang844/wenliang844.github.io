(function () {
  const core = window.CWLToolsCore;
  if (!core) {
    return;
  }

  const timeResults = {};

  function t(key, fallback) {
    return window.cwlT ? window.cwlT(key, fallback) : fallback;
  }

  function locale() {
    return window.cwlLang && window.cwlLang() === "en" ? "en-US" : undefined;
  }

  function text(id, value) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = value;
    }
  }

  function value(id, next) {
    const el = document.getElementById(id);
    if (el) {
      el.value = next;
    }
  }

  function inputValue(id) {
    const el = document.getElementById(id);
    return el ? el.value : "";
  }

  function closest(target, selector) {
    return target && typeof target.closest === "function" ? target.closest(selector) : null;
  }

  function toolPanels() {
    return Array.prototype.slice.call(document.querySelectorAll("[data-tool-panel]"));
  }

  function panelFor(id, panels) {
    return panels.find(function (panel) {
      return panel.getAttribute("data-tool-panel") === id;
    });
  }

  function toolTabs(panels) {
    const seen = {};
    return Array.prototype.slice.call(document.querySelectorAll(".tools-tabs [data-tool-tab]")).filter(function (tab) {
      const id = tab.getAttribute("data-tool-tab");
      if (!panelFor(id, panels) || seen[id]) {
        return false;
      }
      seen[id] = true;
      return true;
    });
  }

  function statusType(el) {
    if (el && el.classList.contains("is-error")) {
      return "error";
    }
    if (el && el.classList.contains("is-ok")) {
      return "ok";
    }
    return "";
  }

  function setStatusElement(el, message, type, key, fallback, suffix) {
    if (!el) {
      return;
    }
    el.textContent = message || "";
    el.classList.toggle("is-error", type === "error");
    el.classList.toggle("is-ok", type === "ok");
    if (key) {
      el.setAttribute("data-status-key", key);
      el.setAttribute("data-status-fallback", fallback || message || "");
      if (suffix) {
        el.setAttribute("data-status-suffix", suffix);
      } else {
        el.removeAttribute("data-status-suffix");
      }
    } else {
      el.removeAttribute("data-status-key");
      el.removeAttribute("data-status-fallback");
      el.removeAttribute("data-status-suffix");
    }
  }

  function setStatus(id, message, type) {
    setStatusElement(document.getElementById(id), message, type);
  }

  function setStatusKey(id, key, fallback, type) {
    setStatusElement(document.getElementById(id), t(key, fallback), type, key, fallback);
  }

  function setStatusElementKey(el, key, fallback, type) {
    setStatusElement(el, t(key, fallback), type, key, fallback);
  }

  function rerenderStatusKeys() {
    Array.prototype.slice.call(document.querySelectorAll(".tool-status[data-status-key]")).forEach(function (el) {
      const key = el.getAttribute("data-status-key");
      const fallback = el.getAttribute("data-status-fallback") || el.textContent;
      const suffix = el.getAttribute("data-status-suffix") || "";
      setStatusElement(el, t(key, fallback) + suffix, statusType(el), key, fallback, suffix);
    });
  }

  function statusError(result) {
    if (!result || !result.code) {
      return {
        message: result && result.error ? result.error : t("tools.error.unknown", "处理失败"),
      };
    }
    if (result.code === "json") {
      const fallback = "JSON 解析失败：";
      const suffix = String(result.error || "").replace(/^JSON 解析失败：/, "");
      return {
        fallback: fallback,
        key: "tools.error.json",
        message: t("tools.error.json", fallback) + suffix,
        suffix: suffix,
      };
    }
    const key = "tools.error." + result.code;
    const fallback = result.error || t("tools.error.unknown", "处理失败");
    return {
      fallback: fallback,
      key: key,
      message: t(key, fallback),
    };
  }

  function setStatusError(id, result) {
    const data = statusError(result);
    setStatusElement(document.getElementById(id), data.message, "error", data.key, data.fallback, data.suffix);
  }

  function applyResult(result, outputId, statusId) {
    if (result.ok) {
      value(outputId, result.value);
      setStatusKey(statusId, "tools.status.done", "处理完成", "ok");
    } else {
      value(outputId, "");
      setStatusError(statusId, result);
    }
  }

  function formatTimeResult(data) {
    const rows = [
      ["milliseconds", t("tools.time.ms", "毫秒")],
      ["seconds", t("tools.time.seconds", "秒")],
      ["iso", "ISO"],
      ["local", t("tools.time.local", "本地时间")],
    ];
    return rows.filter(function (row) {
      return Object.prototype.hasOwnProperty.call(data, row[0]);
    }).map(function (row) {
      const value = row[0] === "local" && Object.prototype.hasOwnProperty.call(data, "milliseconds")
        ? new Date(data.milliseconds).toLocaleString(locale())
        : data[row[0]];
      return row[1] + ": " + value;
    }).join("\n");
  }

  function copyFrom(targetId, source) {
    const target = document.getElementById(targetId);
    const panel = (target && closest(target, ".tool-panel")) || closest(source, ".tool-panel");
    const status = panel && panel.querySelector(".tool-status");
    const isPlaceholder = target && target.getAttribute("data-empty") === "true";
    const data = !isPlaceholder && target && ("value" in target ? target.value : target.textContent);
    if (!data) {
      setStatusElementKey(status, "tools.status.copyEmpty", "没有可复制的内容", "error");
      return;
    }
    const copier = window.CWLUtils && window.CWLUtils.copyText
      ? window.CWLUtils.copyText
      : function (textValue) { return navigator.clipboard.writeText(textValue); };
    Promise.resolve().then(function () {
      return copier(data);
    }).then(function () {
      setStatusElementKey(status, "tools.status.copied", "已复制", "ok");
    }).catch(function () {
      setStatusElementKey(status, "tools.status.copyFail", "复制失败，请手动选择复制", "error");
    });
  }

  function switchTool(id, options) {
    const panels = toolPanels();
    const tabs = toolTabs(panels);
    const selectedTab = tabs.find(function (tab) {
      return tab.getAttribute("data-tool-tab") === id;
    });
    const selectedPanel = panelFor(id, panels);

    if (!selectedTab || !selectedPanel) {
      return false;
    }

    tabs.forEach(function (tab) {
      const active = tab.getAttribute("data-tool-tab") === id;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.setAttribute("tabindex", active ? "0" : "-1");
      if (active) {
        tab.setAttribute("aria-current", "true");
      } else {
        tab.removeAttribute("aria-current");
      }
    });

    panels.forEach(function (panel) {
      const active = panel.getAttribute("data-tool-panel") === id;
      panel.classList.toggle("active", active);
      panel.hidden = !active;
    });

    if (options && options.focus) {
      selectedTab.focus();
    }
    return true;
  }

  function switchToolByKey(tab, key) {
    const tabs = toolTabs(toolPanels());
    const currentIndex = tabs.indexOf(tab);
    if (currentIndex === -1) {
      return false;
    }

    let nextIndex = currentIndex;
    if (key === "ArrowRight" || key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (key === "ArrowLeft" || key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (key === "Home") {
      nextIndex = 0;
    } else if (key === "End") {
      nextIndex = tabs.length - 1;
    } else {
      return false;
    }

    return switchTool(tabs[nextIndex].getAttribute("data-tool-tab"), { focus: true });
  }

  function setGeneratedUuid(uuid) {
    const output = document.getElementById("uuid-output");
    if (!output) {
      return;
    }
    output.textContent = uuid;
    output.removeAttribute("data-empty");
    output.removeAttribute("data-i18n");
  }

  function updateNow() {
    const now = new Date();
    text("time-now-ms", String(now.getTime()));
    text("time-now-local", now.toLocaleString(locale()));
  }

  function initTimeInput() {
    const el = document.getElementById("datetime-input");
    if (!el) {
      return;
    }
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    el.value = now.toISOString().slice(0, 16);
  }

  document.addEventListener("click", function (event) {
    const tab = closest(event.target, "[data-tool-tab]");
    if (tab && tab.closest(".tools-tabs")) {
      switchTool(tab.getAttribute("data-tool-tab"));
      return;
    }

    const jsonAction = closest(event.target, "[data-json-action]");
    if (jsonAction) {
      const action = jsonAction.getAttribute("data-json-action");
      applyResult(
        action === "format" ? core.formatJson(inputValue("json-input")) : core.minifyJson(inputValue("json-input")),
        "json-output",
        "json-status",
      );
      return;
    }

    const codecAction = closest(event.target, "[data-codec-action]");
    if (codecAction) {
      const action = codecAction.getAttribute("data-codec-action");
      const map = {
        "base64-encode": ["base64-input", "base64-output", "base64-status", core.encodeBase64],
        "base64-decode": ["base64-input", "base64-output", "base64-status", core.decodeBase64],
        "url-encode": ["url-input", "url-output", "url-status", core.encodeUrl],
        "url-decode": ["url-input", "url-output", "url-status", core.decodeUrl],
      };
      const entry = map[action];
      if (entry) {
        applyResult(entry[3](inputValue(entry[0])), entry[1], entry[2]);
      }
      return;
    }

    const timeAction = closest(event.target, "[data-time-action]");
    if (timeAction) {
      const action = timeAction.getAttribute("data-time-action");
      const outputId = action === "from-timestamp" ? "timestamp-output" : "datetime-output";
      const result = action === "from-timestamp"
        ? core.normalizeTimestamp(inputValue("timestamp-input"))
        : core.dateToTimestamp(inputValue("datetime-input"));
      if (result.ok) {
        timeResults[outputId] = result.value;
        text(outputId, formatTimeResult(result.value));
        setStatusKey("time-status", "tools.status.converted", "转换完成", "ok");
      } else {
        delete timeResults[outputId];
        text(outputId, "");
        setStatusError("time-status", result);
      }
      return;
    }

    if (closest(event.target, "[data-uuid-generate]")) {
      setGeneratedUuid(core.generateUuid());
      setStatusKey("uuid-status", "tools.status.uuid", "UUID 已生成", "ok");
      return;
    }

    if (closest(event.target, "[data-jwt-decode]")) {
      const result = core.decodeJwt(inputValue("jwt-input"));
      if (result.ok) {
        value("jwt-header-output", result.value.header);
        value("jwt-payload-output", result.value.payload);
        setStatusKey("jwt-status", "tools.status.jwt", "JWT 已解码。本工具不校验签名。", "ok");
      } else {
        value("jwt-header-output", "");
        value("jwt-payload-output", "");
        setStatusError("jwt-status", result);
      }
      return;
    }

    const copy = closest(event.target, "[data-copy-target]");
    if (copy) {
      copyFrom(copy.getAttribute("data-copy-target"), copy);
    }
  });

  document.addEventListener("keydown", function (event) {
    const tab = closest(event.target, "[data-tool-tab]");
    if (!tab || !tab.closest(".tools-tabs")) {
      return;
    }
    if (switchToolByKey(tab, event.key)) {
      event.preventDefault();
    }
  });

  updateNow();
  initTimeInput();
  document.addEventListener("cwl:langchange", function () {
    updateNow();
    Object.keys(timeResults).forEach(function (id) {
      text(id, formatTimeResult(timeResults[id]));
    });
    rerenderStatusKeys();
    const timeStatus = document.getElementById("time-status");
    if (timeStatus && timeStatus.classList.contains("is-ok") && Object.keys(timeResults).length) {
      setStatusKey("time-status", "tools.status.converted", "转换完成", "ok");
    }
  });
  window.setInterval(updateNow, 1000);
})();
