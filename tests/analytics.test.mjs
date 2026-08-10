import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { JSDOM } from "jsdom";

const ROOT = join(import.meta.dirname, "..");

async function analyticsSource(provider = "", websiteId = "") {
  const source = await readFile(join(ROOT, "js", "analytics.js"), "utf8");
  return source
    .replace('provider: "",', `provider: "${provider}",`)
    .replace('websiteId: "",', `websiteId: "${websiteId}",`);
}

test("analytics stays network-silent until a provider is configured", async () => {
  const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/",
  });
  dom.window.eval(await analyticsSource());

  assert.equal(dom.window.CWLAnalytics.enabled, false);
  assert.equal(dom.window.CWLAnalytics.provider, "none");
  assert.equal(dom.window.document.querySelector("script[data-analytics-provider]"), null);
  assert.equal(dom.window.CWLAnalytics.track("test", {}), false);
});

test("plausible adapter queues sanitized custom events after loading", async () => {
  const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/post/example/",
  });
  dom.window.eval(await analyticsSource("plausible"));

  const script = dom.window.document.querySelector('script[data-analytics-provider="plausible"]');
  assert.ok(script);
  assert.equal(script.src, "https://plausible.io/js/script.js");
  assert.equal(script.dataset.domain, "wenliang844.github.io");
  script.dispatchEvent(new dom.window.Event("load"));

  assert.equal(dom.window.CWLAnalytics.track("search_result_click", {
    query: "x".repeat(300),
    ignored: { secret: true },
  }), true);
  const queued = dom.window.plausible.q[0];
  assert.equal(queued[0], "search_result_click");
  assert.equal(queued[1].props.query.length, 160);
  assert.equal("ignored" in queued[1].props, false);
});

test("analytics honors Do Not Track before loading a provider", async () => {
  const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
    runScripts: "outside-only",
  });
  Object.defineProperty(dom.window.navigator, "doNotTrack", { value: "1" });
  dom.window.eval(await analyticsSource("plausible"));

  assert.equal(dom.window.CWLAnalytics.enabled, false);
  assert.equal(dom.window.document.querySelector("script[data-analytics-provider]"), null);
});
