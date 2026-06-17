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
    const appreciationHtml = await readFile(join(outDir, "appreciation", "index.html"), "utf8");
    const sitemap = await readFile(join(outDir, "sitemap.xml"), "utf8");
    const rss = await readFile(join(outDir, "index.xml"), "utf8");
    const searchIndex = JSON.parse(await readFile(join(outDir, "search-index.json"), "utf8"));
    const appreciationTexts = [
      "鉴赏",
      "科技研究排行榜",
      "影视作品排行榜",
      "娱乐项目排行榜",
      "Codex",
      "Claude",
      "AI",
      "Java",
      "Python",
      "无耻之徒",
      "大西洋帝国",
      "豪斯医生",
      "风骚律师",
      "绝命毒师",
      "恶搞之家",
      "IT狂人",
      "和有意思的人交流",
      "做成一件挑战性事件得到超出预期的回报",
      "得到提高身体健康的方法",
      "想出一个能有回报的套路",
      "学得一项新技能",
      "推翻一个之前错误的想法",
      "独处",
      "正向影响到身边的人",
      "得到多数人的认可",
      "旅游看世界",
      "获得一个高质量朋友",
      "时间得到充实",
      "大脑得到充分的休息",
      "没有负面消息的一天",
    ];

    assert.match(postsHtml, /class="post-tree"/);
    for (const text of appreciationTexts) {
      assert.ok(appreciationHtml.includes(text), `appreciation page missing: ${text}`);
    }
    assert.match(sitemap, /<urlset /);
    assert.match(rss, /<rss version="2.0"/);
    assert.equal(searchIndex.filter((item) => item.type === "post").length, 6);
    assert.ok(searchIndex.some((item) => item.path === "/appreciation/" && item.summary.includes("娱乐项目")));
    assert.ok(searchIndex.every((item) => item.path && !item.path.includes("\\")));
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("build rejects missing or unsafe output directories", async () => {
  await assert.rejects(runBuild(["--out"]), /缺少 --out <dir> 参数/);
  await assert.rejects(runBuild(["--out", ".."]), /--out 只能指向项目内目录/);
});
