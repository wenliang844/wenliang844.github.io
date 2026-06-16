// 标签云页 → tags/index.html
// 复用现有 .list-page / .tag-filter / .tag-chip 样式，零新增 CSS。
// 每个标签链接到 /post/?tag=<标签>，由 blog.js 在列表页就地激活筛选。
import { renderPage } from "./layout.mjs";

// 把标签文本编码进 URL（保留可读性，空格等交给 encodeURIComponent）。
function tagHref(tag) {
  return `/post/?tag=${encodeURIComponent(tag)}`;
}

/**
 * @param {Array<{tag: string, count: number}>} tagStats 已排序的标签及其文章数
 */
export function renderTagsPage(tagStats) {
  const chips = tagStats
    .map(
      ({ tag, count }) =>
        `          <a class="tag-chip" href="${tagHref(tag)}">${tag} <span class="tag-count">${count}</span></a>`,
    )
    .join("\n");

  const main = `    <main class="content">
      <section class="list-page container">
        <h1>Tags</h1>
        <p class="lead">按技术标签浏览文章，点击任意标签跳转到博客列表并自动筛选。</p>
        <div class="tag-filter tag-cloud" aria-label="标签云">
${chips}
        </div>
      </section>
    </main>`;

  const description = "博客标签：按技术主题浏览CWL的项目复盘与工程实践文章。";
  return renderPage({
    title: "Tags :: CWLBlog",
    description,
    active: "blog",
    og: { type: "website", title: "Tags", description, path: "/tags/" },
    main,
  });
}
