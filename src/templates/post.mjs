// 文章相关模板：单篇页、博客列表页（树形单页显隐）。
import { buildPageJsonLd, renderPage } from "./layout.mjs";
import { CONTENT_CATEGORIES, CONTENT_SERIES, SITE } from "../config.mjs";
import { isoDate, longDate, escapeAttr, escapeHtml } from "../lib/format.mjs";

function enValue(post, key) {
  return post[`${key}En`] || post[key] || "";
}

function i18nText(key, zh, en, extra = "") {
  return `data-i18n="${key}" data-i18n-en="${escapeAttr(en || zh)}"${extra ? ` ${extra}` : ""}`;
}

function tagEn(post, tag, index) {
  return (post.tagsEn && post.tagsEn[index]) || tag;
}

// 阅读时长占位：SSR 输出静态值作为无 JS 兜底；coder.js 会在运行时
// 按当前语言重算并刷新（querySelectorAll(".reading-time")），
// 且检测到已有 .reading-time 时不再重复追加。
function renderReadingTime(post) {
  const minutes = post.readMinutes || 1;
  return `<span class="reading-time"><i class="fas fa-clock" aria-hidden="true"></i> <span data-i18n="dyn.readingPrefix">约</span> ${minutes} <span data-i18n="dyn.readingSuffix">分钟</span></span>`;
}

function renderRevision(post) {
  const published = isoDate(post.date);
  const modified = isoDate(post.modified || post.date);
  const updated = modified > published
    ? `<span>最后更新 <time datetime="${modified}">${longDate(modified)}</time></span>`
    : "";
  const history = post.revisionUrl
    ? `<a href="${escapeAttr(post.revisionUrl)}" target="_blank" rel="noopener noreferrer">修订历史</a>`
    : "";
  return `<div class="article-revision"><span>发布于 <time datetime="${published}">${longDate(published)}</time></span>${updated}${history}</div>`;
}

// 列表页用：标签按钮由 blog.js 接管就地筛选。
function renderListTags(post) {
  return post.tags.map((tag, index) => {
    return `<button class="post-list-tag" type="button" data-tag="${escapeAttr(tag)}" data-i18n="post.${post.slug}.tag.${index}" data-i18n-en="${escapeAttr(tagEn(post, tag, index))}">${escapeHtml(tag)}</button>`;
  }).join("");
}

function prefixTocIds(html, prefix) {
  if (!prefix) {
    return html;
  }
  return html
    .replace(/\sid="(toc-[^"]+)"/g, ` id="${prefix}-$1"`)
    .replace(/\shref="#(toc-[^"]+)"/g, ` href="#${prefix}-$1"`);
}

// 单篇页用：tags 渲染为链接，点击跳转到 /post/?tag= 并自动筛选
//（单篇页不加载 blog.js，因此用真链接而非就地筛选）。
function renderTagLinks(post) {
  return post.tags
    .map((tag, index) => `<a href="/post/?tag=${encodeURIComponent(tag)}" data-tag="${escapeAttr(tag)}" data-i18n="post.${post.slug}.tag.${index}" data-i18n-en="${escapeAttr(tagEn(post, tag, index))}">${escapeHtml(tag)}</a>`)
    .join("");
}

function renderTaxonomy(post) {
  const category = CONTENT_CATEGORIES[post.category];
  const series = post.series ? CONTENT_SERIES[post.series] : null;
  if (!category && !series) return "";
  const categoryLink = category
    ? `<a href="/categories/${escapeAttr(post.category)}/"><span>分类</span>${escapeHtml(category.name)}</a>`
    : "";
  const seriesLink = series
    ? `<a href="/series/${escapeAttr(post.series)}/"><span>系列 ${post.seriesOrder}</span>${escapeHtml(series.name)}</a>`
    : "";
  return `            <nav class="post-taxonomy" aria-label="内容分类与系列">
              ${categoryLink}${seriesLink}
            </nav>`;
}

function renderCover(post, variant = "list") {
  const asset = post.coverAsset;
  if (!asset) return "";
  const eager = variant === "hero";
  const image = `<img src="${escapeAttr(asset.src)}" width="${asset.width}" height="${asset.height}" alt="${escapeAttr(asset.alt)}" loading="${eager ? "eager" : "lazy"}" decoding="async"${eager ? ' fetchpriority="high"' : ""}>`;
  const picture = `<picture><source srcset="${escapeAttr(asset.avif)}" type="image/avif"><source srcset="${escapeAttr(asset.webp)}" type="image/webp">${image}</picture>`;
  if (eager) {
    return `          <figure class="post-cover post-cover-hero">${picture}</figure>`;
  }
  return `            <a class="post-cover post-cover-list" href="/post/${escapeAttr(post.slug)}/" tabindex="-1" aria-hidden="true">${picture}</a>`;
}

function renderSeriesNavigation(series) {
  if (!series) return "";
  const previous = series.prev
    ? `<a href="/post/${series.prev.slug}/">← ${escapeHtml(series.prev.shortTitle)}</a>`
    : "<span></span>";
  const next = series.next
    ? `<a href="/post/${series.next.slug}/">${escapeHtml(series.next.shortTitle)} →</a>`
    : "<span></span>";
  return `      <nav class="series-navigation" aria-label="系列连续阅读">
        <div>
          <span class="eyebrow">系列 ${series.index + 1} / ${series.total}</span>
          <a class="series-navigation-title" href="/series/${escapeAttr(series.id)}/">${escapeHtml(series.name)}</a>
        </div>
        <div class="series-navigation-links">${previous}${next}</div>
      </nav>`;
}

function renderI18nContent(post, indent, options = {}) {
  // 没有英文译文时，正文不打 data-i18n-lang 标记，保证任何语言下都显示（中文兜底）。
  const idPrefix = options.headingIdPrefix || "";
  if (!post.contentHtmlEn) {
    return `${indent}<div class="article-content">\n${prefixTocIds(post.contentHtml, idPrefix)}\n${indent}</div>`;
  }
  const zhPrefix = idPrefix ? `${idPrefix}-zh` : "";
  const enPrefix = idPrefix ? `${idPrefix}-en` : "";
  const zh = `${indent}<div class="article-content" data-i18n-lang="zh">\n${prefixTocIds(post.contentHtml, zhPrefix)}\n${indent}</div>`;
  const en = `${indent}<div class="article-content" data-i18n-lang="en" hidden>\n${prefixTocIds(post.contentHtmlEn, enPrefix)}\n${indent}</div>`;
  return `${zh}\n${en}`;
}

// 分享图标用内联 SVG，不依赖 Font Awesome 子集（子集里没有这些品牌字形）。
// 均为 24×24 viewBox、fill=currentColor，继承主题色。
const SHARE_ICONS = {
  // 通用“分享”节点图标（实心三点连线）
  share: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/></svg>',
  // X (Twitter)
  x: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
  // 新浪微博
  weibo: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M10.098 20.323c-3.977.391-7.414-1.406-7.672-4.02-.259-2.609 2.759-5.047 6.74-5.441 3.979-.394 7.413 1.404 7.671 4.018.259 2.6-2.759 5.049-6.737 5.439l-.002.004zM9.05 17.219c-.384.616-1.208.884-1.829.602-.612-.279-.793-.991-.406-1.593.379-.595 1.176-.861 1.793-.601.622.263.82.972.442 1.592zm1.27-1.627c-.141.237-.449.353-.689.253-.236-.09-.312-.359-.177-.586.138-.227.436-.346.672-.24.239.09.315.36.18.601l.014-.028zm.176-2.719c-1.893-.493-4.033.451-4.857 2.118-.836 1.704-.026 3.603 1.886 4.21 1.983.63 4.318-.354 5.132-2.179.8-1.793-.247-3.667-2.161-4.149zm7.563-1.224c-.346-.105-.57-.18-.405-.615.375-.977.42-1.829-.01-2.448-.81-1.155-3.027-1.092-5.567-.03 0 0-.795.346-.591-.284.39-1.26.33-2.31-.27-2.913-1.365-1.365-4.992.045-8.103 3.157C-.21 11.84-.96 14.61.04 16.7c1.62 3.405 6.99 3.585 11.52 1.875 4.53-1.71 8.42-5.97 6.78-9.45-.36-.78-1.05-1.32-1.86-1.626.18-.27.35-.54.4-.825.05-.36-.18-.54-.45-.39-.045.075-.075.165-.09.255-.054.21-.139.435-.27.63zm1.5-3.99c-.165-.5-.434-.945-.794-1.305-.36-.36-.81-.629-1.305-.794-.165-.06-.345.029-.405.194-.06.165.03.345.195.405.36.12.69.314.96.585.27.27.464.6.585.96.06.165.225.255.39.21.165-.045.255-.225.21-.39l-.031-.06zm2.355-.766c-.345-1.035-.93-1.965-1.71-2.745-.78-.781-1.71-1.366-2.746-1.711-.27-.09-.539.06-.629.33-.09.27.06.539.33.629.825.27 1.575.735 2.205 1.365.63.63 1.095 1.38 1.365 2.205.09.27.359.42.629.33.27-.09.42-.36.33-.629l.001-.024z"/></svg>',
  // 微信
  wechat: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.027-.406-.032zm-3.39 2.927c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z"/></svg>',
  // 链接（复制）
  link: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',
};

// 文章分享条：分享到 X、微博、微信二维码、复制链接。
// share.js 读取 data-share-url / data-share-title 生成各渠道行为；
// 列表页每篇 panel 各有一条（数据随文章不同），切换文章即用对应那条。
function renderShare(post) {
  const url = `/post/${post.slug}/`;
  return `            <div class="post-share" data-share-url="${url}" data-share-title="${escapeAttr(post.shortTitle)}" data-share-title-en="${escapeAttr(enValue(post, "shortTitle"))}">
              <span class="share-label" data-i18n="post.share">${SHARE_ICONS.share} 分享</span>
              <a class="share-btn" data-share="x" href="#" target="_blank" rel="noopener" aria-label="分享到 X" data-i18n-aria="post.share.x">${SHARE_ICONS.x}</a>
              <button class="share-btn" type="button" data-share="weibo" aria-label="分享到微博" data-i18n-aria="post.share.weibo">${SHARE_ICONS.weibo}</button>
              <button class="share-btn" type="button" data-share="wechat" aria-label="微信扫码分享" data-i18n-aria="post.share.wechat">${SHARE_ICONS.wechat}</button>
              <button class="share-btn" type="button" data-share="copy" aria-label="复制链接" data-i18n-aria="post.share.copy">${SHARE_ICONS.link}</button>
            </div>`;
}

// 渲染文章目录
function renderToc(toc, tocEn) {
  if (!toc || toc.length === 0) return "";

  const items = toc.map((item, index) => {
    const enText = tocEn && tocEn[index] ? tocEn[index].text : item.text;
    const indent = item.level === 3 ? ' class="toc-sub"' : '';
    return `            <li${indent}><a href="#${item.id}" data-toc-id="${item.id}" data-i18n="toc.${item.id}" data-i18n-en="${escapeAttr(enText)}">${escapeHtml(item.text)}</a></li>`;
  }).join("\n");

  return `        <aside class="toc-sidebar is-collapsed" aria-label="目录" data-i18n-aria="toc.aria">
          <div class="toc-header">
            <button class="toc-toggle" type="button" aria-expanded="false" aria-label="展开/收起目录" data-i18n-aria="toc.toggle">
              <i class="fas fa-list" aria-hidden="true"></i>
              <span data-i18n="toc.title">目录</span>
              <i class="fas fa-chevron-down toc-chevron" aria-hidden="true"></i>
            </button>
          </div>
          <nav class="toc-nav">
            <ul>
${items}
            </ul>
          </nav>
        </aside>`;
}

// 单篇底部上一篇/下一篇导航。
// prev = 更新的一篇（←），next = 更老的一篇（→）；缺失时回退到 /post/。
function renderPager(prev, next) {
  const prevHref = prev ? `/post/${prev.slug}/` : "/post/";
  const prevLabel = prev ? prev.shortTitle : "文章";
  const prevLabelEn = prev ? enValue(prev, "shortTitle") : "Posts";
  const nextHref = next ? `/post/${next.slug}/` : "/post/";
  const nextLabel = next ? next.shortTitle : "文章";
  const nextLabelEn = next ? enValue(next, "shortTitle") : "Posts";

  return `      <nav class="post-pager" aria-label="Post pagination">
        <a class="pager-prev" href="${prevHref}">← <span ${i18nText(prev ? `post.${prev.slug}.shortTitle` : "post.meta.posts", prevLabel, prevLabelEn)}>${escapeHtml(prevLabel)}</span></a>
        <a class="pager-next" href="${nextHref}"><span ${i18nText(next ? `post.${next.slug}.shortTitle` : "post.meta.posts", nextLabel, nextLabelEn)}>${escapeHtml(nextLabel)}</span> →</a>
      </nav>`;
}

// 下一篇浮动推荐卡：默认隐藏，post-next.js 在滚动接近底部时滑入。
// next = 更老的一篇；无 next 时不渲染（renderPostPage 也不挂脚本）。
function renderNextPopup(next, prev) {
  if (!next) return "";
  const prevAttrs = prev
    ? ` data-prev-url="/post/${prev.slug}/" data-prev-title="${escapeAttr(prev.shortTitle)}" data-prev-title-en="${escapeAttr(enValue(prev, "shortTitle"))}"`
    : "";
  return `      <aside class="next-popup" hidden aria-label="下一篇推荐" data-i18n-aria="post.next.aria" data-next-url="/post/${next.slug}/" data-next-title="${escapeAttr(next.shortTitle)}" data-next-title-en="${escapeAttr(enValue(next, "shortTitle"))}"${prevAttrs}>
        <button class="next-popup-close" type="button" aria-label="关闭" data-i18n-aria="post.next.close"><i class="fas fa-times" aria-hidden="true"></i></button>
        <span class="next-popup-eyebrow" data-i18n="post.next.eyebrow" data-i18n-en="Up next">下一篇</span>
        <a class="next-popup-link" href="/post/${next.slug}/">
          <span class="next-popup-title" ${i18nText(`post.${next.slug}.shortTitle`, next.shortTitle, enValue(next, "shortTitle"))}>${escapeHtml(next.shortTitle)}</span>
        </a>
      </aside>`;
}

// 相关文章：基于标签重叠由构建期算好（nav.related），渲染在文末 pager 之前。
function renderRelated(related) {
  if (!related || related.length === 0) return "";
  const cards = related
    .map((post) => {
      const recommendation = post.recommendation || {};
      const reasons = recommendation.reasons || [];
      const reasonLabels = [];
      const reasonLabelsEn = [];
      if (reasons.includes("linked")) {
        reasonLabels.push("正文引用");
        reasonLabelsEn.push("Linked content");
      }
      if (reasons.includes("series")) {
        reasonLabels.push("同一系列");
        reasonLabelsEn.push("Same series");
      }
      if (reasons.includes("category")) {
        reasonLabels.push("同一专题");
        reasonLabelsEn.push("Same topic");
      }
      if (reasons.includes("tags") && recommendation.sharedTags) {
        reasonLabels.push(`${recommendation.sharedTags} 个共同标签`);
        reasonLabelsEn.push(`${recommendation.sharedTags} shared tag${recommendation.sharedTags > 1 ? "s" : ""}`);
      }
      const reason = reasonLabels.slice(0, 2).join(" · ") || post.eyebrow;
      const reasonEn = reasonLabelsEn.slice(0, 2).join(" · ") || enValue(post, "eyebrow");
      return `        <li>
          <a class="related-card" href="/post/${post.slug}/" data-analytics-event="related_click" data-analytics-target="${escapeAttr(post.slug)}">
            <span class="related-eyebrow">${escapeHtml(post.eyebrow)}</span>
            <span class="related-title" ${i18nText(`post.${post.slug}.shortTitle`, post.shortTitle, enValue(post, "shortTitle"))}>${escapeHtml(post.shortTitle)}</span>
            <span class="related-reason" data-i18n-en="${escapeAttr(reasonEn)}">${escapeHtml(reason)}</span>
            <time datetime="${isoDate(post.date)}">${isoDate(post.date)}</time>
          </a>
        </li>`;
    })
    .join("\n");
  return `      <nav class="post-related" aria-label="相关文章" data-i18n-aria="post.related.aria">
        <h2 class="post-related-title" data-i18n="post.related.title" data-i18n-en="Related posts">相关文章</h2>
        <ul class="related-list">
${cards}
        </ul>
      </nav>`;
}

function renderBacklinks(backlinks) {
  if (!backlinks || backlinks.length === 0) return "";
  const items = backlinks.map((post) => `          <li>
            <a href="/post/${escapeAttr(post.slug)}/">
              <strong>${escapeHtml(post.shortTitle)}</strong>
              <span>${escapeHtml(post.summary)}</span>
            </a>
          </li>`).join("\n");
  return `      <section class="post-backlinks" aria-labelledby="post-backlinks-title">
        <div>
          <span class="eyebrow">Backlinks</span>
          <h2 id="post-backlinks-title">哪些文章提到了这里</h2>
        </div>
        <ul>
${items}
        </ul>
      </section>`;
}

// Article 结构化数据（JSON-LD），数据均取自 post 对象。
function buildArticleJsonLd(post) {
  const url = `${SITE.baseURL}/post/${post.slug}/`;
  const data = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.shortTitle,
    name: post.title,
    description: post.description,
    datePublished: isoDate(post.date),
    dateModified: isoDate(post.modified || post.date),
    inLanguage: "zh-CN",
    keywords: post.tags.join(", "),
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    author: { "@type": "Person", name: SITE.author || "CWL" },
    publisher: {
      "@type": "Organization",
      name: SITE.title,
      logo: { "@type": "ImageObject", url: `${SITE.baseURL}/images/favicon.png` },
    },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "首页", item: `${SITE.baseURL}/` },
        { "@type": "ListItem", position: 2, name: "文章", item: `${SITE.baseURL}/post/` },
        { "@type": "ListItem", position: 3, name: post.shortTitle, item: url },
      ],
    },
  };
  if (post.images && post.images.length) {
    data.image = post.images.map((src) =>
      /^https?:\/\//i.test(src)
        ? src
        : src.startsWith("/")
          ? `${SITE.baseURL}${src}`
          : `${url}${src.replace(/^\.?\//, "")}`,
    );
  }
  return data;
}

function buildPostListJsonLd(posts, description) {
  return buildPageJsonLd({
    type: "CollectionPage",
    name: "CWLBlog 文章",
    description,
    path: "/post/",
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: posts.length,
      itemListElement: posts.map((post, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: post.shortTitle,
        url: `${SITE.baseURL}/post/${post.slug}/`,
      })),
    },
  });
}

/**
 * 单篇文章页 → post/<slug>/index.html
 * @param {object} post 文章对象（含 contentHtml）
 * @param {object} nav  { prev, next, related, backlinks } 相邻文章 + 相关文章 + 反向链接
 */
export function renderPostPage(post, nav) {
  const hasEnglishContent = Boolean(post.contentHtmlEn);
  const tocHtml = renderToc(post.toc, post.tocEn);
  const main = `    <main id="main-content" class="content container">
      <div class="post-layout">
        <article class="article" data-post-slug="${escapeAttr(post.slug)}">
          <header class="article-header">
            <span class="eyebrow">${escapeHtml(post.eyebrow)}</span>
            <h1 data-pagefind-meta="title"${hasEnglishContent ? ` ${i18nText(`post.${post.slug}.title`, post.title, enValue(post, "title"))}` : ""}>${escapeHtml(post.title)}</h1>
            <div class="article-meta">
              <time datetime="${isoDate(post.date)}" data-pagefind-meta="date[datetime]">${longDate(post.date)}</time>
              <span>·</span>
              <a href="/post/#${post.slug}" data-i18n="post.meta.posts" data-i18n-en="Posts">文章</a>
              <span>·</span>
              ${renderReadingTime(post)}
            </div>
            ${renderRevision(post)}
            <p class="article-summary"${hasEnglishContent ? ` ${i18nText(`post.${post.slug}.summary`, post.summary, enValue(post, "summary"))}` : ""}>${escapeHtml(post.summary)}</p>
            <div class="post-tags">
              ${renderTagLinks(post)}
            </div>
${renderTaxonomy(post)}
          </header>
${renderCover(post, "hero")}
${renderI18nContent(post, "          ")}
${renderShare(post)}
        </article>
${tocHtml}
      </div>
      <section class="comments container" aria-label="评论" data-i18n-aria="post.comments.aria">
        <h2 data-i18n="post.comments" data-i18n-html><i class="fas fa-comments" aria-hidden="true"></i> 评论</h2>
        <div id="giscus-thread"></div>
      </section>
${renderBacklinks(nav.backlinks)}
${renderRelated(nav.related)}
${renderSeriesNavigation(nav.series)}
${renderPager(nav.prev, nav.next)}
${renderNextPopup(nav.next, nav.prev)}
    </main>`;

  const scripts = ["/js/vendor/qrcode.min.js", "/js/share.js", "/js/giscus.js", "/js/toc.js"];
  if (nav.next) scripts.push("/js/post-next.js");

  return renderPage({
    title: `${post.shortTitle} :: CWLBlog`,
    description: post.description,
    titleEn: `${enValue(post, "shortTitle")} :: CWLBlog`,
    descriptionEn: enValue(post, "description"),
    active: "blog",
    page: "posts",
    scripts,
    jsonLd: buildArticleJsonLd(post),
    languageMode: hasEnglishContent ? "bilingual" : "zh-only",
    og: {
      type: "article",
      title: post.shortTitle,
      description: post.description,
      path: `/post/${post.slug}/`,
      image: post.cover,
    },
    main,
  });
}

// 列表页左侧树形导航中的单条链接。
function renderTreeLink(post) {
  return `                <li>
                  <a class="post-tree-link" href="#post-${post.slug}" data-post-target="post-${post.slug}">
                    <span class="tree-title" ${i18nText(`post.${post.slug}.shortTitle`, post.shortTitle, enValue(post, "shortTitle"))}>${escapeHtml(post.shortTitle)}</span>
                    <time datetime="${isoDate(post.date)}">${isoDate(post.date)}</time>
                  </a>
                </li>`;
}

function groupPostsByYear(posts) {
  const groups = [];
  for (const post of posts) {
    const year = post.date.slice(0, 4);
    let group = groups[groups.length - 1];
    if (!group || group.year !== year) {
      group = { year, posts: [] };
      groups.push(group);
    }
    group.posts.push(post);
  }
  return groups;
}

function renderTreeGroup(group) {
  const links = group.posts
    .map((post) => renderTreeLink(post))
    .join("\n");
  return `            <details class="tree-group" open>
              <summary>
                <span><i class="fas fa-folder-open" aria-hidden="true"></i> ${group.year}</span>
                <span class="tree-count">${group.posts.length}</span>
              </summary>
              <ul>
${links}
              </ul>
            </details>`;
}

// 列表页只输出扫描所需的元数据，正文只存在于单篇 URL，避免列表体积随全文增长。
function renderPostCard(post) {
  return `          <article class="post-summary-card" id="post-${escapeAttr(post.slug)}" data-post-slug="${escapeAttr(post.slug)}">
            <span id="${escapeAttr(post.slug)}" class="legacy-post-anchor" aria-hidden="true"></span>
${renderCover(post)}
            <div class="post-summary-meta">
              <span class="eyebrow">${escapeHtml(post.eyebrow)}</span>
              <time datetime="${isoDate(post.date)}">${longDate(post.date)}</time>
              ${renderReadingTime(post)}
            </div>
            <h2><a href="/post/${post.slug}/" ${i18nText(`post.${post.slug}.title`, post.title, enValue(post, "title"))}>${escapeHtml(post.title)}</a></h2>
            <p class="article-summary" ${i18nText(`post.${post.slug}.summary`, post.summary, enValue(post, "summary"))}>${escapeHtml(post.summary)}</p>
            <div class="post-tags" aria-label="文章标签">
              ${renderListTags(post)}
            </div>
${renderTaxonomy(post)}
            <a class="post-summary-link" href="/post/${post.slug}/" aria-label="阅读全文：${escapeAttr(post.shortTitle)}">
              <span data-i18n="post.readMore" data-i18n-en="Read article">阅读全文</span>
              <span aria-hidden="true">→</span>
            </a>
          </article>`;
}

/**
 * 博客列表页 → post/index.html
 * @param {object[]} posts 已按日期倒序排列的文章
 * @param {object} stats   { count, systems, year } 顶部统计
 */
export function renderPostList(posts, stats) {
  const treeGroups = groupPostsByYear(posts)
    .map((group) => renderTreeGroup(group))
    .join("\n");
  const cards = posts
    .map((post) => renderPostCard(post))
    .join("\n\n");

  const main = `    <main id="main-content" class="content">
      <section class="blog-layout container" aria-label="Blog">
        <aside class="post-tree" aria-label="文章目录" data-i18n-aria="post.tree.aria">
          <div class="post-tree-header">
            <span class="eyebrow">${stats.range} Timeline</span>
            <h1 data-i18n="post.list.title" data-i18n-en="Posts">文章</h1>
            <p class="lead" data-i18n="post.tree.lead">按时间线整理 AI Coding、低代码、工作流、SaaS 后台与智能分析预警相关实践，重点记录系统边界、数据流转、规则运行时和平台化落地。</p>
          </div>
          <div class="timeline-stats" aria-label="内容概览" data-i18n-aria="post.stats.aria">
            <div>
              <strong>${stats.count}</strong>
              <span data-i18n="post.stats.posts">篇复盘</span>
            </div>
            <div>
              <strong>${stats.systems}</strong>
              <span data-i18n="post.stats.systems">类主题</span>
            </div>
            <div>
              <strong>${stats.range}</strong>
              <span data-i18n="post.stats.year">时间跨度</span>
            </div>
          </div>
          <nav class="post-tree-nav">
${treeGroups}
          </nav>
          <div class="post-search">
            <i class="fas fa-search" aria-hidden="true"></i>
            <input type="search" id="post-search-input" placeholder="搜索文章 / 标签…" aria-label="搜索文章" data-i18n-ph="post.search.ph" data-i18n-aria="post.search.aria">
          </div>
          <div class="tag-filter" id="tag-filter" aria-label="按标签筛选" data-i18n-aria="post.tagfilter.aria"></div>
        </aside>

        <section class="post-detail" aria-label="文章列表" data-i18n-aria="post.tree.aria">
${cards}
          <p class="post-list-empty" hidden aria-live="polite"></p>
        </section>
      </section>
    </main>`;

  const description =
    "按时间线整理项目复盘：覆盖 Codex 与 Claude 协作、低代码引擎、Activiti 工作流、企顾 SaaS、智能分析预警平台与规则引擎告警闭环。";
  return renderPage({
    title: "文章 :: CWLBlog",
    description,
    titleEn: "Posts :: CWLBlog",
    active: "blog",
    page: "posts",
    scripts: ["/js/blog.js?v=20260806"],
    jsonLd: buildPostListJsonLd(posts, description),
    languageMode: "zh-only",
    og: { type: "website", title: "Posts", description, path: "/post/" },
    main,
  });
}
