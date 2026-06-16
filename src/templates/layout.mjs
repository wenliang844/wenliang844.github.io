// 公共页面骨架：head / 导航 / 页脚 / 粒子 canvas。
// 所有页面 1:1 复用这里的常量，确保与手写 HTML 像素级一致。
import { SITE } from "../config.mjs";

const NAV_ITEMS = [
  { href: "/post/", label: "Blog", key: "blog", i18n: "nav.blog" },
  { href: "/editor/", label: "Editor", key: "editor", i18n: "nav.editor" },
  { href: "/contact/", label: "Contact", key: "contact", i18n: "nav.contact" },
];

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

// 属性值转义，避免标题/摘要里的引号或尖括号破坏 meta 标签。
function attr(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
    `  <meta property="og:type" content="${attr(og.type || "website")}">`,
    `  <meta property="og:site_name" content="${attr(SITE.title)}">`,
    `  <meta property="og:title" content="${attr(og.title)}">`,
    `  <meta property="og:description" content="${attr(og.description)}">`,
    `  <meta property="og:url" content="${attr(url)}">`,
  ];
  if (SITE.ogImage) {
    const img = `${SITE.baseURL}${SITE.ogImage}`;
    lines.push(`  <meta property="og:image" content="${attr(img)}">`);
    lines.push(`  <meta name="twitter:card" content="summary_large_image">`);
    lines.push(`  <meta name="twitter:image" content="${attr(img)}">`);
  } else {
    lines.push(`  <meta name="twitter:card" content="summary">`);
  }
  lines.push(`  <meta name="twitter:title" content="${attr(og.title)}">`);
  lines.push(`  <meta name="twitter:description" content="${attr(og.description)}">`);
  return lines.join("\n");
}

/**
 * 生成完整 HTML 文档。
 * @param {object} opts
 * @param {string} opts.title       <title> 内容
 * @param {string} opts.description  meta description
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
    active = "",
    scripts = [],
    bodyClass = "colorscheme-dark",
    page = "",
    main,
    og,
  } = opts;

  const allScripts = ["/js/i18n.js", "/js/coder.js", "/js/vendor/fuse.min.js", "/js/search.js", ...scripts];
  const meta = renderMeta(og);

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${description}">
  <meta name="generator" content="Hugo 0.82.0">
  <link rel="icon" href="/images/favicon.png" type="image/png">
  <link rel="stylesheet" href="/css/fontawesome-all.min.css">
  <link rel="stylesheet" href="/css/coder.css">
${renderScripts(allScripts)}${meta ? "\n" + meta : ""}
  <title>${title}</title>
</head>
<body class="${bodyClass}"${page ? ` data-i18n-page="${page}"` : ""}>
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
        <p data-i18n="footer.text">© 2021 - 2026 CWL · Powered by Hugo · Theme inspired by Coder</p>
      </section>
    </footer>
  </div>
</body>
</html>`;
}
