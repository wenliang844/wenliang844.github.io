type GiscusConfig = {
  repo: string;
  repoId: string;
  category: string;
  categoryId: string;
  mapping: string;
  theme: string;
  lang: string;
};

type GiscusWindow = Window & typeof globalThis & {
  CWLUtils?: { t?: (key: string, fallback: string) => string };
  CWL_GISCUS_CONFIG?: Partial<GiscusConfig>;
};

const DEFAULT_CONFIG: GiscusConfig = {
  repo: "wenliang844/wenliang844.github.io",
  repoId: "MDEwOlJlcG9zaXRvcnkzNTQyNDE4MDY=",
  category: "Announcements",
  categoryId: "DIC_kwDOFR1NDs4C_PFL",
  mapping: "pathname",
  theme: "preferred_color_scheme",
  lang: "zh-CN",
};

export function initGiscus(doc: Document = document, win: GiscusWindow = window as GiscusWindow) {
  const thread = doc.getElementById("giscus-thread");
  if (!thread) return;
  const config = { ...DEFAULT_CONFIG, ...(win.CWL_GISCUS_CONFIG || {}) };
  const translate = win.CWLUtils?.t || ((_key: string, fallback: string) => fallback);
  const createPlaceholder = () => {
    const message = translate("dyn.comments.placeholder", "评论区尚未配置。站长在 <code>src/client/giscus.ts</code> 填入 GitHub 仓库的 giscus 配置（repo / repoId / categoryId）后，即可启用基于 GitHub Discussions 的评论。");
    const paragraph = doc.createElement("p");
    paragraph.className = "comments-hint";
    const codeMatch = message.match(/<code>(.*?)<\/code>/);
    if (!codeMatch || codeMatch.index === undefined) {
      paragraph.textContent = message;
      return paragraph;
    }
    const code = doc.createElement("code");
    code.textContent = codeMatch[1];
    paragraph.append(
      doc.createTextNode(message.slice(0, codeMatch.index)),
      code,
      doc.createTextNode(message.slice(codeMatch.index + codeMatch[0].length)),
    );
    return paragraph;
  };
  const renderPlaceholder = () => thread.replaceChildren(createPlaceholder());
  if (!config.repo || !config.repoId || !config.categoryId) {
    renderPlaceholder();
    doc.addEventListener("cwl:langchange", renderPlaceholder);
    return;
  }

  const activeTerm = () => {
    const active = doc.querySelector<HTMLElement>(".blog-article.active[data-post-slug]");
    return active?.dataset.postSlug ? `/post/${active.dataset.postSlug}/` : null;
  };
  const buildScript = (options: { mapping?: string; term?: string } = {}) => {
    const script = doc.createElement("script");
    script.src = "https://giscus.app/client.js";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.repo = config.repo;
    script.dataset.repoId = config.repoId;
    script.dataset.category = config.category;
    script.dataset.categoryId = config.categoryId;
    script.dataset.mapping = options.mapping || config.mapping;
    if (options.term) script.dataset.term = options.term;
    script.dataset.strict = "0";
    script.dataset.reactionsEnabled = "1";
    script.dataset.emitMetadata = "0";
    script.dataset.inputPosition = "top";
    script.dataset.theme = config.theme;
    script.dataset.lang = config.lang;
    return script;
  };
  const afterPageLoad = (callback: () => void) => {
    if (doc.readyState === "complete") callback();
    else win.addEventListener("load", callback, { once: true });
  };
  if (thread.dataset.giscusMode !== "switch") {
    afterPageLoad(() => thread.appendChild(buildScript()));
    return;
  }

  let loadedTerm: string | null = null;
  const giscusFrame = () => thread.querySelector<HTMLIFrameElement>("iframe.giscus-frame");
  const switchTerm = (term: string) => {
    const frame = giscusFrame();
    if (!frame?.contentWindow) return false;
    frame.contentWindow.postMessage({ giscus: { setConfig: { term } } }, "https://giscus.app");
    return true;
  };
  const showTerm = (term: string | null) => {
    if (!term || term === loadedTerm) return;
    if (!giscusFrame()) {
      thread.appendChild(buildScript({ mapping: "specific", term }));
      loadedTerm = term;
    } else if (switchTerm(term)) loadedTerm = term;
  };
  afterPageLoad(() => showTerm(activeTerm()));

  const observer = new win.MutationObserver((mutations) => {
    for (const mutation of mutations) {
      const element = mutation.target as HTMLElement;
      if (!element.classList?.contains("blog-article") || !element.classList.contains("active")) continue;
      if (element.dataset.postSlug) showTerm(`/post/${element.dataset.postSlug}/`);
    }
  });
  for (const panel of doc.querySelectorAll(".blog-article")) {
    observer.observe(panel, { attributes: true, attributeFilter: ["class"] });
  }
  win.addEventListener("pagehide", () => observer.disconnect());
}
