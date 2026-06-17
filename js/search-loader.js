(function () {
  let task = null;
  let queuedOpen = false;

  function editing() {
    const active = document.activeElement || {};
    const tag = active.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || active.isContentEditable;
  }

  function loadSearch(openAfterLoad) {
    if (window.cwlOpenSearch) {
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
          if (queuedOpen && window.cwlOpenSearch) {
            window.cwlOpenSearch();
          }
          queuedOpen = false;
          resolve();
        };
        script.onerror = function () {
          queuedOpen = false;
          task = null;
          reject(new Error("Search script failed"));
        };
        document.head.appendChild(script);
      });
    }
    return task;
  }

  document.addEventListener("click", function (event) {
    const trigger = event.target.closest && event.target.closest(".nav-search-trigger");
    if (!trigger) {
      return;
    }
    event.preventDefault();
    loadSearch(true);
  });

  document.addEventListener("keydown", function (event) {
    const modalOpen = document.body.classList.contains("search-open");
    if (modalOpen || editing()) {
      return;
    }
    if (event.key === "/" || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k")) {
      event.preventDefault();
      loadSearch(true);
    }
  });
})();
