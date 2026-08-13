import { buildPageJsonLd, renderPage } from "./layout.mjs";
import { CONTENT_CATEGORIES } from "../config.mjs";
import { escapeAttr, escapeHtml } from "../lib/format.mjs";

function graphPosition(index, count) {
  const angle = (Math.PI * 2 * index) / Math.max(count, 1) - Math.PI / 2;
  return {
    x: Math.round(450 + Math.cos(angle) * 315),
    y: Math.round(285 + Math.sin(angle) * 215),
  };
}

function renderGraph(graph) {
  const positions = new Map(graph.nodes.map((node, index) => [node.id, graphPosition(index, graph.nodes.length)]));
  const edges = graph.edges.map((edge) => {
    const source = positions.get(edge.source);
    const target = positions.get(edge.target);
    const sourceNode = graph.nodes.find((node) => node.id === edge.source);
    const targetNode = graph.nodes.find((node) => node.id === edge.target);
    return `              <line x1="${source.x}" y1="${source.y}" x2="${target.x}" y2="${target.y}" data-source-category="${escapeAttr(sourceNode.category)}" data-target-category="${escapeAttr(targetNode.category)}"><title>${escapeHtml(edge.label)}</title></line>`;
  }).join("\n");
  const nodes = graph.nodes.map((node) => {
    const position = positions.get(node.id);
    const label = node.shortTitle.length > 12 ? `${node.shortTitle.slice(0, 12)}…` : node.shortTitle;
    return `              <a href="${escapeAttr(node.url)}" data-category="${escapeAttr(node.category)}">
                <g transform="translate(${position.x} ${position.y})">
                  <circle r="42"></circle>
                  <text text-anchor="middle" dominant-baseline="middle">${escapeHtml(label)}</text>
                  <title>${escapeHtml(node.title)}</title>
                </g>
              </a>`;
  }).join("\n");
  return `          <div class="knowledge-graph-shell">
            <svg class="knowledge-graph" viewBox="0 0 900 570" role="img" aria-labelledby="knowledge-graph-title knowledge-graph-desc">
              <title id="knowledge-graph-title">文章关系图谱</title>
              <desc id="knowledge-graph-desc">节点代表文章，连线代表共享标签、系列顺序或文章引用。</desc>
              <g class="knowledge-edges">${edges}</g>
              <g class="knowledge-nodes">${nodes}</g>
            </svg>
          </div>`;
}

function renderHealthDashboard(health) {
  if (!health) return "";
  const statusNames = { current: "状态正常", review: "建议复核", stale: "需要更新" };
  const coverageRows = health.categories.map((category) => `            <li>
              <div><strong>${escapeHtml(category.name)}</strong><span>${category.count} / ${category.target} 篇</span></div>
              <progress value="${category.count}" max="${category.target}" aria-label="${escapeAttr(category.name)}覆盖 ${category.coverage}%">${category.coverage}%</progress>
              <small>${category.gap ? `还需 ${category.gap} 篇达到阶段目标` : "已达到阶段目标"}${category.stale ? ` · ${category.stale} 篇需要更新` : ""}</small>
            </li>`).join("\n");
  const maintenanceRows = health.maintenance.length
    ? health.maintenance.map((article) => `            <li>
              <a href="${escapeAttr(article.url)}"><strong>${escapeHtml(article.shortTitle)}</strong><span data-health-status="${escapeAttr(article.freshness)}">${statusNames[article.freshness]}</span></a>
              <small>${escapeHtml(article.reasons.join(" · "))}</small>
            </li>`).join("\n")
    : "            <li class=\"knowledge-health-empty\">当前没有需要处理的内容维护项。</li>";
  return `        <section class="knowledge-health" aria-labelledby="knowledge-health-title">
          <div class="knowledge-section-heading">
            <div>
              <span class="eyebrow">Content Health</span>
              <h2 id="knowledge-health-title">内容健康看板</h2>
            </div>
            <p>以 ${escapeHtml(health.asOf)} 的最新内容版本为基准；超过 ${health.policy.reviewAfterDays} 天建议复核，超过 ${health.policy.staleAfterDays} 天列入更新。</p>
          </div>
          <div class="knowledge-health-stats" aria-label="内容健康统计">
            <div><strong>${health.stats.current}</strong><span>状态正常</span></div>
            <div><strong>${health.stats.review}</strong><span>建议复核</span></div>
            <div><strong>${health.stats.stale}</strong><span>需要更新</span></div>
            <div><strong>${health.stats.categoryGap}</strong><span>主题目标缺口</span></div>
          </div>
          <div class="knowledge-health-grid">
            <section aria-labelledby="knowledge-coverage-title">
              <h3 id="knowledge-coverage-title">主题覆盖</h3>
              <ul class="knowledge-coverage">${coverageRows}
              </ul>
            </section>
            <section aria-labelledby="knowledge-maintenance-title">
              <h3 id="knowledge-maintenance-title">维护队列</h3>
              <ul class="knowledge-maintenance">${maintenanceRows}
              </ul>
            </section>
          </div>
        </section>`;
}

export function buildKnowledgePageModel(graph, health = null) {
  const categoryCounts = Object.entries(CONTENT_CATEGORIES).map(([id, meta]) => {
    const count = graph.nodes.filter((node) => node.category === id).length;
    return `            <button type="button" data-knowledge-filter="${escapeAttr(id)}"><span>${escapeHtml(meta.name)}</span><strong>${count}</strong></button>`;
  }).join("\n");
  const articleRows = graph.nodes.map((node) => `            <li data-category="${escapeAttr(node.category)}">
              <a href="${escapeAttr(node.url)}"><strong>${escapeHtml(node.shortTitle)}</strong><span>${escapeHtml(CONTENT_CATEGORIES[node.category]?.name || node.category)}</span></a>
              <span>${node.connections} 个关联 · ${node.incomingLinks} 入链 / ${node.outgoingLinks} 出链 · 更新于 ${escapeHtml(node.modified)}</span>
            </li>`).join("\n");
  const main = `    <main id="main-content" class="content">
      <section class="container knowledge-page" aria-labelledby="knowledge-title">
        <header class="page-hero compact-hero">
          <span class="eyebrow">Knowledge Assets</span>
          <h1 id="knowledge-title">知识资产</h1>
          <p class="lead">按主题、系列、标签和文章引用组织公开内容，定位覆盖薄弱与缺少关联的知识节点。</p>
        </header>
        <div class="knowledge-stats" aria-label="知识资产概览">
          <div><strong>${graph.stats.articles}</strong><span>篇文章</span></div>
          <div><strong>${graph.stats.categories}</strong><span>个主题</span></div>
          <div><strong>${graph.stats.edges}</strong><span>条关联</span></div>
          <div><strong>${graph.stats.references}</strong><span>条正文引用</span></div>
          <div><strong>${graph.stats.linkOrphans}</strong><span>篇无正文链接</span></div>
        </div>
        <div class="knowledge-filters" aria-label="按主题筛选">
          <button type="button" class="active" data-knowledge-filter="all"><span>全部</span><strong>${graph.nodes.length}</strong></button>
${categoryCounts}
        </div>
${renderHealthDashboard(health)}
${renderGraph(graph)}
        <section class="knowledge-inventory" aria-labelledby="knowledge-inventory-title">
          <h2 id="knowledge-inventory-title">内容清单</h2>
          <ul>
${articleRows}
          </ul>
        </section>
      </section>
    </main>`;
  return {
    ...buildKnowledgePageMetadata(),
    main,
  };
}

export function buildKnowledgePageMetadata() {
  const description = "CWLBlog 的个人知识资产地图，展示文章主题覆盖、系列、标签关系和维护状态。";
  return {
    title: "知识资产 :: CWLBlog",
    description,
    active: "knowledge",
    page: "knowledge",
    scripts: ["/js/knowledge.js"],
    languageMode: "zh-only",
    jsonLd: buildPageJsonLd({ type: "CollectionPage", name: "CWLBlog 知识资产", description, path: "/knowledge/" }),
    og: { type: "website", title: "知识资产", description, path: "/knowledge/" },
  };
}

export function renderKnowledgePage(graph, health = null) {
  return renderPage(buildKnowledgePageModel(graph, health));
}
