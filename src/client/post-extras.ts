type LoadTask = () => Promise<void>;

function createScriptLoader(doc: Document, src: string): LoadTask {
  return () => new Promise((resolve, reject) => {
    const existing = doc.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") resolve();
      else {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
      }
      return;
    }
    const script = doc.createElement("script");
    script.src = src;
    script.async = true;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
    doc.head.appendChild(script);
  });
}

export function initPostExtras(
  doc: Document = document,
  win: Window & typeof globalThis = window,
  tasks: {
    loadQr?: LoadTask;
    loadShare?: LoadTask;
    loadComments?: LoadTask;
  } = {},
) {
  const loadQr = tasks.loadQr || createScriptLoader(doc, "/js/vendor/qrcode.min.js");
  const loadShare = tasks.loadShare || (async () => {
    const module = await import("./share");
    module.initShare(doc, win);
  });
  const loadComments = tasks.loadComments || (async () => {
    const module = await import("./giscus");
    module.initGiscus(doc, win);
  });
  let shareTask: Promise<void> | null = null;
  let commentsTask: Promise<void> | null = null;
  const loadSharing = () => {
    if (!shareTask) {
      shareTask = loadQr()
        .then(loadShare)
        .catch(() => { shareTask = null; });
    }
    return shareTask;
  };
  const ensureComments = () => {
    if (!commentsTask) commentsTask = loadComments().catch(() => { commentsTask = null; });
    return commentsTask;
  };
  const loadNear = (selector: string, callback: () => unknown) => {
    const target = doc.querySelector(selector);
    if (!target) return;
    if (!("IntersectionObserver" in win) || typeof win.IntersectionObserver !== "function") {
      win.addEventListener("load", callback, { once: true });
      return;
    }
    const observer = new win.IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      callback();
    }, { rootMargin: "800px 0px" });
    observer.observe(target);
  };

  loadNear(".post-share", loadSharing);
  loadNear("#giscus-thread", ensureComments);
}
