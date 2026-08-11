import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

import { renderChatPage } from "../src/templates/chat.mjs";

const MINNIT_CHAT_URL = "https://organizations.minnit.chat/330715643479128/c/Main?embed";

test("chat template embeds the configured Minnit room", () => {
  const html = renderChatPage();
  const dom = new JSDOM(html);
  const { document } = dom.window;
  const embed = document.querySelector(".minnit-chat-sembed");
  const script = [...document.scripts].find(({ src }) => src.startsWith("https://minnit.chat/js/embed.js"));

  assert.ok(embed);
  assert.equal(embed.dataset.chatname, MINNIT_CHAT_URL);
  assert.equal(embed.dataset.version, "1.55");
  assert.ok(script);
  assert.equal(script.defer, true);
  assert.ok([...document.scripts].some(({ src }) => src.endsWith("/js/chat-embed.js")));
  assert.equal(document.querySelector(".chat-external-link").href, MINNIT_CHAT_URL);
  assert.equal(document.querySelectorAll('meta[name="viewport"]').length, 1);
  assert.equal(document.querySelector(".nav-chat").classList.contains("active"), true);
});

test("chat CSP grants Minnit only the capabilities required by its embed loader", () => {
  const html = renderChatPage();
  const policy = new JSDOM(html).window.document
    .querySelector('meta[http-equiv="Content-Security-Policy"]')
    .content;

  assert.match(policy, /script-src[^;]*https:\/\/minnit\.chat/);
  assert.match(policy, /frame-src[^;]*https:\/\/organizations\.minnit\.chat/);
  assert.match(policy, /style-src-attr 'unsafe-inline'/);
  assert.doesNotMatch(policy, /connect-src[^;]*\shttps:(?:\s|;|$)/);
  assert.doesNotMatch(html, /<[^>]+\sstyle=/i);
});

test("chat metadata describes a hosted online application without exposing private chat data", () => {
  const html = renderChatPage();

  assert.match(html, /"@type":"WebApplication"/);
  assert.match(html, /聊天室由 Minnit Chat 托管/);
  assert.doesNotMatch(html, /room=[0-9A-Z]{8}/);
  assert.doesNotMatch(html, /src="\/js\/chat\.js"/);
});
