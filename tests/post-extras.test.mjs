import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { loadClientModule } from "./helpers/client-module.mjs";

function buildDom() {
  return new JSDOM("<!doctype html><html><head></head><body><div class='post-share'></div><div id='giscus-thread'></div></body></html>", {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/post/example/",
  });
}

test("post extras load sharing and comments independently near the viewport", async () => {
  const dom = buildDom();
  const observers = [];
  dom.window.IntersectionObserver = class {
    constructor(callback, options) {
      this.callback = callback;
      this.options = options;
      this.disconnected = false;
      observers.push(this);
    }
    observe(target) { this.target = target; }
    disconnect() { this.disconnected = true; }
  };
  const loaded = [];
  const module = await loadClientModule(dom, "src/client/post-extras.ts", "PostExtrasClient");
  module.initPostExtras(dom.window.document, dom.window, {
    loadQr: async () => { loaded.push("qr"); },
    loadShare: async () => { loaded.push("share"); },
    loadComments: async () => { loaded.push("comments"); },
  });

  assert.equal(observers.length, 2);
  assert.ok(observers.every((observer) => observer.options.rootMargin === "800px 0px"));
  assert.deepEqual(loaded, []);

  observers[0].callback([{ target: observers[0].target, isIntersecting: true }]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(loaded, ["qr", "share"]);
  assert.equal(observers[0].disconnected, true);

  observers[1].callback([{ target: observers[1].target, isIntersecting: true }]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(loaded, ["qr", "share", "comments"]);
  assert.equal(observers[1].disconnected, true);
  dom.window.close();
});

test("post extras defer to window load when IntersectionObserver is unavailable", async () => {
  const dom = buildDom();
  dom.window.IntersectionObserver = undefined;
  const loaded = [];
  const module = await loadClientModule(dom, "src/client/post-extras.ts", "PostExtrasClient");
  module.initPostExtras(dom.window.document, dom.window, {
    loadQr: async () => { loaded.push("qr"); },
    loadShare: async () => { loaded.push("share"); },
    loadComments: async () => { loaded.push("comments"); },
  });
  assert.deepEqual(loaded, []);

  dom.window.dispatchEvent(new dom.window.Event("load"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(loaded, ["qr", "comments", "share"]);
  dom.window.close();
});
