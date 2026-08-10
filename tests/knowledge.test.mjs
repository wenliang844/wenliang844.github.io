import test from "node:test";
import assert from "node:assert/strict";
import { buildContentHealth, buildKnowledgeChunks, buildKnowledgeGraph, resolvePostLinks } from "../scripts/build.mjs";
import { renderKnowledgePage } from "../src/templates/knowledge.mjs";

const posts = resolvePostLinks([
  { slug: "alpha", title: "Alpha", shortTitle: "Alpha", date: "2026-01-01", modified: "2026-02-01", category: "ai-coding", series: "ai-collaboration", seriesOrder: 1, tags: ["AI", "Workflow"], outgoingLinks: ["beta"] },
  { slug: "beta", title: "Beta", shortTitle: "Beta", date: "2026-01-02", modified: "2026-03-01", category: "ai-coding", series: "ai-collaboration", seriesOrder: 2, tags: ["AI"], outgoingLinks: [] },
  { slug: "gamma", title: "Gamma", shortTitle: "Gamma", date: "2026-01-03", modified: "2026-01-03", category: "backend-platform", series: "", seriesOrder: null, tags: [], outgoingLinks: [] },
]);

test("knowledge graph derives tag, series and reference relationships", () => {
  const graph = buildKnowledgeGraph(posts);
  assert.equal(graph.generatedAt, "2026-03-01T00:00:00.000Z");
  assert.equal(graph.nodes.length, 3);
  assert.ok(graph.edges.some((edge) => edge.type === "tag" && edge.label === "AI"));
  assert.ok(graph.edges.some((edge) => edge.type === "series"));
  assert.ok(graph.edges.some((edge) => edge.type === "reference"));
  assert.equal(graph.stats.orphans, 1);
  assert.equal(graph.stats.references, 1);
  assert.equal(graph.stats.linkOrphans, 1);
  assert.equal(graph.nodes.find((node) => node.id === "gamma").connections, 0);
});

test("knowledge page renders an accessible graph and filter controls", () => {
  const graph = buildKnowledgeGraph(posts);
  const html = renderKnowledgePage(graph, buildContentHealth(posts, graph));
  assert.match(html, /<title>知识资产 :: CWLBlog<\/title>/);
  assert.match(html, /class="knowledge-graph"/);
  assert.match(html, /role="img"/);
  assert.match(html, /data-knowledge-filter="ai-coding"/);
  assert.match(html, /src="\/js\/knowledge\.js" defer/);
  assert.match(html, /内容健康看板/);
  assert.match(html, /主题覆盖/);
  assert.match(html, /维护队列/);
});

test("content health derives deterministic freshness, coverage and maintenance priorities", () => {
  const graph = buildKnowledgeGraph(posts);
  const health = buildContentHealth(posts, graph, { asOf: "2026-03-01" });

  assert.equal(health.version, 1);
  assert.equal(health.asOf, "2026-03-01");
  assert.equal(health.policy.clock, "monthly-or-latest-content");
  assert.equal(health.stats.articles, 3);
  assert.equal(health.stats.stale, 0);
  assert.equal(health.stats.linkOrphans, 1);
  assert.equal(health.categories.length, 4);
  assert.deepEqual(
    health.categories.find((category) => category.id === "ai-coding"),
    { id: "ai-coding", name: "AI 协作开发", count: 2, target: 5, coverage: 40, gap: 3, latestModified: "2026-03-01", stale: 0 },
  );
  assert.equal(health.maintenance[0].slug, "gamma");
  assert.deepEqual(health.maintenance[0].reasons, ["缺少正文入链或出链", "未形成知识关联", "主题标签少于 2 个"]);
});

test("knowledge chunks are stable, bounded and exclude Markdown control syntax", () => {
  const dataset = buildKnowledgeChunks([{
    slug: "alpha",
    title: "Alpha",
    date: "2026-01-01",
    modified: "2026-02-01",
    category: "ai-coding",
    series: "ai-collaboration",
    tags: ["AI", "Workflow"],
    contentMarkdown: "## 架构\n\n这是用于知识检索的正文，包含 [[beta|关联文章]] 和 [链接](/post/beta/)。\n\n" + "长内容".repeat(500),
  }]);
  assert.equal(dataset.version, 1);
  assert.match(dataset.datasetHash, /^[a-f0-9]{64}$/);
  assert.equal(dataset.documents.length, 1);
  assert.ok(dataset.chunks.length >= 2);
  assert.ok(dataset.chunks.every((chunk) => chunk.text.length <= 1100));
  assert.ok(dataset.chunks.every((chunk) => /^alpha-\d+-[a-f0-9]{12}$/.test(chunk.id)));
  assert.match(dataset.chunks[0].text, /关联文章/);
  assert.doesNotMatch(dataset.chunks[0].text, /\[\[|\]\]|\/post\/beta/);
  assert.deepEqual(buildKnowledgeChunks([{
    slug: "alpha",
    title: "Alpha",
    date: "2026-01-01",
    modified: "2026-02-01",
    category: "ai-coding",
    series: "ai-collaboration",
    tags: ["AI", "Workflow"],
    contentMarkdown: "## 架构\n\n这是用于知识检索的正文，包含 [[beta|关联文章]] 和 [链接](/post/beta/)。\n\n" + "长内容".repeat(500),
  }]).datasetHash, dataset.datasetHash);
});
