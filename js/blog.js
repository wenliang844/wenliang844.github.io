(function () {
  const treeNav = document.querySelector(".post-tree-nav");
  if (!treeNav) {
    return;
  }

  const links = Array.from(document.querySelectorAll(".post-tree-link[data-post-target]"));
  if (!links.length) {
    return;
  }

  const searchInput = document.getElementById("post-search-input");
  const tagFilter = document.getElementById("tag-filter");
  const t = window.CWLUtils.t;
  const empty = document.querySelector(".post-list-empty") || document.createElement("p");
  if (!empty.parentNode) {
    empty.className = "tree-empty";
    empty.hidden = true;
    treeNav.appendChild(empty);
  }
  let query = "";
  let activeTag = null;
  let items = [];

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
      const panel = document.getElementById(link.getAttribute("data-post-target"));
      const tagEls = panel ? Array.from(panel.querySelectorAll(".post-tags [data-tag]")) : [];
      const tags = tagEls.map(function (tag) {
        return tag.dataset.tag || (tag.textContent || "").trim();
      });
      const tagLabels = tagEls.map(function (tag) {
        return (tag.textContent || "").trim();
      });
      const title = link.querySelector(".tree-title");
      const summary = panel ? panel.querySelector(".article-summary") : null;
      const haystack = [
        title ? title.textContent : "",
        summary ? summary.textContent : "",
        tags.join(" "),
        tagLabels.join(" "),
      ].join(" ").toLowerCase();
      return {
        link: link,
        li: link.closest("li"),
        panel: panel,
        tags: tags,
        tagLabels: tagLabels,
        haystack: haystack,
      };
    });
  }

  function matches(item) {
    return (!query || item.haystack.indexOf(query) !== -1)
      && (!activeTag || item.tags.indexOf(activeTag) !== -1);
  }

  function setCurrent(item) {
    if (item && typeof window.coderShowPost === "function") {
      window.coderShowPost(item.link.getAttribute("data-post-target"), true);
      return;
    }
    items.forEach(function (candidate) {
      const current = candidate === item;
      candidate.link.classList.toggle("active", current);
      if (candidate.panel) {
        candidate.panel.classList.toggle("active", current);
      }
    });
  }

  function updateGroups() {
    document.querySelectorAll(".tree-group").forEach(function (group) {
      const visible = Array.from(group.querySelectorAll("li")).filter(function (li) {
        return !li.hidden;
      }).length;
      const badge = group.querySelector(".tree-count");
      if (badge) {
        badge.textContent = String(visible);
      }
      group.hidden = visible === 0;
    });
  }

  function apply() {
    let visibleCount = 0;
    items.forEach(function (item) {
      const visible = matches(item);
      if (item.li) {
        item.li.hidden = !visible;
      }
      if (item.panel) {
        item.panel.hidden = !visible;
      }
      if (visible) {
        visibleCount += 1;
      }
    });
    updateGroups();
    empty.hidden = visibleCount !== 0;
    empty.textContent = t("dyn.blog.empty", "没有匹配的文章，换个关键词或标签试试。");
    const activeVisible = items.some(function (item) {
      return matches(item) && item.panel && item.panel.classList.contains("active");
    });
    if (!activeVisible) {
      const firstVisible = items.find(matches);
      if (firstVisible && typeof window.coderShowPost === "function") {
        window.coderShowPost(firstVisible.link.getAttribute("data-post-target"), false);
      }
    }
  }

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
      // URL synchronization is an enhancement; filtering still works without it.
    }
  }

  function setActiveTag(tag) {
    activeTag = activeTag === tag ? null : tag;
    if (tagFilter) {
      Array.from(tagFilter.children).forEach(function (chip) {
        chip.classList.toggle("active", chip.dataset.tag === activeTag);
      });
    }
    syncUrl();
    apply();
  }

  function collectTags() {
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
    if (!tagFilter) {
      return [];
    }
    const data = collectTags();
    tagFilter.replaceChildren();
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

  function attachPanelTagHandlers() {
    document.querySelectorAll(".post-tags [data-tag]").forEach(function (tagElement) {
      if (tagElement.tagName !== "BUTTON") {
        tagElement.setAttribute("role", "button");
        tagElement.setAttribute("tabindex", "0");
      }
      const activate = function () {
        setActiveTag(tagElement.dataset.tag || (tagElement.textContent || "").trim());
        if (searchInput) {
          searchInput.focus();
        }
      };
      tagElement.addEventListener("click", activate);
      tagElement.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      });
    });
  }

  function visibleItems() {
    return items.filter(function (item) {
      return item.panel && !item.panel.hidden;
    });
  }

  function editing() {
    return Boolean(window.CWLUtils && window.CWLUtils.isEditing && window.CWLUtils.isEditing());
  }

  function move(delta) {
    const visible = visibleItems();
    if (!visible.length) {
      return;
    }
    let index = visible.findIndex(function (item) {
      return item.link.classList.contains("active");
    });
    index = index === -1
      ? (delta > 0 ? 0 : visible.length - 1)
      : Math.max(0, Math.min(visible.length - 1, index + delta));
    const target = visible[index];
    setCurrent(target);
    if (target.link.scrollIntoView) {
      target.link.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  buildItems();
  attachPanelTagHandlers();
  const availableTags = rebuildTagFilter();

  if (searchInput) {
    const search = function () {
      query = searchInput.value.trim().toLowerCase();
      apply();
    };
    searchInput.addEventListener(
      "input",
      window.CWLUtils.debounce ? window.CWLUtils.debounce(search, 200) : search,
    );
  }

  try {
    const initialTag = new URL(window.location.href).searchParams.get("tag");
    if (initialTag && availableTags.indexOf(initialTag) !== -1) {
      setActiveTag(initialTag);
    }
  } catch (error) {
    // Invalid URLs do not block the article list.
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

  const sidebar = document.querySelector(".post-tree");
  if (sidebar) {
    if (!sidebar.id) {
      sidebar.id = "post-tree-sidebar";
    }
    const existingFab = document.querySelector(".post-tree-fab");
    const fab = existingFab || document.createElement("button");
    if (!existingFab) {
      fab.type = "button";
      fab.className = "post-tree-fab";
      fab.setAttribute("aria-controls", sidebar.id);
    }

    const collapseBtn = document.createElement("button");
    collapseBtn.type = "button";
    collapseBtn.className = "post-tree-collapse";
    collapseBtn.setAttribute("aria-controls", sidebar.id);

    const replaceIcon = function (button, open, label) {
      const text = document.createElement("span");
      text.className = "post-tree-control-label";
      text.textContent = label;
      button.replaceChildren(treeToggleIcon(open), text);
    };

    const updateControls = function (open) {
      const expandLabel = t("dyn.blog.expandTree", "展开文章目录");
      const collapseLabel = t("dyn.blog.collapseTree", "收起文章目录");
      replaceIcon(fab, false, expandLabel);
      replaceIcon(collapseBtn, true, collapseLabel);
      fab.classList.toggle("is-hidden", open);
      fab.setAttribute("aria-expanded", String(open));
      fab.setAttribute("aria-label", expandLabel);
      fab.setAttribute("title", expandLabel);
      collapseBtn.setAttribute("aria-expanded", "true");
      collapseBtn.setAttribute("aria-label", collapseLabel);
      collapseBtn.setAttribute("title", collapseLabel);
    };

    const setOpen = function (open) {
      sidebar.classList.toggle("is-floating-open", open);
      document.body.classList.toggle("post-tree-floating", open);
      updateControls(open);
    };

    updateControls(false);
    fab.addEventListener("click", function () {
      setOpen(true);
    });
    collapseBtn.addEventListener("click", function () {
      setOpen(false);
      fab.focus();
    });
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
    const postDetail = document.querySelector(".post-detail");
    if (!existingFab) {
      (postDetail || document.body).prepend(fab);
    }

    document.addEventListener("cwl:langchange", function () {
      buildItems();
      rebuildTagFilter();
      updateControls(sidebar.classList.contains("is-floating-open"));
      apply();
    });
  }

  if (window.location.hash) {
    const target = window.location.hash.slice(1).replace(/^post-/, "");
    const current = items.find(function (item) {
      return item.panel && item.panel.dataset.postSlug === target;
    });
    if (current) {
      setCurrent(current);
    }
  }

  apply();
})();
