(function () {
  const PAGES = [
    { id: "blog", title: "博客", titleEn: "Blog", url: "/post/", keywords: ["博客", "文章", "post", "项目", "复盘", "blog"], descKey: "assistant.page.blog.desc", desc: "项目复盘和技术文章都在博客列表。" },
    { id: "ai", title: "AI导航", titleEn: "AI Navigation", url: "/ai/", keywords: ["ai", "AI", "导航", "工具", "模型"], descKey: "assistant.page.ai.desc", desc: "常用 AI 网站和工具分类整理在 AI 导航。" },
    { id: "tools", title: "工具箱", titleEn: "Toolbox", url: "/tools/", keywords: ["工具箱", "json", "timestamp", "时间戳", "base64", "url", "uuid", "jwt", "toolbox"], descKey: "assistant.page.tools.desc", desc: "JSON、时间戳、Base64、URL、UUID、JWT 工具在在线工具箱。" },
    { id: "overleaf", title: "简历模版", titleEn: "Resume Template", url: "/overleaf/", keywords: ["简历", "模板", "模版", "overleaf", "latex", "pdf", "resume"], descKey: "assistant.page.overleaf.desc", desc: "多格式简历模板在简历模版页面。" },
    { id: "editor", title: "编辑器", titleEn: "Editor", url: "/editor/", keywords: ["编辑器", "markdown", "md", "写作", "editor"], descKey: "assistant.page.editor.desc", desc: "Markdown 在线编辑器支持实时预览和导出。" },
    { id: "sponsor", title: "赞助", titleEn: "Sponsor", url: "/sponsor/", keywords: ["赞助", "支持", "paypal", "爱发电", "sponsor"], descKey: "assistant.page.sponsor.desc", desc: "赞助和支持方式在赞助页面。" },
    { id: "contact", title: "联系我", titleEn: "Contact", url: "/contact/#feedback-title", keywords: ["联系", "反馈", "留言", "邮箱", "contact"], descKey: "assistant.page.contact.desc", desc: "联系方式和留言反馈在联系页面。" },
    { id: "about", title: "关于", titleEn: "About", url: "/about/", keywords: ["关于", "作者", "cwl", "经历", "技能", "about"], descKey: "assistant.page.about.desc", desc: "作者介绍、技能和项目经历在关于页面。" },
  ];

  const POSTS = [
    { title: "Codex 与 Claude 协作开发", titleEn: "Codex and Claude Collaboration", url: "/post/codex-claude-vibe-coding/", keywords: ["codex", "claude", "ai", "vibe", "协作"] },
    { title: "低代码 Schema 与代码生成", titleEn: "Low-Code Schema and Code Generation", url: "/post/lowcode-schema-codegen/", keywords: ["低代码", "lowcode", "schema", "代码生成"] },
    { title: "Activiti 工作流引擎", titleEn: "Activiti Workflow Engine", url: "/post/activiti-workflow-engine/", keywords: ["activiti", "流程", "工作流", "审批", "workflow"] },
    { title: "金融 SaaS 后端实践", titleEn: "Finance SaaS Backend Practice", url: "/post/finance-saas-backend/", keywords: ["金融", "saas", "后端", "报表"] },
    { title: "规则引擎告警闭环", titleEn: "Rule Engine Alert Loop", url: "/post/rule-engine-alerts/", keywords: ["规则", "告警", "报警", "引擎"] },
    { title: "管理系统工程实践", titleEn: "Management System Engineering", url: "/post/manage-system/", keywords: ["管理系统", "后台", "工程"] },
  ];

  const QUICK_ACTIONS = [
    { action: "search", key: "assistant.quick.search", fallback: "搜索文章" },
    { action: "tools", key: "assistant.quick.tools", fallback: "打开工具箱" },
    { action: "contact", key: "assistant.quick.contact", fallback: "联系我" },
    { action: "ai", key: "assistant.quick.ai", fallback: "查看 AI 导航" },
  ];

  const MAX_MESSAGES = 40;

  function t(key, fallback) {
    return window.cwlT ? window.cwlT(key, fallback) : fallback;
  }

  function isEnglish() {
    return window.cwlLang && window.cwlLang() === "en";
  }

  function label(item) {
    return isEnglish() && item.titleEn ? item.titleEn : item.title;
  }

  function pageDescription(item) {
    return t(item.descKey, item.desc);
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text !== undefined) {
      node.textContent = text;
    }
    return node;
  }

  function icon(className) {
    const node = el("i");
    node.className = "fas " + className;
    node.setAttribute("aria-hidden", "true");
    return node;
  }

  function score(item, query) {
    const lower = query.toLowerCase();
    const titleScore = [item.title, item.titleEn].filter(Boolean).some(function (title) {
      const normalizedTitle = String(title).toLowerCase();
      return lower.includes(normalizedTitle) || normalizedTitle.includes(lower);
    }) ? 8 : 0;
    return item.keywords.reduce(function (sum, keyword) {
      const normalized = String(keyword).toLowerCase();
      if (!normalized || !lower.includes(normalized)) {
        return sum;
      }
      return sum + Math.min(6, Math.max(1, normalized.length));
    }, titleScore);
  }

  function matches(list, query) {
    return list.map(function (item) {
      return { item: item, score: score(item, query) };
    }).filter(function (entry) {
      return entry.score > 0;
    }).sort(function (a, b) {
      return b.score - a.score;
    }).map(function (entry) {
      return entry.item;
    });
  }

  function linkFor(item) {
    return {
      title: label(item),
      url: item.url,
    };
  }

  function answer(query) {
    const text = String(query || "").trim();
    const pageMatches = matches(PAGES, text);
    const postMatches = matches(POSTS, text);
    if (!text) {
      return {
        text: t("assistant.empty", "你可以问我：工具箱在哪里、怎么联系作者、有哪些 AI 工具，或者输入关键词让我推荐文章。"),
        links: [PAGES[2], PAGES[0], PAGES[1]].map(linkFor),
      };
    }
    if (pageMatches.length) {
      return {
        text: pageDescription(pageMatches[0]) + (postMatches.length ? t("assistant.related", " 另外也找到几篇相关文章。") : ""),
        links: pageMatches.slice(0, 3).concat(postMatches.slice(0, 2)).map(linkFor),
      };
    }
    if (postMatches.length) {
      return {
        text: t("assistant.postIntro", "我按关键词找到这些相关文章："),
        links: postMatches.slice(0, 3).map(linkFor),
      };
    }
    return {
      text: t("assistant.noMatch", "暂时没匹配到明确页面。你可以试试“工具箱”“AI导航”“简历”“联系”“低代码”“工作流”等关键词，或者直接打开全站搜索。"),
      links: [
        { title: t("assistant.searchLink", "打开搜索"), url: "#search" },
        linkFor(PAGES[2]),
        linkFor(PAGES[0]),
      ],
    };
  }

  function openSearch() {
    if (window.cwlOpenSearch) {
      window.cwlOpenSearch();
      return;
    }
    const trigger = document.querySelector(".nav-search-trigger");
    if (trigger) {
      trigger.click();
    }
  }

  function init() {
    if (document.querySelector(".assistant-widget")) {
      return;
    }

    const root = el("section", "assistant-widget");
    root.setAttribute("aria-label", t("assistant.aria", "AI 助手"));

    const toggle = el("button", "assistant-fab");
    toggle.type = "button";
    toggle.setAttribute("aria-label", t("assistant.open", "打开 AI 助手"));
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", "assistant-panel");
    toggle.appendChild(el("span", "assistant-fab-label", "AI"));

    const panel = el("div", "assistant-panel");
    panel.id = "assistant-panel";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-labelledby", "assistant-title");
    panel.setAttribute("aria-describedby", "assistant-privacy");

    const head = el("header", "assistant-head");
    const titleWrap = el("div");
    const title = el("strong", "", t("assistant.title", "AI 助手"));
    title.id = "assistant-title";
    const privacy = el("span", "", t("assistant.privacy", "本地规则版，不会发送你的输入"));
    privacy.id = "assistant-privacy";
    const close = el("button", "assistant-close");
    close.type = "button";
    close.setAttribute("aria-label", t("assistant.close", "关闭 AI 助手"));
    const closeMark = el("span", "assistant-close-mark", "×");
    closeMark.setAttribute("aria-hidden", "true");
    close.appendChild(closeMark);
    titleWrap.appendChild(title);
    titleWrap.appendChild(privacy);
    head.appendChild(titleWrap);
    head.appendChild(close);

    const messages = el("div", "assistant-messages");
    messages.setAttribute("role", "log");
    messages.setAttribute("aria-live", "polite");

    const quick = el("div", "assistant-quick");
    QUICK_ACTIONS.forEach(function (item) {
      const btn = el("button", "", t(item.key, item.fallback));
      btn.type = "button";
      btn.setAttribute("data-assistant-action", item.action);
      quick.appendChild(btn);
    });

    const form = el("form", "assistant-form");
    const input = el("input", "assistant-input");
    input.type = "text";
    input.placeholder = t("assistant.placeholder", "问站点导航或文章关键词");
    input.setAttribute("aria-label", t("assistant.input", "输入问题"));
    const send = el("button", "assistant-send");
    send.type = "submit";
    send.setAttribute("aria-label", t("assistant.send", "发送"));
    send.appendChild(icon("fa-paper-plane"));
    form.appendChild(input);
    form.appendChild(send);

    panel.appendChild(head);
    panel.appendChild(messages);
    panel.appendChild(quick);
    panel.appendChild(form);
    root.appendChild(toggle);
    root.appendChild(panel);
    document.body.appendChild(root);

    function updateStaticText() {
      root.setAttribute("aria-label", t("assistant.aria", "AI 助手"));
      title.textContent = t("assistant.title", "AI 助手");
      privacy.textContent = t("assistant.privacy", "本地规则版，不会发送你的输入");
      close.setAttribute("aria-label", t("assistant.close", "关闭 AI 助手"));
      input.placeholder = t("assistant.placeholder", "问站点导航或文章关键词");
      input.setAttribute("aria-label", t("assistant.input", "输入问题"));
      send.setAttribute("aria-label", t("assistant.send", "发送"));
      toggle.setAttribute("aria-label", panel.hidden ? t("assistant.open", "打开 AI 助手") : t("assistant.minimize", "最小化 AI 助手"));
      QUICK_ACTIONS.forEach(function (item) {
        const btn = quick.querySelector('[data-assistant-action="' + item.action + '"]');
        if (btn) {
          btn.textContent = t(item.key, item.fallback);
        }
      });
    }

    function setOpen(open, options) {
      root.classList.toggle("open", open);
      document.body.classList.toggle("assistant-open", open);
      panel.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? t("assistant.minimize", "最小化 AI 助手") : t("assistant.open", "打开 AI 助手"));
      if (open) {
        input.focus();
      } else if (options && options.returnFocus) {
        toggle.focus();
      }
    }

    function addMessage(role, message, links) {
      const item = el("div", "assistant-message " + role);
      item.appendChild(el("p", "", message));
      if (links && links.length) {
        const linkList = el("div", "assistant-links");
        links.forEach(function (link) {
          const a = el("a", "", link.title);
          a.href = link.url;
          if (link.url === "#search") {
            a.addEventListener("click", function (event) {
              event.preventDefault();
              openSearch();
            });
          }
          linkList.appendChild(a);
        });
        item.appendChild(linkList);
      }
      messages.appendChild(item);
      while (messages.children.length > MAX_MESSAGES) {
        messages.removeChild(messages.firstElementChild);
      }
      messages.scrollTop = messages.scrollHeight;
    }

    function ask(value) {
      const query = String(value || "").trim();
      if (!query) {
        const result = answer("");
        addMessage("bot", result.text, result.links);
        return;
      }
      addMessage("user", query);
      const result = answer(query);
      addMessage("bot", result.text, result.links);
      input.value = "";
    }

    addMessage("bot", t("assistant.hello", "你好，我可以帮你找博客文章、AI 导航、工具箱、简历模板、编辑器、赞助和联系方式。"));

    toggle.addEventListener("click", function () {
      setOpen(panel.hidden);
    });
    close.addEventListener("click", function () {
      setOpen(false, { returnFocus: true });
    });
    quick.addEventListener("click", function (event) {
      const btn = event.target.closest("[data-assistant-action]");
      if (!btn) {
        return;
      }
      const action = btn.getAttribute("data-assistant-action");
      if (action === "search") {
        openSearch();
        return;
      }
      if (action === "tools") {
        window.location.href = "/tools/";
        return;
      }
      if (action === "ai") {
        window.location.href = "/ai/";
        return;
      }
      if (action === "contact") {
        window.location.href = "/contact/#feedback-title";
      }
    });
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      ask(input.value);
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !panel.hidden) {
        setOpen(false, { returnFocus: true });
      }
    });
    document.addEventListener("cwl:langchange", updateStaticText);
    updateStaticText();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
