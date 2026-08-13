type ArticleWindow = Window & typeof globalThis & {
  CWLUtils?: {
    storageGet?: (key: string) => string | null;
    storageSet?: (key: string, value: string) => unknown;
    t?: (key: string, fallback: string) => string;
    throttle?: <T extends (...args: any[]) => void>(callback: T, wait: number) => T;
  };
};

const RESUME_MAX_AGE = 14 * 24 * 60 * 60 * 1000;
const RESUME_MIN_RATIO = 0.08;
const RESUME_MAX_RATIO = 0.98;
const PERSIST_RATIO_STEP = 0.01;
const SCROLL_THROTTLE = 100;
const RESIZE_THROTTLE = 200;

type SavedPosition = { ratio: number; time: number };

function activeArticle(doc: Document) {
  return doc.querySelector<HTMLElement>(".blog-article.active")
    || doc.querySelector<HTMLElement>("article.article");
}

function articleSlug(article: HTMLElement | null, win: Window) {
  if (article?.dataset.postSlug) return article.dataset.postSlug;
  return win.location.pathname.match(/\/post\/([^/]+)\//)?.[1] || "";
}

function articleRatio(article: HTMLElement, win: Window, doc: Document) {
  const scrollTop = win.scrollY || doc.documentElement.scrollTop || 0;
  const articleTop = article.getBoundingClientRect().top + scrollTop;
  const readableHeight = Math.max(1, article.scrollHeight - win.innerHeight * 0.65);
  return Math.min(1, Math.max(0, (scrollTop - articleTop) / readableHeight));
}

export function initArticleReading(
  doc: Document = document,
  win: ArticleWindow = window as ArticleWindow,
) {
  if (!doc.querySelector("article.article")) return;

  const translate = win.CWLUtils?.t || ((_key: string, fallback: string) => fallback);
  const progress = doc.createElement("progress");
  progress.className = "read-progress";
  progress.max = 1;
  progress.value = 0;
  progress.setAttribute("aria-label", translate("dyn.readingProgress", "文章阅读进度"));
  doc.body.appendChild(progress);

  let currentArticle: HTMLElement | null = null;
  let currentRatio = 0;
  let lastSavedSlug = "";
  let lastSavedRatio = -1;

  const storageKey = (slug: string) => `cwl.reading.${slug}`;
  const readPosition = (slug: string): SavedPosition | null => {
    if (!slug || !win.CWLUtils?.storageGet) return null;
    try {
      const raw = win.CWLUtils.storageGet(storageKey(slug));
      if (!raw) return null;
      const value = JSON.parse(raw) as Partial<SavedPosition>;
      return Number.isFinite(value.ratio) && Number.isFinite(value.time)
        ? { ratio: Number(value.ratio), time: Number(value.time) }
        : null;
    } catch {
      return null;
    }
  };
  const persist = (force = false) => {
    const slug = articleSlug(currentArticle, win);
    if (!slug || !currentArticle || !win.CWLUtils?.storageSet || currentRatio < RESUME_MIN_RATIO) return;
    if (!force && slug === lastSavedSlug && Math.abs(currentRatio - lastSavedRatio) < PERSIST_RATIO_STEP) return;
    win.CWLUtils.storageSet(storageKey(slug), JSON.stringify({ ratio: currentRatio, time: Date.now() }));
    lastSavedSlug = slug;
    lastSavedRatio = currentRatio;
  };
  const removeResume = () => doc.querySelector(".reading-resume")?.remove();
  const scrollToRatio = (article: HTMLElement, ratio: number) => {
    const scrollTop = win.scrollY || doc.documentElement.scrollTop || 0;
    const articleTop = article.getBoundingClientRect().top + scrollTop;
    const readableHeight = Math.max(1, article.scrollHeight - win.innerHeight * 0.65);
    win.scrollTo({
      top: articleTop + readableHeight * Math.min(1, Math.max(0, ratio)),
      behavior: "smooth",
    });
  };
  const showResume = (article: HTMLElement | null) => {
    removeResume();
    if (!article) return;
    const compact = win.matchMedia
      ? win.matchMedia("(max-width: 768px)").matches
      : win.innerWidth <= 768;
    if (compact) return;
    const saved = readPosition(articleSlug(article, win));
    if (!saved || Date.now() - saved.time > RESUME_MAX_AGE) return;
    if (saved.ratio < RESUME_MIN_RATIO || saved.ratio > RESUME_MAX_RATIO) return;

    const prompt = doc.createElement("aside");
    prompt.className = "reading-resume";
    prompt.setAttribute("role", "status");
    prompt.setAttribute("aria-live", "polite");
    const text = doc.createElement("span");
    text.textContent = `${translate("dyn.resume.text", "上次读到")} ${Math.round(saved.ratio * 100)}%`;
    const resume = doc.createElement("button");
    resume.type = "button";
    resume.className = "reading-resume-btn";
    resume.textContent = translate("dyn.resume.continue", "继续阅读");
    resume.addEventListener("click", () => {
      scrollToRatio(article, saved.ratio);
      removeResume();
    });
    const close = doc.createElement("button");
    close.type = "button";
    close.className = "reading-resume-close";
    close.setAttribute("aria-label", translate("dyn.resume.close", "关闭继续阅读提示"));
    close.textContent = "×";
    close.addEventListener("click", removeResume);
    prompt.append(text, resume, close);
    doc.body.appendChild(prompt);
  };
  const update = () => {
    currentArticle = activeArticle(doc);
    currentRatio = currentArticle ? articleRatio(currentArticle, win, doc) : 0;
    progress.value = currentRatio;
    progress.hidden = !currentArticle;
    persist();
  };
  const throttledScroll = win.CWLUtils?.throttle?.(update, SCROLL_THROTTLE) || update;
  const throttledResize = win.CWLUtils?.throttle?.(update, RESIZE_THROTTLE) || update;

  win.addEventListener("scroll", throttledScroll, { passive: true });
  win.addEventListener("resize", throttledResize);
  win.addEventListener("pagehide", () => persist(true));
  doc.addEventListener("cwl:langchange", () => {
    progress.setAttribute("aria-label", translate("dyn.readingProgress", "文章阅读进度"));
  });
  doc.addEventListener("cwl:postchange", () => {
    persist(true);
    lastSavedSlug = "";
    lastSavedRatio = -1;
    currentArticle = activeArticle(doc);
    showResume(currentArticle);
    update();
  });

  currentArticle = activeArticle(doc);
  showResume(currentArticle);
  update();
}
