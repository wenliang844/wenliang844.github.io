(function () {
  var task = null;
  var queuedOpen = false;

  function editing() {
    var active = document.activeElement || {};
    var tag = active.tagName;
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
        var script = document.createElement("script");
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
    var trigger = event.target.closest && event.target.closest(".nav-search-trigger");
    if (!trigger) {
      return;
    }
    event.preventDefault();
    loadSearch(true);
  });

  document.addEventListener("keydown", function (event) {
    var modalOpen = document.body.classList.contains("search-open");
    if (modalOpen || editing()) {
      return;
    }
    if (event.key === "/" || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k")) {
      event.preventDefault();
      loadSearch(true);
    }
  });
})();
