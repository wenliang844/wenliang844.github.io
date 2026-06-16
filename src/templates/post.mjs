// 文章相关模板：单篇页、博客列表页（树形单页显隐）。
import { renderPage } from "./layout.mjs";
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

// 列表页面板用：tags 渲染为 span，由 blog.js 接管就地筛选（span 之间不留空白）。
function renderTags(post) {
  return post.tags.map((tag, index) => {
    return `<span data-tag="${escapeAttr(tag)}" data-i18n="post.${post.slug}.tag.${index}" data-i18n-en="${escapeAttr(tagEn(post, tag, index))}">${escapeHtml(tag)}</span>`;
  }).join("");
}

// 单篇页用：tags 渲染为链接，点击跳转到 /post/?tag= 并自动筛选
//（单篇页不加载 blog.js，因此用真链接而非就地筛选）。
function renderTagLinks(post) {
  return post.tags
    .map((tag, index) => `<a href="/post/?tag=${encodeURIComponent(tag)}" data-tag="${escapeAttr(tag)}" data-i18n="post.${post.slug}.tag.${index}" data-i18n-en="${escapeAttr(tagEn(post, tag, index))}">${escapeHtml(tag)}</a>`)
    .join("");
}

function renderI18nContent(post, indent) {
  const zh = `${indent}<div class="article-content" data-i18n-lang="zh">\n${post.contentHtml}\n${indent}</div>`;
  if (!post.contentHtmlEn) return zh;
  const en = `${indent}<div class="article-content" data-i18n-lang="en" hidden>\n${post.contentHtmlEn}\n${indent}</div>`;
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

/**
 * 单篇文章页 → post/<slug>/index.html
 * @param {object} post 文章对象（含 contentHtml）
 * @param {object} nav  { prev, next } 相邻文章
 */
export function renderPostPage(post, nav) {
  const main = `    <main class="content container">
      <article class="article">
        <header class="article-header">
          <span class="eyebrow">${escapeHtml(post.eyebrow)}</span>
          <h1 ${i18nText(`post.${post.slug}.title`, post.title, enValue(post, "title"))}>${escapeHtml(post.title)}</h1>
          <div class="article-meta">
            <time datetime="${isoDate(post.date)}">${longDate(post.date)}</time>
            <span>·</span>
            <a href="/post/#${post.slug}" data-i18n="post.meta.posts" data-i18n-en="Posts">文章</a>
          </div>
          <p class="article-summary" ${i18nText(`post.${post.slug}.summary`, post.summary, enValue(post, "summary"))}>${escapeHtml(post.summary)}</p>
          <div class="post-tags">
            ${renderTagLinks(post)}
          </div>
        </header>
${renderI18nContent(post, "        ")}
${renderShare(post)}
      </article>
      <section class="comments container" aria-label="评论" data-i18n-aria="post.comments.aria">
        <h2 data-i18n="post.comments"><i class="fas fa-comments" aria-hidden="true"></i> 评论</h2>
        <div id="giscus-thread"></div>
      </section>
${renderPager(nav.prev, nav.next)}
    </main>`;

  return renderPage({
    title: `${post.shortTitle} :: CWLBlog`,
    description: post.description,
    titleEn: `${enValue(post, "shortTitle")} :: CWLBlog`,
    descriptionEn: enValue(post, "description"),
    active: "blog",
    page: "posts",
    scripts: ["/js/vendor/qrcode.min.js", "/js/share.js", "/js/giscus.js"],
    og: {
      type: "article",
      title: post.shortTitle,
      description: post.description,
      path: `/post/${post.slug}/`,
    },
    main,
  });
}

// 列表页左侧树形导航中的单条链接。
function renderTreeLink(post, isFirst) {
  const activeCls = isFirst ? " active" : "";
  const ariaCurrent = isFirst ? ' aria-current="page"' : "";
  return `                <li>
                  <a class="post-tree-link${activeCls}" href="#${post.slug}" data-post-target="post-${post.slug}"${ariaCurrent}>
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

function renderTreeGroup(group, activeSlug) {
  const links = group.posts
    .map((post) => renderTreeLink(post, post.slug === activeSlug))
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

// 列表页右侧的单篇文章面板（与单篇页正文相同，但 meta 链接指向单篇）。
function renderArticlePanel(post, isFirst) {
  const activeCls = isFirst ? " active" : "";
  return `          <article class="article blog-article${activeCls}" id="post-${post.slug}" data-post-slug="${post.slug}">
            <header class="article-header">
              <span class="eyebrow">${escapeHtml(post.eyebrow)}</span>
              <h1 ${i18nText(`post.${post.slug}.title`, post.title, enValue(post, "title"))}>${escapeHtml(post.title)}</h1>
              <div class="article-meta">
                <time datetime="${isoDate(post.date)}">${longDate(post.date)}</time>
              </div>
              <p class="article-summary" ${i18nText(`post.${post.slug}.summary`, post.summary, enValue(post, "summary"))}>${escapeHtml(post.summary)}</p>
              <div class="post-tags">
                ${renderTags(post)}
              </div>
            </header>
${renderI18nContent(post, "            ")}
${renderShare(post)}
          </article>`;
}

/**
 * 博客列表页 → post/index.html
 * @param {object[]} posts 已按日期倒序排列的文章
 * @param {object} stats   { count, systems, year } 顶部统计
 */
export function renderPostList(posts, stats) {
  const treeGroups = groupPostsByYear(posts)
    .map((group) => renderTreeGroup(group, posts[0].slug))
    .join("\n");
  const panels = posts
    .map((post, i) => renderArticlePanel(post, i === 0))
    .join("\n\n");

  const main = `    <main class="content">
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

        <section class="post-detail" aria-live="polite">
${panels}
          <section class="comments" aria-label="评论" data-i18n-aria="post.comments.aria">
            <h2 data-i18n="post.comments"><i class="fas fa-comments" aria-hidden="true"></i> 评论</h2>
            <div id="giscus-thread" data-giscus-mode="switch"></div>
          </section>
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
    scripts: ["/js/blog.js", "/js/vendor/qrcode.min.js", "/js/share.js", "/js/giscus.js"],
    og: { type: "website", title: "Posts", description, path: "/post/" },
    main,
  });
}
