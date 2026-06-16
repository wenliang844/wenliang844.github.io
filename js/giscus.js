(function () {
  /* ------------------------------------------------------------------------
   * Giscus comments (GitHub Discussions powered).
   *
   * To enable: open https://giscus.app, select your repository (Discussions
   * must be enabled), then copy the generated values below.
   * While any of repo / repoId / categoryId is empty the comment area shows a
   * placeholder instead of loading anything.
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

  var thread = document.getElementById("giscus-thread");
  if (!thread) {
    return;
  }

  if (!config.repo || !config.repoId || !config.categoryId) {
    thread.innerHTML = '<p class="comments-hint">评论区尚未配置。站长在 <code>js/giscus.js</code> 填入 GitHub 仓库的 giscus 配置（repo / repoId / categoryId）后，即可启用基于 GitHub Discussions 的评论。</p>';
    return;
  }

  var script = document.createElement("script");
  script.src = "https://giscus.app/client.js";
  script.async = true;
  script.crossOrigin = "anonymous";
  script.setAttribute("data-repo", config.repo);
  script.setAttribute("data-repo-id", config.repoId);
  script.setAttribute("data-category", config.category);
  script.setAttribute("data-category-id", config.categoryId);
  script.setAttribute("data-mapping", config.mapping);
  script.setAttribute("data-strict", "0");
  script.setAttribute("data-reactions-enabled", "1");
  script.setAttribute("data-emit-metadata", "0");
  script.setAttribute("data-input-position", "top");
  script.setAttribute("data-theme", config.theme);
  script.setAttribute("data-lang", config.lang);
  thread.appendChild(script);
})();
