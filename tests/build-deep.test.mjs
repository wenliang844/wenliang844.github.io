// Deep test: build.mjs — uncovered code paths (empty file, empty content, error aggregation, absoluteUrl)
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDate, normalizeModifiedDate, normalizeCover, validateSlug, validatePost, renderContent, readingMinutes, relatedPosts } from "../scripts/build.mjs";

// ─── normalizeDate edge cases ─────────────────────────────────────────────

test("normalizeDate handles Date at UTC midnight", () => {
  const d = new Date(Date.UTC(2025, 0, 1)); // Jan 1, 2025
  assert.equal(normalizeDate(d), "2025-01-01");
});

test("normalizeDate handles Feb 29 on leap year 2000", () => {
  assert.equal(normalizeDate("2000-02-29"), "2000-02-29");
});

test("normalizeDate rejects Feb 29 on non-leap year 2001", () => {
  assert.throws(() => normalizeDate("2001-02-29"), /Invalid date/);
});

test("normalizeDate rejects month 00", () => {
  assert.throws(() => normalizeDate("2024-00-01"), /Invalid date/);
});

test("normalizeDate rejects month 13", () => {
  assert.throws(() => normalizeDate("2024-13-01"), /Invalid date/);
});

test("normalizeDate rejects day 00", () => {
  assert.throws(() => normalizeDate("2024-01-00"), /Invalid date/);
});

test("normalizeDate rejects day 32", () => {
  assert.throws(() => normalizeDate("2024-01-32"), /Invalid date/);
});

test("normalizeDate rejects all 31-day violations", () => {
  // Months with only 30 days
  assert.throws(() => normalizeDate("2024-04-31"), /Invalid date/);
  assert.throws(() => normalizeDate("2024-06-31"), /Invalid date/);
  assert.throws(() => normalizeDate("2024-09-31"), /Invalid date/);
  assert.throws(() => normalizeDate("2024-11-31"), /Invalid date/);
});

test("normalizeDate accepts boundary dates", () => {
  assert.equal(normalizeDate("2024-01-01"), "2024-01-01");
  assert.equal(normalizeDate("2024-12-31"), "2024-12-31");
  assert.equal(normalizeDate("2024-01-31"), "2024-01-31");
});

test("normalizeModifiedDate defaults to published date", () => {
  assert.equal(normalizeModifiedDate(undefined, "2024-06-18", "test.md"), "2024-06-18");
});

test("normalizeModifiedDate accepts a later valid date", () => {
  assert.equal(normalizeModifiedDate("2024-06-20", "2024-06-18", "test.md"), "2024-06-20");
});

test("normalizeModifiedDate rejects dates before publish date", () => {
  assert.throws(
    () => normalizeModifiedDate("2024-06-17", "2024-06-18", "test.md"),
    /before published date/,
  );
});

test("normalizeCover accepts site image and remote http URLs", () => {
  assert.equal(normalizeCover("/images/posts/cover.png", "test.md"), "/images/posts/cover.png");
  assert.equal(normalizeCover("https://example.com/cover.png", "test.md"), "https://example.com/cover.png");
  assert.equal(normalizeCover(null, "test.md"), null);
});

test("normalizeCover rejects unsafe or unexpected paths", () => {
  assert.throws(() => normalizeCover("javascript:alert(1)", "test.md"), /must start with/);
  assert.throws(() => normalizeCover("/post/cover.png", "test.md"), /must start with/);
  assert.throws(() => normalizeCover(42, "test.md"), /must be a string/);
});

// ─── validateSlug boundary cases ──────────────────────────────────────────

test("validateSlug accepts exactly 100 character slug", () => {
  assert.doesNotThrow(() => validateSlug("a".repeat(100), "test.md"));
});

test("validateSlug rejects 101 character slug", () => {
  assert.throws(() => validateSlug("a".repeat(101), "test.md"), /too long/);
});

test("validateSlug accepts mixed case alphanumeric with hyphens and underscores", () => {
  assert.doesNotThrow(() => validateSlug("My-Post_2024", "test.md"));
});

test("validateSlug rejects dot in slug", () => {
  assert.throws(() => validateSlug("my.post", "test.md"), /Only letters/);
});

test("validateSlug rejects at sign in slug", () => {
  assert.throws(() => validateSlug("my@post", "test.md"), /Only letters/);
});

test("validateSlug rejects hash in slug", () => {
  assert.throws(() => validateSlug("my#post", "test.md"), /Only letters/);
});

test("validateSlug rejects percent in slug", () => {
  assert.throws(() => validateSlug("my%20post", "test.md"), /Only letters/);
});

test("validateSlug rejects plus in slug", () => {
  assert.throws(() => validateSlug("my+post", "test.md"), /Only letters/);
});

// ─── validatePost boundary cases ──────────────────────────────────────────

test("validatePost accepts title at exactly 200 chars", () => {
  assert.doesNotThrow(() => validatePost({
    title: "a".repeat(200),
    shortTitle: "S",
    date: "2024-01-01",
    summary: "Sum",
    description: "Desc",
  }, "test.md"));
});

test("validatePost rejects title at 201 chars", () => {
  assert.throws(() => validatePost({
    title: "a".repeat(201),
    shortTitle: "S",
    date: "2024-01-01",
    summary: "Sum",
    description: "Desc",
  }, "test.md"), /Title too long/);
});

test("validatePost accepts shortTitle at exactly 100 chars", () => {
  assert.doesNotThrow(() => validatePost({
    title: "T",
    shortTitle: "a".repeat(100),
    date: "2024-01-01",
    summary: "Sum",
    description: "Desc",
  }, "test.md"));
});

test("validatePost rejects shortTitle at 101 chars", () => {
  assert.throws(() => validatePost({
    title: "T",
    shortTitle: "a".repeat(101),
    date: "2024-01-01",
    summary: "Sum",
    description: "Desc",
  }, "test.md"), /Short title too long/);
});

test("validatePost accepts description at exactly 500 chars", () => {
  assert.doesNotThrow(() => validatePost({
    title: "T",
    shortTitle: "S",
    date: "2024-01-01",
    summary: "Sum",
    description: "a".repeat(500),
  }, "test.md"));
});

test("validatePost rejects description at 501 chars", () => {
  assert.throws(() => validatePost({
    title: "T",
    shortTitle: "S",
    date: "2024-01-01",
    summary: "Sum",
    description: "a".repeat(501),
  }, "test.md"), /Description too long/);
});

test("validatePost rejects when all fields missing", () => {
  assert.throws(() => validatePost({}, "test.md"), /Missing required fields/);
});

test("validatePost rejects empty string fields as missing", () => {
  assert.throws(() => validatePost({
    title: "",
    shortTitle: "",
    date: "",
    summary: "",
    description: "",
  }, "test.md"), /Missing required fields/);
});

test("renderContent generates unique heading ids shared with TOC", () => {
  const result = renderContent(`
## Duplicate
### Child
### Child
## Duplicate
### Child
`);

  assert.deepEqual(result.toc.map((item) => item.id), [
    "toc-1-duplicate",
    "toc-1-child",
    "toc-1-child-2",
    "toc-2-duplicate",
    "toc-2-child",
  ]);
  for (const item of result.toc) {
    assert.match(result.html, new RegExp(`id="${item.id}"`));
  }
});

// ─── readingMinutes boundary cases ────────────────────────────────────────

test("readingMinutes returns exactly 1 for 1 Chinese char", () => {
  assert.equal(readingMinutes("中"), 1);
});

test("readingMinutes returns 1 for 1 English word", () => {
  assert.equal(readingMinutes("hello"), 1);
});

test("readingMinutes handles exactly 350 Chinese chars", () => {
  assert.equal(readingMinutes("中".repeat(350)), 1);
});

test("readingMinutes handles exactly 351 Chinese chars", () => {
  // 351/350 = 1.003, rounds to 1
  assert.equal(readingMinutes("中".repeat(351)), 1);
});

test("readingMinutes handles exactly 200 English words", () => {
  assert.equal(readingMinutes("word ".repeat(200).trim()), 1);
});

test("readingMinutes handles exactly 201 English words", () => {
  // 201/200 = 1.005, rounds to 1
  assert.equal(readingMinutes("word ".repeat(201).trim()), 1);
});

test("readingMinutes handles 1000 Chinese chars", () => {
  assert.equal(readingMinutes("中".repeat(1000)), 3);
});

test("readingMinutes handles whitespace-only text", () => {
  assert.equal(readingMinutes("   "), 1);
});

test("readingMinutes handles text with only newlines", () => {
  assert.equal(readingMinutes("\n\n\n"), 1);
});

// ─── relatedPosts edge cases ──────────────────────────────────────────────

test("relatedPosts handles large number of posts", () => {
  const current = { slug: "main", tags: ["Java"] };
  const posts = Array.from({ length: 100 }, (_, i) => ({
    slug: `post-${i}`,
    tags: i % 2 === 0 ? ["Java"] : ["Python"],
    date: `2024-${String(i % 12 + 1).padStart(2, "0")}-01`,
  }));
  const result = relatedPosts(current, posts, 5);
  assert.equal(result.length, 5, "should respect limit");
  result.forEach((p) => assert.ok(p.tags.includes("Java"), "all results should share Java tag"));
});

test("relatedPosts prefers more shared tags", () => {
  const current = { slug: "a", tags: ["Java", "Spring", "Docker"] };
  const posts = [
    { slug: "b", tags: ["Java", "Spring", "Docker"], date: "2024-01-01" },          // 3 shared
    { slug: "c", tags: ["Java", "Spring"], date: "2024-06-01" },                     // 2 shared
    { slug: "d", tags: ["Java"], date: "2024-03-01" },                               // 1 shared
    { slug: "e", tags: ["Python"], date: "2024-09-01" },                              // 0 shared
  ];
  const result = relatedPosts(current, posts, 10);
  assert.equal(result.length, 3); // e excluded (0 shared)
  assert.equal(result[0].slug, "b"); // 3 shared tags, most recent among equals
  assert.equal(result[1].slug, "c"); // 2 shared tags
  assert.equal(result[2].slug, "d"); // 1 shared tag
});

test("relatedPosts prefers newer post when shared tags are equal", () => {
  const current = { slug: "a", tags: ["Java"] };
  const posts = [
    { slug: "old", tags: ["Java"], date: "2020-01-01" },
    { slug: "new", tags: ["Java"], date: "2024-01-01" },
  ];
  const result = relatedPosts(current, posts);
  assert.equal(result[0].slug, "new", "newer post should come first");
});

test("relatedPosts handles posts with empty tags array", () => {
  const current = { slug: "a", tags: ["Java"] };
  const posts = [
    { slug: "b", tags: [], date: "2024-01-01" },
    { slug: "c", tags: ["Java"], date: "2024-01-01" },
  ];
  const result = relatedPosts(current, posts);
  assert.equal(result.length, 1);
  assert.equal(result[0].slug, "c");
});

test("relatedPosts returns empty for empty posts array", () => {
  const current = { slug: "a", tags: ["Java"] };
  assert.deepEqual(relatedPosts(current, []), []);
});

test("relatedPosts does not mutate input arrays", () => {
  const current = { slug: "a", tags: ["Java"] };
  const posts = [
    { slug: "b", tags: ["Java"], date: "2024-01-01" },
    { slug: "c", tags: ["Python"], date: "2024-06-01" },
  ];
  const originalLength = posts.length;
  relatedPosts(current, posts);
  assert.equal(posts.length, originalLength, "should not mutate input");
});

// ─── validateSlug with all special characters ─────────────────────────────

test("validateSlug rejects all common special characters", () => {
  const specials = ["!", "@", "#", "$", "%", "^", "&", "*", "(", ")", "+", "=", "{", "}", "[", "]", "|", "\\", ":", ";", '"', "'", "<", ">", ",", ".", "?", "/", "~", "`", " "];
  for (const char of specials) {
    assert.throws(
      () => validateSlug(`slug${char}test`, "test.md"),
      /Only letters/,
      `should reject slug with '${char}'`,
    );
  }
});

// ─── validatePost with falsy values ───────────────────────────────────────

test("validatePost treats null fields as missing", () => {
  assert.throws(() => validatePost({
    title: null,
    shortTitle: null,
    date: null,
    summary: null,
    description: null,
  }, "test.md"), /Missing required fields/);
});

test("validatePost treats undefined fields as missing", () => {
  assert.throws(() => validatePost({
    title: undefined,
    shortTitle: undefined,
    date: undefined,
    summary: undefined,
    description: undefined,
  }, "test.md"), /Missing required fields/);
});

test("validatePost treats 0 as falsy (missing)", () => {
  assert.throws(() => validatePost({
    title: 0,
    shortTitle: "S",
    date: "2024-01-01",
    summary: "Sum",
    description: "Desc",
  }, "test.md"), /Missing required fields/);
});

// ─── readingMinutes with mixed content ────────────────────────────────────

test("readingMinutes handles long mixed content correctly", () => {
  // 350 Chinese chars + 200 English words
  const text = "中".repeat(350) + " " + "word ".repeat(200).trim();
  const result = readingMinutes(text);
  // 350/350 + 200/200 = 1 + 1 = 2
  assert.equal(result, 2);
});

test("readingMinutes handles text with only punctuation", () => {
  assert.equal(readingMinutes("!@#$%^&*()"), 1);
});

test("readingMinutes handles single sentence with both Chinese and English", () => {
  const text = "这是一个 Java Spring Boot 项目的复盘";
  const result = readingMinutes(text);
  assert.ok(result >= 1, "should be at least 1");
  assert.ok(result <= 2, "should be small for short text");
});
