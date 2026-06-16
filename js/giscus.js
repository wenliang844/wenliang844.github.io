(function () {
  /* ------------------------------------------------------------------------
   * Giscus comments (GitHub Discussions powered).
   *
   * To enable: open https://giscus.app, select your repository (Discussions
   * must be enabled), then copy the generated values below.
   * While any of repo / repoId / categoryId is empty the comment area shows a
   * placeholder instead of loading anything.
   *
   * 两种页面共用一个 #giscus-thread 容器：
   *  - 单篇页：按 pathname 映射，直接加载该篇讨论。
   *  - 列表页（data-giscus-mode="switch"）：只加载一个 iframe，切换文章时通过
   *    postMessage(setConfig) 切到对应讨论线程（term = 该篇单篇页 pathname，
   *    与单篇页共用同一条 GitHub Discussion）。避免多实例 iframe 冲突。
   * ---------------------------------------------------------------------- */
  var config = {
    repo: "wenliang844/wenliang844.github.io",
    repoId: "MDEwOlJlcG9zaXRvcnkzNTQyNDE4MDY=",
    category: "Announcements",
    categoryId: "DIC_kwDOFR1NDs4C_PFL",
    mapping: "pathname",
    theme: "preferred_color_scheme",
    lang: "zh-CN"
  };

  var configured = config.repo && config.repoId && config.categoryId;

  function t(key, fallback) {
    return window.cwlT ? window.cwlT(key, fallback) : fallback;
  }

  function placeholder() {
    return '<p class="comments-hint">' + t("dyn.comments.placeholder", "评论区尚未配置。站长在 <code>js/giscus.js</code> 填入 GitHub 仓库的 giscus 配置（repo / repoId / categoryId）后，即可启用基于 GitHub Discussions 的评论。") + '</p>';
  }

  var thread = document.getElementById("giscus-thread");
  if (!thread) {
    return;
  }

  if (!configured) {
    thread.innerHTML = placeholder();
    document.addEventListener("cwl:langchange", function () {
      thread.innerHTML = placeholder();
    });
    return;
  }

  var isSwitchMode = thread.getAttribute("data-giscus-mode") === "switch";

  // 当前激活面板对应的讨论 term（= 该篇单篇页 pathname）。
  function activeTerm() {
    var active = document.querySelector(".blog-article.active[data-post-slug]");
    return active ? "/post/" + active.getAttribute("data-post-slug") + "/" : null;
  }

  function buildScript(opts) {
    opts = opts || {};
    var script = document.createElement("script");
    script.src = "https://giscus.app/client.js";
    script.async = true;
    script.crossOrigin = "anonymous";
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
    script.setAttribute("data-theme", config.theme);
    script.setAttribute("data-lang", config.lang);
    return script;
  }

  /* ---- 单篇页：pathname 映射直接加载 ----------------------------------- */
  if (!isSwitchMode) {
    thread.appendChild(buildScript());
    return;
  }

  /* ---- 列表页：单 iframe + setConfig 切换 ------------------------------ */
  var loadedTerm = null;

  function giscusFrame() {
    return thread.querySelector("iframe.giscus-frame");
  }

  // 通过 postMessage 切换已存在 iframe 的讨论线程。
  function switchTerm(term) {
    var frame = giscusFrame();
    if (!frame || !frame.contentWindow) {
      return false;
    }
    frame.contentWindow.postMessage(
      { giscus: { setConfig: { term: term } } },
      "https://giscus.app"
    );
    return true;
  }

  function showTerm(term) {
    if (!term || term === loadedTerm) {
      return;
    }
    if (!giscusFrame()) {
      // 首次：用 specific 映射 + term 加载唯一 iframe。
      thread.appendChild(buildScript({ mapping: "specific", term: term }));
      loadedTerm = term;
    } else if (switchTerm(term)) {
      loadedTerm = term;
    }
  }

  showTerm(activeTerm());

  // 面板 active 类变化时（树链接 / 搜索 / 标签筛选都经由它）切换讨论线程。
  var observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      var el = mutation.target;
      if (el.classList && el.classList.contains("blog-article") && el.classList.contains("active")) {
        var slug = el.getAttribute("data-post-slug");
        if (slug) {
          showTerm("/post/" + slug + "/");
        }
      }
    });
  });

  document.querySelectorAll(".blog-article").forEach(function (panel) {
    observer.observe(panel, { attributes: true, attributeFilter: ["class"] });
  });

  // 清理：页面卸载时断开 observer，防止内存泄漏
  window.addEventListener("unload", function () {
    if (observer) {
      observer.disconnect();
    }
  });
})();
