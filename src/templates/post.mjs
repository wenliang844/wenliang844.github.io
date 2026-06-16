// 文章相关模板：单篇页、博客列表页（树形单页显隐）。
import { renderPage } from "./layout.mjs";
import { isoDate, longDate } from "../lib/format.mjs";

// 列表页面板用：tags 渲染为 span，由 blog.js 接管就地筛选（span 之间不留空白）。
function renderTags(tags) {
  return tags.map((t) => `<span>${t}</span>`).join("");
}

// 单篇页用：tags 渲染为链接，点击跳转到 /post/?tag= 并自动筛选
//（单篇页不加载 blog.js，因此用真链接而非就地筛选）。
function renderTagLinks(tags) {
  return tags
    .map((t) => `<a href="/post/?tag=${encodeURIComponent(t)}">${t}</a>`)
    .join("");
}

// 单篇底部上一篇/下一篇导航。
// prev = 更新的一篇（←），next = 更老的一篇（→）；缺失时回退到 /post/。
function renderPager(prev, next) {
  const prevHref = prev ? `/post/${prev.slug}/` : "/post/";
  const prevLabel = prev ? prev.shortTitle : "Posts";
  const nextHref = next ? `/post/${next.slug}/` : "/post/";
  const nextLabel = next ? next.shortTitle : "Posts";

  return `      <nav class="post-pager" aria-label="Post pagination">
        <a class="pager-prev" href="${prevHref}">← ${prevLabel}</a>
        <a class="pager-next" href="${nextHref}">${nextLabel} →</a>
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
          <span class="eyebrow">${post.eyebrow}</span>
          <h1>${post.title}</h1>
          <div class="article-meta">
            <time datetime="${isoDate(post.date)}">${longDate(post.date)}</time>
            <span>·</span>
            <a href="/post/#${post.slug}">Posts</a>
          </div>
          <p class="article-summary">${post.summary}</p>
          <div class="post-tags">
            ${renderTagLinks(post.tags)}
          </div>
        </header>
        <div class="article-content">
${post.contentHtml}
        </div>
      </article>
      <section class="comments container" aria-label="评论">
        <h2><i class="fas fa-comments" aria-hidden="true"></i> 评论</h2>
        <div id="giscus-thread"></div>
      </section>
${renderPager(nav.prev, nav.next)}
    </main>`;

  return renderPage({
    title: `${post.shortTitle} :: CWLBlog`,
    description: post.description,
    active: "blog",
    scripts: ["/js/giscus.js"],
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
                    <span class="tree-title">${post.shortTitle}</span>
                    <time datetime="${isoDate(post.date)}">${isoDate(post.date)}</time>
                  </a>
                </li>`;
}

// 列表页右侧的单篇文章面板（与单篇页正文相同，但 meta 链接指向单篇）。
function renderArticlePanel(post, isFirst) {
  const activeCls = isFirst ? " active" : "";
  return `          <article class="article blog-article${activeCls}" id="post-${post.slug}" data-post-slug="${post.slug}">
            <header class="article-header">
              <span class="eyebrow">${post.eyebrow}</span>
              <h1>${post.title}</h1>
              <div class="article-meta">
                <time datetime="${isoDate(post.date)}">${longDate(post.date)}</time>
              </div>
              <p class="article-summary">${post.summary}</p>
              <div class="post-tags">
                ${renderTags(post.tags)}
              </div>
            </header>
            <div class="article-content">
${post.contentHtml}
            </div>
          </article>`;
}

/**
 * 博客列表页 → post/index.html
 * @param {object[]} posts 已按日期倒序排列的文章
 * @param {object} stats   { count, systems, year } 顶部统计
 */
export function renderPostList(posts, stats) {
  const treeLinks = posts
    .map((post, i) => renderTreeLink(post, i === 0))
    .join("\n");
  const panels = posts
    .map((post, i) => renderArticlePanel(post, i === 0))
    .join("\n\n");

  const main = `    <main class="content">
      <section class="blog-layout container" aria-label="Blog">
        <aside class="post-tree" aria-label="文章目录">
          <div class="post-tree-header">
            <span class="eyebrow">${stats.year} Timeline</span>
            <h1>Posts</h1>
            <p class="lead">把今年做过的系统重构、平台化建设和工程实践，整理成可持续更新的技术札记。</p>
          </div>
          <div class="timeline-stats" aria-label="内容概览">
            <div>
              <strong>${stats.count}</strong>
              <span>篇复盘</span>
            </div>
            <div>
              <strong>${stats.systems}</strong>
              <span>类系统</span>
            </div>
            <div>
              <strong>${stats.year}</strong>
              <span>今年时间线</span>
            </div>
          </div>
          <nav class="post-tree-nav">
            <details class="tree-group" open>
              <summary>
                <span><i class="fas fa-folder-open" aria-hidden="true"></i> ${stats.year}</span>
                <span class="tree-count">${stats.count}</span>
              </summary>
              <ul>
${treeLinks}
              </ul>
            </details>
          </nav>
          <div class="post-search">
            <i class="fas fa-search" aria-hidden="true"></i>
            <input type="search" id="post-search-input" placeholder="搜索文章 / 标签…" aria-label="搜索文章">
          </div>
          <div class="tag-filter" id="tag-filter" aria-label="按标签筛选"></div>
        </aside>

        <section class="post-detail" aria-live="polite">
${panels}
          <section class="comments" aria-label="评论">
            <h2><i class="fas fa-comments" aria-hidden="true"></i> 评论</h2>
            <div id="giscus-thread" data-giscus-mode="switch"></div>
          </section>
        </section>
      </section>
    </main>`;

  const description =
    "2026 年技术项目复盘：视频智能侦测、规则引擎、财税 SaaS、低代码、审批流和工程化实践。";
  return renderPage({
    title: "Posts :: CWLBlog",
    description,
    active: "blog",
    scripts: ["/js/blog.js", "/js/giscus.js"],
    og: { type: "website", title: "Posts", description, path: "/post/" },
    main,
  });
}
