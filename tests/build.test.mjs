import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import assert from "node:assert/strict";

const execFileAsync = promisify(execFile);
const ROOT = join(import.meta.dirname, "..");

async function runBuild(args = []) {
  return execFileAsync("node", ["scripts/build.mjs", ...args], {
    cwd: ROOT,
    windowsHide: true,
  });
}

test("build writes the expected static artifacts", async () => {
  const tempRoot = join(ROOT, "temp");
  await mkdir(tempRoot, { recursive: true });
  const outDir = await mkdtemp(join(tempRoot, "cwlblog-build-"));
  try {
    const { stdout } = await runBuild(["--out", outDir]);
    assert.match(stdout, /构建完成：6 篇文章/);

    const postsHtml = await readFile(join(outDir, "post", "index.html"), "utf8");
    const sitemap = await readFile(join(outDir, "sitemap.xml"), "utf8");
    const rss = await readFile(join(outDir, "index.xml"), "utf8");
    const searchIndex = JSON.parse(await readFile(join(outDir, "search-index.json"), "utf8"));

    assert.match(postsHtml, /class="post-tree"/);
    assert.match(sitemap, /<urlset /);
    assert.match(rss, /<rss version="2.0"/);
    assert.equal(searchIndex.filter((item) => item.type === "post").length, 6);
    assert.ok(searchIndex.every((item) => item.path && !item.path.includes("\\")));
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("build rejects missing or unsafe output directories", async () => {
  await assert.rejects(runBuild(["--out"]), /缺少 --out <dir> 参数/);
  await assert.rejects(runBuild(["--out", ".."]), /--out 只能指向项目内目录/);
});
