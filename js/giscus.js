(function () {
  const config = Object.assign({
    repo: "wenliang844/wenliang844.github.io",
    repoId: "MDEwOlJlcG9zaXRvcnkzNTQyNDE4MDY=",
    category: "Announcements",
    categoryId: "DIC_kwDOFR1NDs4C_PFL",
    mapping: "pathname",
    theme: "preferred_color_scheme",
    lang: "zh-CN"
  }, window.CWL_GISCUS_CONFIG || {});

  const configured = config.repo && config.repoId && config.categoryId;
  const LOAD_TIMEOUT = 12000;

  const t = window.CWLUtils.t;

  function createPlaceholder() {
    const message = t("dyn.comments.placeholder", "评论区尚未配置。站长在 <code>js/giscus.js</code> 填入 GitHub 仓库的 giscus 配置（repo / repoId / categoryId）后，即可启用基于 GitHub Discussions 的评论。");
    const p = document.createElement("p");
    p.className = "comments-hint";

    const codeMatch = message.match(/<code>(.*?)<\/code>/);
    if (!codeMatch) {
      p.textContent = message;
      return p;
    }

    const before = message.slice(0, codeMatch.index);
    const after = message.slice(codeMatch.index + codeMatch[0].length);
    const code = document.createElement("code");
    code.textContent = codeMatch[1];

    p.appendChild(document.createTextNode(before));
    p.appendChild(code);
    p.appendChild(document.createTextNode(after));
    return p;
  }

  function renderPlaceholder() {
    thread.replaceChildren(createPlaceholder());
  }

  function renderLoadFailure(reason) {
    const p = document.createElement("p");
    p.className = "comments-hint";
    p.textContent = t("dyn.comments.loadFail", "评论加载失败，可稍后重试或通过留言页反馈。");
    thread.replaceChildren(p);
    if (window.CWLLogger && typeof window.CWLLogger.warn === "function") {
      window.CWLLogger.warn("Giscus load failed", { reason: reason || "unknown" });
    }
  }

  const thread = document.getElementById("giscus-thread");
  if (!thread) {
    return;
  }

  if (!configured) {
    renderPlaceholder();
    document.addEventListener("cwl:langchange", function () {
      renderPlaceholder();
    });
    return;
  }

  const isSwitchMode = thread.getAttribute("data-giscus-mode") === "switch";
  let commentsStarted = false;
  let lazyObserver = null;

  function activeTerm() {
    const active = document.querySelector(".blog-article.active[data-post-slug]");
    return active ? "/post/" + active.getAttribute("data-post-slug") + "/" : null;
  }

  function giscusLang() {
    return window.cwlLang && window.cwlLang() === "en" ? "en" : config.lang;
  }

  function giscusTheme() {
    const classes = document.body.classList;
    return classes.contains("colorscheme-dark") ? "dark" : classes.contains("colorscheme-light") ? "light" : config.theme;
  }

  function buildScript(opts) {
    opts = opts || {};
    const script = document.createElement("script");
    let settled = false;
    const failTimer = window.setTimeout(function () {
      if (settled) {
        return;
      }
      settled = true;
      renderLoadFailure("timeout");
    }, LOAD_TIMEOUT);
    function settle() {
      if (!settled) {
        settled = true;
      }
      window.clearTimeout(failTimer);
    }
    script.src = "https://giscus.app/client.js";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = settle;
    script.onerror = function () {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(failTimer);
      renderLoadFailure("script-error");
    };
    script.setAttribute("data-repo", config.repo);
    script.setAttribute("data-repo-id", config.repoId);
    script.setAttribute("data-category", config.category);
    script.setAttribute("data-category-id", config.categoryId);
    script.setAttribute("data-mapping", opts.mapping || config.mapping);
    if (opts.term) {
      script.setAttribute("data-term", opts.term);
    }
    script.setAttribute("data-strict", "0");
    script.setAttribute("data-reactions-enabled", "1");
    script.setAttribute("data-emit-metadata", "0");
    script.setAttribute("data-input-position", "top");
    script.setAttribute("data-theme", giscusTheme());
    script.setAttribute("data-lang", giscusLang());
    return script;
  }

  let loadedTerm = null;

  function giscusFrame() {
    return thread.querySelector("iframe.giscus-frame");
  }

  function setGiscusConfig(partial) {
    const frame = giscusFrame();
    if (!frame || !frame.contentWindow) {
      return false;
    }
    frame.contentWindow.postMessage({ giscus: { setConfig: partial } }, "https://giscus.app");
    return true;
  }

  function switchTerm(term) {
    return setGiscusConfig({ term: term });
  }

  function showTerm(term) {
    if (!term || term === loadedTerm) {
      return;
    }
    if (!giscusFrame()) {
      thread.appendChild(buildScript({ mapping: "specific", term: term }));
      loadedTerm = term;
    } else if (switchTerm(term)) {
      loadedTerm = term;
    }
  }

  function loadCommentsOnce() {
    if (commentsStarted) {
      return;
    }
    commentsStarted = true;
    if (lazyObserver) {
      lazyObserver.disconnect();
      lazyObserver = null;
    }
    if (!isSwitchMode) {
      thread.appendChild(buildScript());
      return;
    }
    showTerm(activeTerm());
  }

  function scheduleCommentsLoad() {
    if (!("IntersectionObserver" in window)) {
      loadCommentsOnce();
      return;
    }
    lazyObserver = new IntersectionObserver(function (entries) {
      if (entries.some(function (entry) { return entry.isIntersecting; })) {
        loadCommentsOnce();
      }
    }, { rootMargin: "600px 0px" });
    lazyObserver.observe(thread);
  }

  if (!isSwitchMode) {
    scheduleCommentsLoad();
    return;
  }

  scheduleCommentsLoad();

  const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      const el = mutation.target;
      if (el.classList && el.classList.contains("blog-article") && el.classList.contains("active")) {
        const slug = el.getAttribute("data-post-slug");
        if (slug && commentsStarted) {
          showTerm("/post/" + slug + "/");
        }
      }
    });
  });

  document.querySelectorAll(".blog-article").forEach(function (panel) {
    observer.observe(panel, { attributes: true, attributeFilter: ["class"] });
  });

  document.addEventListener("cwl:langchange", function () { setGiscusConfig({ lang: giscusLang() }); });

  document.addEventListener("cwl:themechange", function (event) {
    setGiscusConfig({ theme: (event.detail || {}).actualTheme || giscusTheme() });
  });

  window.addEventListener("pagehide", function () {
    if (lazyObserver) {
      lazyObserver.disconnect();
      lazyObserver = null;
    }
    if (observer) {
      observer.disconnect();
    }
  });
})();
