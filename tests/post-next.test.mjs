import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { loadClientModule } from "./helpers/client-module.mjs";

function wait(ms = 20) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

test("next-post module reveals the next recommendation near article bottom", async () => {
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

  const module = await loadClientModule(dom, "src/client/next-post.ts", "NextPostClient");
  module.initNextPost();
  await wait();

  const popup = document.querySelector(".next-popup");
  assert.equal(popup.hidden, false);
  assert.ok(popup.classList.contains("is-visible"));
  dom.window.close();
});

test("next-post module keeps the automatic recommendation hidden on mobile", async () => {
  const dom = new JSDOM(`<!doctype html><html><body>
    <article class="article"><p>Body</p></article>
    <aside class="next-popup" hidden data-next-url="/post/next-post/">
      <a class="next-popup-link" href="/post/next-post/">Next</a>
    </aside>
  </body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/post/current-post/",
    pretendToBeVisual: true,
  });
  Object.defineProperty(dom.window, "innerWidth", { value: 390, configurable: true });
  dom.window.matchMedia = (query) => ({ matches: query === "(max-width: 768px)" });

  const module = await loadClientModule(dom, "src/client/next-post.ts", "NextPostClient");
  module.initNextPost();
  await wait();

  const popup = dom.window.document.querySelector(".next-popup");
  assert.equal(popup.hidden, true);
  assert.equal(popup.classList.contains("is-visible"), false);
  dom.window.close();
});

test("next-post module observes the article tail and disconnects on pagehide", async () => {
  const dom = new JSDOM(`<!doctype html><html><body>
    <article class="article"><p>Body</p><footer>Tail</footer></article>
    <aside class="next-popup" hidden data-next-url="/post/next/"><a class="next-popup-link" href="/post/next/">Next</a></aside>
  </body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/post/current/",
    pretendToBeVisual: true,
  });
  let callback;
  let observed = null;
  let disconnects = 0;
  dom.window.IntersectionObserver = class {
    constructor(next) { callback = next; }
    observe(target) { observed = target; }
    disconnect() { disconnects += 1; }
  };
  const module = await loadClientModule(dom, "src/client/next-post.ts", "NextPostClient");
  module.initNextPost();
  assert.equal(observed.tagName, "FOOTER");
  callback([{ isIntersecting: true }]);
  await wait();
  assert.equal(dom.window.document.querySelector(".next-popup").hidden, false);
  dom.window.dispatchEvent(new dom.window.Event("pagehide"));
  assert.ok(disconnects >= 2, "reveal and pagehide should both clean up the observer");
  dom.window.close();
});
