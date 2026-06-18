(function () {
  function init() {
    const tabs = Array.from(document.querySelectorAll("[data-ai-tab]"));
    const panels = Array.from(document.querySelectorAll("[data-ai-panel]"));
    if (!tabs.length || !panels.length) {
      return;
    }

    function activate(id, moveFocus) {
      tabs.forEach(function (tab) {
        const active = tab.getAttribute("data-ai-tab") === id;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", active ? "true" : "false");
        tab.setAttribute("tabindex", active ? "0" : "-1");
        if (active && moveFocus) {
          tab.focus();
        }
      });

      panels.forEach(function (panel) {
        const active = panel.getAttribute("data-ai-panel") === id;
        panel.classList.toggle("active", active);
        panel.hidden = !active;
      });
    }

    function syncHash(id) {
      const nextHash = id === "relay" ? "#relay" : "#nav";
      if (window.location.hash === nextHash || !window.history || !window.history.replaceState) {
        return;
      }
      window.history.replaceState(null, "", window.location.pathname + window.location.search + nextHash);
    }

    function tabIdFromHash() {
      const hash = window.location.hash.replace(/^#/, "");
      if (hash === "relay" || hash === "ranking" || hash === "ai-panel-relay") {
        return "relay";
      }
      if (hash === "nav" || hash === "ai-panel-nav") {
        return "nav";
      }
      return "";
    }

    function activateFromHash() {
      const id = tabIdFromHash();
      activate(id || "relay", false);
    }

    tabs.forEach(function (tab, index) {
      tab.addEventListener("click", function () {
        const id = tab.getAttribute("data-ai-tab");
        activate(id, false);
        syncHash(id);
      });
      tab.addEventListener("keydown", function (event) {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
          return;
        }
        event.preventDefault();
        const nextIndex = event.key === "ArrowRight"
          ? (index + 1) % tabs.length
          : (index - 1 + tabs.length) % tabs.length;
        const id = tabs[nextIndex].getAttribute("data-ai-tab");
        activate(id, true);
        syncHash(id);
      });
    });

    window.addEventListener("hashchange", activateFromHash);
    activateFromHash();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
