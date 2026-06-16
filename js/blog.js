(function () {
  var treeNav = document.querySelector(".post-tree-nav");
  if (!treeNav) {
    return;
  }

  var links = Array.prototype.slice.call(
    document.querySelectorAll(".post-tree-link[data-post-target]")
  );
  if (!links.length) {
    return;
  }

  var searchInput = document.getElementById("post-search-input");
  var tagFilter = document.getElementById("tag-filter");
  var countBadge = document.querySelector(".tree-group .tree-count");

  var items = [];

  var query = "";
  var activeTag = null;

  // Empty-state notice.
  var empty = document.createElement("p");
  empty.className = "tree-empty";
  empty.hidden = true;
  empty.textContent = window.cwlT ? window.cwlT("dyn.blog.empty", "没有匹配的文章，换个关键词或标签试试。") : "没有匹配的文章，换个关键词或标签试试。";
  treeNav.appendChild(empty);

  function t(key, fallback) {
    return window.cwlT ? window.cwlT(key, fallback) : fallback;
  }

  function buildItems() {
    items = links.map(function (link) {
      var li = link.closest("li");
      var panel = document.getElementById(link.getAttribute("data-post-target"));
      var tagEls = panel ? Array.prototype.slice.call(panel.querySelectorAll(".post-tags span")) : [];
      var tags = tagEls.map(function (s) {
        return s.dataset.tag || (s.textContent || "").trim();
      });
      var tagLabels = tagEls.map(function (s) {
        return (s.textContent || "").trim();
      });
      var titleEl = link.querySelector(".tree-title");
      var summaryEl = panel ? panel.querySelector(".article-summary") : null;
      var title = titleEl ? titleEl.textContent : "";
      var summary = summaryEl ? summaryEl.textContent : "";
      var haystack = (title + " " + summary + " " + tags.join(" ") + " " + tagLabels.join(" ")).toLowerCase();
      return { link: link, li: li, panel: panel, tags: tags, tagLabels: tagLabels, haystack: haystack };
    });
  }

  function matches(item) {
    var byQuery = !query || item.haystack.indexOf(query) !== -1;
    var byTag = !activeTag || item.tags.indexOf(activeTag) !== -1;
    return byQuery && byTag;
  }

  function apply() {
    var visible = [];
    items.forEach(function (item) {
      var ok = matches(item);
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
      var activePanelVisible = visible.some(function (item) {
        return item.panel && item.panel.classList.contains("active");
      });
      if (!activePanelVisible) {
        window.coderShowPost(visible[0].link.getAttribute("data-post-target"), false);
      }
    }
  }

  // ---- Search -------------------------------------------------------------
  if (searchInput) {
    searchInput.addEventListener("input", function () {
      query = searchInput.value.trim().toLowerCase();
      apply();
    });
  }

  // ---- Tag filter ---------------------------------------------------------
  // 把当前激活标签同步进 URL（?tag=），便于复制分享与直达。
  function syncUrl() {
    try {
      var url = new URL(window.location.href);
      if (activeTag) {
        url.searchParams.set("tag", activeTag);
      } else {
        url.searchParams.delete("tag");
      }
      window.history.replaceState(null, "", url);
    } catch (error) {}
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
    var seen = {};
    var tags = [];
    var labels = {};
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
    if (!tagFilter) return [];
    var data = collectTagLabels();
    tagFilter.innerHTML = "";
    data.tags.forEach(function (tag) {
      var chip = document.createElement("button");
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
    var tags = rebuildTagFilter();

    // 支持通过 /post/?tag=<标签> 直达并自动激活筛选。
    try {
      var initialTag = new URL(window.location.href).searchParams.get("tag");
      if (initialTag && tags.indexOf(initialTag) !== -1) {
        setActiveTag(initialTag);
      }
    } catch (error) {}
  }

  // ---- Clickable tags inside each article ---------------------------------
  document.querySelectorAll(".blog-article .post-tags span").forEach(function (span) {
    span.setAttribute("role", "button");
    span.setAttribute("tabindex", "0");
    var tag = span.dataset.tag || (span.textContent || "").trim();
    function trigger() {
      setActiveTag(tag);
      var sidebar = document.querySelector(".post-tree");
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
