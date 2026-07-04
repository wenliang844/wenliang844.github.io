(function () {
  const STYLE_HREF = "/css/assistant.css";
  const RUNTIME_SRC = "/js/assistant.js";
  let stylePromise = null;
  let runtimePromise = null;

  function hasStartupIntent() {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("assistant") === "fullscreen" ||
        params.get("ai") === "fullscreen" ||
        window.location.hash === "#assistant-fullscreen";
    } catch {
      return false;
    }
  }

  function runtimeLoaded() {
    return !!document.querySelector(".assistant-widget");
  }

  function existingStyle() {
    return Array.from(document.querySelectorAll('link[rel="stylesheet"]')).find(function (link) {
      return link.getAttribute("href") === STYLE_HREF;
    });
  }

  function existingRuntimeScript() {
    return Array.from(document.querySelectorAll("script")).find(function (script) {
      return script.getAttribute("src") === RUNTIME_SRC;
    });
  }

  function loadStyle() {
    if (stylePromise) {
      return stylePromise;
    }
    if (existingStyle()) {
      stylePromise = Promise.resolve();
      return stylePromise;
    }

    stylePromise = new Promise(function (resolve, reject) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = STYLE_HREF;
      link.dataset.assistantStyle = "true";
      link.onload = resolve;
      link.onerror = reject;
      document.head.appendChild(link);
    });
    return stylePromise;
  }

  function loadRuntime() {
    if (runtimeLoaded()) {
      return Promise.resolve();
    }
    if (runtimePromise) {
      return runtimePromise;
    }

    const styleReady = loadStyle();
    const existing = existingRuntimeScript();
    if (existing) {
      const scriptReady = new Promise(function (resolve, reject) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
      });
      runtimePromise = Promise.all([styleReady, scriptReady]).then(function () {});
      return runtimePromise;
    }

    const scriptReady = new Promise(function (resolve, reject) {
      const script = document.createElement("script");
      script.src = RUNTIME_SRC;
      script.defer = true;
      script.dataset.assistantRuntime = "true";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    runtimePromise = Promise.all([styleReady, scriptReady]).then(function () {});
    return runtimePromise;
  }

  function loadAndReplay(trigger) {
    loadRuntime().then(function () {
      if (trigger && document.contains(trigger)) {
        trigger.click();
      }
    }).catch(function () {
      console.warn("Failed to load assistant runtime.");
    });
  }

  document.addEventListener("click", function (event) {
    const trigger = event.target.closest && event.target.closest("[data-assistant-toggle]");
    if (!trigger || runtimeLoaded()) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    loadAndReplay(trigger);
  }, true);

  if (hasStartupIntent()) {
    loadRuntime().catch(function () {
      console.warn("Failed to load assistant runtime.");
    });
  }
})();
