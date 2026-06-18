// Phase 2: 构建系统单元测试扩展
import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeDate,
  validateSlug,
  validateUniqueSlug,
  validatePost,
  relatedPosts,
  readingMinutes,
} from "../scripts/build.mjs";

// ─── normalizeDate 边界测试 ────────────────────────────────────────────────────

test("normalizeDate accepts valid YYYY-MM-DD strings", () => {
  assert.equal(normalizeDate("2024-01-01"), "2024-01-01");
  assert.equal(normalizeDate("2024-12-31"), "2024-12-31");
  assert.equal(normalizeDate("2000-02-29"), "2000-02-29"); // 闰年
  assert.equal(normalizeDate("2024-02-29"), "2024-02-29"); // 闰年
});

test("normalizeDate accepts Date objects", () => {
  const d = new Date(Date.UTC(2024, 5, 16));
  assert.equal(normalizeDate(d), "2024-06-16");
});

test("normalizeDate rejects NaN Date objects", () => {
  assert.throws(() => normalizeDate(new Date("invalid")), /Invalid date value/);
});

test("normalizeDate rejects non-YYYY-MM-DD strings", () => {
  assert.throws(() => normalizeDate("2024/01/01"), /Invalid date format/);
  assert.throws(() => normalizeDate("01-01-2024"), /Invalid date format/);
  assert.throws(() => normalizeDate("2024-1-1"), /Invalid date format/);
  assert.throws(() => normalizeDate(""), /Invalid date format/);
  assert.throws(() => normalizeDate("not-a-date"), /Invalid date format/);
  assert.throws(() => normalizeDate("2024-00-01"), /Invalid date/); // 格式对但月份无效
  assert.throws(() => normalizeDate("2024-13-01"), /Invalid date/); // 格式对但月份无效
});

test("normalizeDate rejects impossible dates", () => {
  assert.throws(() => normalizeDate("2023-02-29"), /Invalid date value/); // 非闰年
  assert.throws(() => normalizeDate("2024-02-30"), /Invalid date value/);
  assert.throws(() => normalizeDate("2024-04-31"), /Invalid date value/);
  assert.throws(() => normalizeDate("2024-06-31"), /Invalid date value/);
  assert.throws(() => normalizeDate("2024-09-31"), /Invalid date value/);
  assert.throws(() => normalizeDate("2024-11-31"), /Invalid date value/);
});

// ─── validateSlug 边界测试 ──────────────────────────────────────────────────────

test("validateSlug accepts valid slugs with various characters", () => {
  assert.doesNotThrow(() => validateSlug("abc", "test.md"));
  assert.doesNotThrow(() => validateSlug("ABC", "test.md"));
  assert.doesNotThrow(() => validateSlug("123", "test.md"));
  assert.doesNotThrow(() => validateSlug("a-b-c", "test.md"));
  assert.doesNotThrow(() => validateSlug("a_b_c", "test.md"));
  assert.doesNotThrow(() => validateSlug("aBc-123_X", "test.md"));
  assert.doesNotThrow(() => validateSlug("a".repeat(100), "test.md")); // 恰好100字符
});

test("validateSlug rejects empty, null, undefined, non-string", () => {
  assert.throws(() => validateSlug("", "test.md"), /slug is required/);
  assert.throws(() => validateSlug(null, "test.md"), /slug is required/);
  assert.throws(() => validateSlug(undefined, "test.md"), /slug is required/);
  assert.throws(() => validateSlug(123, "test.md"), /slug is required/);
});

test("validateSlug rejects special characters", () => {
  assert.throws(() => validateSlug("slug with spaces", "test.md"), /Only letters/);
  assert.throws(() => validateSlug("slug/slash", "test.md"), /Only letters/);
  assert.throws(() => validateSlug("slug@at", "test.md"), /Only letters/);
  assert.throws(() => validateSlug("slug.dot", "test.md"), /Only letters/);
  assert.throws(() => validateSlug("slug<script>", "test.md"), /Only letters/);
  assert.throws(() => validateSlug("slug&amp", "test.md"), /Only letters/);
  assert.throws(() => validateSlug("中文slug", "test.md"), /Only letters/);
  assert.throws(() => validateSlug("slug space", "test.md"), /Only letters/);
});

test("validateSlug rejects slugs longer than 100 characters", () => {
  assert.throws(() => validateSlug("a".repeat(101), "test.md"), /too long/);
  assert.throws(() => validateSlug("a".repeat(200), "test.md"), /too long/);
});

// ─── validateUniqueSlug 测试 ────────────────────────────────────────────────────

test("validateUniqueSlug detects duplicates across files", () => {
  const seen = new Map();
  assert.doesNotThrow(() => validateUniqueSlug("post-a", "a.md", seen));
  assert.doesNotThrow(() => validateUniqueSlug("post-b", "b.md", seen));
  assert.throws(() => validateUniqueSlug("post-a", "c.md", seen), /Duplicate slug/);
  assert.throws(() => validateUniqueSlug("post-b", "d.md", seen), /Duplicate slug/);
});

test("validateUniqueSlug works with empty map", () => {
  const seen = new Map();
  assert.doesNotThrow(() => validateUniqueSlug("first", "first.md", seen));
  assert.equal(seen.size, 1);
  assert.equal(seen.get("first"), "first.md");
});

// ─── validatePost 测试 ──────────────────────────────────────────────────────────

test("validatePost accepts complete post data", () => {
  assert.doesNotThrow(() =>
    validatePost({
      title: "Title",
      shortTitle: "Short",
      date: "2024-01-01",
      summary: "Summary",
      description: "Description",
    }, "test.md")
  );
});

test("validatePost rejects each missing field individually", () => {
  const base = { title: "T", shortTitle: "S", date: "2024-01-01", summary: "Sum", description: "Desc" };
  for (const field of Object.keys(base)) {
    const data = { ...base };
    delete data[field];
    assert.throws(() => validatePost(data, "test.md"), /Missing required fields/, `should reject missing ${field}`);
  }
});

test("validatePost rejects multiple missing fields", () => {
  assert.throws(
    () => validatePost({ title: "T" }, "test.md"),
    /Missing required fields/,
  );
});

test("validatePost rejects overly long title", () => {
  const data = { title: "a".repeat(201), shortTitle: "S", date: "2024-01-01", summary: "Sum", description: "Desc" };
  assert.throws(() => validatePost(data, "test.md"), /Title too long/);
});

test("validatePost accepts title at exactly 200 characters", () => {
  const data = { title: "a".repeat(200), shortTitle: "S", date: "2024-01-01", summary: "Sum", description: "Desc" };
  assert.doesNotThrow(() => validatePost(data, "test.md"));
});

test("validatePost rejects overly long shortTitle", () => {
  const data = { title: "T", shortTitle: "a".repeat(101), date: "2024-01-01", summary: "Sum", description: "Desc" };
  assert.throws(() => validatePost(data, "test.md"), /Short title too long/);
});

test("validatePost rejects overly long description", () => {
  const data = { title: "T", shortTitle: "S", date: "2024-01-01", summary: "Sum", description: "a".repeat(501) };
  assert.throws(() => validatePost(data, "test.md"), /Description too long/);
});

// ─── readingMinutes 测试 ────────────────────────────────────────────────────────

test("readingMinutes returns at least 1 for short text", () => {
  assert.equal(readingMinutes(""), 1);
  assert.equal(readingMinutes("短"), 1);
  assert.equal(readingMinutes("Hello"), 1);
});

test("readingMinutes handles pure Chinese text", () => {
  // 350 字/分钟 → 700字 = 2分钟
  assert.equal(readingMinutes("中".repeat(700)), 2);
  assert.equal(readingMinutes("中".repeat(350)), 1);
  assert.equal(readingMinutes("中".repeat(175)), 1); // 0.5 → round → 1
});

test("readingMinutes handles pure English text", () => {
  // 200 词/分钟
  const words = "word ".repeat(200).trim();
  assert.equal(readingMinutes(words), 1);
  const words400 = "word ".repeat(400).trim();
  assert.equal(readingMinutes(words400), 2);
});

test("readingMinutes handles mixed Chinese and English", () => {
  const text = "中文内容".repeat(100) + " " + "word ".repeat(100);
  const result = readingMinutes(text);
  assert.ok(result >= 1, "should be at least 1");
  assert.ok(result <= 5, "should be reasonable for this text length");
});

// ─── relatedPosts 测试 ──────────────────────────────────────────────────────────

test("relatedPosts returns posts with shared tags sorted by overlap", () => {
  const current = { slug: "a", tags: ["Java", "Spring"] };
  const posts = [
    { slug: "b", tags: ["Java", "Spring", "Docker"], date: "2024-01-01" },
    { slug: "c", tags: ["Java"], date: "2024-06-01" },
    { slug: "d", tags: ["Python"], date: "2024-03-01" },
    { slug: "e", tags: ["Java", "Spring"], date: "2024-09-01" },
  ];
  const result = relatedPosts(current, posts, 3);
  assert.equal(result.length, 3);
  // b 和 e 都有 2 个共同标签，e 更新 → e 排第一
  assert.equal(result[0].slug, "e");
  assert.equal(result[1].slug, "b");
  assert.equal(result[2].slug, "c"); // 1 个共同标签
});

test("relatedPosts excludes the post itself", () => {
  const current = { slug: "a", tags: ["Java"] };
  const posts = [
    { slug: "a", tags: ["Java"], date: "2024-01-01" },
    { slug: "b", tags: ["Java"], date: "2024-01-01" },
  ];
  const result = relatedPosts(current, posts);
  assert.equal(result.length, 1);
  assert.equal(result[0].slug, "b");
});

test("relatedPosts returns empty for post with no tags", () => {
  const current = { slug: "a", tags: [] };
  const posts = [{ slug: "b", tags: ["Java"], date: "2024-01-01" }];
  assert.deepEqual(relatedPosts(current, posts), []);
});

test("relatedPosts respects limit parameter", () => {
  const current = { slug: "a", tags: ["Java"] };
  const posts = [
    { slug: "b", tags: ["Java"], date: "2024-01-01" },
    { slug: "c", tags: ["Java"], date: "2024-02-01" },
    { slug: "d", tags: ["Java"], date: "2024-03-01" },
    { slug: "e", tags: ["Java"], date: "2024-04-01" },
  ];
  assert.equal(relatedPosts(current, posts, 2).length, 2);
  assert.equal(relatedPosts(current, posts, 1).length, 1);
  assert.equal(relatedPosts(current, posts, 10).length, 4);
});

test("relatedPosts returns empty when no shared tags", () => {
  const current = { slug: "a", tags: ["Go"] };
  const posts = [
    { slug: "b", tags: ["Java"], date: "2024-01-01" },
    { slug: "c", tags: ["Python"], date: "2024-02-01" },
  ];
  assert.deepEqual(relatedPosts(current, posts), []);
});
