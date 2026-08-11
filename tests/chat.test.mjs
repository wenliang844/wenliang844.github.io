import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { JSDOM } from "jsdom";

import { SITE } from "../src/config.mjs";
import { renderChatPage } from "../src/templates/chat.mjs";

const ROOT = join(import.meta.dirname, "..");
const chatCode = await readFile(join(ROOT, "js", "chat.js"), "utf8");

function renderWithApi(apiBase) {
  const previous = SITE.apiBase;
  SITE.apiBase = apiBase;
  try {
    return renderChatPage();
  } finally {
    SITE.apiBase = previous;
  }
}

function chatDom(apiBase = "https://api.example.com") {
  const dom = new JSDOM(renderWithApi(apiBase), {
    url: "https://blog.example.com/chat/?room=abcd-2345",
    runScripts: "outside-only",
  });
  const { window } = dom;
  window.HTMLElement.prototype.scrollIntoView = function () {};
  window.CWLUtils = {
    t(_key, fallback) { return fallback; },
    copyText() { return Promise.resolve(); },
  };
  class FakeWebSocket extends window.EventTarget {
    static OPEN = 1;
    static instances = [];
    constructor(url) {
      super();
      this.url = url;
      this.readyState = 0;
      this.sent = [];
      FakeWebSocket.instances.push(this);
    }
    open() {
      this.readyState = FakeWebSocket.OPEN;
      this.dispatchEvent(new window.Event("open"));
    }
    receive(frame) {
      this.dispatchEvent(new window.MessageEvent("message", { data: JSON.stringify(frame) }));
    }
    send(value) { this.sent.push(JSON.parse(value)); }
    close(code = 1000, reason = "") {
      this.readyState = 3;
      this.dispatchEvent(new window.CloseEvent("close", { code, reason }));
    }
  }
  window.WebSocket = FakeWebSocket;
  window.eval(chatCode);
  return { dom, window, FakeWebSocket };
}

test("chat template includes navigation, JSON-LD and exact API websocket CSP", () => {
  const html = renderWithApi("https://api.example.com");
  assert.match(html, /class="nav-chat active" href="\/chat\/"/);
  assert.match(html, /src="\/js\/chat\.js"/);
  assert.match(html, /connect-src[^;]*https:\/\/api\.example\.com[^;]*wss:\/\/api\.example\.com/);
  assert.match(html, /"@type":"WebApplication"/);
  assert.doesNotMatch(html, /room=[0-9A-Z]+/);
});

test("chat client normalizes invite codes and renders server messages as text", () => {
  const { window, FakeWebSocket } = chatDom();
  assert.equal(window.CWLChat.normalizeRoomCode(" abcd-2345 "), "ABCD2345");
  assert.equal(window.CWLChat.validNickname("CWL"), true);
  assert.equal(window.CWLChat.validNickname("x"), false);

  window.document.getElementById("chat-nickname").value = "CWL";
  window.document.querySelector("[data-chat-lobby-form]").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  assert.equal(window.document.querySelector('[data-chat-view="room"]').hidden, false);
  assert.equal(FakeWebSocket.instances.length, 1);
  const socket = FakeWebSocket.instances[0];
  assert.equal(socket.url, "wss://api.example.com/api/v1/chat/rooms/ABCD2345/websocket");
  socket.open();
  assert.deepEqual(socket.sent[0], { type: "join", nickname: "CWL" });

  socket.receive({
    type: "ready",
    roomCode: "ABCD2345",
    participantId: "p1",
    resumeToken: "resume-token-resume-token",
    nickname: "CWL",
    online: 2,
    history: [{ id: "m1", participantId: "p2", nickname: "Visitor", text: "<img src=x onerror=alert(1)>", sentAt: "2026-08-11T04:00:00.000Z" }],
  });
  const messages = window.document.querySelector("[data-chat-messages]");
  assert.equal(messages.querySelectorAll("img").length, 0);
  assert.match(messages.textContent, /<img src=x onerror=alert\(1\)>/);
  assert.equal(window.document.querySelector("[data-chat-online]").textContent, "2");
});

test("chat client disables create and join when the API origin is unconfigured", () => {
  const { window } = chatDom("");
  assert.equal(window.document.querySelector("[data-chat-create]").disabled, true);
  assert.equal(window.document.querySelector("[data-chat-join]").disabled, true);
  assert.match(window.document.querySelector("[data-chat-lobby-status]").textContent, /尚未配置/);
});
