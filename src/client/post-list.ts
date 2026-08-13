type BlogWindow = Window & typeof globalThis & {
  CWLUtils?: {
    debounce?: <T extends (...args: any[]) => void>(callback: T, wait: number) => T;
    isEditing?: () => boolean;
    t?: (key: string, fallback: string) => string;
  };
};

type PostItem = {
  link: HTMLAnchorElement;
  listItem: HTMLLIElement | null;
  panel: HTMLElement | null;
  tags: string[];
  tagLabels: string[];
  haystack: string;
};

function treeToggleIcon(doc: Document, open: boolean) {
  const paths = open
    ? ["M8 3v3a2 2 0 0 1-2 2H3", "M21 8h-3a2 2 0 0 1-2-2V3", "M3 16h3a2 2 0 0 1 2 2v3", "M16 21v-3a2 2 0 0 1 2-2h3"]
    : ["M8 3H5a2 2 0 0 0-2 2v3", "M16 3h3a2 2 0 0 1 2 2v3", "M21 16v3a2 2 0 0 1-2 2h-3", "M8 21H5a2 2 0 0 1-2-2v-3"];
  const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "post-tree-fab-icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  for (const pathData of paths) {
    const path = doc.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    svg.appendChild(path);
  }
  return svg;
}

export function initPostList(doc: Document = document, win: BlogWindow = window as BlogWindow) {
  const treeNav = doc.querySelector<HTMLElement>(".post-tree-nav");
  if (!treeNav) return;

  const links = Array.from(doc.querySelectorAll<HTMLAnchorElement>(".post-tree-link[data-post-target]"));
  if (!links.length) return;

  const utils = win.CWLUtils;
  const translate = utils?.t || ((_key: string, fallback: string) => fallback);
  const searchInput = doc.getElementById("post-search-input") as HTMLInputElement | null;
  const tagFilter = doc.getElementById("tag-filter");
  const empty = doc.querySelector<HTMLElement>(".post-list-empty") || doc.createElement("p");
  if (!empty.parentNode) {
    empty.className = "tree-empty";
    empty.hidden = true;
    treeNav.appendChild(empty);
  }

  let query = "";
  let activeTag: string | null = null;
  let items: PostItem[] = [];

  const buildItems = () => {
    items = links.map((link) => {
      const panel = doc.getElementById(link.dataset.postTarget || "");
      const tagElements = panel ? Array.from(panel.querySelectorAll<HTMLElement>(".post-tags [data-tag]")) : [];
      const tags = tagElements.map((tag) => tag.dataset.tag || tag.textContent?.trim() || "");
      const tagLabels = tagElements.map((tag) => tag.textContent?.trim() || "");
      const title = link.querySelector(".tree-title")?.textContent || "";
      const summary = panel?.querySelector(".article-summary")?.textContent || "";
      return {
        link,
        listItem: link.closest("li"),
        panel,
        tags,
        tagLabels,
        haystack: [title, summary, tags.join(" "), tagLabels.join(" ")].join(" ").toLowerCase(),
      };
    });
  };

  const matches = (item: PostItem) => (!query || item.haystack.includes(query))
    && (!activeTag || item.tags.includes(activeTag));

  const showPost = (targetId: string, updateHash: boolean) => {
    const targetItem = items.find((item) => item.panel?.id === targetId);
    const target = targetItem?.panel;
    if (!target) return;
    for (const item of items) {
      const current = item.panel === target;
      item.panel?.classList.toggle("active", current);
      item.link.classList.toggle("active", current);
      if (current) item.link.setAttribute("aria-current", "page");
      else item.link.removeAttribute("aria-current");
    }
    if (updateHash && target.dataset.postSlug) {
      win.history.replaceState(null, "", `#${target.dataset.postSlug}`);
    }
    doc.dispatchEvent(new win.CustomEvent("cwl:postchange", {
      detail: { targetId, slug: target.dataset.postSlug || "" },
    }));
  };

  const updateGroups = () => {
    for (const group of doc.querySelectorAll<HTMLElement>(".tree-group")) {
      const visible = Array.from(group.querySelectorAll("li")).filter((item) => !item.hidden).length;
      const badge = group.querySelector(".tree-count");
      if (badge) badge.textContent = String(visible);
      group.hidden = visible === 0;
    }
  };

  const apply = () => {
    let visibleCount = 0;
    for (const item of items) {
      const visible = matches(item);
      if (item.listItem) item.listItem.hidden = !visible;
      if (item.panel) item.panel.hidden = !visible;
      if (visible) visibleCount += 1;
    }
    updateGroups();
    empty.hidden = visibleCount !== 0;
    empty.textContent = translate("dyn.blog.empty", "没有匹配的文章，换个关键词或标签试试。");
    const activeVisible = items.some((item) => matches(item) && item.panel?.classList.contains("active"));
    if (!activeVisible) {
      const firstVisible = items.find(matches);
      if (firstVisible) showPost(firstVisible.link.dataset.postTarget || "", false);
    }
  };

  const syncUrl = () => {
    try {
      const url = new URL(win.location.href);
      if (activeTag) url.searchParams.set("tag", activeTag);
      else url.searchParams.delete("tag");
      win.history.replaceState(null, "", url);
    } catch {
      // URL synchronization is an enhancement; filtering still works without it.
    }
  };

  const setActiveTag = (tag: string) => {
    activeTag = activeTag === tag ? null : tag;
    if (tagFilter) {
      for (const chip of Array.from(tagFilter.children) as HTMLElement[]) {
        chip.classList.toggle("active", chip.dataset.tag === activeTag);
      }
    }
    syncUrl();
    apply();
  };

  const rebuildTagFilter = () => {
    if (!tagFilter) return [];
    const labels = new Map<string, string>();
    for (const item of items) {
      item.tags.forEach((tag, index) => {
        if (tag && !labels.has(tag)) labels.set(tag, item.tagLabels[index] || tag);
      });
    }
    const tags = [...labels.keys()].sort((a, b) => (labels.get(a) || a).localeCompare(labels.get(b) || b, "zh-Hans-CN"));
    tagFilter.replaceChildren(...tags.map((tag) => {
      const chip = doc.createElement("button");
      chip.type = "button";
      chip.className = "tag-chip";
      chip.dataset.tag = tag;
      chip.textContent = labels.get(tag) || tag;
      chip.classList.toggle("active", tag === activeTag);
      chip.addEventListener("click", () => setActiveTag(tag));
      return chip;
    }));
    if (activeTag && !labels.has(activeTag)) activeTag = null;
    return tags;
  };

  const attachPanelTagHandlers = () => {
    for (const tagElement of doc.querySelectorAll<HTMLElement>(".post-tags [data-tag]")) {
      if (tagElement.tagName !== "BUTTON") {
        tagElement.setAttribute("role", "button");
        tagElement.setAttribute("tabindex", "0");
      }
      const activate = () => {
        setActiveTag(tagElement.dataset.tag || tagElement.textContent?.trim() || "");
        searchInput?.focus();
      };
      tagElement.addEventListener("click", activate);
      tagElement.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      });
    }
  };

  const move = (delta: number) => {
    const visible = items.filter((item) => item.panel && !item.panel.hidden);
    if (!visible.length) return;
    let index = visible.findIndex((item) => item.link.classList.contains("active"));
    index = index === -1
      ? (delta > 0 ? 0 : visible.length - 1)
      : Math.max(0, Math.min(visible.length - 1, index + delta));
    const target = visible[index];
    showPost(target.link.dataset.postTarget || "", true);
    target.link.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
    win.scrollTo({ top: 0, behavior: "smooth" });
  };

  buildItems();
  attachPanelTagHandlers();
  const availableTags = rebuildTagFilter();
  for (const link of links) {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      showPost(link.dataset.postTarget || "", true);
    });
  }

  if (searchInput) {
    const search = () => {
      query = searchInput.value.trim().toLowerCase();
      apply();
    };
    searchInput.addEventListener("input", utils?.debounce ? utils.debounce(search, 200) : search);
  }

  try {
    const initialTag = new URL(win.location.href).searchParams.get("tag");
    if (initialTag && availableTags.includes(initialTag)) setActiveTag(initialTag);
  } catch {
    // Invalid URLs do not block the article list.
  }

  doc.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || utils?.isEditing?.()) return;
    if (event.key === "j" || event.key === "J") {
      event.preventDefault();
      move(1);
    } else if (event.key === "k" || event.key === "K") {
      event.preventDefault();
      move(-1);
    }
  });

  const sidebar = doc.querySelector<HTMLElement>(".post-tree");
  if (sidebar) {
    if (!sidebar.id) sidebar.id = "post-tree-sidebar";
    const existingFab = doc.querySelector<HTMLButtonElement>(".post-tree-fab");
    const fab = existingFab || doc.createElement("button");
    if (!existingFab) {
      fab.type = "button";
      fab.className = "post-tree-fab";
      fab.setAttribute("aria-controls", sidebar.id);
    }
    const collapseButton = doc.createElement("button");
    collapseButton.type = "button";
    collapseButton.className = "post-tree-collapse";
    collapseButton.setAttribute("aria-controls", sidebar.id);

    const replaceIcon = (button: HTMLButtonElement, open: boolean, label: string) => {
      const text = doc.createElement("span");
      text.className = "post-tree-control-label";
      text.textContent = label;
      button.replaceChildren(treeToggleIcon(doc, open), text);
    };
    const updateControls = (open: boolean) => {
      const expandLabel = translate("dyn.blog.expandTree", "展开文章目录");
      const collapseLabel = translate("dyn.blog.collapseTree", "收起文章目录");
      replaceIcon(fab, false, expandLabel);
      replaceIcon(collapseButton, true, collapseLabel);
      fab.classList.toggle("is-hidden", open);
      fab.setAttribute("aria-expanded", String(open));
      fab.setAttribute("aria-label", expandLabel);
      fab.title = expandLabel;
      collapseButton.setAttribute("aria-expanded", "true");
      collapseButton.setAttribute("aria-label", collapseLabel);
      collapseButton.title = collapseLabel;
    };
    const setOpen = (open: boolean) => {
      sidebar.classList.toggle("is-floating-open", open);
      doc.body.classList.toggle("post-tree-floating", open);
      updateControls(open);
    };

    updateControls(false);
    fab.addEventListener("click", () => setOpen(true));
    collapseButton.addEventListener("click", () => {
      setOpen(false);
      fab.focus();
    });
    sidebar.addEventListener("click", (event) => {
      const target = event.target as Element | null;
      if (target?.closest?.(".post-tree-link")) setOpen(false);
    });
    doc.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && sidebar.classList.contains("is-floating-open")) setOpen(false);
    });
    sidebar.appendChild(collapseButton);
    if (!existingFab) (doc.querySelector(".post-detail") || doc.body).prepend(fab);
    doc.addEventListener("cwl:langchange", () => {
      buildItems();
      rebuildTagFilter();
      updateControls(sidebar.classList.contains("is-floating-open"));
      apply();
    });
  }

  if (win.location.hash) {
    const targetSlug = win.location.hash.slice(1).replace(/^post-/, "");
    const current = items.find((item) => item.panel?.dataset.postSlug === targetSlug);
    if (current) showPost(current.link.dataset.postTarget || "", false);
  }
  apply();
}
