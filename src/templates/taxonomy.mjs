import { buildPageJsonLd, renderPage, siteUrl } from "./layout.mjs";
import { escapeAttr, escapeHtml, isoDate } from "../lib/format.mjs";

function renderPostRow(post, index, kind) {
  const prefix = kind === "series" ? `第 ${index + 1} 篇` : post.eyebrow;
  return `          <li>
            <a class="taxonomy-post" href="/post/${escapeAttr(post.slug)}/">
              <span class="taxonomy-post-order">${escapeHtml(prefix)}</span>
              <strong>${escapeHtml(post.shortTitle)}</strong>
              <span>${escapeHtml(post.summary)}</span>
              <time datetime="${isoDate(post.date)}">${isoDate(post.date)}</time>
            </a>
          </li>`;
}

export function buildTaxonomyDetailPageModel(group, kind) {
  const noun = kind === "series" ? "系列" : "分类";
  const base = kind === "series" ? "/series/" : "/categories/";
  const rows = group.posts.map((post, index) => renderPostRow(post, index, kind)).join("\n");
  const main = `    <main id="main-content" class="content">
      <section class="list-page container taxonomy-page">
        <a class="taxonomy-back" href="${base}">← 返回${noun}</a>
        <span class="eyebrow">${noun} · ${group.posts.length} 篇</span>
        <h1>${escapeHtml(group.name)}</h1>
        <p class="lead">${escapeHtml(group.description)}</p>
        <ol class="taxonomy-post-list">
${rows}
        </ol>
      </section>
    </main>`;

  return {
    ...buildTaxonomyDetailPageMetadata(group, kind),
    main,
  };
}

export function buildTaxonomyDetailPageMetadata(group, kind) {
  const noun = kind === "series" ? "系列" : "分类";
  const base = kind === "series" ? "/series/" : "/categories/";
  const description = `${group.name}：${group.description}`;
  return {
    title: `${group.name} :: CWLBlog`,
    description,
    active: "blog",
    page: "categories",
    languageMode: "zh-only",
    jsonLd: buildPageJsonLd({
      type: "CollectionPage",
      name: group.name,
      description,
      path: `${base}${group.id}/`,
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: group.posts.length,
        itemListElement: group.posts.map((post, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: post.shortTitle,
          url: siteUrl(`/post/${post.slug}/`),
        })),
      },
    }),
    og: { type: "website", title: group.name, description, path: `${base}${group.id}/` },
  };
}

export function renderTaxonomyDetail(group, kind) {
  return renderPage(buildTaxonomyDetailPageModel(group, kind));
}

export function buildSeriesIndexPageModel(groups) {
  const cards = groups.map((group) => `          <a class="taxonomy-card" href="/series/${escapeAttr(group.id)}/">
            <span class="eyebrow">${group.posts.length} 篇</span>
            <strong>${escapeHtml(group.name)}</strong>
            <span>${escapeHtml(group.description)}</span>
          </a>`).join("\n");
  const main = `    <main id="main-content" class="content">
      <section class="list-page container taxonomy-page">
        <span class="eyebrow">Reading Paths</span>
        <h1>文章系列</h1>
        <p class="lead">按主题和推荐顺序连续阅读，建立从背景、架构到实现细节的完整上下文。</p>
        <div class="taxonomy-grid">
${cards}
        </div>
      </section>
    </main>`;
  return {
    ...buildSeriesIndexPageMetadata(groups),
    main,
  };
}

export function buildSeriesIndexPageMetadata(groups) {
  const description = "按连续阅读顺序整理 CWLBlog 的技术文章系列。";
  return {
    title: "文章系列 :: CWLBlog",
    description,
    active: "blog",
    page: "categories",
    languageMode: "zh-only",
    jsonLd: buildPageJsonLd({
      type: "CollectionPage",
      name: "CWLBlog 文章系列",
      description,
      path: "/series/",
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: groups.length,
        itemListElement: groups.map((group, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: group.name,
          url: siteUrl(`/series/${group.id}/`),
        })),
      },
    }),
    og: { type: "website", title: "文章系列", description, path: "/series/" },
  };
}

export function renderSeriesIndex(groups) {
  return renderPage(buildSeriesIndexPageModel(groups));
}
