(function () {
  const RUNTIME_SRC = "/js/assistant.js";
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

  function existingRuntimeScript() {
    return Array.from(document.querySelectorAll("script")).find(function (script) {
      return script.getAttribute("src") === RUNTIME_SRC;
    });
  }

  function loadRuntime() {
    if (runtimeLoaded()) {
      return Promise.resolve();
    }
    if (runtimePromise) {
      return runtimePromise;
    }

    const existing = existingRuntimeScript();
    if (existing) {
      runtimePromise = new Promise(function (resolve, reject) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
      });
      return runtimePromise;
    }

    runtimePromise = new Promise(function (resolve, reject) {
      const script = document.createElement("script");
      script.src = RUNTIME_SRC;
      script.defer = true;
      script.dataset.assistantRuntime = "true";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
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
