type ArticleWindow = Window & typeof globalThis & {
  CWLUtils?: {
    copyText?: (text: string) => Promise<unknown>;
    readingMinutes?: (text: string) => number;
    t?: (key: string, fallback: string) => string;
    throttle?: <T extends (...args: any[]) => void>(callback: T, wait: number) => T;
  };
};

function activeContent(article: Element) {
  return article.querySelector<HTMLElement>(".article-content:not([hidden])")
    || article.querySelector<HTMLElement>(".article-content");
}

function icon(doc: Document, className: string) {
  const element = doc.createElement("i");
  element.className = className;
  element.setAttribute("aria-hidden", "true");
  return element;
}

export function initArticleEnhancements(
  doc: Document = document,
  win: ArticleWindow = window as ArticleWindow,
) {
  const articles = Array.from(doc.querySelectorAll<HTMLElement>("article.article"));
  if (!articles.length) return;
  const translate = win.CWLUtils?.t || ((_key: string, fallback: string) => fallback);
  const readingMinutes = win.CWLUtils?.readingMinutes || ((text: string) => Math.max(1, Math.ceil(text.trim().length / 350)));
  const copyText = win.CWLUtils?.copyText || (() => Promise.reject(new Error("Clipboard unavailable")));

  const setCopyLabel = (button: HTMLButtonElement, key = "dyn.copy", fallback = "复制", iconClass = "fas fa-copy") => {
    button.replaceChildren(icon(doc, iconClass), doc.createTextNode(` ${translate(key, fallback)}`));
  };
  for (const pre of doc.querySelectorAll<HTMLElement>(".article-content pre")) {
    if (pre.querySelector(".code-copy")) continue;
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "code-copy";
    setCopyLabel(button);
    button.addEventListener("click", async () => {
      const code = pre.querySelector<HTMLElement>("code") || pre;
      button.disabled = true;
      try {
        await copyText(code.innerText || code.textContent || "");
        button.classList.add("copied");
        setCopyLabel(button, "dyn.copied", "已复制", "fas fa-check");
      } catch {
        setCopyLabel(button, "dyn.copyFailed", "复制失败", "fas fa-times");
      } finally {
        win.setTimeout(() => {
          button.disabled = false;
          button.classList.remove("copied");
          setCopyLabel(button);
        }, 1600);
      }
    });
    pre.appendChild(button);
  }

  let overlay: HTMLDivElement | null = null;
  let opener: HTMLElement | null = null;
  const closeLightbox = () => {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
    doc.body.classList.remove("lightbox-open");
    opener?.focus();
    opener = null;
  };
  const openLightbox = (image: HTMLImageElement) => {
    if (!image.getAttribute("src")) return;
    closeLightbox();
    opener = image;
    overlay = doc.createElement("div");
    overlay.className = "lightbox-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", translate("dyn.lightbox.aria", "图片预览"));
    const close = doc.createElement("button");
    close.type = "button";
    close.className = "lightbox-close";
    close.setAttribute("aria-label", translate("dyn.lightbox.close", "关闭图片预览"));
    close.textContent = "×";
    const preview = doc.createElement("img");
    preview.className = "lightbox-image";
    preview.src = image.currentSrc || image.src;
    preview.alt = image.alt || translate("dyn.lightbox.image", "文章图片");
    overlay.append(close, preview);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay || event.target === close) closeLightbox();
    });
    doc.body.appendChild(overlay);
    doc.body.classList.add("lightbox-open");
    close.focus();
  };
  doc.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && overlay) closeLightbox();
  });
  for (const image of doc.querySelectorAll<HTMLImageElement>(".article-content img")) {
    if (image.dataset.lightboxReady === "true") continue;
    image.dataset.lightboxReady = "true";
    image.tabIndex = 0;
    image.setAttribute("role", "button");
    image.setAttribute("aria-label", translate("dyn.lightbox.open", "查看大图"));
    image.addEventListener("click", () => openLightbox(image));
    image.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openLightbox(image);
      }
    });
  }

  const slugify = (text: string) => text.trim().toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "") || "section";
  const hasServerToc = (article: HTMLElement) => Boolean(article.closest(".post-layout")?.querySelector(".toc-sidebar"));
  const setTocOpen = (toc: HTMLElement, open: boolean) => {
    toc.classList.toggle("is-open", open);
    toc.classList.toggle("is-collapsed", !open);
    toc.querySelector(".article-toc-toggle")?.setAttribute("aria-expanded", String(open));
  };
  const buildToc = (article: HTMLElement, content: HTMLElement) => {
    const lang = content.dataset.i18nLang || "content";
    article.querySelector(`.article-toc[data-toc-lang="${lang}"]`)?.remove();
    const headings = Array.from(content.querySelectorAll<HTMLElement>("h2, h3"))
      .filter((heading) => Boolean(heading.textContent?.trim()));
    if (headings.length < 3) return;
    const compact = win.matchMedia?.("(max-width: 768px)").matches || false;
    const toc = doc.createElement("aside");
    toc.className = `article-toc ${compact ? "is-collapsed" : "is-open"}`;
    toc.dataset.tocLang = lang;
    toc.hidden = content.hidden;
    const toggle = doc.createElement("button");
    toggle.type = "button";
    toggle.className = "article-toc-toggle";
    toggle.setAttribute("aria-expanded", String(!compact));
    const title = doc.createElement("span");
    toggle.append(icon(doc, "fas fa-list"), title, icon(doc, "fas fa-chevron-down article-toc-chevron"));
    toggle.addEventListener("click", () => setTocOpen(toc, toggle.getAttribute("aria-expanded") !== "true"));
    const list = doc.createElement("ol");
    headings.forEach((heading, index) => {
      const articleId = article.dataset.postSlug || article.id || "article";
      heading.id ||= `toc-${slugify(articleId)}-${slugify(lang)}-${index}-${slugify(heading.textContent || "")}`;
      const item = doc.createElement("li");
      item.className = `toc-depth-${heading.tagName.slice(1)}`;
      const link = doc.createElement("a");
      link.href = `#${heading.id}`;
      link.textContent = heading.textContent || "";
      item.appendChild(link);
      list.appendChild(item);
    });
    toc.append(toggle, list);
    article.appendChild(toc);
  };
  const updateActiveToc = () => {
    const article = doc.querySelector<HTMLElement>(".blog-article.active")
      || doc.querySelector<HTMLElement>("article.article");
    const content = article && activeContent(article);
    if (!article || !content) return;
    const lang = content.dataset.i18nLang || "content";
    const toc = article.querySelector<HTMLElement>(`.article-toc[data-toc-lang="${lang}"]`);
    if (!toc) return;
    const headings = Array.from(content.querySelectorAll<HTMLElement>("h2[id], h3[id]"));
    if (!headings.length) return;
    let active = headings[0];
    for (const heading of headings) {
      if (heading.getBoundingClientRect().top <= 125) active = heading;
    }
    for (const link of toc.querySelectorAll<HTMLAnchorElement>("a")) {
      const isActive = link.hash === `#${active.id}`;
      link.classList.toggle("active", isActive);
      if (isActive) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    }
  };
  for (const article of articles) {
    if (!hasServerToc(article)) {
      for (const content of article.querySelectorAll<HTMLElement>(".article-content")) buildToc(article, content);
    }
    const meta = article.querySelector(".article-meta");
    if (meta && !meta.querySelector(".reading-time")) {
      const reading = doc.createElement("span");
      reading.className = "reading-time";
      meta.append(doc.createTextNode(" "), reading);
    }
  }

  const updateText = () => {
    for (const button of doc.querySelectorAll<HTMLButtonElement>(".code-copy:not(.copied)")) setCopyLabel(button);
    for (const reading of doc.querySelectorAll<HTMLElement>(".reading-time")) {
      const article = reading.closest("article.article");
      const content = article && activeContent(article);
      if (!content) continue;
      reading.replaceChildren(
        icon(doc, "fas fa-clock"),
        doc.createTextNode(` ${translate("dyn.readingPrefix", "约")} ${readingMinutes(content.textContent || "")} ${translate("dyn.readingSuffix", "分钟")}`),
      );
    }
    for (const toc of doc.querySelectorAll<HTMLElement>(".article-toc")) {
      const article = toc.closest("article.article");
      const content = article && activeContent(article);
      toc.hidden = Boolean(content && (toc.dataset.tocLang || "content") !== (content.dataset.i18nLang || "content"));
      const label = translate("dyn.toc", "目录");
      toc.setAttribute("aria-label", translate("dyn.toc.aria", label));
      const toggle = toc.querySelector<HTMLElement>(".article-toc-toggle");
      toggle?.setAttribute("aria-label", translate("dyn.toc.aria", label));
      const title = toggle?.querySelector("span");
      if (title) title.textContent = label;
    }
    for (const image of doc.querySelectorAll<HTMLImageElement>(".article-content img[data-lightbox-ready='true']")) {
      image.setAttribute("aria-label", translate("dyn.lightbox.open", "查看大图"));
    }
  };
  doc.addEventListener("cwl:langchange", updateText);
  doc.addEventListener("cwl:postchange", () => {
    updateText();
    updateActiveToc();
  });
  const throttledToc = win.CWLUtils?.throttle?.(updateActiveToc, 100) || updateActiveToc;
  win.addEventListener("scroll", throttledToc, { passive: true });
  updateText();
  updateActiveToc();
}
