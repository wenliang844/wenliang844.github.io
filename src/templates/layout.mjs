// 公共页面骨架：head / 导航 / 页脚 / 粒子 canvas。
// 所有页面 1:1 复用这里的常量，确保与手写 HTML 像素级一致。
import { createHash } from "node:crypto";
import { SITE } from "../config.mjs";
import { escapeAttr, escapeHtml } from "../lib/format.mjs";

export const NAV_ITEMS = [
  {
    href: "/post/",
    label: "博客",
    key: "blog",
    i18n: "nav.blog",
    className: "nav-blog-main",
    html: '<i class="fas fa-book-open" aria-hidden="true"></i> 博客',
    htmlEn: '<i class="fas fa-book-open" aria-hidden="true"></i> Blog',
  },
  { href: "/ai/", label: "AI中转站排名", key: "ai", i18n: "nav.ai" },
  { href: "/appreciation/", label: "观察家", key: "appreciation", i18n: "nav.appreciation" },
];

export const MORE_ITEMS = [
  { href: "/knowledge/", label: "知识资产", key: "knowledge", i18n: "nav.knowledge" },
  { href: "/tools/", label: "工具箱", key: "tools", i18n: "nav.tools" },
  { href: "/overleaf/", label: "简历模版", key: "overleaf", i18n: "nav.overleaf" },
];

export const SPONSOR_LINKS = {
  afdian: "https://www.ifdian.net/order/create?plan_id=047bc28a6a1c11f182c452540025c377&product_type=0&remark=&affiliate_code=",
  paypal: "https://PayPal.Me/chenwenliang4212",
};

export const RESOURCE_HINTS = [
  { rel: "preconnect", href: "https://giscus.app" },
  { rel: "dns-prefetch", href: "https://giscus.app" },
  { rel: "preconnect", href: "https://buttondown.com" },
  { rel: "dns-prefetch", href: "https://buttondown.com" },
  { rel: "dns-prefetch", href: "https://www.ifdian.net" },
  { rel: "dns-prefetch", href: "https://paypal.me" },
];

const ASSISTANT_CONNECT_ORIGINS = [
  "https://muyuan.do",
  "https://token-plan-cn.xiaomimimo.com",
];

function apiOrigin(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    const local = url.hostname === "127.0.0.1" || url.hostname === "localhost";
    return url.protocol === "https:" || (local && url.protocol === "http:") ? url.origin : "";
  } catch {
    return "";
  }
}

function websocketOrigin(value) {
  const origin = apiOrigin(value);
  if (!origin) return "";
  const url = new URL(origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.origin;
}

export function contentSecurityPolicy(page, scripts, inlineScripts = [], capabilities = {}) {
  const scriptSources = [
    "'self'",
    "https://cloud.umami.is",
    "https://plausible.io",
  ];
  const styleSources = ["'self'"];
  if (capabilities.comments) {
    scriptSources.push("https://giscus.app");
  }
  if (page === "chat") {
    scriptSources.push("https://minnit.chat");
  }
  if (page === "tools") {
    scriptSources.push("'wasm-unsafe-eval'", "https://cdn.jsdelivr.net");
  }
  if (scripts.includes("/js/search-loader.js") && !scriptSources.includes("'wasm-unsafe-eval'")) {
    scriptSources.push("'wasm-unsafe-eval'");
  }
  scriptSources.push(...inlineScripts.map((source) => `'sha256-${createHash("sha256").update(source).digest("base64")}'`));

  const connectSources = ["'self'"];
  if (page === "tools") {
    // Mini API Tester intentionally accepts arbitrary HTTPS targets. Keep this
    // exception isolated to the toolbox instead of granting it site-wide.
    connectSources.push("https:");
  } else {
    if (scripts.includes("/js/analytics.js")) {
      connectSources.push("https://cloud.umami.is", "https://plausible.io");
    }
    if (scripts.includes("/js/subscribe.js")) {
      connectSources.push("https://buttondown.com");
    }
    if (scripts.includes("/js/assistant.js") || scripts.includes("/js/assistant-loader.js")) {
      connectSources.push(...ASSISTANT_CONNECT_ORIGINS);
    }
    if (scripts.includes("/js/feedback.js")) {
      connectSources.push("https://api.web3forms.com");
    }
    const configuredApiOrigin = apiOrigin(SITE.apiBase);
    if (configuredApiOrigin) {
      connectSources.push(configuredApiOrigin);
      if (page === "chat") connectSources.push(websocketOrigin(SITE.apiBase));
    }
  }

  const frameSources = ["https://giscus.app"];
  if (page === "chat") frameSources.push("https://organizations.minnit.chat");

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    `script-src ${scriptSources.join(" ")}`,
    "script-src-attr 'none'",
    `style-src ${styleSources.join(" ")}`,
    `style-src-attr ${page === "chat" ? "'unsafe-inline'" : "'none'"}`,
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "worker-src 'self'",
    `connect-src ${[...new Set(connectSources)].join(" ")}`,
    `frame-src ${frameSources.join(" ")}`,
    "form-action 'self' https://buttondown.com https://api.web3forms.com",
  ].join("; ");
}

export const CORE_SCRIPTS = [
  "/js/error-handler.js",
  "/js/utils.js",
  "/js/pwa.js",
  "/js/analytics.js",
  "/js/i18n.js",
  "/js/coder.js",
  "/js/search-loader.js",
  "/js/subscribe.js",
  "/js/assistant-loader.js",
];

// 渲染主导航；active 标记当前栏目。
function renderNavItem(item, active, indent = "          ") {
  const classes = [item.key === active ? "active" : "", item.className || ""].filter(Boolean).join(" ");
  const cls = classes ? ` class="${classes}"` : "";
  const target = item.target ? ` target="${item.target}" rel="noopener noreferrer"` : "";
  const i18nHtml = item.html ? " data-i18n-html" : "";
  const i18nEn = item.htmlEn ? ` data-i18n-en-html="${escapeAttr(item.htmlEn)}"` : "";
  return `${indent}<li><a${cls} href="${item.href}"${target} data-i18n="${item.i18n}"${i18nHtml}${i18nEn}>${item.html || item.label}</a></li>`;
}

function renderNav(active, languageMode) {
  const items = NAV_ITEMS.map((item) => renderNavItem(item, active)).join("\n");
  const moreActive = MORE_ITEMS.some((item) => item.key === active);
  const moreItems = MORE_ITEMS.map((item) => renderNavItem(item, active, "              ")).join("\n");
  const languageItem = languageMode === "zh-only"
    ? ""
    : '            <li><button class="lang-toggle" type="button" aria-label="Switch language">EN</button></li>';

  return `        <nav class="navigation-list" aria-label="Main navigation" data-i18n-aria="nav.main">
          <ul>
${items}
            <li class="nav-more">
              <details>
                <summary class="nav-more-toggle${moreActive ? " active" : ""}" data-i18n="nav.more" data-i18n-html data-i18n-en-html="&lt;i class=&quot;fas fa-ellipsis-h&quot; aria-hidden=&quot;true&quot;&gt;&lt;/i&gt; More"><i class="fas fa-ellipsis-h" aria-hidden="true"></i> 更多</summary>
                <ul class="nav-more-menu">
${moreItems}
                </ul>
              </details>
            </li>
            <li><a class="nav-feedback${active === "contact" ? " active" : ""}" href="/contact/" data-i18n="nav.feedback" data-i18n-html><i class="fas fa-comment-dots" aria-hidden="true"></i> 留言反馈</a></li>
            <li><button class="nav-subscribe" type="button" data-subscribe-open data-i18n="nav.subscribe" data-i18n-html><i class="fas fa-envelope" aria-hidden="true"></i> 订阅</button></li>
            <li><a class="nav-sponsor${active === "sponsor" ? " active" : ""}" href="/sponsor/" data-i18n="nav.sponsor" data-i18n-html><i class="fas fa-heart" aria-hidden="true"></i> 赞助</a></li>
            <li><a class="nav-chat${active === "chat" ? " active" : ""}" href="/chat/" aria-label="打开在线聊天室" title="打开在线聊天室" data-i18n-aria="nav.chat" data-i18n-title="nav.chat"><i class="fas fa-comments" aria-hidden="true"></i></a></li>
            <li><button class="theme-toggle" type="button" aria-label="切换主题" data-i18n-aria="nav.theme"><i class="fas fa-adjust"></i></button></li>
${languageItem}
            <li><button class="nav-search-trigger" type="button" aria-label="全局搜索（Ctrl+K 或 /）" title="全局搜索（Ctrl+K 或 /）" data-i18n-aria="nav.searchHint" data-i18n-title="nav.searchHint"><i class="fas fa-search"></i></button></li>
            <li><button class="nav-ai-experience assistant-nav-trigger" type="button" aria-label="打开 AI 助手" title="打开 AI 助手" data-assistant-toggle data-i18n-aria="assistant.open" data-i18n-title="assistant.open"><span aria-hidden="true">AI</span></button></li>
          </ul>
        </nav>`;
}

// 渲染 <head> 中按页变化的脚本标签。
function renderScripts(scripts) {
  return scripts
    .map((src) => `  <script src="${escapeAttr(src)}" defer></script>`)
    .join("\n");
}

function renderResourceHints() {
  return RESOURCE_HINTS
    .map(({ rel, href }) => `  <link rel="${rel}" href="${escapeAttr(href)}">`)
    .join("\n");
}

export function mainStylesheet(page) {
  if (page === "home") return "/css/coder-home.min.css";
  if (page === "posts") return "/css/coder-post.min.css";
  return "/css/coder.min.css";
}

function renderSponsorFooterCta() {
  return `        <div class="sponsor-mini" aria-label="赞助支持选项" data-i18n-aria="sponsorMini.aria">
          <p class="sponsor-mini-text" data-i18n="sponsorMini.text">如果内容对你有帮助，可以支持我继续更新。</p>
          <div class="sponsor-mini-actions">
            <a class="sponsor-mini-btn sponsor-mini-primary" href="${SPONSOR_LINKS.afdian}" target="_blank" rel="noopener noreferrer" data-i18n="sponsorMini.afdian">☕ 赞助</a>
            <a class="sponsor-mini-btn sponsor-mini-secondary" href="${SPONSOR_LINKS.paypal}" target="_blank" rel="noopener noreferrer" data-i18n="sponsorMini.paypal">💳 PayPal 支持</a>
          </div>
        </div>`;
}

/**
 * 渲染 Open Graph + Twitter 卡片 meta。
 * 有缩略图（文章 og.image 或 SITE.ogImage 非 null）→ 大图卡 summary_large_image；
 * 无缩略图 → 纯文字卡 summary，避免分享时图裂。
 * @param {{title: string, description: string, path: string, type?: string, image?: string}} og
 */
export function buildOpenGraphMeta(og) {
  if (!og) return [];
  const url = `${SITE.baseURL}${og.path}`;
  const image = og.image || SITE.ogImage;
  const tags = [
    { tag: "link", rel: "canonical", href: url },
    { tag: "meta", property: "og:type", content: og.type || "website" },
    { tag: "meta", property: "og:site_name", content: SITE.title },
    { tag: "meta", property: "og:title", content: og.title },
    { tag: "meta", property: "og:description", content: og.description },
    { tag: "meta", property: "og:url", content: url },
  ];
  if (image) {
    const img = /^https?:\/\//i.test(image) ? image : `${SITE.baseURL}${image}`;
    tags.push({ tag: "meta", property: "og:image", content: img });
    tags.push({ tag: "meta", name: "twitter:card", content: "summary_large_image" });
    tags.push({ tag: "meta", name: "twitter:image", content: img });
  } else {
    tags.push({ tag: "meta", name: "twitter:card", content: "summary" });
  }
  tags.push({ tag: "meta", name: "twitter:title", content: og.title });
  tags.push({ tag: "meta", name: "twitter:description", content: og.description });
  return tags;
}

function renderMeta(og) {
  return buildOpenGraphMeta(og).map((tag) => {
    if (tag.tag === "link") {
      return `  <link rel="${escapeAttr(tag.rel)}" href="${escapeAttr(tag.href)}">`;
    }
    const key = tag.property ? "property" : "name";
    return `  <meta ${key}="${escapeAttr(tag[key])}" content="${escapeAttr(tag.content)}">`;
  }).join("\n");
}

export function siteUrl(path) {
  return `${SITE.baseURL}${path}`;
}

export function buildPageJsonLd({ type = "WebPage", name, description, path, ...extra }) {
  return {
    "@context": "https://schema.org",
    "@type": type,
    name,
    description,
    url: siteUrl(path),
    inLanguage: "zh-CN",
    isPartOf: {
      "@type": "WebSite",
      name: SITE.title,
      url: siteUrl("/"),
    },
    ...extra,
  };
}

export function buildLayoutState(opts) {
  const {
    title,
    description,
    titleEn = "",
    descriptionEn = "",
    active = "",
    scripts = [],
    styles = [],
    bodyClass = "colorscheme-dark",
    page = "",
    main = "",
    og,
    jsonLd,
    languageMode = "bilingual",
    comments = false,
  } = opts;
  const allScripts = [...new Set([...CORE_SCRIPTS, ...scripts])];
  const jsonLdSource = jsonLd ? JSON.stringify(jsonLd).replace(/</g, "\\u003c") : "";

  return {
    title,
    description,
    titleEn,
    descriptionEn,
    active,
    scripts: allScripts,
    styles,
    bodyClass,
    page,
    main,
    languageMode,
    comments,
    mainStyle: mainStylesheet(page),
    resourceHints: RESOURCE_HINTS,
    openGraph: buildOpenGraphMeta(og),
    jsonLdSource,
    csp: contentSecurityPolicy(page, allScripts, jsonLdSource ? [jsonLdSource] : [], { comments }),
    apiBase: SITE.apiBase || "",
  };
}

export function searchableMain(main) {
  return main.replace(/<main\b/, "<main data-pagefind-body");
}

/**
 * 生成完整 HTML 文档。
 * @param {object} opts
 * @param {string} opts.title       <title> 内容
 * @param {string} opts.description  meta description
 * @param {string} [opts.titleEn]    英文 <title>（用于生成内容页）
 * @param {string} [opts.descriptionEn] 英文 meta description
 * @param {string} opts.active       导航高亮 key（blog/editor/contact 或 ""）
 * @param {string[]} opts.scripts    额外 defer 脚本（兼容构建的 coder.js 已默认包含）
 * @param {string[]} [opts.styles]   当前页面额外加载的同源样式表
 * @param {string} opts.bodyClass    body 额外 class，默认 colorscheme-light
 * @param {string} opts.page         用于 i18n head 切换（如 "home"/"posts"/"tags"），对应 head.title.* / head.desc.* 键
 * @param {string} opts.main         <main> 内部 HTML
 * @param {object} [opts.og]         OG/Twitter 卡片数据 { title, description, path, type? }；省略则不输出
 * @param {"bilingual"|"zh-only"} [opts.languageMode] 页面语言能力
 */
export function renderPage(opts) {
  const state = buildLayoutState(opts);
  const {
    title,
    description,
    titleEn = "",
    descriptionEn = "",
    active = "",
    scripts: allScripts,
    styles = [],
    bodyClass = "colorscheme-dark",
    page = "",
    main,
    mainStyle,
    openGraph,
    jsonLdSource,
    csp,
    apiBase,
    languageMode = "bilingual",
    comments = false,
  } = state;
  const meta = openGraph.length ? renderMeta(opts.og) : "";
  const jsonLdTag = jsonLdSource
    ? `\n  <script type="application/ld+json">${jsonLdSource}</script>`
    : "";

  const bodyI18n = [
    page ? `data-i18n-page="${page}"` : "",
    titleEn ? `data-i18n-title-en="${escapeAttr(titleEn)}"` : "",
    descriptionEn ? `data-i18n-desc-en="${escapeAttr(descriptionEn)}"` : "",
    `data-language-mode="${languageMode}"`,
    comments ? 'data-cwl-comments="enabled"' : "",
  ].filter(Boolean).join(" ");
  const searchableContent = searchableMain(main);

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="${escapeAttr(csp)}">
  <meta name="cwl-api-base" content="${escapeAttr(apiBase)}">
  <meta name="description" content="${escapeAttr(description)}">
  <meta name="theme-color" content="#171717">
  <link rel="icon" href="/images/favicon.png" type="image/png">
${renderResourceHints()}
  <link rel="stylesheet" href="/css/fontawesome-all.min.css">
  <link rel="stylesheet" href="${mainStyle}">
  <link rel="stylesheet" href="/css/content.min.css">
${styles.map((href) => `  <link rel="stylesheet" href="${escapeAttr(href)}">`).join("\n")}
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="apple-touch-icon" href="/images/pwa-192.png">
${renderScripts(allScripts)}${meta ? "\n" + meta : ""}${jsonLdTag}
  <title>${escapeHtml(title)}</title>
</head>
<body class="${bodyClass}"${bodyI18n ? ` ${bodyI18n}` : ""}>
  <a class="skip-link" href="#main-content" data-i18n="nav.skip">跳到主要内容</a>
  <div class="cursor-glow" aria-hidden="true"></div>
  <canvas class="cursor-canvas" aria-hidden="true"></canvas>
  <div class="site-shell">
    <header class="navigation">
      <section class="container">
        <a class="navigation-title" href="/">CWLBlog</a>
        <input type="checkbox" id="menu-toggle" class="menu-toggle" aria-label="Toggle menu" data-i18n-aria="nav.menu">
        <label class="menu-button" for="menu-toggle"><i class="fas fa-bars"></i></label>
        <label class="menu-overlay" for="menu-toggle" aria-hidden="true"></label>
${renderNav(active, languageMode)}
      </section>
    </header>
${searchableContent}
    <footer class="footer">
      <section class="container">
        <div class="subscribe">
          <p class="subscribe-title" data-i18n="subscribe.title">订阅更新 · 新文章邮件提醒</p>
          <form class="subscribe-form" novalidate>
            <input class="subscribe-input" type="email" name="email" required autocomplete="email" placeholder="输入你的邮箱" data-i18n-ph="subscribe.ph" aria-label="Email">
            <button class="subscribe-btn" type="submit" data-i18n="subscribe.btn">订阅</button>
          </form>
          <p class="subscribe-status" role="status" aria-live="polite"></p>
        </div>
${renderSponsorFooterCta()}
        <p data-i18n="footer.text">© 2021 - 2026 CWL · Powered by Cwl · Theme inspired by Coder</p>
      </section>
    </footer>
  </div>
</body>
</html>`;
}
