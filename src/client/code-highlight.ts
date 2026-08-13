type HighlightApi = {
  configure: (options: { ignoreUnescapedHTML: boolean; languages: string[] }) => void;
  highlightElement: (element: HTMLElement) => void;
};

type HighlightWindow = Window & typeof globalThis & {
  hljs?: HighlightApi;
  CWLUtils?: {
    throttle?: <T extends (...args: any[]) => void>(callback: T, wait: number) => T;
  };
};

const HIGHLIGHT_SRC = "/js/vendor/highlight.min.js";
const HIGHLIGHT_LANGUAGES = [
  "javascript",
  "java",
  "python",
  "bash",
  "sql",
  "html",
  "css",
  "json",
  "xml",
];
const LOAD_MARGIN = 800;
const loadTasks = new WeakMap<Document, Promise<HighlightApi>>();
const configuredApis = new WeakSet<object>();

function currentApi(win: HighlightWindow) {
  const api = win.hljs;
  return api && typeof api.configure === "function" && typeof api.highlightElement === "function"
    ? api
    : null;
}

function loadHighlightApi(doc: Document, win: HighlightWindow) {
  const loaded = currentApi(win);
  if (loaded) return Promise.resolve(loaded);

  const pending = loadTasks.get(doc);
  if (pending) return pending;

  let script = doc.querySelector<HTMLScriptElement>(`script[src="${HIGHLIGHT_SRC}"]`);
  if (script?.dataset.highlightState === "error") {
    script.remove();
    script = null;
  }

  const task = new Promise<HighlightApi>((resolve, reject) => {
    const target = script || doc.createElement("script");
    const cleanup = () => {
      target.removeEventListener("load", onLoad);
      target.removeEventListener("error", onError);
    };
    const onLoad = () => {
      cleanup();
      const api = currentApi(win);
      if (!api) {
        target.dataset.highlightState = "error";
        reject(new Error("highlight.js loaded without exposing its API"));
        return;
      }
      target.dataset.highlightState = "loaded";
      resolve(api);
    };
    const onError = () => {
      cleanup();
      target.dataset.highlightState = "error";
      reject(new Error("Failed to load highlight.js"));
    };

    if (target.dataset.highlightState === "loaded") {
      onLoad();
      return;
    }
    target.addEventListener("load", onLoad, { once: true });
    target.addEventListener("error", onError, { once: true });
    if (!script) {
      target.src = HIGHLIGHT_SRC;
      target.async = true;
      target.dataset.highlightState = "loading";
      doc.head.appendChild(target);
    }
  });
  loadTasks.set(doc, task);
  void task.catch(() => {
    if (loadTasks.get(doc) === task) loadTasks.delete(doc);
  });
  return task;
}

function highlightBlocks(api: HighlightApi, blocks: HTMLElement[], win: HighlightWindow) {
  if (!configuredApis.has(api)) {
    api.configure({
      ignoreUnescapedHTML: true,
      languages: HIGHLIGHT_LANGUAGES,
    });
    configuredApis.add(api);
  }
  for (const block of blocks) {
    if (block.dataset.cwlHighlighted === "true" || block.dataset.highlighted === "yes") continue;
    try {
      api.highlightElement(block);
      block.dataset.cwlHighlighted = "true";
    } catch (error) {
      win.console.warn("Failed to highlight code block:", error);
    }
  }
}

export function initCodeHighlight(
  doc: Document = document,
  win: HighlightWindow = window as HighlightWindow,
) {
  const blocks = Array.from(doc.querySelectorAll<HTMLElement>("article.article .article-content pre code"));
  if (!blocks.length) return;

  let observer: IntersectionObserver | null = null;
  let cleanupFallback = () => {};
  let requested = false;
  let disposed = false;
  const cleanup = () => {
    observer?.disconnect();
    observer = null;
    cleanupFallback();
    cleanupFallback = () => {};
  };
  const requestHighlight = () => {
    if (requested || disposed) return;
    requested = true;
    cleanup();
    void loadHighlightApi(doc, win)
      .then((api) => {
        if (!disposed) highlightBlocks(api, blocks, win);
      })
      .catch((error) => win.console.warn("Failed to load highlight.js:", error));
  };
  const onPageHide = () => {
    disposed = true;
    cleanup();
  };
  win.addEventListener("pagehide", onPageHide, { once: true });

  if (currentApi(win)) {
    requestHighlight();
    return;
  }
  if (typeof win.IntersectionObserver === "function") {
    observer = new win.IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) requestHighlight();
    }, { rootMargin: `${LOAD_MARGIN}px 0px` });
    observer.observe(blocks[0]);
    return;
  }

  const firstBlock = blocks[0];
  const isNearViewport = () => {
    const bounds = firstBlock.getBoundingClientRect();
    return bounds.top <= win.innerHeight + LOAD_MARGIN && bounds.bottom >= -LOAD_MARGIN;
  };
  const check = () => {
    if (isNearViewport()) requestHighlight();
  };
  const throttled = win.CWLUtils?.throttle?.(check, 150) || check;
  win.addEventListener("scroll", throttled, { passive: true });
  win.addEventListener("resize", throttled);
  win.addEventListener("load", throttled, { once: true });
  cleanupFallback = () => {
    win.removeEventListener("scroll", throttled);
    win.removeEventListener("resize", throttled);
    win.removeEventListener("load", throttled);
  };
  check();
}
