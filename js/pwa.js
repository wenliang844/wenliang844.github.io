(function () {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) {
    return;
  }

  const excluded = ["/editor/", "/overleaf/", "/chat/", "/api/"];
  if (excluded.some(function (prefix) { return window.location.pathname.startsWith(prefix); })) {
    return;
  }

  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/service-worker.js", { scope: "/" }).catch(function () {
      // Offline support is an enhancement; registration failure must not block the site.
    });
  }, { once: true });
}());
