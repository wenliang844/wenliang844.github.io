(function () {
  const treeNav = document.querySelector(".post-tree-nav");
  if (!treeNav) {
    return;
  }

  const links = Array.prototype.slice.call(
    document.querySelectorAll(".post-tree-link[data-post-target]")
  );
  if (!links.length) {
    return;
  }

  const searchInput = document.getElementById("post-search-input");
  const tagFilter = document.getElementById("tag-filter");
  const countBadge = document.querySelector(".tree-group .tree-count");

  let items = [];

  let query = "";
  let activeTag = null;

  // Empty-state notice.
  const empty = document.createElement("p");
  empty.className = "tree-empty";
  empty.hidden = true;
  empty.textContent = window.cwlT ? window.cwlT("dyn.blog.empty", "没有匹配的文章，换个关键词或标签试试。") : "没有匹配的文章，换个关键词或标签试试。";
  treeNav.appendChild(empty);

  function t(key, fallback) {
    return window.cwlT ? window.cwlT(key, fallback) : fallback;
  }

  function treeToggleIcon(open) {
    const paths = open
      ? [
        "M8 3v3a2 2 0 0 1-2 2H3",
        "M21 8h-3a2 2 0 0 1-2-2V3",
        "M3 16h3a2 2 0 0 1 2 2v3",
        "M16 21v-3a2 2 0 0 1 2-2h3",
      ]
      : [
        "M8 3H5a2 2 0 0 0-2 2v3",
        "M16 3h3a2 2 0 0 1 2 2v3",
        "M21 16v3a2 2 0 0 1-2 2h-3",
        "M8 21H5a2 2 0 0 1-2-2v-3",
      ];
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "post-tree-fab-icon");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    paths.forEach(function (pathData) {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", pathData);
      svg.appendChild(path);
    });
    return svg;
  }

  function buildItems() {
    items = links.map(function (link) {
      const li = link.closest("li");
      const panel = document.getElementById(link.getAttribute("data-post-target"));
      const tagEls = panel ? Array.prototype.slice.call(panel.querySelectorAll(".post-tags span")) : [];
      const tags = tagEls.map(function (s) {
        return s.dataset.tag || (s.textContent || "").trim();
      });
      const tagLabels = tagEls.map(function (s) {
        return (s.textContent || "").trim();
      });
      const titleEl = link.querySelector(".tree-title");
      const summaryEl = panel ? panel.querySelector(".article-summary") : null;
      const title = titleEl ? titleEl.textContent : "";
      const summary = summaryEl ? summaryEl.textContent : "";
      const haystack = (title + " " + summary + " " + tags.join(" ") + " " + tagLabels.join(" ")).toLowerCase();
      return { link: link, li: li, panel: panel, tags: tags, tagLabels: tagLabels, haystack: haystack };
    });
  }

  function matches(item) {
    const byQuery = !query || item.haystack.indexOf(query) !== -1;
    const byTag = !activeTag || item.tags.indexOf(activeTag) !== -1;
    return byQuery && byTag;
  }

  function apply() {
    const visible = [];
    items.forEach(function (item) {
      const ok = matches(item);
      if (item.li) {
        item.li.hidden = !ok;
      }
      if (ok) {
        visible.push(item);
      }
    });

    if (countBadge) {
      countBadge.textContent = String(visible.length);
    }
    empty.hidden = visible.length !== 0;

    // If the active panel was filtered out, surface the first visible one.
    if (visible.length && typeof window.coderShowPost === "function") {
      const activePanelVisible = visible.some(function (item) {
        return item.panel && item.panel.classList.contains("active");
      });
      if (!activePanelVisible) {
        window.coderShowPost(visible[0].link.getAttribute("data-post-target"), false);
      }
    }
  }

  // ---- Search -------------------------------------------------------------
  if (searchInput) {
    const debouncedSearch = window.CWLUtils && window.CWLUtils.debounce
      ? window.CWLUtils.debounce(function () {
          query = searchInput.value.trim().toLowerCase();
          apply();
        }, 200)
      : function () {
          query = searchInput.value.trim().toLowerCase();
          apply();
        };
    searchInput.addEventListener("input", debouncedSearch);
  }

  // ---- Tag filter ---------------------------------------------------------
  // 把当前激活标签同步进 URL（?tag=），便于复制分享与直达。
  function syncUrl() {
    try {
      const url = new URL(window.location.href);
      if (activeTag) {
        url.searchParams.set("tag", activeTag);
      } else {
        url.searchParams.delete("tag");
      }
      window.history.replaceState(null, "", url);
    } catch (error) {
      // URL 操作失败，不影响核心功能，静默处理
    }
  }

  function setActiveTag(tag) {
    activeTag = activeTag === tag ? null : tag;
    if (tagFilter) {
      Array.prototype.slice.call(tagFilter.children).forEach(function (chip) {
        chip.classList.toggle("active", chip.dataset.tag === activeTag);
      });
    }
    syncUrl();
    apply();
  }

  function collectTagLabels() {
    const seen = {};
    const tags = [];
    const labels = {};
    items.forEach(function (item) {
      item.tags.forEach(function (tag, index) {
        if (tag && !seen[tag]) {
          seen[tag] = true;
          tags.push(tag);
          labels[tag] = item.tagLabels[index] || tag;
        }
      });
    });
    tags.sort(function (a, b) {
      return (labels[a] || a).localeCompare(labels[b] || b, "zh-Hans-CN");
    });
    return { seen: seen, tags: tags, labels: labels };
  }

  function rebuildTagFilter() {
    if (!tagFilter) {return [];}
    const data = collectTagLabels();
    // Clear safely using textContent first to avoid potential XSS
    while (tagFilter.firstChild) {
      tagFilter.removeChild(tagFilter.firstChild);
    }
    data.tags.forEach(function (tag) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "tag-chip";
      chip.dataset.tag = tag;
      chip.textContent = data.labels[tag] || tag;
      chip.classList.toggle("active", tag === activeTag);
      chip.addEventListener("click", function () {
        setActiveTag(tag);
      });
      tagFilter.appendChild(chip);
    });
    if (activeTag && !data.seen[activeTag]) {
      activeTag = null;
    }
    return data.tags;
  }

  if (tagFilter) {
    buildItems();
    const tags = rebuildTagFilter();

    // 支持通过 /post/?tag=<标签> 直达并自动激活筛选。
    try {
      const initialTag = new URL(window.location.href).searchParams.get("tag");
      if (initialTag && tags.indexOf(initialTag) !== -1) {
        setActiveTag(initialTag);
      }
    } catch (error) {
      // URL 参数解析失败，不影响核心功能，静默处理
    }
  }

  // ---- Clickable tags inside each article ---------------------------------
  document.querySelectorAll(".blog-article .post-tags span").forEach(function (span) {
    span.setAttribute("role", "button");
    span.setAttribute("tabindex", "0");
    const tag = span.dataset.tag || (span.textContent || "").trim();
    function trigger() {
      setActiveTag(tag);
      const sidebar = document.querySelector(".post-tree");
      if (sidebar && sidebar.scrollIntoView) {
        sidebar.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
    span.addEventListener("click", trigger);
    span.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        trigger();
      }
    });
  });

  // ---- Vim 风格 J/K 切换文章 ----------------------------------------------
  // 复用 window.coderShowPost（coder.js 暴露）切换可见面板，跳过被筛选隐藏的项。
  function editing() {
    const el = document.activeElement || {};
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
  }

  function visibleItems() {
    return items.filter(function (item) {
      return !item.li || !item.li.hidden;
    });
  }

  function activeIndex(list) {
    for (let i = 0; i < list.length; i++) {
      if (list[i].panel && list[i].panel.classList.contains("active")) {
        return i;
      }
    }
    return -1;
  }

  function move(delta) {
    if (typeof window.coderShowPost !== "function") {
      return;
    }
    const list = visibleItems();
    if (!list.length) {
      return;
    }
    let index = activeIndex(list);
    index = index === -1 ? 0 : index + delta;
    index = Math.max(0, Math.min(list.length - 1, index));
    const target = list[index];
    if (!target) {
      return;
    }
    window.coderShowPost(target.link.getAttribute("data-post-target"), true);
    if (target.link.scrollIntoView) {
      target.link.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  document.addEventListener("keydown", function (event) {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || editing()) {
      return;
    }
    if (event.key === "j" || event.key === "J") {
      event.preventDefault();
      move(1);
    } else if (event.key === "k" || event.key === "K") {
      event.preventDefault();
      move(-1);
    }
  });

  // ---- 移动端浮动侧栏切换 --------------------------------------------------
  const sidebar = document.querySelector(".post-tree");
  if (sidebar) {
    if (!sidebar.id) {
      sidebar.id = "post-tree-sidebar";
    }
    const fab = document.createElement("button");
    fab.type = "button";
    fab.className = "post-tree-fab";
    fab.setAttribute("aria-controls", sidebar.id);

    const collapseBtn = document.createElement("button");
    collapseBtn.type = "button";
    collapseBtn.className = "post-tree-collapse";
    collapseBtn.setAttribute("aria-controls", sidebar.id);

    function updateFab(open) {
      const label = t("dyn.blog.expandTree", "展开文章目录");
      while (fab.firstChild) {
        fab.removeChild(fab.firstChild);
      }
      fab.appendChild(treeToggleIcon(false));
      fab.classList.toggle("is-hidden", open);
      fab.setAttribute("aria-expanded", String(open));
      fab.setAttribute("aria-label", label);
      fab.setAttribute("title", label);
    }

    function updateCollapseButton() {
      const label = t("dyn.blog.collapseTree", "收起文章目录");
      while (collapseBtn.firstChild) {
        collapseBtn.removeChild(collapseBtn.firstChild);
      }
      collapseBtn.appendChild(treeToggleIcon(true));
      collapseBtn.setAttribute("aria-expanded", "true");
      collapseBtn.setAttribute("aria-label", label);
      collapseBtn.setAttribute("title", label);
    }

    const setOpen = function (open) {
      sidebar.classList.toggle("is-floating-open", open);
      document.body.classList.toggle("post-tree-floating", open);
      updateFab(open);
      updateCollapseButton();
    };

    updateFab(false);
    updateCollapseButton();

    fab.addEventListener("click", function () {
      setOpen(true);
    });

    collapseBtn.addEventListener("click", function () {
      setOpen(false);
      fab.focus();
    });

    // 选中文章或点击树链接后自动收起浮层。
    sidebar.addEventListener("click", function (event) {
      if (event.target.closest(".post-tree-link")) {
        setOpen(false);
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && sidebar.classList.contains("is-floating-open")) {
        setOpen(false);
      }
    });

    sidebar.appendChild(collapseBtn);
    document.body.appendChild(fab);
  }

  function refreshI18n() {
    empty.textContent = t("dyn.blog.empty", "没有匹配的文章，换个关键词或标签试试。");
    buildItems();
    rebuildTagFilter();
    apply();
    const fab = document.querySelector(".post-tree-fab");
    if (fab) {
      const open = fab.getAttribute("aria-expanded") === "true";
      const label = t("dyn.blog.expandTree", "展开文章目录");
      fab.classList.toggle("is-hidden", open);
      fab.setAttribute("aria-label", label);
      fab.setAttribute("title", label);
    }
    const collapseBtn = document.querySelector(".post-tree-collapse");
    if (collapseBtn) {
      const label = t("dyn.blog.collapseTree", "收起文章目录");
      collapseBtn.setAttribute("aria-label", label);
      collapseBtn.setAttribute("title", label);
    }
  }

  buildItems();
  document.addEventListener("cwl:langchange", refreshI18n);
  apply();
})();
