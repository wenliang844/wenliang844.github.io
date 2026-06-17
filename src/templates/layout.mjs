// 公共页面骨架：head / 导航 / 页脚 / 粒子 canvas。
// 所有页面 1:1 复用这里的常量，确保与手写 HTML 像素级一致。
import { SITE } from "../config.mjs";
import { escapeAttr, escapeHtml } from "../lib/format.mjs";

const NAV_ITEMS = [
  { href: "/post/", label: "博客", key: "blog", i18n: "nav.blog" },
  { href: "/ai/", label: "AI导航", key: "ai", i18n: "nav.ai" },
  { href: "/appreciation/", label: "鉴赏", key: "appreciation", i18n: "nav.appreciation" },
  { href: "/overleaf/", label: "简历模版", key: "overleaf", i18n: "nav.overleaf" },
  { href: "/editor/", label: "编辑器", key: "editor", i18n: "nav.editor" },
  { href: "/about/", label: "关于", key: "about", i18n: "nav.about" },
];

export const SPONSOR_LINKS = {
  afdian: "https://www.ifdian.net/order/create?plan_id=047bc28a6a1c11f182c452540025c377&product_type=0&remark=&affiliate_code=",
  paypal: "https://PayPal.Me/chenwenliang4212",
};

// 渲染主导航；active 标记当前栏目。
function renderNav(active) {
  const items = NAV_ITEMS.map((item) => {
    const cls = item.key === active ? ' class="active"' : "";
    return `          <li><a${cls} href="${item.href}" data-i18n="${item.i18n}">${item.label}</a></li>`;
  }).join("\n");

  return `        <nav class="navigation-list" aria-label="Main navigation" data-i18n-aria="nav.main">
          <ul>
${items}
            <li><a class="nav-feedback" href="/contact/#feedback-title" data-i18n="nav.feedback" data-i18n-html><i class="fas fa-comment-dots" aria-hidden="true"></i> 留言反馈</a></li>
            <li><button class="nav-subscribe" type="button" data-subscribe-open data-i18n="nav.subscribe" data-i18n-html><i class="fas fa-envelope" aria-hidden="true"></i> 订阅</button></li>
            <li><a class="nav-sponsor${active === "sponsor" ? " active" : ""}" href="/sponsor/" data-i18n="nav.sponsor" data-i18n-html><i class="fas fa-heart" aria-hidden="true"></i> 赞助</a></li>
            <li><button class="theme-toggle" type="button" aria-label="Toggle dark mode" data-i18n-aria="nav.theme"><i class="fas fa-adjust"></i></button></li>
            <li><button class="lang-toggle" type="button" aria-label="Switch language">EN</button></li>
            <li><button class="nav-search-trigger" type="button" aria-label="全局搜索" data-i18n-aria="nav.search"><i class="fas fa-search"></i></button></li>
          </ul>
        </nav>`;
}

// 渲染 <head> 中按页变化的脚本标签。
function renderScripts(scripts) {
  return scripts
    .map((src) => `  <script src="${src}" defer></script>`)
    .join("\n");
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
 * 有缩略图（SITE.ogImage 非 null）→ 大图卡 summary_large_image；
 * 无缩略图 → 纯文字卡 summary，避免分享时图裂。
 * @param {{title: string, description: string, path: string, type?: string}} og
 */
function renderMeta(og) {
  if (!og) return "";
  const url = `${SITE.baseURL}${og.path}`;
  const lines = [
    `  <link rel="canonical" href="${escapeAttr(url)}">`,
    `  <meta property="og:type" content="${escapeAttr(og.type || "website")}">`,
    `  <meta property="og:site_name" content="${escapeAttr(SITE.title)}">`,
    `  <meta property="og:title" content="${escapeAttr(og.title)}">`,
    `  <meta property="og:description" content="${escapeAttr(og.description)}">`,
    `  <meta property="og:url" content="${escapeAttr(url)}">`,
  ];
  if (SITE.ogImage) {
    const img = `${SITE.baseURL}${SITE.ogImage}`;
    lines.push(`  <meta property="og:image" content="${escapeAttr(img)}">`);
    lines.push(`  <meta name="twitter:card" content="summary_large_image">`);
    lines.push(`  <meta name="twitter:image" content="${escapeAttr(img)}">`);
  } else {
    lines.push(`  <meta name="twitter:card" content="summary">`);
  }
  lines.push(`  <meta name="twitter:title" content="${escapeAttr(og.title)}">`);
  lines.push(`  <meta name="twitter:description" content="${escapeAttr(og.description)}">`);
  return lines.join("\n");
}

/**
 * 生成完整 HTML 文档。
 * @param {object} opts
 * @param {string} opts.title       <title> 内容
 * @param {string} opts.description  meta description
 * @param {string} [opts.titleEn]    英文 <title>（用于生成内容页）
 * @param {string} [opts.descriptionEn] 英文 meta description
 * @param {string} opts.active       导航高亮 key（blog/editor/contact 或 ""）
 * @param {string[]} opts.scripts    额外 defer 脚本（coder.js 已默认包含）
 * @param {string} opts.bodyClass    body 额外 class，默认 colorscheme-light
 * @param {string} opts.page         用于 i18n head 切换（如 "home"/"posts"/"tags"），对应 head.title.* / head.desc.* 键
 * @param {string} opts.main         <main> 内部 HTML
 * @param {object} [opts.og]         OG/Twitter 卡片数据 { title, description, path, type? }；省略则不输出
 */
export function renderPage(opts) {
  const {
    title,
    description,
    titleEn = "",
    descriptionEn = "",
    active = "",
    scripts = [],
    bodyClass = "colorscheme-dark",
    page = "",
    main,
    og,
    jsonLd,
  } = opts;

  const allScripts = ["/js/error-handler.js", "/js/utils.js", "/js/i18n.js", "/js/coder.js", "/js/search-loader.js", "/js/subscribe.js", ...scripts];
  const meta = renderMeta(og);
  // JSON-LD 结构化数据：转义 "<" 防止 </script> 提前闭合脚本块。
  const jsonLdTag = jsonLd
    ? `\n  <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>`
    : "";

  const bodyI18n = [
    page ? `data-i18n-page="${page}"` : "",
    titleEn ? `data-i18n-title-en="${escapeAttr(titleEn)}"` : "",
    descriptionEn ? `data-i18n-desc-en="${escapeAttr(descriptionEn)}"` : "",
  ].filter(Boolean).join(" ");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeAttr(description)}">
  <link rel="icon" href="/images/favicon.png" type="image/png">
  <link rel="preconnect" href="https://giscus.app">
  <link rel="dns-prefetch" href="https://giscus.app">
  <link rel="stylesheet" href="/css/fontawesome-all.min.css">
  <link rel="stylesheet" href="/css/coder.css">
${renderScripts(allScripts)}${meta ? "\n" + meta : ""}${jsonLdTag}
  <title>${escapeHtml(title)}</title>
</head>
<body class="${bodyClass}"${bodyI18n ? ` ${bodyI18n}` : ""}>
  <div class="cursor-glow" aria-hidden="true"></div>
  <canvas class="cursor-canvas" aria-hidden="true"></canvas>
  <div class="site-shell">
    <header class="navigation">
      <section class="container">
        <a class="navigation-title" href="/">CWLBlog</a>
        <input type="checkbox" id="menu-toggle" class="menu-toggle" aria-label="Toggle menu" data-i18n-aria="nav.menu">
        <label class="menu-button" for="menu-toggle"><i class="fas fa-bars"></i></label>
${renderNav(active)}
      </section>
    </header>
${main}
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
