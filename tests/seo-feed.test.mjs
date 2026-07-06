import test from "node:test";
import assert from "node:assert/strict";
import {
  FEED_SPECS,
  createSeoFeedReport,
  formatSeoFeedReport,
  routeFromHtmlFile,
} from "../scripts/check-seo-feed.mjs";

test("SEO/feed report maps committed HTML paths to public routes", () => {
  assert.equal(routeFromHtmlFile("index.html"), "/");
  assert.equal(routeFromHtmlFile("post/index.html"), "/post/");
  assert.equal(routeFromHtmlFile("post/example/index.html"), "/post/example/");
  assert.equal(routeFromHtmlFile("404.html"), "/404.html");
});

test("SEO/feed report covers sitemap, RSS feeds, head signals and JSON-LD", async () => {
  const report = await createSeoFeedReport();

  assert.equal(report.summary.status, "pass");
  assert.equal(report.violations.length, 0);
  assert.equal(report.summary.htmlFiles, 21);
  assert.equal(report.summary.indexablePages, 19);
  assert.equal(report.summary.sitemapUrls, 19);
  assert.equal(report.summary.rssFeeds, FEED_SPECS.length);
  assert.equal(report.summary.rssItemsPerFeed, 6);
  assert.ok(report.summary.feedAlternates >= report.summary.indexablePages);
  assert.ok(report.summary.jsonLdBlocks >= report.summary.indexablePages);
  assert.match(formatSeoFeedReport(report), /SEO\/feed check passed\./);

  const home = report.html.find((page) => page.route === "/");
  assert.ok(home.feedAlternates.some((feed) => feed.href === "https://wenliang844.github.io/index.xml"));

  const postList = report.html.find((page) => page.route === "/post/");
  assert.ok(postList.feedAlternates.some((feed) => feed.href === "https://wenliang844.github.io/post/index.xml"));

  const categories = report.html.find((page) => page.route === "/categories/");
  assert.ok(categories.feedAlternates.some((feed) => feed.href === "https://wenliang844.github.io/categories/index.xml"));
});
