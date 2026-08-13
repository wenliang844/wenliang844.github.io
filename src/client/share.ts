type ShareWindow = Window & typeof globalThis & {
  CWLUtils?: {
    copyText?: (text: string) => Promise<void>;
    t?: (key: string, fallback: string) => string;
  };
  cwlLang?: () => string;
  qrcode?: (type: number, level: string) => {
    addData: (value: string) => void;
    make: () => void;
    createSvgTag: (options: Record<string, unknown>) => string;
  };
};

export function initShare(doc: Document = document, win: ShareWindow = window as ShareWindow) {
  const bars = Array.from(doc.querySelectorAll<HTMLElement>(".post-share"));
  if (!bars.length) return;

  const translate = win.CWLUtils?.t || ((_key: string, fallback: string) => fallback);
  const absoluteUrl = (path: string) => /^https?:/i.test(path) ? path : win.location.origin + path;
  const shareTitle = (bar: HTMLElement) => {
    if (win.cwlLang?.() === "en") {
      return bar.dataset.shareTitleEn || bar.dataset.shareTitle || doc.title;
    }
    return bar.dataset.shareTitle || doc.title;
  };
  const shareUrl = (bar: HTMLElement) => absoluteUrl(bar.dataset.shareUrl || win.location.pathname);
  const xIntent = (url: string, title: string) => `https://x.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;

  for (const bar of bars) {
    const link = bar.querySelector<HTMLAnchorElement>('a[data-share="x"]');
    if (link) link.href = xIntent(shareUrl(bar), shareTitle(bar));
  }

  const copyText = win.CWLUtils?.copyText
    || ((_text: string) => Promise.reject(new Error("CWLUtils.copyText is unavailable")));
  const checkSvg = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';

  const flashCopied = (button: HTMLElement) => {
    if (button.classList.contains("copied")) return;
    const previous = button.innerHTML;
    button.innerHTML = checkSvg;
    button.classList.add("copied");
    win.setTimeout(() => {
      button.innerHTML = previous;
      button.classList.remove("copied");
    }, 1600);
  };

  let overlay: HTMLElement | null = null;
  const closeOverlay = () => {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
    doc.removeEventListener("keydown", onKeydown);
  };
  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") closeOverlay();
  };
  const createIcon = (pathData: string) => {
    const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
    const path = doc.createElementNS("http://www.w3.org/2000/svg", "path");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "1em");
    svg.setAttribute("height", "1em");
    svg.setAttribute("fill", "currentColor");
    svg.setAttribute("aria-hidden", "true");
    path.setAttribute("d", pathData);
    svg.appendChild(path);
    return svg;
  };
  const appendQrSvg = (container: HTMLElement, source: string) => {
    if (!source || !win.DOMParser) return false;
    try {
      const parsed = new win.DOMParser().parseFromString(source, "image/svg+xml");
      const svg = parsed.documentElement;
      if (!svg || svg.nodeName.toLowerCase() !== "svg") return false;
      container.appendChild(doc.importNode(svg, true));
      return true;
    } catch {
      return false;
    }
  };
  const showQr = (url: string, title: string) => {
    closeOverlay();
    let source = "";
    if (typeof win.qrcode === "function") {
      try {
        const qr = win.qrcode(0, "M");
        qr.addData(url);
        qr.make();
        source = qr.createSvgTag({ cellSize: 5, margin: 4, scalable: true });
      } catch {
        source = "";
      }
    }

    overlay = doc.createElement("div");
    overlay.className = "share-qr-overlay";
    const card = doc.createElement("div");
    card.className = "share-qr-card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-label", translate("post.qr.aria", "微信扫码分享"));
    const close = doc.createElement("button");
    close.type = "button";
    close.className = "share-qr-close";
    close.setAttribute("aria-label", translate("post.qr.close", "关闭"));
    close.appendChild(createIcon("M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"));
    const qrTitle = doc.createElement("p");
    qrTitle.className = "share-qr-title";
    qrTitle.textContent = translate("post.qr.title", "微信扫一扫，分享文章");
    const qrCode = doc.createElement("div");
    qrCode.className = "share-qr-code";
    if (!appendQrSvg(qrCode, source)) {
      const failure = doc.createElement("p");
      failure.className = "share-qr-fail";
      failure.textContent = translate("post.qr.fail", "二维码生成失败，可改用“复制链接”。");
      qrCode.appendChild(failure);
    }
    const name = doc.createElement("p");
    name.className = "share-qr-name";
    name.textContent = title;
    card.append(close, qrTitle, qrCode, name);
    overlay.appendChild(card);
    overlay.addEventListener("click", (event) => {
      const target = event.target as Element | null;
      if (target === overlay || target?.closest?.(".share-qr-close")) closeOverlay();
    });
    doc.body.appendChild(overlay);
    doc.addEventListener("keydown", onKeydown);
  };

  doc.addEventListener("click", (event) => {
    const target = event.target as Element | null;
    const trigger = target?.closest<HTMLElement>("[data-share]");
    const bar = trigger?.closest<HTMLElement>(".post-share");
    if (!trigger || !bar) return;
    const url = shareUrl(bar);
    const title = shareTitle(bar);
    const kind = trigger.dataset.share;
    if (kind === "x") {
      if (trigger instanceof win.HTMLAnchorElement) trigger.href = xIntent(url, title);
      return;
    }
    if (kind === "weibo") {
      event.preventDefault();
      win.open(`https://service.weibo.com/share/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`, "_blank", "noopener");
      return;
    }
    if (kind === "copy") {
      event.preventDefault();
      copyText(url).then(() => flashCopied(trigger)).catch(() => showQr(url, title));
      return;
    }
    if (kind === "wechat") {
      event.preventDefault();
      showQr(url, title);
    }
  });
}
