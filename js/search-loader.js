(function () {
  let task = null;
  let queuedOpen = false;

  function editing() {
    return Boolean(window.CWLUtils && window.CWLUtils.isEditing && window.CWLUtils.isEditing());
  }

  function t(key, fallback) {
    return window.CWLUtils && window.CWLUtils.t ? window.CWLUtils.t(key, fallback) : fallback;
  }

  function rememberTriggerLabel(trigger) {
    if (!trigger.hasAttribute("data-search-original-label")) {
      trigger.dataset.searchOriginalLabel = trigger.getAttribute("aria-label") || "";
    }
    if (!trigger.hasAttribute("data-search-original-title")) {
      trigger.dataset.searchOriginalTitle = trigger.getAttribute("title") || "";
    }
  }

  function clearSearchLoadFailure() {
    document.querySelectorAll(".nav-search-trigger.is-error").forEach(function (trigger) {
      trigger.classList.remove("is-error");
      if (trigger.hasAttribute("data-search-original-label")) {
        trigger.setAttribute("aria-label", trigger.dataset.searchOriginalLabel);
      }
      if (trigger.hasAttribute("data-search-original-title")) {
        trigger.setAttribute("title", trigger.dataset.searchOriginalTitle);
      }
    });
  }

  function reportSearchLoadFailure(error) {
    const message = t("dyn.search.bundleLoadFail", "搜索加载失败，请稍后重试。");
    document.querySelectorAll(".nav-search-trigger").forEach(function (trigger) {
      rememberTriggerLabel(trigger);
      trigger.classList.add("is-error");
      trigger.setAttribute("aria-label", message);
      trigger.setAttribute("title", message);
    });
    if (window.CWLLogger && typeof window.CWLLogger.warn === "function") {
      window.CWLLogger.warn("search", "Search bundle failed to load", {
        message: error && error.message ? error.message : String(error || ""),
      });
    }
    if (window.CWLErrorHandler && typeof window.CWLErrorHandler.showUserMessage === "function") {
      window.CWLErrorHandler.showUserMessage(message);
    }
  }

  function loadSearch(openAfterLoad) {
    if (window.cwlOpenSearch) {
      clearSearchLoadFailure();
      if (openAfterLoad) {
        window.cwlOpenSearch();
      }
      return Promise.resolve();
    }

    queuedOpen = queuedOpen || !!openAfterLoad;
    if (!task) {
      task = new Promise(function (resolve, reject) {
        const script = document.createElement("script");
        script.src = "/js/search.js";
        script.defer = true;
        script.onload = function () {
          clearSearchLoadFailure();
          if (queuedOpen && window.cwlOpenSearch) {
            window.cwlOpenSearch();
          } else if (window.cwlPreloadSearch) {
            window.cwlPreloadSearch().catch(function () {});
          }
          queuedOpen = false;
          resolve();
        };
        script.onerror = function () {
          queuedOpen = false;
          task = null;
          if (script.parentNode) {
            script.parentNode.removeChild(script);
          }
          reject(new Error("Search script failed"));
        };
        document.head.appendChild(script);
      });
    }
    return task;
  }

  function preloadSearch() {
    loadSearch(false).catch(function () {});
  }

  function scheduleIdlePreload() {
    if (window.cwlOpenSearch || !document.querySelector(".nav-search-trigger")) {
      return;
    }
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(preloadSearch, { timeout: 3500 });
    } else {
      window.setTimeout(preloadSearch, 2500);
    }
  }

  document.addEventListener("click", function (event) {
    const trigger = event.target.closest && event.target.closest(".nav-search-trigger");
    if (!trigger) {
      return;
    }
    event.preventDefault();
    loadSearch(true).catch(reportSearchLoadFailure);
  });

  document.addEventListener("keydown", function (event) {
    const modalOpen = document.body.classList.contains("search-open");
    if (modalOpen || editing()) {
      return;
    }
    if (event.key === "/" || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k")) {
      event.preventDefault();
      loadSearch(true).catch(reportSearchLoadFailure);
    }
  });

  scheduleIdlePreload();
})();
