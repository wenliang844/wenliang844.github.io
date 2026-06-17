import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

test("nav subscribe button opens the footer subscribe form", async () => {
  const jsCode = await readFile(join(ROOT, "js", "subscribe.js"), "utf8");
  const dom = new JSDOM(`<!doctype html>
    <html>
      <body>
        <input type="checkbox" class="menu-toggle" checked>
        <button type="button" data-subscribe-open>订阅</button>
        <div class="subscribe">
          <form class="subscribe-form" novalidate>
            <input class="subscribe-input" type="email" name="email">
            <button class="subscribe-btn" type="submit">订阅</button>
          </form>
          <p class="subscribe-status" role="status"></p>
        </div>
      </body>
    </html>`, {
    runScripts: "outside-only",
  });

  const { document } = dom.window;
  const root = document.querySelector(".subscribe");
  const input = document.querySelector(".subscribe-input");
  let scrollOptions = null;
  let focused = false;

  root.scrollIntoView = function (options) {
    scrollOptions = options;
  };
  input.focus = function () {
    focused = true;
  };

  dom.window.eval(jsCode);
  document.querySelector("[data-subscribe-open]").click();

  await new Promise((resolve) => dom.window.setTimeout(resolve, 220));

  assert.equal(document.querySelector(".menu-toggle").checked, false);
  assert.equal(scrollOptions.behavior, "smooth");
  assert.equal(scrollOptions.block, "center");
  assert.equal(focused, true);
  assert.equal(root.classList.contains("subscribe--focus"), true);
  assert.equal(document.querySelector(".subscribe-status").textContent, "输入邮箱即可订阅更新。");
});
