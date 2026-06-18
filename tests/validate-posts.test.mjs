import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import assert from "node:assert/strict";

const execFileAsync = promisify(execFile);
const ROOT = join(import.meta.dirname, "..");

async function runValidatePosts(args = []) {
  return execFileAsync("node", ["scripts/validate-posts.mjs", ...args], {
    cwd: ROOT,
    windowsHide: true,
  });
}

async function makePostsDir() {
  const tempRoot = join(ROOT, "temp");
  await mkdir(tempRoot, { recursive: true });
  return mkdtemp(join(tempRoot, "cwlblog-posts-"));
}

function postMarkdown(overrides = {}, body = "## 正文\n\n有效内容。") {
  const fields = {
    title: "测试文章",
    shortTitle: "测试",
    slug: "test-post",
    date: "2026-01-02",
    summary: "测试摘要",
    description: "测试描述",
    tags: "[Java, 测试]",
    tagsEn: "[Java, Test]",
    ...overrides,
  };
  const frontMatter = Object.entries(fields)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
  return `---\n${frontMatter}\n---\n\n${body}\n`;
}

test("validate:posts accepts the committed posts", async () => {
  const { stdout } = await runValidatePosts();

  assert.match(stdout, /Post front matter valid: 6 file\(s\) checked/);
});

test("validate-posts reports duplicate slugs", async () => {
  const postsDir = await makePostsDir();
  try {
    await writeFile(join(postsDir, "one.md"), postMarkdown({ slug: "same-slug" }), "utf8");
    await writeFile(join(postsDir, "two.md"), postMarkdown({ slug: "same-slug" }), "utf8");

    await assert.rejects(
      runValidatePosts(["--posts-dir", relative(ROOT, postsDir)]),
      (error) => {
        assert.match(error.stderr, /Post validation failed/);
        assert.match(error.stderr, /Duplicate slug/);
        return true;
      },
    );
  } finally {
    await rm(postsDir, { recursive: true, force: true });
  }
});

test("validate-posts reports tag translation mismatches", async () => {
  const postsDir = await makePostsDir();
  try {
    await writeFile(join(postsDir, "bad-tags.md"), postMarkdown({ tagsEn: "[Java]" }), "utf8");

    await assert.rejects(
      runValidatePosts(["--posts-dir", relative(ROOT, postsDir)]),
      (error) => {
        assert.match(error.stderr, /Post validation failed/);
        assert.match(error.stderr, /tagsEn should contain 2 item\(s\)/);
        return true;
      },
    );
  } finally {
    await rm(postsDir, { recursive: true, force: true });
  }
});

test("validate-posts reports invalid tag field types", async () => {
  const postsDir = await makePostsDir();
  try {
    await writeFile(join(postsDir, "bad-tags.md"), postMarkdown({ tags: "Java" }), "utf8");

    await assert.rejects(
      runValidatePosts(["--posts-dir", relative(ROOT, postsDir)]),
      (error) => {
        assert.match(error.stderr, /tags must be an array/);
        return true;
      },
    );
  } finally {
    await rm(postsDir, { recursive: true, force: true });
  }
});

test("validate-posts reports missing post directories arguments", async () => {
  await assert.rejects(
    runValidatePosts(["--posts-dir"]),
    (error) => {
      assert.match(error.stderr, /缺少 --posts-dir <dir> 参数/);
      return true;
    },
  );
});

test("validate-posts rejects post directories outside the project", async () => {
  await assert.rejects(
    runValidatePosts(["--posts-dir", ".."]),
    (error) => {
      assert.match(error.stderr, /--posts-dir 只能指向项目内目录/);
      return true;
    },
  );
});

test("validate-posts reports empty post directories", async () => {
  const postsDir = await makePostsDir();
  try {
    await assert.rejects(
      runValidatePosts(["--posts-dir", relative(ROOT, postsDir)]),
      (error) => {
        assert.match(error.stderr, /No Markdown posts found/);
        return true;
      },
    );
  } finally {
    await rm(postsDir, { recursive: true, force: true });
  }
});

test("validate-posts rejects public content markers", async () => {
  const postsDir = await makePostsDir();
  try {
    await writeFile(join(postsDir, "internal-note.md"), postMarkdown({}, "## 正文\n\nTODO: remove private launch note."), "utf8");

    await assert.rejects(
      runValidatePosts(["--posts-dir", relative(ROOT, postsDir)]),
      (error) => {
        assert.match(error.stderr, /Public content marker "TODO"/);
        assert.match(error.stderr, /internal-note\.md:\d+/);
        return true;
      },
    );
  } finally {
    await rm(postsDir, { recursive: true, force: true });
  }
});

test("validate-posts prints warnings for empty content bodies", async () => {
  const postsDir = await makePostsDir();
  try {
    await writeFile(join(postsDir, "empty-body.md"), postMarkdown({}, ""), "utf8");

    const { stdout, stderr } = await runValidatePosts(["--posts-dir", relative(ROOT, postsDir)]);

    assert.match(stderr, /Post validation warnings/);
    assert.match(stderr, /Content body is empty/);
    assert.match(stdout, /Post front matter valid: 1 file\(s\) checked/);
  } finally {
    await rm(postsDir, { recursive: true, force: true });
  }
});
