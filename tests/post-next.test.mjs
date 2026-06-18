import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { JSDOM } from "jsdom";

const ROOT = join(import.meta.dirname, "..");

function wait(ms = 20) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

test("post-next.js reveals the next recommendation near article bottom", async () => {
  const code = await readFile(join(ROOT, "js", "post-next.js"), "utf8");
  const dom = new JSDOM(`<!doctype html><html><body>
    <article class="article"><p>Body</p></article>
    <aside class="next-popup" hidden data-next-url="/post/next-post/" data-next-title="Next">
      <button class="next-popup-close" type="button">Close</button>
      <a class="next-popup-link" href="/post/next-post/"><span class="next-popup-title">Next</span></a>
    </aside>
  </body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/post/current-post/",
    pretendToBeVisual: true,
  });
  const { document } = dom.window;
  Object.defineProperty(dom.window, "innerHeight", { value: 1000, configurable: true });
  document.querySelector("article.article").getBoundingClientRect = () => ({ bottom: 700 });

  dom.window.eval(code);
  await wait();

  const popup = document.querySelector(".next-popup");
  assert.equal(popup.hidden, false);
  assert.ok(popup.classList.contains("is-visible"));
  dom.window.close();
});
