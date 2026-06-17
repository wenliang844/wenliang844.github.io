import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

test("nav subscribe button opens the subscribe modal", async () => {
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
  let modalFocused = false;

  root.scrollIntoView = function (options) {
  };

  dom.window.eval(jsCode);
  const modalInput = document.querySelector(".subscribe-modal-input");
  modalInput.focus = function () {
    modalFocused = true;
  };

  document.querySelector("[data-subscribe-open]").click();

  await new Promise((resolve) => dom.window.setTimeout(resolve, 220));

  assert.equal(document.querySelector(".menu-toggle").checked, false);
  assert.equal(document.querySelector(".subscribe-modal").classList.contains("open"), true);
  assert.equal(modalFocused, true);
  assert.equal(document.querySelector(".subscribe-modal-status").textContent, "");
});
