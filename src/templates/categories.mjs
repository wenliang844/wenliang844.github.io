// 时间归档页 → categories/index.html
// 这里沿用现有文章目录样式，把“分类”落到年份维度。
import { renderPage } from "./layout.mjs";
import { escapeAttr, escapeHtml, isoDate } from "../lib/format.mjs";

function enValue(post, key) {
  return post[`${key}En`] || post[key] || "";
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

function renderArchiveLink(post) {
  return `              <li>
                <a class="post-tree-link" href="/post/#${post.slug}">
                  <span class="tree-title" data-i18n="post.${post.slug}.shortTitle" data-i18n-en="${escapeAttr(enValue(post, "shortTitle"))}">${escapeHtml(post.shortTitle)}</span>
                  <time datetime="${isoDate(post.date)}">${isoDate(post.date)}</time>
                </a>
              </li>`;
}

function renderYearGroup(group) {
  const links = group.posts.map(renderArchiveLink).join("\n");
  return `          <details class="tree-group" open>
            <summary>
              <span><i class="fas fa-folder-open" aria-hidden="true"></i> ${group.year}</span>
              <span class="tree-count">${group.posts.length}</span>
            </summary>
            <ul>
${links}
            </ul>
          </details>`;
}

export function renderCategoriesPage(posts, stats) {
  const groups = groupPostsByYear(posts).map(renderYearGroup).join("\n");
  const main = `    <main class="content">
      <section class="list-page container">
        <h1 data-i18n="categories.title" data-i18n-en="Time Archive">时间归档</h1>
        <p class="lead" data-i18n="categories.lead">按年份回看项目复盘，从 AI Coding、低代码与工作流基础设施，到 SaaS 后台，再到智能分析预警和规则引擎告警闭环。</p>
        <div class="timeline-stats" aria-label="归档概览" data-i18n-aria="categories.stats.aria">
          <div>
            <strong>${stats.count}</strong>
            <span data-i18n="post.stats.posts">篇复盘</span>
          </div>
          <div>
            <strong>${stats.yearCount}</strong>
            <span data-i18n="categories.stats.years">个年份</span>
          </div>
          <div>
            <strong>${stats.range}</strong>
            <span data-i18n="post.stats.year">时间跨度</span>
          </div>
        </div>
        <nav class="post-tree-nav" aria-label="时间归档" data-i18n-aria="categories.archive.aria">
${groups}
        </nav>
      </section>
    </main>`;

  const description =
    "按年份整理 CWLBlog 的项目复盘，覆盖 AI Coding、低代码、工作流、SaaS 后台、智能分析预警与规则引擎。";
  return renderPage({
    title: "时间归档 :: CWLBlog",
    description,
    titleEn: "Time Archive :: CWLBlog",
    descriptionEn:
      "A year-based archive of CWLBlog project retrospectives covering AI coding, low-code, workflow, SaaS backend, intelligent analysis and rule engines.",
    active: "blog",
    page: "categories",
    og: { type: "website", title: "Time Archive", description, path: "/categories/" },
    main,
  });
}
