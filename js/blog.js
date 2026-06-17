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

  function refreshI18n() {
    empty.textContent = t("dyn.blog.empty", "没有匹配的文章，换个关键词或标签试试。");
    buildItems();
    rebuildTagFilter();
    apply();
  }

  buildItems();
  document.addEventListener("cwl:langchange", refreshI18n);
  apply();
})();
