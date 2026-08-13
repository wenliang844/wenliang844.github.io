type NextPostWindow = Window & typeof globalThis & {
  CWLUtils?: {
    throttle?: <T extends (...args: any[]) => void>(callback: T, wait: number) => T;
  };
};

export function initNextPost(
  doc: Document = document,
  win: NextPostWindow = window as NextPostWindow,
) {
  const popup = doc.querySelector<HTMLElement>(".next-popup");
  const article = doc.querySelector<HTMLElement>("article.article");
  if (!popup || !article) return;
  const compact = win.matchMedia
    ? win.matchMedia("(max-width: 768px)").matches
    : win.innerWidth <= 768;
  if (compact) return;

  const link = popup.querySelector<HTMLAnchorElement>(".next-popup-link");
  const nextUrl = popup.dataset.nextUrl || link?.getAttribute("href") || win.location.pathname;
  if (link && !link.getAttribute("href")) link.href = nextUrl;
  const dismissKey = `cwl-next-dismissed:${nextUrl}`;
  const dismissed = () => {
    try {
      return win.sessionStorage.getItem(dismissKey) === "1";
    } catch {
      return false;
    }
  };
  const remember = () => {
    try {
      win.sessionStorage.setItem(dismissKey, "1");
    } catch {
      // The recommendation still works when storage is unavailable.
    }
  };
  if (dismissed()) return;

  let shown = false;
  let observer: IntersectionObserver | null = null;
  let cleanupFallback = () => {};
  const cleanup = () => {
    observer?.disconnect();
    cleanupFallback();
  };
  const reveal = () => {
    if (shown) return;
    shown = true;
    popup.hidden = false;
    win.requestAnimationFrame(() => popup.classList.add("is-visible"));
    cleanup();
  };
  const hide = (persist: boolean) => {
    popup.classList.remove("is-visible");
    shown = true;
    if (persist) remember();
    win.setTimeout(() => { popup.hidden = true; }, 320);
    cleanup();
  };
  popup.querySelector(".next-popup-close")?.addEventListener("click", () => hide(true));
  link?.addEventListener("click", remember);

  if (typeof win.IntersectionObserver === "function") {
    const target = article.lastElementChild || article;
    observer = new win.IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) reveal();
    }, { rootMargin: "0px 0px -15% 0px" });
    observer.observe(target);
  } else {
    const check = () => {
      if (!shown && article.getBoundingClientRect().bottom <= win.innerHeight * 0.85) reveal();
    };
    const throttled = win.CWLUtils?.throttle?.(check, 150) || check;
    win.addEventListener("scroll", throttled, { passive: true });
    win.addEventListener("resize", throttled);
    cleanupFallback = () => {
      win.removeEventListener("scroll", throttled);
      win.removeEventListener("resize", throttled);
    };
    check();
  }
  win.addEventListener("pagehide", cleanup, { once: true });
}
