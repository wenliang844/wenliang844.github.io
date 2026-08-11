(function () {
  let shareTask = null;
  let commentsTask = null;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      const existing = document.querySelector('script[src="' + src + '"]');
      if (existing) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = function () {
        reject(new Error("Failed to load " + src));
      };
      document.head.appendChild(script);
    });
  }

  function loadSharing() {
    if (!shareTask) {
      shareTask = loadScript("/js/vendor/qrcode.min.js")
        .then(function () { return loadScript("/js/share.js"); })
        .catch(function () { shareTask = null; });
    }
    return shareTask;
  }

  function loadComments() {
    if (!commentsTask) {
      commentsTask = loadScript("/js/giscus.js")
        .catch(function () { commentsTask = null; });
    }
    return commentsTask;
  }

  function loadNear(selector, callback) {
    const target = document.querySelector(selector);
    if (!target) {
      return;
    }
    if (!("IntersectionObserver" in window)) {
      window.addEventListener("load", callback, { once: true });
      return;
    }
    const observer = new IntersectionObserver(function (entries) {
      if (!entries.some(function (entry) { return entry.isIntersecting; })) {
        return;
      }
      observer.disconnect();
      callback();
    }, { rootMargin: "800px 0px" });
    observer.observe(target);
  }

  loadNear(".post-share", loadSharing);
  loadNear("#giscus-thread", loadComments);
})();
