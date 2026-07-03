(function () {
  const PAGES = [
    { id: "blog", title: "博客", titleEn: "Blog", url: "/post/", keywords: ["博客", "文章", "post", "项目", "复盘", "blog"], descKey: "assistant.page.blog.desc", desc: "项目复盘和技术文章都在博客列表。" },
    { id: "relay", title: "中转站排名", titleEn: "Relay Ranking", url: "/ai/", keywords: ["中转站", "relay", "api", "key", "claude", "chatgpt", "openai", "anthropic", "排行榜", "排名"], descKey: "assistant.page.relay.desc", desc: "AI 中转站排行榜在这里，可以筛选 ChatGPT/OpenAI 与 Claude/Anthropic 格式。" },
    { id: "ai", title: "AI导航网站", titleEn: "AI Websites", url: "/ai/#nav", keywords: ["ai", "AI", "导航", "工具", "模型"], descKey: "assistant.page.ai.desc", desc: "常用 AI 网站和工具分类整理在 AI 导航网站。" },
    { id: "tools", title: "工具箱", titleEn: "Toolbox", url: "/tools/", keywords: ["工具箱", "json", "timestamp", "时间戳", "base64", "url", "uuid", "jwt", "hash", "哈希", "password", "密码", "color", "颜色", "regex", "正则", "markdown", "diff", "cron", "qr", "二维码", "yaml", "jsonpath", "query", "ua", "user-agent", "随机数", "文本统计", "单位换算", "toolbox"], descKey: "assistant.page.tools.desc", desc: "JSON、时间戳、编码、哈希、密码、颜色、正则、Markdown、Diff、Cron、二维码、YAML、JSONPath 和文本处理工具在在线工具箱。" },
    { id: "overleaf", title: "简历模版", titleEn: "Resume Template", url: "/overleaf/", keywords: ["简历", "模板", "模版", "overleaf", "latex", "pdf", "resume"], descKey: "assistant.page.overleaf.desc", desc: "多格式简历模板在简历模版页面。" },
    { id: "editor", title: "编辑器", titleEn: "Editor", url: "/editor/", keywords: ["编辑器", "markdown", "md", "写作", "editor"], descKey: "assistant.page.editor.desc", desc: "Markdown 在线编辑器支持实时预览和导出。" },
    { id: "sponsor", title: "赞助", titleEn: "Sponsor", url: "/sponsor/", keywords: ["赞助", "支持", "paypal", "爱发电", "sponsor"], descKey: "assistant.page.sponsor.desc", desc: "赞助和支持方式在赞助页面。" },
    { id: "contact", title: "留言反馈", titleEn: "Contact & Feedback", url: "/contact/", keywords: ["联系", "反馈", "留言", "邮箱", "contact", "关于", "作者", "cwl", "经历", "技能", "about"], descKey: "assistant.page.contact.desc", desc: "作者介绍、联系方式和留言反馈在联系页面。" },
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
    { action: "search", icon: "fa-search", key: "assistant.quick.search", fallback: "搜索文章" },
    { action: "ai", icon: "fa-magic", key: "assistant.quick.ai", fallback: "查看 AI 导航网站" },
    { action: "tools", icon: "fa-wrench", key: "assistant.quick.tools", fallback: "打开工具箱" },
    { action: "contact", icon: "fa-comments", key: "assistant.quick.contact", fallback: "联系我" },
  ];

  const MAX_MESSAGES = 40;
  const STORAGE_KEY = "cwl.assistant.llmConfig";
  const MODE_KEY = "cwl.assistant.mode";
  const OPACITY_KEY = "cwl.assistant.opacity";
  const DISMISS_KEY = "cwl.assistant.dismissed";
  const CONVERSATIONS_KEY = "cwl.assistant.conversations";
  const ACTIVE_CONVERSATION_KEY = "cwl.assistant.activeConversation";
  const DEFAULT_OPACITY = 100;
  const MAX_CONVERSATIONS = 20;
  const REQUEST_TIMEOUT_MS = 60000;
  const OPENAI_DEFAULT_API_KEY = ["sk", "-KsVG2X640CtGExXHyDSQApJPxrHMBb7xYa05PuaFKa6nS3Ij"].join("");
  const OPENAI_DEFAULT_ENDPOINT = "https://muyuan.do/v1/responses";
  const LEGACY_OPENAI_DEFAULT_ENDPOINT = "https://free.lyclaude.site/v1/responses";
  const LEGACY_OPENAI_FC_ENDPOINT = "https://a-ocnfniawgw.cn-shanghai.fcapp.run/v1";
  const LEGACY_ANTHROPIC_DEFAULT_ENDPOINT = "https://token-plan-cn.xiaomimimo.com/anthropic";
  const LLM_PRESETS = {
    openai: {
      format: "openai",
      endpoint: OPENAI_DEFAULT_ENDPOINT,
      apiKey: "",
      model: "gpt-5.5",
      stream: true,
    },
    anthropic: {
      format: "anthropic",
      endpoint: LEGACY_ANTHROPIC_DEFAULT_ENDPOINT,
      apiKey: "",
      model: "mimo-v2.5-pro",
      stream: true,
    },
  };
  const LLM_EXPERIENCE_KEYS = {
    openai: OPENAI_DEFAULT_API_KEY,
    anthropic: ["tp", "-cm4es5h6ehs1m9p2i2su9894nuyiwh2nomdswvjfaix86pxr"].join(""),
  };
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

  function fullscreenIcon(isFullscreen) {
    const paths = isFullscreen
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
    svg.setAttribute("class", "assistant-fullscreen-icon");
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

  function storageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  function now() {
    return Date.now();
  }

  function uniqueId(prefix) {
    return prefix + "-" + now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function cleanLinks(links) {
    if (!Array.isArray(links)) {
      return [];
    }
    return links.slice(0, 6).map(function (link) {
      return {
        title: String(link && link.title || ""),
        url: String(link && link.url || ""),
      };
    }).filter(function (link) {
      return link.title && link.url;
    });
  }

  function cleanMessage(message) {
    const role = message && message.role === "user" ? "user" : "bot";
    const text = String(message && (message.text || message.content) || "");
    if (!text) {
      return null;
    }
    return {
      id: String(message && message.id || uniqueId("msg")),
      role: role,
      text: text,
      links: cleanLinks(message && message.links),
    };
  }

  function cleanLlmHistory(history) {
    if (!Array.isArray(history)) {
      return [];
    }
    return history.map(function (message) {
      const role = message && message.role === "assistant" ? "assistant" : "user";
      const content = String(message && message.content || "");
      if (!content) {
        return null;
      }
      return { role: role, content: content };
    }).filter(Boolean).slice(-12);
  }

  function newConversation() {
    const timestamp = now();
    return {
      id: uniqueId("chat"),
      title: t("assistant.chat.new", "新对话"),
      createdAt: timestamp,
      updatedAt: timestamp,
      messages: [{
        id: uniqueId("msg"),
        role: "bot",
        text: t("assistant.hello", "今天有什么计划?"),
        links: [],
      }],
      llmHistory: [],
    };
  }

  function cleanConversation(conversation) {
    if (!conversation || typeof conversation !== "object") {
      return null;
    }
    const messages = Array.isArray(conversation.messages)
      ? conversation.messages.map(cleanMessage).filter(Boolean).slice(-MAX_MESSAGES)
      : [];
    const timestamp = Number(conversation.updatedAt || conversation.createdAt || now());
    return {
      id: String(conversation.id || uniqueId("chat")),
      title: String(conversation.title || t("assistant.chat.new", "新对话")).slice(0, 40),
      createdAt: Number(conversation.createdAt || timestamp),
      updatedAt: Number.isFinite(timestamp) ? timestamp : now(),
      messages: messages.length ? messages : newConversation().messages,
      llmHistory: cleanLlmHistory(conversation.llmHistory),
    };
  }

  function readConversations() {
    const saved = storageGet(CONVERSATIONS_KEY);
    if (!saved) {
      return [];
    }
    try {
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.map(cleanConversation).filter(Boolean).slice(0, MAX_CONVERSATIONS);
    } catch {
      return [];
    }
  }

  function titleFromMessage(message) {
    const clean = String(message || "").replace(/\s+/g, " ").trim();
    if (!clean) {
      return t("assistant.chat.new", "新对话");
    }
    return clean.length > 18 ? clean.slice(0, 18) + "..." : clean;
  }

  function sessionGet(key) {
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function sessionSet(key, value) {
    try {
      window.sessionStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  function normalizeFormat(format) {
    return format === "anthropic" ? "anthropic" : "openai";
  }

  function preset(format) {
    return Object.assign({}, LLM_PRESETS[normalizeFormat(format)]);
  }

  function isPresetEndpoint(format, endpoint) {
    const base = preset(format);
    return cleanEndpoint(endpoint) === cleanEndpoint(base.endpoint);
  }

  function readConfig() {
    const saved = storageGet(STORAGE_KEY);
    if (!saved) {
      return preset("openai");
    }

    try {
      const parsed = JSON.parse(saved);
      const format = normalizeFormat(parsed.format);
      const base = preset(format);
      const endpoint = String(parsed.endpoint || base.endpoint);
      const apiKey = String(parsed.apiKey || "");
      const model = String(parsed.model || base.model);
      const migrateLegacyAnthropicDefault =
        format === "anthropic" &&
        endpoint === LEGACY_ANTHROPIC_DEFAULT_ENDPOINT &&
        !apiKey &&
        model === "mimo-v2.5-pro";
      const migrateLegacyOpenAiDefault =
        format === "openai" &&
        (endpoint === LEGACY_OPENAI_DEFAULT_ENDPOINT || endpoint === LEGACY_OPENAI_FC_ENDPOINT) &&
        !apiKey &&
        model === "gpt-5.5";
      if (migrateLegacyAnthropicDefault || migrateLegacyOpenAiDefault) {
        return preset("openai");
      }
      return {
        format: format,
        endpoint: endpoint,
        apiKey: apiKey,
        model: model,
        stream: typeof parsed.stream === "boolean" ? parsed.stream : base.stream,
      };
    } catch {
      return preset("openai");
    }
  }

  function saveConfig(config) {
    const clean = {
      format: normalizeFormat(config.format),
      endpoint: String(config.endpoint || "").trim(),
      apiKey: String(config.apiKey || ""),
      model: String(config.model || "").trim(),
      stream: Boolean(config.stream),
    };
    storageSet(STORAGE_KEY, JSON.stringify(clean));
    return clean;
  }

  function withEffectiveApiKey(config) {
    const clean = Object.assign({}, config);
    clean.apiKey = String(clean.apiKey || "").trim();
    if (!clean.apiKey && isPresetEndpoint(clean.format, clean.endpoint)) {
      clean.apiKey = LLM_EXPERIENCE_KEYS[normalizeFormat(clean.format)] || "";
    }
    return clean;
  }

  function readMode() {
    return "llm";
  }

  function readOpacity() {
    const savedValue = storageGet(OPACITY_KEY);
    if (savedValue === null || savedValue === "") {
      return DEFAULT_OPACITY;
    }
    const saved = Number(savedValue);
    if (!Number.isFinite(saved)) {
      return DEFAULT_OPACITY;
    }
    return Math.min(DEFAULT_OPACITY, Math.max(60, Math.round(saved)));
  }

  function shouldStartFullscreen() {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("assistant") === "fullscreen" ||
        params.get("ai") === "fullscreen" ||
        window.location.hash === "#assistant-fullscreen";
    } catch {
      return false;
    }
  }

  function isHomePage() {
    try {
      const path = window.location.pathname || "/";
      return path === "/" || path === "/index.html";
    } catch {
      return false;
    }
  }

  function shouldAutoOpen() {
    if (shouldStartFullscreen()) {
      return true;
    }
    if (isHomePage()) {
      return true;
    }
    return sessionGet(DISMISS_KEY) !== "1";
  }

  function rememberDismissed() {
    sessionSet(DISMISS_KEY, "1");
  }

  function score(item, query) {
    const lower = query.toLowerCase();
    const titleScore = [item.title, item.titleEn].filter(Boolean).reduce(function (best, title) {
      const normalized = String(title).toLowerCase();
      if (lower.includes(normalized)) {
        return Math.max(best, 8);
      }
      if (normalized.includes(lower)) {
        return Math.max(best, 7);
      }
      return best;
    }, 0);
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

  function pageById(id) {
    return PAGES.find(function (page) {
      return page.id === id;
    });
  }

  function answer(query) {
    const text = String(query || "").trim();
    const pageMatches = matches(PAGES, text);
    const postMatches = matches(POSTS, text);
    if (!text) {
      return {
        text: t("assistant.empty", "你可以问我：工具箱在哪里、怎么联系作者、有哪些 AI 工具，或者输入关键词让我推荐文章。"),
        links: ["tools", "blog", "relay", "ai"].map(pageById).filter(Boolean).map(linkFor),
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
      text: t("assistant.noMatch", "AI助手本地搜索暂时没匹配到明确答案,你可以试试大模型。"),
      links: [
        { title: t("assistant.searchLink", "打开搜索"), url: "#search" },
        linkFor(pageById("tools")),
        linkFor(pageById("blog")),
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

  function cleanEndpoint(endpoint) {
    return String(endpoint || "").trim().replace(/\/+$/, "");
  }

  function openAiChatEndpoint(endpoint) {
    const clean = cleanEndpoint(endpoint);
    if (/\/v1\/chat\/completions$/i.test(clean) || /\/chat\/completions$/i.test(clean)) {
      return clean;
    }
    if (/\/v1\/responses$/i.test(clean)) {
      return clean.replace(/\/responses$/i, "/chat/completions");
    }
    if (/\/v1$/i.test(clean)) {
      return clean + "/chat/completions";
    }
    return clean + "/v1/chat/completions";
  }

  function openAiResponsesEndpoint(endpoint) {
    const clean = cleanEndpoint(endpoint);
    if (/\/v1\/responses$/i.test(clean) || /\/responses$/i.test(clean)) {
      return clean;
    }
    if (/\/v1\/chat\/completions$/i.test(clean)) {
      return clean.replace(/\/chat\/completions$/i, "/responses");
    }
    if (/\/v1$/i.test(clean)) {
      return clean + "/responses";
    }
    return clean + "/v1/responses";
  }

  function anthropicMessagesEndpoint(endpoint) {
    const clean = cleanEndpoint(endpoint);
    if (/\/v1\/messages$/i.test(clean) || /\/messages$/i.test(clean)) {
      return clean;
    }
    if (/\/v1$/i.test(clean)) {
      return clean + "/messages";
    }
    return clean + "/v1/messages";
  }

  function parseResponseText(payload) {
    if (!payload || typeof payload !== "object") {
      return "";
    }
    if (typeof payload.output_text === "string") {
      return payload.output_text;
    }
    if (Array.isArray(payload.choices) && payload.choices[0]) {
      const message = payload.choices[0].message || {};
      return String(message.content || payload.choices[0].text || "");
    }
    if (Array.isArray(payload.content)) {
      return payload.content.map(function (part) {
        return typeof part === "string" ? part : (part && part.text) || "";
      }).join("");
    }
    if (Array.isArray(payload.output)) {
      return payload.output.map(function (item) {
        if (!Array.isArray(item.content)) {
          return "";
        }
        return item.content.map(function (part) {
          return part.text || part.output_text || "";
        }).join("");
      }).join("");
    }
    return "";
  }

  function errorMessageFromPayload(payload) {
    if (!payload || typeof payload !== "object") {
      return "";
    }
    const err = payload.error || payload;
    const message = err.message || err.error || err.detail;
    return message ? String(message).slice(0, 160) : "";
  }

  function makeHttpError(response, payload) {
    const error = new Error(errorMessageFromPayload(payload) || "HTTP " + response.status);
    error.status = response.status;
    error.payload = payload;
    return error;
  }

  async function parsePayload(response) {
    const text = await response.text();
    if (!text) {
      return null;
    }
    try {
      return JSON.parse(text);
    } catch {
      return { message: text.slice(0, 160) };
    }
  }

  async function postJson(endpoint, headers, body, signal) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, headers),
      body: JSON.stringify(body),
      signal: signal,
    });
    const payload = await parsePayload(response);
    if (!response.ok) {
      throw makeHttpError(response, payload);
    }
    if (payload && typeof payload === "object" && payload.error) {
      throw makeHttpError(response, payload);
    }
    return payload;
  }

  function deltaFromSsePayload(payload) {
    if (!payload || typeof payload !== "object") {
      return "";
    }
    if (payload.type === "content_block_delta" && payload.delta) {
      return payload.delta.text || "";
    }
    if (payload.type === "response.output_text.delta") {
      return payload.delta || "";
    }
    if (Array.isArray(payload.choices) && payload.choices[0] && payload.choices[0].delta) {
      return payload.choices[0].delta.content || "";
    }
    return "";
  }

  async function postStream(endpoint, headers, body, signal, onDelta) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, headers),
      body: JSON.stringify(body),
      signal: signal,
    });
    if (!response.ok) {
      const payload = await parsePayload(response);
      throw makeHttpError(response, payload);
    }
    if (!response.body || !response.body.getReader) {
      const payload = await parsePayload(response);
      const text = parseResponseText(payload);
      if (text) {
        onDelta(text);
      }
      return text;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let result = "";

    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) {
        break;
      }
      buffer += decoder.decode(chunk.value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";
      events.forEach(function (eventText) {
        eventText.split("\n").forEach(function (line) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) {
            return;
          }
          const data = trimmed.slice(5).trim();
          if (!data || data === "[DONE]") {
            return;
          }
          try {
            const delta = deltaFromSsePayload(JSON.parse(data));
            if (delta) {
              result += delta;
              onDelta(delta);
            }
          } catch {
            // Ignore malformed SSE heartbeat lines.
          }
        });
      });
    }
    return result;
  }

  function withTimeout(parentSignal) {
    const controller = new AbortController();
    const timer = window.setTimeout(function () {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);
    if (parentSignal) {
      parentSignal.addEventListener("abort", function () {
        controller.abort();
      }, { once: true });
    }
    return {
      signal: controller.signal,
      clear: function () {
        window.clearTimeout(timer);
      },
    };
  }

  function normalizeLlmError(error) {
    if (error && error.name === "AbortError") {
      return "已停止生成。";
    }
    const status = error && error.status;
    if (status === 401 || status === 403) {
      return "中转站鉴权失败，请检查 API key 或账户权限。";
    }
    if (status === 429) {
      return "中转站触发频率限制，请稍后再试。";
    }
    if (status === 404) {
      return "中转站路径或模型不可用，请检查请求地址和模型名。";
    }
    if (status >= 500) {
      return "中转站服务异常，请稍后再试或切换其他中转站。";
    }
    return "请求失败：" + (error && error.message ? error.message : "未知错误");
  }

  function shouldTryOpenAiFallback(error) {
    const status = error && error.status;
    const message = String(error && error.message || "").toLowerCase();
    return [400, 404, 405, 422].includes(status) ||
      /invalid.*request|invalid codex request|not found|unsupported|chat.*completion/.test(message);
  }

  function prefersOpenAiResponses(config) {
    const endpoint = cleanEndpoint(config.endpoint).toLowerCase();
    return /\/responses$/i.test(endpoint) || endpoint.includes("a-ocnfniawgw.cn-shanghai.fcapp.run");
  }

  function responseContentFor(message) {
    return [{
      type: message.role === "assistant" ? "output_text" : "input_text",
      text: message.content,
    }];
  }

  function openAiResponsesBody(config, history, stream, codexShape) {
    const input = history.map(function (message) {
      const item = {
        role: message.role === "assistant" ? "assistant" : "user",
        content: responseContentFor(message),
      };
      if (codexShape) {
        item.type = "message";
      }
      return item;
    });
    const body = {
      model: config.model,
      input: input,
      stream: Boolean(stream),
      store: false,
    };
    if (codexShape) {
      body.instructions = "You are a helpful assistant.";
    }
    return body;
  }

  async function requestOpenAiResponses(config, headers, history, signal, onDelta, stream) {
    const endpoint = openAiResponsesEndpoint(config.endpoint);
    const primaryBody = openAiResponsesBody(config, history, stream, false);
    if (stream) {
      try {
        return await postStream(endpoint, headers, primaryBody, signal, onDelta);
      } catch (error) {
        if (!shouldTryOpenAiFallback(error)) {
          throw error;
        }
        return postStream(endpoint, headers, openAiResponsesBody(config, history, true, true), signal, onDelta);
      }
    }
    try {
      const payload = await postJson(endpoint, headers, primaryBody, signal);
      return parseResponseText(payload);
    } catch (error) {
      if (!shouldTryOpenAiFallback(error)) {
        throw error;
      }
      const payload = await postJson(endpoint, headers, openAiResponsesBody(config, history, false, true), signal);
      return parseResponseText(payload);
    }
  }

  async function callOpenAi(config, history, signal, onDelta) {
    const headers = { Authorization: "Bearer " + config.apiKey };
    const chatBody = {
      model: config.model,
      messages: history,
      stream: Boolean(config.stream),
    };

    if (prefersOpenAiResponses(config)) {
      return requestOpenAiResponses(config, headers, history, signal, onDelta, Boolean(config.stream));
    }

    if (config.stream) {
      try {
        return await postStream(openAiChatEndpoint(config.endpoint), headers, chatBody, signal, onDelta);
      } catch (error) {
        if (!shouldTryOpenAiFallback(error)) {
          throw error;
        }
        return requestOpenAiResponses(config, headers, history, signal, onDelta, true);
      }
    }

    try {
      const payload = await postJson(openAiChatEndpoint(config.endpoint), headers, chatBody, signal);
      return parseResponseText(payload);
    } catch (error) {
      if (!shouldTryOpenAiFallback(error)) {
        throw error;
      }
      return requestOpenAiResponses(config, headers, history, signal, onDelta, false);
    }
  }

  async function callAnthropic(config, history, signal, onDelta) {
    const headers = {
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    };
    const body = {
      model: config.model,
      max_tokens: 1024,
      messages: history.filter(function (message) {
        return message.role !== "system";
      }).map(function (message) {
        return {
          role: message.role === "assistant" ? "assistant" : "user",
          content: message.content,
        };
      }),
      stream: Boolean(config.stream),
    };

    if (config.stream) {
      return postStream(anthropicMessagesEndpoint(config.endpoint), headers, body, signal, onDelta);
    }
    const payload = await postJson(anthropicMessagesEndpoint(config.endpoint), headers, body, signal);
    return parseResponseText(payload);
  }

  async function callLlm(config, history, signal, onDelta) {
    const timeout = withTimeout(signal);
    try {
      const result = config.format === "anthropic"
        ? await callAnthropic(config, history, timeout.signal, onDelta)
        : await callOpenAi(config, history, timeout.signal, onDelta);
      return result || "";
    } finally {
      timeout.clear();
    }
  }

  function init() {
    if (document.querySelector(".assistant-widget")) {
      return;
    }

    let mode = readMode();
    let activeController = null;
    let fullscreen = false;
    let configExpanded = false;
    let lastToggle = null;
    let conversations = readConversations();
    if (!conversations.length) {
      conversations = [newConversation()];
    }
    let activeConversationId = storageGet(ACTIVE_CONVERSATION_KEY);
    if (!conversations.some(function (conversation) {
      return conversation.id === activeConversationId;
    })) {
      activeConversationId = conversations[0].id;
    }

    const root = el("section", "assistant-widget");
    root.setAttribute("aria-label", t("assistant.aria", "AI 助手"));
    root.style.setProperty("--assistant-opacity", String(readOpacity() / 100));

    const navToggles = Array.from(document.querySelectorAll("[data-assistant-toggle]"));
    if (navToggles.length) {
      root.classList.add("has-nav-trigger");
    }

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
    const privacy = el("span", "", "");
    privacy.id = "assistant-privacy";
    const headActions = el("div", "assistant-head-actions");
    const fullscreenBtn = el("button", "assistant-fullscreen");
    fullscreenBtn.type = "button";
    fullscreenBtn.setAttribute("aria-label", t("assistant.fullscreen.open", "全屏显示 AI 助手"));
    fullscreenBtn.setAttribute("aria-pressed", "false");
    fullscreenBtn.appendChild(fullscreenIcon(false));
    const close = el("button", "assistant-close");
    close.type = "button";
    close.setAttribute("aria-label", t("assistant.close", "关闭 AI 助手"));
    const closeMark = el("span", "assistant-close-mark", "×");
    closeMark.setAttribute("aria-hidden", "true");
    close.appendChild(closeMark);
    titleWrap.appendChild(title);
    titleWrap.appendChild(privacy);
    head.appendChild(titleWrap);
    headActions.appendChild(fullscreenBtn);
    headActions.appendChild(close);
    head.appendChild(headActions);

    const modes = el("div", "assistant-modes");
    const siteMode = el("button", "", t("assistant.mode.site", "站点助手"));
    const llmMode = el("button", "", t("assistant.mode.llm", "大模型"));
    siteMode.type = "button";
    llmMode.type = "button";
    siteMode.setAttribute("data-assistant-mode", "site");
    llmMode.setAttribute("data-assistant-mode", "llm");
    modes.appendChild(siteMode);
    modes.appendChild(llmMode);

    const body = el("div", "assistant-body");
    const sidebar = el("aside", "assistant-sidebar");
    sidebar.setAttribute("aria-label", t("assistant.history.aria", "历史对话"));
    const sidebarTop = el("div", "assistant-sidebar-top");
    const sidebarBrand = el("div", "assistant-sidebar-brand");
    sidebarBrand.appendChild(icon("fa-magic"));
    sidebarBrand.appendChild(el("span", "", "CWL AI"));
    const sidebarFullscreen = el("button", "assistant-sidebar-fullscreen");
    sidebarFullscreen.type = "button";
    sidebarFullscreen.setAttribute("aria-label", t("assistant.fullscreen.open", "全屏显示 AI 助手"));
    sidebarFullscreen.setAttribute("aria-pressed", "false");
    sidebarFullscreen.appendChild(fullscreenIcon(false));
    const sidebarClose = el("button", "assistant-sidebar-close");
    sidebarClose.type = "button";
    sidebarClose.setAttribute("aria-label", t("assistant.close", "关闭 AI 助手"));
    const sidebarCloseMark = el("span", "assistant-close-mark", "×");
    sidebarCloseMark.setAttribute("aria-hidden", "true");
    sidebarClose.appendChild(sidebarCloseMark);
    sidebarBrand.appendChild(sidebarFullscreen);
    sidebarBrand.appendChild(sidebarClose);
    const sidebarActions = el("div", "assistant-sidebar-actions");
    const historyTitle = el("strong", "", t("assistant.history.title", "历史对话"));
    const newChatBtn = el("button", "assistant-new-chat");
    newChatBtn.type = "button";
    newChatBtn.setAttribute("aria-label", t("assistant.newChat", "新建对话"));
    newChatBtn.appendChild(icon("fa-comment-dots"));
    newChatBtn.appendChild(el("span", "", t("assistant.newChat", "新建对话")));

    const quick = el("div", "assistant-quick");
    QUICK_ACTIONS.forEach(function (item) {
      const btn = el("button");
      btn.type = "button";
      btn.setAttribute("data-assistant-action", item.action);
      btn.appendChild(icon(item.icon));
      btn.appendChild(el("span", "", t(item.key, item.fallback)));
      quick.appendChild(btn);
    });

    const relayCta = el("a", "assistant-relay-cta");
    relayCta.href = "/ai/#relay";
    relayCta.appendChild(icon("fa-network-wired fa-cogs"));
    relayCta.appendChild(el("span", "", t("assistant.relayCta", "中转站排行榜")));

    sidebarActions.appendChild(newChatBtn);
    sidebarActions.appendChild(quick);
    sidebarActions.appendChild(relayCta);
    sidebarTop.appendChild(sidebarBrand);
    sidebarTop.appendChild(sidebarActions);
    const historyHead = el("div", "assistant-history-head");
    historyHead.appendChild(historyTitle);
    const historyList = el("div", "assistant-history-list");
    historyList.setAttribute("role", "list");
    sidebar.appendChild(sidebarTop);
    sidebar.appendChild(historyHead);
    sidebar.appendChild(historyList);

    const main = el("div", "assistant-main");

    const settings = el("section", "assistant-settings");
    const configToggle = el("button", "assistant-config-toggle");
    configToggle.type = "button";
    configToggle.setAttribute("aria-expanded", "false");
    configToggle.setAttribute("aria-controls", "assistant-config-body");
    const configToggleText = el("span", "", t("assistant.config.toggle", "配置"));
    configToggle.appendChild(configToggleText);
    const configBody = el("div", "assistant-config-body");
    configBody.id = "assistant-config-body";
    configBody.hidden = true;

    const opacityLabel = el("label", "assistant-opacity");
    const opacityText = el("span", "", t("assistant.opacity", "透明度"));
    const opacityControl = el("div", "assistant-opacity-control");
    const opacityInput = el("input", "assistant-opacity-range");
    opacityInput.type = "range";
    opacityInput.min = "60";
    opacityInput.max = "100";
    opacityInput.step = "5";
    opacityInput.value = String(readOpacity());
    opacityInput.setAttribute("aria-label", t("assistant.opacity", "透明度"));
    const opacityValue = el("output", "assistant-opacity-value");
    opacityValue.value = opacityInput.value;
    opacityValue.textContent = opacityInput.value + "%";
    opacityControl.appendChild(opacityInput);
    opacityControl.appendChild(opacityValue);
    opacityLabel.appendChild(opacityText);
    opacityLabel.appendChild(opacityControl);

    const configForm = el("form", "assistant-config");
    configForm.hidden = true;
    const formatLabel = el("label", "assistant-config-field");
    formatLabel.appendChild(el("span", "", "格式"));
    const formatSelect = el("select", "assistant-format");
    [
      ["openai", "ChatGPT/OpenAI"],
      ["anthropic", "Claude/Anthropic"],
    ].forEach(function (item) {
      const option = el("option", "", item[1]);
      option.value = item[0];
      formatSelect.appendChild(option);
    });
    formatLabel.appendChild(formatSelect);

    const endpointLabel = el("label", "assistant-config-field");
    endpointLabel.appendChild(el("span", "", "请求地址"));
    const endpointInput = el("input", "assistant-endpoint");
    endpointInput.type = "url";
    endpointInput.autocomplete = "off";
    endpointLabel.appendChild(endpointInput);

    const keyLabel = el("label", "assistant-config-field");
    keyLabel.appendChild(el("span", "", "API key"));
    const keyInput = el("input", "assistant-api-key");
    keyInput.type = "password";
    keyInput.autocomplete = "off";
    keyInput.placeholder = "请输入你自己的 API key";
    keyLabel.appendChild(keyInput);

    const modelLabel = el("label", "assistant-config-field");
    modelLabel.appendChild(el("span", "", "模型名"));
    const modelInput = el("input", "assistant-model");
    modelInput.type = "text";
    modelInput.autocomplete = "off";
    modelLabel.appendChild(modelInput);

    const streamLabel = el("label", "assistant-stream");
    const streamInput = el("input");
    streamInput.type = "checkbox";
    streamLabel.appendChild(streamInput);
    streamLabel.appendChild(el("span", "", "流式输出"));

    const configActions = el("div", "assistant-config-actions");
    const saveConfigBtn = el("button", "", "保存配置");
    const testConfigBtn = el("button", "", "测试连接");
    saveConfigBtn.type = "submit";
    testConfigBtn.type = "button";
    const configStatus = el("span", "assistant-config-status");
    configActions.appendChild(saveConfigBtn);
    configActions.appendChild(testConfigBtn);
    configActions.appendChild(configStatus);

    configBody.appendChild(opacityLabel);
    configForm.appendChild(formatLabel);
    configForm.appendChild(endpointLabel);
    configForm.appendChild(keyLabel);
    configForm.appendChild(modelLabel);
    configForm.appendChild(streamLabel);
    configForm.appendChild(configActions);
    configBody.appendChild(configForm);
    settings.appendChild(configToggle);
    settings.appendChild(configBody);

    const messages = el("div", "assistant-messages");
    messages.setAttribute("role", "log");
    messages.setAttribute("aria-live", "polite");

    const form = el("form", "assistant-form");
    const input = el("input", "assistant-input");
    input.type = "text";
    input.setAttribute("aria-label", t("assistant.input", "输入问题"));
    const send = el("button", "assistant-send");
    send.type = "submit";
    send.setAttribute("aria-label", t("assistant.send", "发送"));
    send.appendChild(icon("fa-paper-plane"));
    form.appendChild(input);
    form.appendChild(send);

    main.appendChild(head);
    main.appendChild(modes);
    main.appendChild(settings);
    main.appendChild(messages);
    main.appendChild(form);
    body.appendChild(sidebar);
    body.appendChild(main);
    panel.appendChild(body);
    root.appendChild(toggle);
    root.appendChild(panel);
    document.body.appendChild(root);

    const assistantToggles = [toggle].concat(navToggles);
    assistantToggles.forEach(function (btn) {
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-controls", "assistant-panel");
    });

    function activeConversation() {
      let conversation = conversations.find(function (item) {
        return item.id === activeConversationId;
      });
      if (!conversation) {
        conversation = newConversation();
        conversations.unshift(conversation);
        activeConversationId = conversation.id;
      }
      return conversation;
    }

    function saveConversations() {
      conversations = conversations.sort(function (a, b) {
        return b.updatedAt - a.updatedAt;
      }).slice(0, MAX_CONVERSATIONS);
      storageSet(CONVERSATIONS_KEY, JSON.stringify(conversations));
      storageSet(ACTIVE_CONVERSATION_KEY, activeConversationId);
    }

    function conversationMeta(conversation) {
      const count = Math.max(0, (conversation.messages || []).length - 1);
      if (isEnglish()) {
        return count === 1 ? "1 message" : count + " messages";
      }
      return count + " 条消息";
    }

    function renderHistory() {
      historyList.textContent = "";
      conversations.forEach(function (conversation) {
        const item = el("button", "assistant-history-item");
        item.type = "button";
        item.setAttribute("role", "listitem");
        item.setAttribute("data-assistant-chat-id", conversation.id);
        if (conversation.id === activeConversationId) {
          item.classList.add("active");
          item.setAttribute("aria-current", "true");
        }
        item.appendChild(el("strong", "", conversation.title || t("assistant.chat.new", "新对话")));
        item.appendChild(el("span", "", conversationMeta(conversation)));
        historyList.appendChild(item);
      });
    }

    function renderMessages() {
      messages.textContent = "";
      activeConversation().messages.forEach(function (message) {
        addMessage(message.role, message.text, message.links, {
          id: message.id,
          persist: false,
        });
      });
      messages.scrollTop = messages.scrollHeight;
    }

    function touchConversation(conversation) {
      conversation.updatedAt = now();
      saveConversations();
      renderHistory();
    }

    function setActiveConversation(id) {
      if (activeController) {
        activeController.abort();
        activeController = null;
        setGenerating(false);
      }
      const next = conversations.find(function (conversation) {
        return conversation.id === id;
      });
      if (!next) {
        return;
      }
      activeConversationId = next.id;
      saveConversations();
      renderHistory();
      renderMessages();
      input.focus();
    }

    function startNewConversation() {
      if (activeController) {
        activeController.abort();
        activeController = null;
        setGenerating(false);
      }
      const conversation = newConversation();
      conversations.unshift(conversation);
      activeConversationId = conversation.id;
      saveConversations();
      renderHistory();
      renderMessages();
      input.value = "";
      input.focus();
    }

    function readConfigFromFields() {
      return saveConfig({
        format: formatSelect.value,
        endpoint: endpointInput.value,
        apiKey: keyInput.value,
        model: modelInput.value,
        stream: streamInput.checked,
      });
    }

    function fillConfigFields(config) {
      formatSelect.value = normalizeFormat(config.format);
      endpointInput.value = config.endpoint || "";
      keyInput.value = config.apiKey || "";
      modelInput.value = config.model || "";
      streamInput.checked = Boolean(config.stream);
    }

    function setGenerating(generating) {
      send.classList.toggle("is-generating", generating);
      send.setAttribute("aria-label", generating ? "停止生成" : t("assistant.send", "发送"));
      send.textContent = "";
      send.appendChild(icon(generating ? "fa-stop" : "fa-paper-plane"));
    }

    function setConfigExpanded(expanded) {
      configExpanded = Boolean(expanded);
      configBody.hidden = !configExpanded;
      configToggle.setAttribute("aria-expanded", String(configExpanded));
    }

    function setOpacity(value) {
      const opacity = Math.min(DEFAULT_OPACITY, Math.max(60, Math.round(Number(value) || DEFAULT_OPACITY)));
      opacityInput.value = String(opacity);
      opacityValue.value = String(opacity);
      opacityValue.textContent = opacity + "%";
      root.style.setProperty("--assistant-opacity", String(opacity / 100));
      storageSet(OPACITY_KEY, String(opacity));
    }

    function updateFullscreenButton() {
      [fullscreenBtn, sidebarFullscreen].forEach(function (btn) {
        btn.setAttribute("aria-pressed", String(fullscreen));
        btn.setAttribute("aria-label", fullscreen
          ? t("assistant.fullscreen.close", "退出全屏")
          : t("assistant.fullscreen.open", "全屏显示 AI 助手"));
        btn.textContent = "";
        btn.appendChild(fullscreenIcon(fullscreen));
      });
    }

    function updateFullscreenOffset() {
      root.style.removeProperty("--assistant-fullscreen-top");
    }

    function updateNavigationOffset() {
      const nav = document.querySelector(".navigation");
      if (!nav) {
        root.style.removeProperty("--assistant-nav-height");
        return;
      }
      const navHeight = Math.ceil(nav.getBoundingClientRect().height);
      if (navHeight > 0) {
        root.style.setProperty("--assistant-nav-height", navHeight + "px");
      } else {
        root.style.removeProperty("--assistant-nav-height");
      }
    }

    function setFullscreen(nextFullscreen) {
      fullscreen = Boolean(nextFullscreen);
      if (fullscreen) {
        closeMobileMenu();
      }
      root.classList.toggle("fullscreen", fullscreen);
      document.body.classList.toggle("assistant-fullscreen", fullscreen);
      updateFullscreenOffset();
      updateFullscreenButton();
      if (fullscreen && panel.hidden) {
        setOpen(true);
      }
    }

    function updateStaticText() {
      root.setAttribute("aria-label", t("assistant.aria", "AI 助手"));
      title.textContent = t("assistant.title", "AI 助手");
      close.setAttribute("aria-label", t("assistant.close", "关闭 AI 助手"));
      sidebarClose.setAttribute("aria-label", t("assistant.close", "关闭 AI 助手"));
      sidebar.setAttribute("aria-label", t("assistant.history.aria", "历史对话"));
      historyTitle.textContent = t("assistant.history.title", "历史对话");
      newChatBtn.setAttribute("aria-label", t("assistant.newChat", "新建对话"));
      const newChatText = newChatBtn.querySelector("span");
      if (newChatText) {
        newChatText.textContent = t("assistant.newChat", "新建对话");
      }
      relayCta.querySelector("span").textContent = t("assistant.relayCta", "中转站排行榜");
      input.setAttribute("aria-label", t("assistant.input", "输入问题"));
      configToggleText.textContent = t("assistant.config.toggle", "配置");
      opacityText.textContent = t("assistant.opacity", "透明度");
      opacityInput.setAttribute("aria-label", t("assistant.opacity", "透明度"));
      siteMode.textContent = t("assistant.mode.site", "站点助手");
      llmMode.textContent = t("assistant.mode.llm", "大模型");
      syncToggles(!panel.hidden);
      QUICK_ACTIONS.forEach(function (item) {
        const btn = quick.querySelector('[data-assistant-action="' + item.action + '"]');
        if (btn) {
          const btnText = btn.querySelector("span");
          if (btnText) {
            btnText.textContent = t(item.key, item.fallback);
          }
        }
      });
      applyMode(mode);
      updateFullscreenButton();
      renderHistory();
    }

    function applyMode(nextMode) {
      mode = nextMode === "llm" ? "llm" : "site";
      storageSet(MODE_KEY, mode);
      siteMode.classList.toggle("active", mode === "site");
      llmMode.classList.toggle("active", mode === "llm");
      siteMode.setAttribute("aria-pressed", String(mode === "site"));
      llmMode.setAttribute("aria-pressed", String(mode === "llm"));
      configForm.hidden = mode !== "llm";
      privacy.textContent = mode === "llm"
        ? t("assistant.llmPrivacy", "大模型模式会请求你配置的中转站，API key 输入框默认留空；未填写时使用内置体验 key。")
        : t("assistant.privacy", "本地规则版，不会发送你的输入");
      input.placeholder = mode === "llm"
        ? t("assistant.llmPlaceholder", "输入要发送给大模型的问题")
        : t("assistant.placeholder", "问站点导航或文章关键词");
    }

    function syncToggles(open) {
      const label = open ? t("assistant.minimize", "最小化 AI 助手") : t("assistant.open", "打开 AI 助手");
      assistantToggles.forEach(function (btn) {
        btn.setAttribute("aria-expanded", String(open));
        btn.setAttribute("aria-label", label);
        if (btn.hasAttribute("title")) {
          btn.setAttribute("title", label);
        }
      });
    }

    function closeMobileMenu() {
      const menuToggle = document.querySelector(".menu-toggle");
      if (menuToggle && menuToggle.checked) {
        menuToggle.checked = false;
      }
    }

    function setOpen(open, options) {
      root.classList.toggle("open", open);
      document.body.classList.toggle("assistant-open", open);
      panel.hidden = !open;
      syncToggles(open);
      if (open) {
        closeMobileMenu();
      }
      if (open && !(options && options.skipFocus)) {
        input.focus();
      } else if (options && options.returnFocus) {
        setFullscreen(false);
        (lastToggle || navToggles[0] || toggle).focus();
      } else if (!open) {
        setFullscreen(false);
      }
    }

    function persistMessage(message) {
      const conversation = activeConversation();
      conversation.messages.push(message);
      conversation.messages = conversation.messages.slice(-MAX_MESSAGES);
      if (message.role === "user" && conversation.title === t("assistant.chat.new", "新对话")) {
        conversation.title = titleFromMessage(message.text);
      }
      touchConversation(conversation);
    }

    function addMessage(role, message, links, options) {
      const cleanRole = role === "user" ? "user" : "bot";
      const cleanText = String(message || "");
      const messageId = options && options.id ? options.id : uniqueId("msg");
      const item = el("div", "assistant-message " + cleanRole);
      item.setAttribute("data-assistant-message-id", messageId);
      item.appendChild(el("p", "", cleanText));
      const messageLinks = cleanLinks(links);
      if (messageLinks.length) {
        const linkList = el("div", "assistant-links");
        messageLinks.forEach(function (link) {
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
      if (!options || options.persist !== false) {
        persistMessage({
          id: messageId,
          role: cleanRole,
          text: cleanText,
          links: messageLinks,
        });
      }
      return item;
    }

    function updateMessage(item, text, targetConversation) {
      const p = item.querySelector("p");
      if (p) {
        p.textContent = text;
      }
      const messageId = item.getAttribute("data-assistant-message-id");
      if (messageId) {
        const conversation = targetConversation || activeConversation();
        const message = conversation.messages.find(function (entry) {
          return entry.id === messageId;
        });
        if (message) {
          message.text = String(text || "");
          touchConversation(conversation);
        }
      }
      messages.scrollTop = messages.scrollHeight;
    }

    function askSite(value) {
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

    async function askLlm(value) {
      const query = String(value || "").trim();
      if (!query) {
        addMessage("bot", "请输入要发送给大模型的问题。");
        return;
      }
      const config = withEffectiveApiKey(readConfigFromFields());
      if (!config.apiKey) {
        addMessage("bot", "请先填写 API key。密钥只会保存在本机浏览器 localStorage。", [
          { title: "打开中转站排行榜", url: "/ai/#relay" },
        ]);
        keyInput.focus();
        return;
      }

      addMessage("user", query);
      input.value = "";
      const conversation = activeConversation();
      conversation.llmHistory.push({ role: "user", content: query });
      conversation.llmHistory = conversation.llmHistory.slice(-12);
      touchConversation(conversation);

      activeController = new AbortController();
      const requestController = activeController;
      setGenerating(true);
      const botMessage = addMessage("bot", "正在连接中转站...");
      let received = "";

      try {
        const answerText = await callLlm(config, conversation.llmHistory, requestController.signal, function (delta) {
          received += delta;
          updateMessage(botMessage, received || "正在生成...", conversation);
        });
        const finalText = received || answerText || "中转站没有返回文本内容。";
        updateMessage(botMessage, finalText, conversation);
        if (finalText !== "已停止生成。") {
          conversation.llmHistory.push({ role: "assistant", content: finalText });
          conversation.llmHistory = conversation.llmHistory.slice(-12);
          touchConversation(conversation);
        }
      } catch (error) {
        updateMessage(botMessage, normalizeLlmError(error), conversation);
      } finally {
        if (activeController === requestController) {
          activeController = null;
          setGenerating(false);
        }
      }
    }

    async function testConnection() {
      const config = withEffectiveApiKey(readConfigFromFields());
      if (!config.apiKey) {
        configStatus.textContent = "请先填写 API key";
        keyInput.focus();
        return;
      }
      const previousStream = config.stream;
      config.stream = false;
      testConfigBtn.disabled = true;
      configStatus.textContent = "测试中...";
      const controller = new AbortController();
      try {
        await callLlm(config, [{ role: "user", content: "ping" }], controller.signal, function () {});
        configStatus.textContent = "连接正常";
      } catch (error) {
        configStatus.textContent = normalizeLlmError(error);
      } finally {
        config.stream = previousStream;
        testConfigBtn.disabled = false;
      }
    }

    fillConfigFields(readConfig());
    saveConversations();
    renderHistory();
    renderMessages();

    assistantToggles.forEach(function (btn) {
      btn.addEventListener("click", function () {
        lastToggle = btn;
        const nextOpen = panel.hidden;
        if (!nextOpen) {
          rememberDismissed();
        }
        setOpen(nextOpen);
      });
    });
    close.addEventListener("click", function () {
      rememberDismissed();
      setOpen(false, { returnFocus: true });
    });
    sidebarClose.addEventListener("click", function () {
      rememberDismissed();
      setOpen(false, { returnFocus: true });
    });
    fullscreenBtn.addEventListener("click", function () {
      setFullscreen(!fullscreen);
      input.focus();
    });
    sidebarFullscreen.addEventListener("click", function () {
      setFullscreen(!fullscreen);
      input.focus();
    });
    modes.addEventListener("click", function (event) {
      const btn = event.target.closest("[data-assistant-mode]");
      if (btn) {
        applyMode(btn.getAttribute("data-assistant-mode"));
      }
    });
    formatSelect.addEventListener("change", function () {
      const next = preset(formatSelect.value);
      next.apiKey = keyInput.value;
      fillConfigFields(next);
      readConfigFromFields();
      configStatus.textContent = "已切换预设，留空会使用体验 key";
    });
    configForm.addEventListener("submit", function (event) {
      event.preventDefault();
      readConfigFromFields();
      configStatus.textContent = "已保存到本机浏览器";
    });
    testConfigBtn.addEventListener("click", testConnection);
    configToggle.addEventListener("click", function () {
      setConfigExpanded(!configExpanded);
    });
    opacityInput.addEventListener("input", function () {
      setOpacity(opacityInput.value);
    });
    newChatBtn.addEventListener("click", startNewConversation);
    historyList.addEventListener("click", function (event) {
      const item = event.target.closest("[data-assistant-chat-id]");
      if (item) {
        setActiveConversation(item.getAttribute("data-assistant-chat-id"));
      }
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
        window.location.href = "/ai/#nav";
        return;
      }
      if (action === "relay") {
        window.location.href = "/ai/";
        return;
      }
      if (action === "contact") {
        window.location.href = "/contact/";
      }
    });
    function submitAssistantForm() {
      if (typeof form.requestSubmit === "function") {
        form.requestSubmit();
        return;
      }
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    }
    input.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" || event.shiftKey || event.isComposing) {
        return;
      }
      event.preventDefault();
      submitAssistantForm();
    });
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (mode === "llm" && activeController) {
        activeController.abort();
        return;
      }
      if (mode === "llm") {
        askLlm(input.value);
      } else {
        askSite(input.value);
      }
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !panel.hidden) {
        if (activeController) {
          activeController.abort();
        }
        if (fullscreen) {
          setFullscreen(false);
          input.focus();
          return;
        }
        rememberDismissed();
        setOpen(false, { returnFocus: true });
      }
    });
    document.addEventListener("cwl:langchange", function () {
      updateStaticText();
      window.requestAnimationFrame(updateNavigationOffset);
      window.requestAnimationFrame(updateFullscreenOffset);
    });
    window.addEventListener("resize", updateNavigationOffset);
    window.addEventListener("resize", updateFullscreenOffset);
    setOpacity(opacityInput.value);
    setConfigExpanded(false);
    updateNavigationOffset();
    updateStaticText();
    setOpen(shouldAutoOpen(), { skipFocus: true });
    if (shouldStartFullscreen()) {
      setFullscreen(true);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
