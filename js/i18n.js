// 中英双语 UI 切换（客户端，不改 URL）。
// 设计：英文文案存放在下面的 EN 字典；中文文案保留在 HTML 原文里，
// 首次运行时按 data-i18n* 属性把原文缓存为 zh 版本。这样：
//   - 不在 JS 里重复维护一份中文；
//   - 禁用 JS 时页面仍显示中文（降级）。
// 元素标记方式：
//   data-i18n        → 替换 textContent
//   data-i18n-html   → 替换 innerHTML（文本里含 <i>/<br> 等）
//   data-i18n-aria   → 替换 aria-label
//   data-i18n-ph     → 替换 placeholder
//   data-i18n-title  → 替换 title 属性
//   data-i18n-en*    → 由构建模板直接写入的英文文案（用于文章等生成内容）
//   data-i18n-lang   → 显隐整块中/英文内容
// <title> 与 meta[name=description] 用 head.* 键单独处理。
(function () {
  var KEY = "cwl-lang";
  var ATTRS = [
    {
      attr: "data-i18n-html",
      selector: "[data-i18n-html]",
      key: function (el) { return el.getAttribute("data-i18n-html") || el.getAttribute("data-i18n"); },
      read: function (el) { return el.innerHTML; },
      inline: function (el) { return el.getAttribute("data-i18n-en-html") || el.getAttribute("data-i18n-en"); },
      apply: function (el, v) { el.innerHTML = v; }
    },
    {
      attr: "data-i18n",
      selector: "[data-i18n]:not([data-i18n-html])",
      key: function (el) { return el.getAttribute("data-i18n"); },
      read: function (el) { return el.textContent; },
      inline: function (el) { return el.getAttribute("data-i18n-en"); },
      apply: function (el, v) { el.textContent = v; }
    },
    {
      attr: "data-i18n-aria",
      selector: "[data-i18n-aria]",
      key: function (el) { return el.getAttribute("data-i18n-aria"); },
      read: function (el) { return el.getAttribute("aria-label") || ""; },
      inline: function (el) { return el.getAttribute("data-i18n-en-aria"); },
      apply: function (el, v) { el.setAttribute("aria-label", v); }
    },
    {
      attr: "data-i18n-ph",
      selector: "[data-i18n-ph]",
      key: function (el) { return el.getAttribute("data-i18n-ph"); },
      read: function (el) { return el.getAttribute("placeholder") || ""; },
      inline: function (el) { return el.getAttribute("data-i18n-en-ph"); },
      apply: function (el, v) { el.setAttribute("placeholder", v); }
    },
    {
      attr: "data-i18n-title",
      selector: "[data-i18n-title]",
      key: function (el) { return el.getAttribute("data-i18n-title"); },
      read: function (el) { return el.getAttribute("title") || ""; },
      inline: function (el) { return el.getAttribute("data-i18n-en-title"); },
      apply: function (el, v) { el.setAttribute("title", v); }
    },
  ];

  // 英文字典。键名用点分命名空间，与 HTML 上的 data-i18n* 值一一对应。
  var EN = {
    // 通用
    "nav.main": "Main navigation",
    "nav.menu": "Toggle menu",
    "nav.about": "About",
    "nav.blog": "Blog",
    "nav.editor": "Editor",
    "nav.overleaf": "Overleaf",
    "nav.contact": "Contact",
    "nav.feedback": '<i class="fas fa-comment-dots" aria-hidden="true"></i> Feedback',
    "nav.theme": "Toggle dark mode",
    "nav.search": "Global search",
    "footer.text": "© 2021 - 2026 CWL · Powered by Hugo · Theme inspired by Coder",
    "head.title.home": "CWLBlog",
    "head.desc.home": "CWL · An AI-native full-stack engineer's blog on AI pair-programming (Claude / Codex), Java, Spring and engineering practice.",
    "head.title.about": "About :: CWLBlog",
    "head.desc.about": "About CWL and the blog.",
    "head.title.contact": "Contact :: CWLBlog",
    "head.desc.contact": "Contact information.",
    "head.title.editor": "Markdown Editor :: CWLBlog",
    "head.desc.editor": "Online Markdown blog editor.",
    "head.title.overleaf": "Overleaf Resume :: CWLBlog",
    "head.desc.overleaf": "Overleaf-style LaTeX resume template with two-way source and preview editing plus PDF download.",
    "head.title.posts": "Posts :: CWLBlog",
    "head.desc.posts": "2026 tech project retrospectives: video intelligence, rule engine, finance SaaS, low-code, workflow and engineering practice.",
    "head.title.tags": "Tags :: CWLBlog",
    "head.desc.tags": "Blog tags: browse CWL's project retrospectives and engineering notes by topic.",
    "head.title.categories": "Categories :: CWLBlog",
    "head.desc.categories": "Blog categories.",
    "head.title.notfound": "404 Page not found",
    "head.desc.notfound": "Page not found.",

    // 首页 home
    "home.hero": 'AI-Native Full-Stack Engineer<br><span class="hero-tagline">AI 全栈工程师</span>',
    "home.btn.blog": '<i class="fas fa-folder-open" aria-hidden="true"></i> Browse Blog',
    "home.btn.about": '<i class="fas fa-envelope" aria-hidden="true"></i> Contact Author',
    "home.ai.title": "AI Collaboration Toolchain",
    "home.ai.sub": "AI drives full-stack development at the core. Below are the two “AI teammates” I work with daily.",
    "home.ai.claude.desc": "Anthropic's AI model, known for its long context window and rigorous reasoning. Used daily for architecture design, untangling complex business logic, code generation and refactoring — a true pair-programming partner.",
    "home.ai.claude.t1": "Pair Programming",
    "home.ai.claude.t2": "Architecture",
    "home.ai.claude.t3": "Refactoring",
    "home.ai.codex.desc": "OpenAI's coding agent that understands an entire repository and autonomously handles coding, debugging and testing. Used for automated development and repo-level refactoring, accelerating the path from requirement to release.",
    "home.ai.codex.t1": "Autonomous Coding",
    "home.ai.codex.t2": "Repo-level Refactor",
    "home.ai.codex.t3": "Test Generation",
    "home.feat.title": "Featured Projects",
    "home.feat.sub": "From video intelligence to a low-code platform — the systems I've built over the years.",
    "home.feat.link": 'View all <i class="fas fa-arrow-right" aria-hidden="true"></i>',
    "home.proj.video.title": "Video Intelligence System",
    "home.proj.video.desc": "Backend refactor of the capture → algorithm → rules → alerting pipeline, with multi-module Maven and a platformized algorithm layer.",
    "home.proj.finance.title": "Qiangu Finance SaaS",
    "home.proj.finance.desc": "Financial report computation, an ElasticSearch Starter and a multi-channel notification center.",
    "home.proj.lowcode.title": "Trantor Low-Code Platform",
    "home.proj.lowcode.desc": "Designer, material protocol and a Web Worker code-gen pipeline that makes page building extensible.",
    "home.proj.activiti.title": "Activiti Approval Engine",
    "home.proj.activiti.desc": "A lightweight BPM engine on Activiti 7, with process deployment and task runtime management.",
    "home.skills.title": "Core Skills",
    "home.skills.sub": "Backend-focused, spanning workflow, low-code and engineering practice.",

    "home.exp.title": "Work & Project Timeline",
    "home.exp.sub": "Two backend engineering roles spanning intelligent analysis, SaaS, low-code and workflow.",
    "home.exp.j1.date": "2023.09 — Present",
    "home.exp.j1.org": " · Java Engineer",
    "home.exp.j1.desc": "Led the backend refactor of a video intelligence system, consolidating capture/algorithm/rules/alerting into multi-module Maven; helped platformize the algorithm service; and owned backend design and development for police inspection, finance SaaS, an approval-flow engine and a low-code platform, while driving shared components, Starters and engineering practice.",
    "home.exp.j2.date": "2022.09 — 2023.08",
    "home.exp.j2.org": " · Java Engineer",
    "home.exp.j2.desc": "Worked on backend development for an enterprise low-code and digital business platform, owning form engine, process automation and page rendering modules; built microservices on Spring Boot/Cloud, optimized complex SQL queries and Redis caching; and contributed to React/TypeScript interaction work, building full-stack collaboration skills.",
    "home.exp.j3.date": "2018.06 — 2022.07",
    "home.exp.j3.org": " · Software Engineering · Bachelor",
    "home.exp.j3.desc": "Built a solid foundation in algorithms and engineering, competing in and winning programming contests.",
    "home.honor.title": "Honors & Certificates",
    "home.honor.h1": '<i class="fas fa-trophy" aria-hidden="true"></i> Lanqiao Cup National Second Prize (Provincial First Prize)',
    "home.honor.h2": '<i class="fas fa-trophy" aria-hidden="true"></i> ACM Programming Contest Bronze (Team Captain)',
    "home.honor.h3": '<i class="fas fa-star" aria-hidden="true"></i> University Lanxin Cup Second Prize · Programming Contest Third Prize',
    "home.honor.h4": '<i class="fas fa-graduation-cap" aria-hidden="true"></i> Software Designer (Intermediate), Soft Exam',

    // 技能等级（about + home 共用）
    "level.master": "Expert",
    "level.proficient": "Proficient",
    "level.skilled": "Skilled",
    "level.familiar": "Familiar",

    // 关于页 about
    "about.eyebrow": '<i class="fas fa-laptop-code" aria-hidden="true"></i> About Me',
    "about.h1": "About CWL",
    "about.lead": "Java backend engineer focused on server-side architecture, workflow engines and low-code platforms. I like making complex systems legible and turning hands-on experience into reusable notes.",
    "about.intro": "From refactoring the pipeline of a video intelligence system, to finance SaaS reports and search components, to a low-code code-generation engine and approval-flow wrapper, I care about clear boundaries, stable naming, unified configuration and failures that can be diagnosed. This site collects project retrospectives and notes on Java, Spring, databases and engineering practice.",
    "about.card.backend": "Java, Spring Boot, MyBatis/JPA, multi-module Maven, microservices",
    "about.card.data": "MySQL, Kingbase, Redis/Redisson, ElasticSearch, RocketMQ/RabbitMQ",
    "about.card.platform": "Activiti workflow, low-code schema/codegen, Docker, Jenkins",
    "about.skills.title": "Skill Stack",
    "about.skills.sub": "Backend as the core, extending into workflow, low-code and frontend engineering.",
    "about.skill.java": "Java language & concurrency",
    "about.skill.mysql": "MySQL / domestic DB adaptation / SQL optimization",
    "about.skill.activiti": "Activiti / BPMN 2.0 workflow",
    "about.skill.lowcode": "Low-code schema / codegen engine",
    "about.skill.python": "Python (FastAPI/Flask)",
    "about.exp.title": "Work & Project Timeline",
    "about.exp.sub": "Two backend engineering roles spanning intelligent analysis, SaaS, low-code and workflow.",
    "about.exp.j1.date": "2023.09 — Present",
    "about.exp.j1.org": " · Java Engineer",
    "about.exp.j1.desc": "Led the backend refactor of a video intelligence system, consolidating capture/algorithm/rules/alerting into multi-module Maven; helped platformize the algorithm service; and owned backend design and development for police inspection, finance SaaS, an approval-flow engine and a low-code platform, while driving shared components, Starters and engineering practice.",
    "about.exp.j2.date": "2022.09 — 2023.08",
    "about.exp.j2.org": " · Java Engineer",
    "about.exp.j2.desc": "Worked on backend development for an enterprise low-code and digital business platform, owning form engine, process automation and page rendering modules; built microservices on Spring Boot/Cloud, optimized complex SQL queries and Redis caching; and contributed to React/TypeScript interaction work, building full-stack collaboration skills.",
    "about.exp.j3.date": "2018.06 — 2022.07",
    "about.exp.j3.org": " · Software Engineering · Bachelor",
    "about.exp.j3.desc": "Built a solid foundation in algorithms and engineering, competing in and winning programming contests.",
    "about.proj.title": "Representative Projects",
    "about.proj.sub": "Open a card to read the corresponding project retrospective.",
    "about.proj.video.desc": "Refactored the capture → algorithm → rule → alert pipeline, with algorithm registration and pluggable executors.",
    "about.proj.finance.desc": "Financial report computation, ElasticSearch Starter and multi-channel notification center.",
    "about.proj.lowcode.desc": "Designer core, material protocol, Web Worker code generation and plugin architecture.",
    "about.proj.activiti.title": "TerminusActiviti Approval Flow",
    "about.proj.activiti.desc": "A lightweight BPM engine wrapper on Activiti 7, with process-diagram support.",
    "about.honorTitle": "Honors & Certificates",
    "about.honor1": '<i class="fas fa-trophy" aria-hidden="true"></i> Lanqiao Cup National Second Prize (Provincial First Prize)',
    "about.honor2": '<i class="fas fa-trophy" aria-hidden="true"></i> ACM Programming Contest Bronze (Team Captain)',
    "about.honor3": '<i class="fas fa-star" aria-hidden="true"></i> University Lanxin Cup Second Prize · Programming Contest Third Prize',
    "about.honor4": '<i class="fas fa-graduation-cap" aria-hidden="true"></i> Software Designer (Intermediate), Soft Exam',

    // 联系页 contact
    "contact.h1": "Contact",
    "contact.lead": "Feel free to reach out via the links below, or check my other profiles.",
    "contact.fb.eyebrow": '<i class="fas fa-comment-dots" aria-hidden="true"></i> Feedback',
    "contact.fb.h1": "Feedback",
    "contact.fb.lead": "Have an idea, a suggestion, or found a problem? Leave a message. Feedback is stored in your current browser and you can view or delete it on this page anytime.",
    "contact.fb.name": "Name (optional)",
    "contact.fb.name.ph": "Your nickname",
    "contact.fb.contact": "Contact (optional)",
    "contact.fb.contact.ph": "Email / WeChat, for replies",
    "contact.fb.message": "Message *",
    "contact.fb.message.ph": "Write your idea, suggestion or the problem you ran into…",
    "contact.fb.submit": '<i class="fas fa-paper-plane" aria-hidden="true"></i> Submit',
    "contact.fb.empty": "No feedback yet. Be the first to leave a note.",
    "contact.fb.anon": "Anonymous",
    "contact.fb.delete": "Delete",
    "contact.fb.required": "Please enter your feedback.",
    "contact.fb.saved": "Saved locally. Thanks for the feedback!",
    "contact.fb.sent": "Submitted and sent to the site owner. Thanks!",
    "contact.fb.sendFail": "Saved locally (online submission failed; please try again later).",
    "contact.fb.offline": "Saved locally (currently offline or submission failed).",
    "contact.fb.subject": "New blog feedback",
    "contact.fb.from": "Anonymous visitor",
    "contact.fb.notProvided": "(not provided)",

    // 编辑器页 editor
    "editor.lead": "Edit Markdown online with live preview, auto-save to your browser, and export to Markdown or HTML.",
    "editor.btn.new": '<i class="fas fa-file"></i> New',
    "editor.btn.sample": '<i class="fas fa-magic"></i> Sample',
    "editor.btn.copyhtml": '<i class="fas fa-copy"></i> Copy HTML',
    "editor.btn.copied": '<i class="fas fa-check"></i> Copied',
    "editor.btn.copyfail": '<i class="fas fa-copy"></i> Copy failed',
    "editor.btn.md": '<i class="fas fa-download"></i> MD',
    "editor.btn.html": '<i class="fas fa-code"></i> HTML',
    "editor.title.label": "Title",
    "editor.title.ph": "Article title",
    "editor.slug.label": "Slug",
    "editor.slug.ph": "my-new-post",
    "editor.date.label": "Date",
    "editor.toolbar.aria": "Markdown formatting tools",
    "editor.tool.bold": "Bold (Ctrl+B)",
    "editor.tool.italic": "Italic (Ctrl+I)",
    "editor.tool.heading": "Heading",
    "editor.tool.link": "Link (Ctrl+K)",
    "editor.tool.image": "Image",
    "editor.tool.code": "Inline code",
    "editor.tool.codeblock": "Code block",
    "editor.tool.quote": "Quote",
    "editor.tool.ul": "Bullet list",
    "editor.tool.ol": "Numbered list",
    "editor.tool.table": "Table",
    "editor.pane.markdown": "Markdown",
    "editor.pane.preview": "Preview",
    "editor.note": "A static GitHub Pages site can't write to the repo directly; exported files can go into Hugo's <code>content/post/</code> or the current static-site build flow. Tip: select text then click a toolbar button to wrap it — Ctrl+B / Ctrl+I / Ctrl+K supported.",
    "editor.sample.title": "New Post Title",
    "editor.sample.markdown": "# New Post Title\n\n> Draft a new blog post here.\n\n## Goal\n\n- Clarify the problem context\n- Record the solution\n- Summarize follow-up improvements\n\n## Code Snippet\n\n```java\npublic class HelloBlog {\n    public static void main(String[] args) {\n        System.out.println(\"Hello, blog!\");\n    }\n}\n```\n\n[Back to post list](/post/)",
    "editor.fmt.bold": "bold text",
    "editor.fmt.italic": "italic text",
    "editor.fmt.code": "code",
    "editor.fmt.list": "List item",
    "editor.fmt.link": "Link text",
    "editor.fmt.image": "Image description",
    "editor.fmt.codeblock": "Paste code here",
    "editor.fmt.table": "| Column 1 | Column 2 |\n| --- | --- |\n| Content | Content |",
    "editor.stats": "{words} words · {chars} chars · about {minutes} min",

    // Overleaf 简历页
    "overleaf.h1": "LaTeX Resume Template",
    "overleaf.lead": "Edit LaTeX source on the left and preview the resume on the right. Text in the preview is editable too, and changes sync back to the source.",
    "overleaf.btn.compile": "Recompile",
    "overleaf.btn.copy": "Copy Source",
    "overleaf.btn.reset": "Reset Template",
    "overleaf.btn.pdf": "Download PDF",
    "overleaf.source": "Source",
    "overleaf.preview": "Preview",
    "overleaf.editable": "editable PDF preview",
    "overleaf.status.ready": "Ready",
    "overleaf.status.compiled": "Compiled from source",
    "overleaf.status.synced": "Preview edits synced to source",
    "overleaf.status.copied": "Copied",
    "overleaf.status.copyfail": "Copy failed",
    "overleaf.status.pdf": "Use the print dialog to save as PDF",

    // 文章列表/单篇 post
    "post.tree.aria": "Article list",
    "post.tree.lead": "Retrospectives, platform work and engineering notes from this year, organized into continuously updated tech logs.",
    "post.stats.aria": "Content overview",
    "post.stats.posts": "retrospectives",
    "post.stats.systems": "system types",
    "post.stats.year": "this year's timeline",
    "post.search.ph": "Search posts / tags…",
    "post.search.aria": "Search posts",
    "post.tagfilter.aria": "Filter by tag",
    "post.comments": '<i class="fas fa-comments" aria-hidden="true"></i> Comments',
    "post.comments.aria": "Comments",
    "post.share": "Share",
    "post.share.x": "Share to X",
    "post.share.weibo": "Share to Weibo",
    "post.share.wechat": "Share via WeChat QR code",
    "post.share.copy": "Copy link",
    "post.meta.posts": "Posts",
    "post.qr.aria": "Share via WeChat QR code",
    "post.qr.close": "Close",
    "post.qr.title": "Scan with WeChat to share",
    "post.qr.fail": "QR generation failed. Try Copy Link instead.",

    // 标签页 tags
    "tags.lead": "Browse posts by topic tag; click any tag to jump to the blog list with the filter applied.",
    "tags.cloud.aria": "Tag cloud",

    // 分类页 / 404
    "categories.lead": "This static site does not have category data yet. Future article builds can connect the category index here.",
    "notfound.lead": "This page does not exist.",
    "notfound.home": "Go to homepage",

    // coder.js 动态文本
    "dyn.readingPrefix": "About",
    "dyn.readingSuffix": "min read",
    "dyn.toc": "Contents",
    "dyn.copy": '<i class="fas fa-copy" aria-hidden="true"></i> Copy',
    "dyn.copied": '<i class="fas fa-check" aria-hidden="true"></i> Copied',
    "dyn.totop": "Back to top",
    "dyn.toc.aria": "Contents",
    "dyn.search.aria": "Search posts",
    "dyn.search.ph": "Search titles, tags, content…",
    "dyn.search.start": "Type a keyword to start searching",
    "dyn.search.loading": "Loading search index…",
    "dyn.search.empty": "No matching posts. Try another keyword.",
    "dyn.search.kind.page": "Page",
    "dyn.search.kind.post": "Post",
    "dyn.search.loadFail": "Search index failed to load. Please try again later.",
    "dyn.search.noMatch": "No matching content. Try another keyword.",
    "dyn.search.indexEmpty": "Search index is empty.",
    "dyn.search.clear": "Clear search",
    "dyn.search.nav": "↑↓ Select",
    "dyn.search.open": "Enter Open",
    "dyn.search.shortcut": "Ctrl/⌘ K Search",
    "dyn.blog.empty": "No matching posts. Try another keyword or tag.",
    "dyn.comments.placeholder": "Comments are not configured yet. Add the giscus repo / repoId / categoryId values in <code>js/giscus.js</code> to enable GitHub Discussions comments.",
  };

  function read() {
    try { return window.localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function write(lang) {
    try { window.localStorage.setItem(KEY, lang); } catch (e) {}
  }

  var lang = read() === "en" ? "en" : "zh"; // 默认中文

  // 取当前语言下某键的文案；en 命中字典则返回英文，否则回退 fallback（中文）。
  function t(key, fallback) {
    if (lang === "en" && Object.prototype.hasOwnProperty.call(EN, key)) {
      return EN[key];
    }
    return fallback;
  }

  // 把页面上所有 data-i18n* 元素切到目标语言。
  // 原文（中文）在首次遇到时缓存到 el.__cwl[attr]，用于切回 zh。
  function applyDom() {
    ATTRS.forEach(function (spec) {
      var nodes = document.querySelectorAll(spec.selector);
      Array.prototype.forEach.call(nodes, function (el) {
        var key = spec.key(el);
        if (!key) return;
        if (!el.__cwl) el.__cwl = {};
        // 缓存原始中文（只缓存一次）。
        if (!(spec.attr in el.__cwl)) {
          el.__cwl[spec.attr] = spec.read(el);
        }
        var zh = el.__cwl[spec.attr];
        var en = spec.inline ? spec.inline(el) : "";
        spec.apply(el, lang === "en" ? (en || t(key, zh)) : zh);
      });
    });
  }

  function applyLanguageBlocks() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-i18n-lang]"), function (el) {
      var blockLang = el.getAttribute("data-i18n-lang") === "en" ? "en" : "zh";
      el.hidden = blockLang !== lang;
    });
  }

  // 更新 <title> 与 meta description（由 <body data-i18n-page> 指定页面键）。
  function applyHead() {
    var page = document.body.getAttribute("data-i18n-page");
    if (!page) return;
    var titleEl = document.querySelector("title");
    var descEl = document.querySelector('meta[name="description"]');
    if (titleEl) {
      if (!titleEl.__cwlZh) titleEl.__cwlZh = titleEl.textContent;
      var titleEn = document.body.getAttribute("data-i18n-title-en") || "";
      titleEl.textContent = lang === "en" ? (titleEn || t("head.title." + page, titleEl.__cwlZh)) : titleEl.__cwlZh;
    }
    if (descEl) {
      if (!descEl.__cwlZh) descEl.__cwlZh = descEl.getAttribute("content") || "";
      var descEn = document.body.getAttribute("data-i18n-desc-en") || "";
      descEl.setAttribute("content", lang === "en" ? (descEn || t("head.desc." + page, descEl.__cwlZh)) : descEl.__cwlZh);
    }
  }

  function apply() {
    document.documentElement.setAttribute("lang", lang === "en" ? "en" : "zh-CN");
    applyDom();
    applyLanguageBlocks();
    applyHead();
    updateToggles();
    // 通知 coder.js 等脚本刷新它们动态生成的文本。
    document.dispatchEvent(new CustomEvent("cwl:langchange", { detail: { lang: lang } }));
  }

  // 语言切换按钮：显示「目标语言」标签。
  function updateToggles() {
    Array.prototype.forEach.call(document.querySelectorAll(".lang-toggle"), function (btn) {
      btn.textContent = lang === "en" ? "中" : "EN";
      btn.setAttribute("aria-label", lang === "en" ? "切换到中文" : "Switch to English");
      btn.setAttribute("title", lang === "en" ? "切换到中文" : "Switch to English");
    });
  }

  function setLang(next) {
    lang = next === "en" ? "en" : "zh";
    write(lang);
    apply();
  }

  // 暴露给其他脚本。
  window.cwlT = t;
  window.cwlLang = function () { return lang; };
  window.cwlSetLang = setLang;

  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest(".lang-toggle");
    if (btn) {
      e.preventDefault();
      setLang(lang === "en" ? "zh" : "en");
    }
  });

  apply();
})();
