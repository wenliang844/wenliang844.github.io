import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { connectSourcesForHtml, hardenHtml, hardenPolicy, inlineScriptHashes } from "../scripts/harden-csp.mjs";

test("CSP hardener hashes inline scripts and disables inline handlers and styles", () => {
  const source = '{"@context":"https://schema.org"}';
  const html = `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' https://plausible.io; style-src 'self' 'unsafe-inline'"><script type="application/ld+json">${source}</script>`;
  const hardened = hardenHtml(html);
  const expected = createHash("sha256").update(source).digest("base64");
  assert.match(hardened, new RegExp(`script-src 'self' https://plausible\\.io 'sha256-${expected.replace(/[+]/g, "\\+")}'`));
  assert.match(hardened, /script-src-attr 'none'/);
  assert.doesNotMatch(hardened, /script-src[^;]*'unsafe-inline'/);
  assert.match(hardened, /style-src 'self'; style-src-attr 'none'/);
  assert.doesNotMatch(hardened, /style-src[^;]*'unsafe-inline'/);
});

test("CSP hardening is deterministic and replaces stale hashes", () => {
  const html = '<script type="application/ld+json">{"name":"CWL"}</script>';
  const hashes = inlineScriptHashes(html);
  const first = hardenPolicy("default-src 'self'; script-src 'self' 'sha256-stale='; script-src-attr 'unsafe-inline'; style-src 'self' 'unsafe-inline'", hashes);
  const second = hardenPolicy(first, hashes);
  assert.equal(first, second);
  assert.doesNotMatch(first, /stale/);
  assert.equal((first.match(/sha256-/g) || []).length, 1);
});

test("CSP hardener rejects inline event handlers", () => {
  assert.throws(() => hardenHtml('<meta http-equiv="Content-Security-Policy" content="script-src \'self\'"><button onclick="alert(1)">Run</button>', "unsafe.html"), /inline event handler/);
});

test("CSP hardener rejects inline style attributes", () => {
  assert.throws(() => hardenHtml('<meta http-equiv="Content-Security-Policy" content="script-src \'self\'; style-src \'self\' \'unsafe-inline\'"><div style="display:none"></div>', "unsafe.html"), /inline style attribute/);
});

test("CSP hardener scopes the CodeMirror runtime style exception to the editor", () => {
  const html = '<meta http-equiv="Content-Security-Policy" content="script-src \'self\'; style-src \'self\' \'unsafe-inline\'"><script src="/js/editor-codemirror.js"></script>';
  const hardened = hardenHtml(html);
  assert.match(hardened, /style-src 'self' 'unsafe-inline'; style-src-attr 'unsafe-inline'/);
});

test("CSP hardener preserves the Minnit loader runtime style exception", () => {
  const html = '<meta http-equiv="Content-Security-Policy" content="script-src \'self\' https://minnit.chat; style-src \'self\'"><script src="https://minnit.chat/js/embed.js?c=1"></script>';
  const hardened = hardenHtml(html);
  assert.match(hardened, /style-src 'self'; style-src-attr 'unsafe-inline'/);
});

test("CSP hardener grants only the WebAssembly permission required by Pagefind", () => {
  const html = '<meta http-equiv="Content-Security-Policy" content="script-src \'self\'; style-src \'self\'"><script src="/js/search-loader.js"></script>';
  const hardened = hardenHtml(html);
  assert.match(hardened, /script-src 'self' 'wasm-unsafe-eval'/);
  assert.doesNotMatch(hardened, /(?:^|\s)'unsafe-eval'(?:\s|;|$)/);
});

test("CSP hardener grants network origins by page capability", () => {
  const publicHtml = [
    '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'; style-src \'self\'; connect-src \'self\' https:">',
    '<meta name="cwl-api-base" content="https://api.example.com/edge">',
    '<script src="/js/analytics.js"></script>',
    '<script src="/js/subscribe.js"></script>',
    '<script src="/js/assistant.js"></script>',
  ].join("");
  assert.deepEqual(connectSourcesForHtml(publicHtml), [
    "'self'",
    "https://cloud.umami.is",
    "https://plausible.io",
    "https://buttondown.com",
    "https://muyuan.do",
    "https://token-plan-cn.xiaomimimo.com",
    "https://api.example.com",
  ]);
  const hardened = hardenHtml(publicHtml);
  const connect = hardened.match(/connect-src ([^;\"]+)/)[1].split(/\s+/);
  assert.equal(connect.includes("https:"), false);
  assert.equal(connect.includes("https://api.example.com"), true);

  const contactHtml = publicHtml + '<script src="/js/feedback.js"></script>';
  assert.equal(connectSourcesForHtml(contactHtml).includes("https://api.web3forms.com"), true);

  const toolsHtml = publicHtml + '<script src="/js/tools.js"></script>';
  assert.deepEqual(connectSourcesForHtml(toolsHtml), ["'self'", "https:"]);
});
