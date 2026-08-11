(function () {
  let task = null;

  function loadAssistant() {
    if (document.querySelector(".assistant-widget")) {
      return Promise.resolve();
    }
    if (!task) {
      task = new Promise(function (resolve, reject) {
        const script = document.createElement("script");
        script.src = "/js/assistant.js";
        script.async = true;
        script.onload = resolve;
        script.onerror = function () {
          task = null;
          reject(new Error("Assistant script failed"));
        };
        document.head.appendChild(script);
      });
    }
    return task;
  }

  document.addEventListener("click", function (event) {
    const trigger = event.target.closest && event.target.closest("[data-assistant-toggle]");
    if (!trigger || document.querySelector(".assistant-widget")) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    loadAssistant().then(function () {
      trigger.click();
    }).catch(function () {});
  }, true);

  const params = new URLSearchParams(window.location.search);
  if (params.get("assistant") === "fullscreen" || window.location.hash === "#assistant-fullscreen") {
    loadAssistant().catch(function () {});
  }
})();
