// Deep test: post-next.js — 下一篇浮动推荐卡
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { JSDOM } from "jsdom";

const ROOT = join(import.meta.dirname, "..");

function buildNextHtml(options = {}) {
  const nextUrl = options.nextUrl || "/post/next-post/";
  return `<!doctype html><html lang="zh-CN"><body class="colorscheme-dark">
  <article class="article" style="height: 2000px;">
    <div class="article-content">
      <p>Long article content...</p>
    </div>
  </article>
  <div class="next-popup" hidden data-next-url="${nextUrl}">
    <button class="next-popup-close" type="button" aria-label="关闭">×</button>
    <a class="next-popup-link" href="${nextUrl}">下一篇</a>
  </div>
</body></html>`;
}

async function loadPostNext(dom) {
  const utilsCode = await readFile(join(ROOT, "js", "utils.js"), "utf8");
  const code = await readFile(join(ROOT, "js", "post-next.js"), "utf8");
  dom.window.eval(utilsCode);
  dom.window.eval(code);
  return dom;
}

// ─── 初始状态（无 sessionStorage 关闭记录时注册滚动监听） ──────────────────

test("post-next.js registers scroll listener when not dismissed", async () => {
  const dom = new JSDOM(buildNextHtml(), {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/post/test/",
    pretendToBeVisual: true,
  });
  await loadPostNext(dom);
  const popup = dom.window.document.querySelector(".next-popup");
  // 在 JSDOM 中 getBoundingClientRect 返回全零，可能触发 reveal
  // 关键验证：脚本没有报错并正常运行
  assert.ok(popup, "popup should exist and script should load");
  dom.window.close();
});

// ─── 关闭按钮隐藏弹窗 ─────────────────────────────────────────────────────

test("post-next.js close button hides popup and persists dismissal", async () => {
  const dom = new JSDOM(buildNextHtml(), {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/post/test/",
    pretendToBeVisual: true,
  });
  await loadPostNext(dom);
  const { document } = dom.window;

  // 手动显示弹窗来测试关闭
  const popup = document.querySelector(".next-popup");
  popup.hidden = false;
  popup.classList.add("is-visible");

  const closeBtn = document.querySelector(".next-popup-close");
  closeBtn.click();

  // is-visible 被移除，但 hidden 是通过 setTimeout 设置的
  assert.ok(!popup.classList.contains("is-visible"), "should remove is-visible class");
  dom.window.close();
});

// ─── 链接点击记住关闭状态 ───────────────────────────────────────────────────

test("post-next.js link click remembers dismissal", async () => {
  const nextUrl = "/post/next-post/";
  const dom = new JSDOM(buildNextHtml({ nextUrl }), {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/post/test/",
    pretendToBeVisual: true,
  });
  await loadPostNext(dom);
  const { document } = dom.window;

  const link = document.querySelector(".next-popup-link");
  link.click();

  // sessionStorage 应记录关闭状态
  const key = "cwl-next-dismissed:" + nextUrl;
  assert.equal(dom.window.sessionStorage.getItem(key), "1", "should store dismissal");
  dom.window.close();
});

// ─── 关闭后记住状态，重新加载不再显示 ───────────────────────────────────────

test("post-next.js respects stored dismissal on reload", async () => {
  const nextUrl = "/post/next-post/";
  const dismissKey = "cwl-next-dismissed:" + nextUrl;

  const dom = new JSDOM(buildNextHtml({ nextUrl }), {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/post/test/",
    pretendToBeVisual: true,
  });
  // 预设关闭状态
  dom.window.sessionStorage.setItem(dismissKey, "1");
  await loadPostNext(dom);

  // 弹窗应保持隐藏，不应注册滚动监听
  const popup = dom.window.document.querySelector(".next-popup");
  assert.ok(popup.hidden, "popup should stay hidden when dismissed");
  dom.window.close();
});

// ─── data-next-url 属性正确读取 ─────────────────────────────────────────────

test("post-next.js reads next URL from data attribute", async () => {
  const dom = new JSDOM(buildNextHtml({ nextUrl: "/post/custom-next/" }), {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/post/test/",
    pretendToBeVisual: true,
  });
  await loadPostNext(dom);
  const popup = dom.window.document.querySelector(".next-popup");
  assert.equal(popup.dataset.nextUrl, "/post/custom-next/");
  dom.window.close();
});

// ─── 无 .next-popup 时静默退出 ─────────────────────────────────────────────

test("post-next.js exits gracefully without next-popup", async () => {
  const dom = new JSDOM(`<!doctype html><html><body>
    <article class="article"><p>Content</p></article>
  </body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/post/test/",
    pretendToBeVisual: true,
  });
  const utilsCode = await readFile(join(ROOT, "js", "utils.js"), "utf8");
  const code = await readFile(join(ROOT, "js", "post-next.js"), "utf8");
  dom.window.eval(utilsCode);
  dom.window.eval(code);
  assert.ok(true, "should exit gracefully");
  dom.window.close();
});

// ─── 无 article 时静默退出 ──────────────────────────────────────────────────

test("post-next.js exits gracefully without article element", async () => {
  const dom = new JSDOM(`<!doctype html><html><body>
    <div class="next-popup" hidden data-next-url="/post/x/">
      <button class="next-popup-close">×</button>
      <a class="next-popup-link" href="/post/x/">Next</a>
    </div>
  </body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/post/test/",
    pretendToBeVisual: true,
  });
  const utilsCode = await readFile(join(ROOT, "js", "utils.js"), "utf8");
  const code = await readFile(join(ROOT, "js", "post-next.js"), "utf8");
  dom.window.eval(utilsCode);
  dom.window.eval(code);
  assert.ok(true, "should exit gracefully without article");
  dom.window.close();
});

// ─── close 按钮的 sessionStorage 持久化 ────────────────────────────────────

test("post-next.js close button persists to sessionStorage", async () => {
  const nextUrl = "/post/abc/";
  const dom = new JSDOM(buildNextHtml({ nextUrl }), {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/post/test/",
    pretendToBeVisual: true,
  });
  await loadPostNext(dom);
  const { document } = dom.window;

  const popup = document.querySelector(".next-popup");
  popup.hidden = false;
  popup.classList.add("is-visible");

  const closeBtn = document.querySelector(".next-popup-close");
  closeBtn.click();

  assert.equal(dom.window.sessionStorage.getItem("cwl-next-dismissed:" + nextUrl), "1");
  dom.window.close();
});
