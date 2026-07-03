import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import assert from "node:assert/strict";
import { STATIC_PAGES } from "../src/config.mjs";

const execFileAsync = promisify(execFile);
const ROOT = join(import.meta.dirname, "..");

async function runBuild(args = []) {
  return execFileAsync("node", ["scripts/build.mjs", ...args], {
    cwd: ROOT,
    windowsHide: true,
  });
}

function indexPathForRoute(root, route) {
  const segments = route.split("/").filter(Boolean);
  return join(root, ...segments, "index.html");
}

function indexArtifactForRoute(route) {
  const segments = route.split("/").filter(Boolean);
  return segments.length ? `${segments.join("/")}/index.html` : "index.html";
}

async function trackedFiles() {
  const { stdout } = await execFileAsync("git", ["ls-files"], { cwd: ROOT, windowsHide: true });
  return new Set(stdout.trim().split(/\r?\n/).filter(Boolean));
}

test("build writes the expected static artifacts", async () => {
  const tempRoot = join(ROOT, "temp");
  await mkdir(tempRoot, { recursive: true });
  const outDir = await mkdtemp(join(tempRoot, "cwlblog-build-"));
  try {
    const { stdout } = await runBuild(["--out", outDir]);
    assert.match(stdout, /构建完成：6 篇文章/);

    const postsHtml = await readFile(join(outDir, "post", "index.html"), "utf8");
    const singlePostHtml = await readFile(join(outDir, "post", "manage-system", "index.html"), "utf8");
    const appreciationHtml = await readFile(join(outDir, "appreciation", "index.html"), "utf8");
    const trustHtml = await readFile(join(outDir, "trust", "index.html"), "utf8");
    const toolsHtml = await readFile(join(outDir, "tools", "index.html"), "utf8");
    const aiHtml = await readFile(join(outDir, "ai", "index.html"), "utf8");
    const sitemap = await readFile(join(outDir, "sitemap.xml"), "utf8");
    const robots = await readFile(join(outDir, "robots.txt"), "utf8");
    const rss = await readFile(join(outDir, "index.xml"), "utf8");
    const searchIndex = JSON.parse(await readFile(join(outDir, "search-index.json"), "utf8"));
    const appreciationTexts = [
      "鉴赏",
      "科技研究排行榜",
      "影视作品排行榜",
      "娱乐项目排行榜",
      "食物排行榜",
      "顿悟排行榜",
      "座右铭排行榜",
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
      "黑道家族",
      "黄石",
      "毒枭",
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
      "鸡蛋",
      "牛肉",
      "坚果",
      "三文鱼",
      "虾",
      "土豆",
      "酸奶",
      "第一次顿悟",
      "xx 年高三：努力学英语 xxxx。",
      "第二次顿悟",
      "xxxx 年底 xx：清晰地知道了保持快乐才是最重要的、与人相处的绝招、识破人。",
      "第三次顿悟",
      "20xx 年 xx 月 xx 日：清晰地知道了自己想要的是什么，规划人生之路。",
      "所有的问题都是经济问题",
      "批判性思维",
      "所有人都支持的一件事必然错误(乌合之众)",
      "心理暗示可以操纵摇摆州",
      "事缓则圆,用AI分析得到建议",
      "每个人都有漏洞,可以通过观察得到",
    ];

    assert.match(postsHtml, /class="post-tree"/);
    assert.match(postsHtml, /<link rel="canonical" href="https:\/\/wenliang844.github.io\/post\/">/);
    assert.match(postsHtml, /property="og:image" content="https:\/\/wenliang844.github.io\/images\/favicon.png"/);
    for (const text of appreciationTexts) {
      assert.ok(appreciationHtml.includes(text), `appreciation page missing: ${text}`);
    }
    assert.match(sitemap, /<urlset /);
    assert.match(sitemap, /xmlns:image="http:\/\/www\.google\.com\/schemas\/sitemap-image\/1\.1"/);
    assert.match(sitemap, /<loc>https:\/\/wenliang844.github.io\/<\/loc><lastmod>[^<]+<\/lastmod><priority>1\.0<\/priority>/);
    assert.match(sitemap, /<loc>https:\/\/wenliang844.github.io\/about\/<\/loc>/);
    assert.match(sitemap, /<loc>https:\/\/wenliang844.github.io\/about\/<\/loc><lastmod>[^<]+<\/lastmod><priority>0\.6<\/priority>/);
    assert.match(sitemap, /<loc>https:\/\/wenliang844.github.io\/contact\/<\/loc>/);
    assert.match(sitemap, /<loc>https:\/\/wenliang844.github.io\/tools\/<\/loc>/);
    assert.match(sitemap, /<loc>https:\/\/wenliang844.github.io\/trust\/<\/loc><lastmod>[^<]+<\/lastmod><priority>0\.5<\/priority>/);
    assert.match(sitemap, /<loc>https:\/\/wenliang844.github.io\/post\/manage-system\/<\/loc><lastmod>[^<]+<\/lastmod><priority>0\.8<\/priority>/);
    assert.doesNotMatch(sitemap, /<priority>0<\/priority>/);
    assert.doesNotMatch(sitemap, /<loc>https:\/\/wenliang844.github.io\/ai\/relay\/<\/loc>/);
    assert.match(robots, /Sitemap: https:\/\/wenliang844.github.io\/sitemap.xml/);
    assert.match(robots, /Allow: \/post\//);
    assert.match(robots, /Allow: \/trust\//);
    assert.match(toolsHtml, /在线工具箱/);
    assert.match(toolsHtml, /JSON 格式化/);
    assert.match(toolsHtml, /JWT 解码/);
    assert.match(toolsHtml, /哈希摘要/);
    assert.match(toolsHtml, /密码生成器/);
    assert.match(toolsHtml, /二维码生成/);
    assert.match(toolsHtml, /\/js\/vendor\/qrcode\.min\.js/);
    assert.match(toolsHtml, /\/js\/tools-core\.js/);
    assert.match(toolsHtml, /\/js\/tools\.js/);
    assert.match(toolsHtml, /\/js\/assistant-loader\.js/);
    assert.doesNotMatch(toolsHtml, /\/js\/assistant\.js/);
    assert.match(aiHtml, /中转站排行榜/);
    assert.match(aiHtml, /<title>中转站排名 :: CWLBlog<\/title>/);
    assert.match(aiHtml, /<a class="active" href="\/ai\/" data-i18n="nav\.ai">AI中转站排名<\/a>/);
    assert.match(aiHtml, /<button class="ai-tab active" id="ai-tab-relay"[^>]+aria-selected="true"/);
    assert.match(aiHtml, /\/js\/relay\.js/);
    assert.match(aiHtml, /id="relay"/);
    assert.match(aiHtml, /data-relay-filter="healthy"/);
    assert.match(trustHtml, /隐私与信任/);
    assert.match(trustHtml, /buttondown\.com/);
    assert.match(trustHtml, /giscus\.app/);
    assert.match(trustHtml, /localStorage: cwl\.assistant\.\*/);
    // 单篇页：阅读时长占位、JSON-LD Article、相关文章、下一篇浮动卡。
    assert.match(singlePostHtml, /class="reading-time"/);
    assert.match(singlePostHtml, />约<\/span> \d+ <span data-i18n="dyn\.readingSuffix">分钟<\/span>/);
    assert.match(singlePostHtml, /<script type="application\/ld\+json">/);
    assert.match(singlePostHtml, /"@type":"Article"/);
    assert.match(singlePostHtml, /class="post-related"/);
    assert.match(singlePostHtml, /class="next-popup"/);
    assert.match(singlePostHtml, /\/js\/post-next\.js/);
    assert.match(rss, /<rss version="2.0"/);
    assert.doesNotMatch(rss, /Hugo/);
    assert.equal(searchIndex.filter((item) => item.type === "post").length, 6);
    assert.ok(searchIndex.some((item) => item.path === "/about/" && item.summary.includes("CWL")));
    assert.ok(searchIndex.some((item) => item.path === "/contact/" && item.summary.includes("CWL")));
    assert.ok(searchIndex.some((item) => item.path === "/tools/" && item.summary.includes("JSON")));
    assert.ok(searchIndex.some((item) => item.path === "/ai/" && item.title === "中转站排名" && item.summary.includes("中转站")));
    assert.ok(searchIndex.some((item) => item.path === "/ai/#nav" && item.title === "AI导航网站"));
    assert.ok(searchIndex.some((item) => item.path === "/trust/" && item.title === "隐私与信任" && item.summary.includes("第三方服务")));
    assert.ok(searchIndex.every((item) => item.path !== "/ai/relay/"));
    assert.ok(searchIndex.some((item) => item.path === "/appreciation/" && item.summary.includes("顿悟")));
    assert.ok(searchIndex.every((item) => item.path && !item.path.includes("\\")));
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("build rejects missing or unsafe output directories", async () => {
  await assert.rejects(runBuild(["--out"]), /缺少 --out <dir> 参数/);
  await assert.rejects(runBuild(["--out", ".."]), /--out 只能指向项目内目录/);
});

test("registered static pages have committed index artifacts", async () => {
  const tracked = await trackedFiles();

  for (const page of STATIC_PAGES) {
    const artifact = indexArtifactForRoute(page.path);
    assert.ok(tracked.has(artifact), `${page.path} should have a tracked ${artifact}`);

    const html = await readFile(indexPathForRoute(ROOT, page.path), "utf8");
    assert.match(html, /<main\b[^>]*\bid=["']main-content["']/i, `${page.path} should have main#main-content`);
  }
});
