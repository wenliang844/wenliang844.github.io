(function () {
  const sw = navigator.serviceWorker;
  const t = (key, fallback) => window.cwlT ? window.cwlT(key, fallback) : fallback;
  const update = () => {
    const node = document.querySelector("[data-pwa-article-status]");
    if (!node) {
      return;
    }
    const ready = sw && sw.controller;
    const offline = !navigator.onLine;
    node.hidden = !ready;
    node.classList.toggle("is-offline", ready && offline);
    node.classList.toggle("is-ready", ready && !offline);
    node.textContent = ready
      ? t(offline ? "dyn.pwa.articleOffline" : "dyn.pwa.articleReady", offline ? "正在离线阅读此文章" : "此文章已可离线阅读")
      : "";
  };
  if (sw && (location.protocol === "https:" || /^(localhost|127\.|::1)/.test(location.hostname))) {
    window.addEventListener("load", () => {
      sw.register("/service-worker.js").then(update).catch(() => {});
    });
    sw.addEventListener("controllerchange", update);
  }
  ["online", "offline"].forEach((name) => window.addEventListener(name, update));
  document.addEventListener("cwl:langchange", update);
  update();
}());
