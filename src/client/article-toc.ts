export function initArticleToc(doc: Document = document, win: Window & typeof globalThis = window) {
  const sidebar = doc.querySelector<HTMLElement>(".toc-sidebar");
  if (!sidebar) return;

  const toggle = sidebar.querySelector<HTMLButtonElement>(".toc-toggle");
  const links = Array.from(sidebar.querySelectorAll<HTMLAnchorElement>(".toc-nav a"));
  const article = doc.querySelector(".article-content");
  const currentScrollY = () => win.scrollY || doc.documentElement.scrollTop || 0;
  const setOpen = (open: boolean) => {
    if (!toggle) return;
    sidebar.classList.toggle("is-open", open);
    sidebar.classList.toggle("is-collapsed", !open);
    toggle.setAttribute("aria-expanded", String(open));
    doc.body.classList.toggle("toc-open", open);
  };

  if (toggle) {
    const desktopDefault = win.matchMedia?.("(min-width: 1201px)").matches;
    setOpen(Boolean(desktopDefault || toggle.getAttribute("aria-expanded") !== "false"));
    toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
  }

  if (!links.length || !article) return;
  const headings = Array.from(article.querySelectorAll<HTMLElement>("h2[id], h3[id]"));
  const updateActiveLink = (id: string) => {
    for (const link of links) link.classList.toggle("active", link.getAttribute("href") === `#${id}`);
  };

  if ("IntersectionObserver" in win && typeof win.IntersectionObserver === "function") {
    const observer = new win.IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) updateActiveLink((entry.target as HTMLElement).id);
      }
    }, { rootMargin: "-80px 0px -80% 0px", threshold: 0 });
    for (const heading of headings) observer.observe(heading);
  }

  for (const link of links) {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const targetId = link.getAttribute("href")?.slice(1) || "";
      const target = doc.getElementById(targetId);
      if (!target) return;
      const top = target.getBoundingClientRect().top + currentScrollY() - 80;
      win.scrollTo({ top, behavior: "smooth" });
      win.history.replaceState(null, "", `#${targetId}`);
      updateActiveLink(targetId);
      if (win.matchMedia?.("(max-width: 1200px)").matches) setOpen(false);
    });
  }

  const hashTarget = win.location.hash ? doc.getElementById(win.location.hash.slice(1)) : null;
  if (hashTarget) {
    win.setTimeout(() => {
      const top = hashTarget.getBoundingClientRect().top + currentScrollY() - 80;
      win.scrollTo({ top, behavior: "smooth" });
      updateActiveLink(hashTarget.id);
    }, 100);
  }
}
