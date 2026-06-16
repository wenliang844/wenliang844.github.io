(function () {
  /* ------------------------------------------------------------------------
   * 全局模糊搜索（Fuse.js）。
   *
   * - 首次打开弹窗时懒加载 /js/vendor/fuse.min.js 与 /search-index.json；
   * - 快捷键 "/" 或 Ctrl/Cmd+K 打开，Escape 关闭；
   * - 搜索范围：文章标题、摘要、标签、正文纯文本。
   * ---------------------------------------------------------------------- */
  var nav = document.querySelector(".navigation");
  if (!nav) {
    return;
  }

  /* ---- DOM -------------------------------------------------------------- */
  var overlay = document.createElement("div");
  overlay.className = "search-modal";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "搜索文章");
  overlay.innerHTML =
    '<div class="search-modal-card">' +
    '<div class="search-modal-head">' +
    '<i class="fas fa-search" aria-hidden="true"></i>' +
    '<input class="search-modal-input" type="text" placeholder="搜索文章标题、标签、内容…" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="false" aria-controls="search-modal-results" aria-autocomplete="list">' +
    '<button class="search-modal-clear" type="button" aria-label="清空搜索"><i class="fas fa-times" aria-hidden="true"></i></button>' +
    '<kbd class="search-modal-kbd">Esc</kbd>' +
    '</div>' +
    '<ul class="search-modal-results" id="search-modal-results" role="listbox"></ul>' +
    '<p class="search-modal-empty">输入关键词开始搜索</p>' +
    '<div class="search-modal-foot"><span>↑↓ 选择</span><span>Enter 打开</span><span>Ctrl/⌘ K 搜索</span></div>' +
    '</div>';

  var input     = overlay.querySelector(".search-modal-input");
  var clearBtn  = overlay.querySelector(".search-modal-clear");
  var list      = overlay.querySelector(".search-modal-results");
  var emptyMsg  = overlay.querySelector(".search-modal-empty");
  var trigger   = nav.querySelector(".nav-search-trigger");
  var fuse      = null;
  var indexData = [];
  var activeData = [];
  var loadTask  = null;
  var results   = [];
  var selected  = -1;
  var lastActive = null;
  var oldOverflow = "";

  document.body.appendChild(overlay);

  /* ---- helpers ---------------------------------------------------------- */
  function t(key, fallback) {
    return window.cwlT ? window.cwlT(key, fallback) : fallback;
  }

  function applyI18n() {
    overlay.setAttribute("aria-label", t("dyn.search.aria", "搜索文章"));
    input.setAttribute("placeholder", t("dyn.search.ph", "搜索文章标题、标签、内容…"));
    clearBtn.setAttribute("aria-label", t("dyn.search.clear", "清空搜索"));
    if (trigger) {
      trigger.setAttribute("aria-label", t("nav.search", "全局搜索"));
    }
    var foot = overlay.querySelector(".search-modal-foot");
    if (foot) {
      foot.innerHTML = "<span>" + t("dyn.search.nav", "↑↓ 选择") + "</span>" +
        "<span>" + t("dyn.search.open", "Enter 打开") + "</span>" +
        "<span>" + t("dyn.search.shortcut", "Ctrl/⌘ K 搜索") + "</span>";
    }
    if (overlay.classList.contains("open")) {
      render();
    } else {
      emptyMsg.textContent = t("dyn.search.start", "输入关键词开始搜索");
    }
  }

  function editing() {
    var tag = (document.activeElement || {}).tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" ||
      (document.activeElement || {}).isContentEditable;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function labelFor(item) {
    return item.type === "page" ? t("dyn.search.kind.page", "页面") : t("dyn.search.kind.post", "文章");
  }

  function currentLang() {
    return window.cwlLang ? window.cwlLang() : "zh";
  }

  function localizedItem(item) {
    if (currentLang() !== "en" || !item.i18n || !item.i18n.en) {
      return item;
    }
    var en = item.i18n.en;
    var copy = {};
    Object.keys(item).forEach(function (key) {
      copy[key] = item[key];
    });
    ["title", "shortTitle", "summary", "tags", "body"].forEach(function (key) {
      if (en[key]) {
        copy[key] = en[key];
      }
    });
    return copy;
  }

  function buildFuse() {
    activeData = indexData.map(localizedItem);
    fuse = new window.Fuse(activeData, {
      keys: [
        { name: "title",      weight: 3 },
        { name: "shortTitle", weight: 2.5 },
        { name: "tags",       weight: 2 },
        { name: "summary",    weight: 1.5 },
        { name: "body",       weight: 1 },
        { name: "path",       weight: 0.4 },
      ],
      threshold: 0.35,
      includeScore: true,
      includeMatches: true,
      findAllMatches: true,
      minMatchCharLength: 2,
      ignoreLocation: true,
    });
  }

  function formatDate(date) {
    return date ? String(date).replace(/-/g, ".") : "";
  }

  function open() {
    list.innerHTML = "";
    emptyMsg.textContent = t("dyn.search.start", "输入关键词开始搜索");
    emptyMsg.style.display = "";
    input.value = "";
    results = [];
    selected = -1;
    lastActive = document.activeElement;
    oldOverflow = document.body.style.overflow;
    overlay.classList.add("open");
    document.body.classList.add("search-open");
    input.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
    window.setTimeout(function () { input.focus(); }, 60);
    loadIndex().then(render).catch(function () {
      setEmpty("搜索索引加载失败，请稍后重试");
    });
  }

  function close() {
    overlay.classList.remove("open");
    document.body.classList.remove("search-open");
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    document.body.style.overflow = oldOverflow;
    if (lastActive && lastActive.focus) {
      lastActive.focus();
    }
  }

  /* ---- lazy-load Fuse + index ------------------------------------------- */
  function loadScript(src, cb, fail) {
    if (document.querySelector('script[src="' + src + '"]')) {
      waitForFuse(cb, fail);
      return;
    }
    var s = document.createElement("script");
    s.src = src;
    s.onload = cb;
    s.onerror = function () {
      fuse = null;
      if (fail) { fail(new Error("Fuse script failed")); }
    };
    document.head.appendChild(s);
  }

  function waitForFuse(cb, fail) {
    if (window.Fuse) {
      cb();
      return;
    }
    var tries = 0;
    var timer = window.setInterval(function () {
      tries += 1;
      if (window.Fuse || tries > 40) {
        window.clearInterval(timer);
        if (window.Fuse) {
          cb();
        } else if (fail) {
          fail(new Error("Fuse script timeout"));
        }
      }
    }, 50);
  }

  function loadIndex() {
    if (fuse) { return Promise.resolve(fuse); }
    if (loadTask) { return loadTask; }

    loadTask = new Promise(function (resolve, reject) {
      function fetchIndex() {
        fetch("/search-index.json", { cache: "no-cache" })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          indexData = Array.isArray(data) ? data : [];
          buildFuse();
          resolve(fuse);
        })
        .catch(function (error) {
          fuse = null;
          loadTask = null;
          reject(error);
        });
      }

      if (window.Fuse) {
        fetchIndex();
      } else {
        loadScript("/js/vendor/fuse.min.js", fetchIndex, reject);
      }
    });

    return loadTask;
  }

  /* ---- render results --------------------------------------------------- */
  function highlightText(text, query) {
    var raw = String(text || "");
    var html = escapeHtml(raw);
    if (!query) { return html; }
    return html.replace(new RegExp("(" + escapeRegExp(query) + ")", "gi"), "<mark>$1</mark>");
  }

  function snippet(text, query) {
    if (!text) { return ""; }
    var lower = text.toLowerCase();
    var idx   = lower.indexOf(query.toLowerCase());
    if (idx === -1) { return escapeHtml(text.slice(0, 150)); }
    var start = Math.max(0, idx - 40);
    var end   = Math.min(text.length, idx + query.length + 100);
    var s = (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
    return highlightText(s, query);
  }

  function bestText(item) {
    return item.summary || item.body || item.path || "";
  }

  function openResult(idx) {
    if (!results[idx]) { return; }
    var path = results[idx].item.path;
    if (path) { window.location.href = path; }
  }

  function setEmpty(message) {
    list.innerHTML = "";
    results = [];
    selected = -1;
    input.removeAttribute("aria-activedescendant");
    emptyMsg.textContent = message;
    emptyMsg.style.display = "";
  }

  function render() {
    var query = input.value.trim();
    clearBtn.classList.toggle("visible", !!query);
    if (!query) {
      setEmpty(t("dyn.search.start", "输入关键词开始搜索"));
      return;
    }
    if (!fuse) {
      setEmpty(t("dyn.search.loading", "正在加载搜索索引…"));
      loadIndex().then(render).catch(function () {
        setEmpty(t("dyn.search.loadFail", "搜索索引加载失败，请稍后重试"));
      });
      return;
    }

    results = fuse.search(query).slice(0, 10);
    selected = results.length ? 0 : -1;

    if (!results.length) {
      setEmpty(activeData.length ? t("dyn.search.noMatch", "没有找到匹配内容，换个关键词试试") : t("dyn.search.indexEmpty", "搜索索引为空"));
      return;
    }

    emptyMsg.style.display = "none";
    list.innerHTML = results.map(function (r, i) {
      var item = r.item;
      var id = "search-result-" + i;
      var tags = (item.tags || []).map(function (t) { return "<span>" + highlightText(t, query) + "</span>"; }).join("");
      var title = highlightText(item.title || item.shortTitle || item.path, query);
      var date = formatDate(item.date);
      return '<li id="' + id + '" role="option" aria-selected="' + (i === 0 ? "true" : "false") + '" data-idx="' + i + '" class="' + (i === 0 ? "selected" : "") + '">' +
        '<div class="search-result-top">' +
        '<span class="search-result-kind">' + labelFor(item) + '</span>' +
        (date ? '<span class="search-result-date">' + escapeHtml(date) + '</span>' : '') +
        '</div>' +
        '<div class="search-result-title">' + title + '</div>' +
        '<div class="search-result-meta">' + escapeHtml(item.path) +
        (tags ? ' <span class="search-result-tags">' + tags + '</span>' : '') + '</div>' +
        '<div class="search-result-snippet">' + snippet(bestText(item), query) + '</div>' +
        '</li>';
    }).join("");
    updateSelected();
  }

  /* ---- keyboard --------------------------------------------------------- */
  input.addEventListener("input", render);

  input.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { close(); return; }
    if (!results.length) { return; }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      selected = (selected + 1) % results.length;
      updateSelected();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      selected = (selected - 1 + results.length) % results.length;
      updateSelected();
      return;
    }
    if (e.key === "Enter" && selected >= 0) {
      e.preventDefault();
      openResult(selected);
    }
  });

  function updateSelected() {
    var items = list.children;
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle("selected", i === selected);
      items[i].setAttribute("aria-selected", i === selected ? "true" : "false");
    }
    if (items[selected]) {
      input.setAttribute("aria-activedescendant", items[selected].id);
      items[selected].scrollIntoView({ block: "nearest" });
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  }

  /* ---- click handlers --------------------------------------------------- */
  list.addEventListener("click", function (e) {
    var li = e.target.closest("li");
    if (!li) { return; }
    var idx = parseInt(li.getAttribute("data-idx"), 10);
    openResult(idx);
  });

  clearBtn.addEventListener("click", function () {
    input.value = "";
    render();
    input.focus();
  });

  if (trigger) {
    trigger.addEventListener("click", function (e) {
      e.preventDefault();
      open();
    });
  }

  overlay.addEventListener("mousedown", function (e) {
    if (e.target === overlay) { close(); }
  });

  /* ---- global shortcuts ------------------------------------------------- */
  document.addEventListener("keydown", function (e) {
    var modalOpen = overlay.classList.contains("open");

    if (e.key === "Escape" && modalOpen) {
      close();
      return;
    }

    if (e.key === "/" && !modalOpen && !editing()) {
      e.preventDefault();
      open();
      return;
    }

    if (e.key === "/" && modalOpen && !input.value) {
      e.preventDefault();
      close();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      modalOpen ? close() : open();
    }
  });

  document.addEventListener("cwl:langchange", function () {
    if (indexData.length && window.Fuse) {
      buildFuse();
    }
    applyI18n();
  });
  applyI18n();
})();
