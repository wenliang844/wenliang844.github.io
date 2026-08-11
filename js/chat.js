(function () {


  const lobby = document.querySelector('[data-chat-view="lobby"]');
  const room = document.querySelector('[data-chat-view="room"]');
  if (!lobby || !room) {return;}

  const apiMeta = document.querySelector('meta[name="cwl-api-base"]');
  const apiBase = apiMeta ? apiMeta.getAttribute("content").replace(/\/$/, "") : "";
  const utils = window.CWLUtils || {};
  const t = function (key, fallback) { return utils.t ? utils.t(key, fallback) : fallback; };
  const nicknameInput = document.getElementById("chat-nickname");
  const codeInput = document.getElementById("chat-room-code");
  const createButton = document.querySelector("[data-chat-create]");
  const joinButton = document.querySelector("[data-chat-join]");
  const lobbyForm = document.querySelector("[data-chat-lobby-form]");
  const lobbyStatus = document.querySelector("[data-chat-lobby-status]");
  const roomCodeEl = document.querySelector("[data-chat-room-code]");
  const connectionEl = document.querySelector("[data-chat-connection]");
  const onlineEl = document.querySelector("[data-chat-online]");
  const messagesEl = document.querySelector("[data-chat-messages]");
  const roomStatus = document.querySelector("[data-chat-room-status]");
  const compose = document.querySelector("[data-chat-compose]");
  const messageInput = document.getElementById("chat-message");
  const counter = document.querySelector("[data-chat-counter]");
  const shareButton = document.querySelector("[data-chat-share]");
  const copyButton = document.querySelector("[data-chat-copy]");
  const leaveButton = document.querySelector("[data-chat-leave]");
  const ROOM_CODE = /^[0-9A-HJKMNP-TV-Z]{8}$/;
  const TERMINAL_ERRORS = new Set(["room_not_found", "room_full", "room_expired", "chat_disabled"]);
  let socket = null;
  let currentRoom = "";
  let currentNickname = "";
  let participantId = "";
  let reconnectAttempt = 0;
  let reconnectTimer = null;
  let leaving = false;

  function normalizeRoomCode(value) {
    return String(value || "").trim().toUpperCase().replace(/[-\s]/g, "");
  }

  function hasControlCharacters(value) {
    return Array.from(value).some(function (character) {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127;
    });
  }

  function validNickname(value) {
    const nickname = String(value || "").trim();
    return nickname.length >= 2 && nickname.length <= 20 && !hasControlCharacters(nickname);
  }

  function setStatus(element, text, state) {
    element.textContent = text || "";
    if (state) {element.dataset.state = state;}
  }

  function setConnection(state) {
    const labels = {
      connecting: t("chat.state.connecting", "正在连接"),
      connected: t("chat.state.connected", "已连接"),
      reconnecting: t("chat.state.reconnecting", "正在重连"),
      disconnected: t("chat.state.disconnected", "连接已断开"),
      expired: t("chat.state.expired", "房间已失效")
    };
    setStatus(connectionEl, labels[state] || labels.disconnected, state);
  }

  function errorMessage(code, fallback) {
    const messages = {
      chat_disabled: t("chat.error.disabled", "聊天室暂未启用。"),
      invalid_origin: t("chat.error.origin", "当前站点无法连接聊天室。"),
      room_not_found: t("chat.error.notFound", "房间不存在或已失效。"),
      room_full: t("chat.error.full", "房间已满。"),
      nickname_invalid: t("chat.error.nickname", "昵称需为 2–20 个字符。"),
      message_invalid: t("chat.error.message", "消息需为 1–500 个字符。"),
      rate_limited: t("chat.error.rate", "操作太频繁，请稍后再试。"),
      room_expired: t("chat.error.expired", "房间因长时间无活动已清除。")
    };
    return messages[code] || fallback || t("chat.error.generic", "聊天室请求失败，请稍后重试。");
  }

  function resumeKey(code) { return "cwl.chat.resume." + code; }
  function readResumeToken(code) {
    try { return window.sessionStorage.getItem(resumeKey(code)) || ""; } catch (_error) { return ""; }
  }
  function saveResumeToken(code, token) {
    try { window.sessionStorage.setItem(resumeKey(code), token); } catch (_error) { /* optional */ }
  }
  function removeResumeToken(code) {
    try { window.sessionStorage.removeItem(resumeKey(code)); } catch (_error) { /* optional */ }
  }

  function appendMessage(message, historical) {
    if (!message || typeof message.text !== "string") {return;}
    const item = document.createElement("li");
    item.className = "chat-message" + (message.participantId === participantId ? " is-own" : "");
    if (message.id) {item.dataset.messageId = message.id;}
    const meta = document.createElement("div");
    meta.className = "chat-message-meta";
    const name = document.createElement("strong");
    name.textContent = message.nickname || t("chat.anonymous", "匿名");
    const time = document.createElement("time");
    const date = new Date(message.sentAt);
    time.dateTime = Number.isNaN(date.getTime()) ? "" : date.toISOString();
    time.textContent = Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const body = document.createElement("p");
    body.textContent = message.text;
    meta.append(name, time);
    item.append(meta, body);
    messagesEl.appendChild(item);
    if (!historical) {item.scrollIntoView({ block: "end" });}
  }

  function appendSystem(event, nickname) {
    const item = document.createElement("li");
    item.className = "chat-system-message";
    if (event === "joined") {item.textContent = t("chat.system.joined", "{name} 加入了房间").replace("{name}", nickname || t("chat.anonymous", "匿名"));}
    else if (event === "left") {item.textContent = t("chat.system.left", "{name} 离开了房间").replace("{name}", nickname || t("chat.anonymous", "匿名"));}
    else if (event === "history_truncated") {item.textContent = t("chat.system.truncated", "较早的消息已按房间上限清除。");}
    else {return;}
    messagesEl.appendChild(item);
    item.scrollIntoView({ block: "end" });
  }

  function handleFrame(frame) {
    if (!frame || typeof frame.type !== "string") {return;}
    if (frame.type === "ready") {
      participantId = frame.participantId || "";
      currentNickname = frame.nickname || currentNickname;
      nicknameInput.value = currentNickname;
      if (frame.resumeToken) {saveResumeToken(currentRoom, frame.resumeToken);}
      messagesEl.replaceChildren();
      (Array.isArray(frame.history) ? frame.history : []).forEach(function (message) { appendMessage(message, true); });
      onlineEl.textContent = String(Number.isInteger(frame.online) ? frame.online : 1);
      reconnectAttempt = 0;
      setConnection("connected");
      messageInput.disabled = false;
      messageInput.focus();
      if (messagesEl.lastElementChild) {messagesEl.lastElementChild.scrollIntoView({ block: "end" });}
      return;
    }
    if (frame.type === "message") {appendMessage(frame, false);}
    else if (frame.type === "presence") {onlineEl.textContent = String(Number.isInteger(frame.online) ? frame.online : 0);}
    else if (frame.type === "system") {appendSystem(frame.event, frame.nickname);}
    else if (frame.type === "error") {
      setStatus(roomStatus, errorMessage(frame.code, frame.message), "error");
      if (TERMINAL_ERRORS.has(frame.code)) {
        leaving = true;
        setConnection(frame.code === "room_expired" ? "expired" : "disconnected");
        messageInput.disabled = true;
        removeResumeToken(currentRoom);
      }
    }
  }

  function websocketUrl(code) {
    const url = new URL(apiBase + "/api/v1/chat/rooms/" + encodeURIComponent(code) + "/websocket");
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return url.toString();
  }

  function scheduleReconnect() {
    if (leaving || !currentRoom || reconnectTimer) {return;}
    const delay = Math.min(30000, Math.pow(2, reconnectAttempt) * 1000);
    reconnectAttempt += 1;
    setConnection("reconnecting");
    reconnectTimer = window.setTimeout(function () { reconnectTimer = null; connect(); }, delay);
  }

  function connect() {
    if (!apiBase || !currentRoom || leaving) {return;}
    setConnection(reconnectAttempt ? "reconnecting" : "connecting");
    messageInput.disabled = true;
    try { socket = new WebSocket(websocketUrl(currentRoom)); } catch (_error) { scheduleReconnect(); return; }
    socket.addEventListener("open", function () {
      socket.send(JSON.stringify({ type: "join", nickname: currentNickname, resumeToken: readResumeToken(currentRoom) || undefined }));
    });
    socket.addEventListener("message", function (event) {
      if (typeof event.data !== "string") {return;}
      try { handleFrame(JSON.parse(event.data)); } catch (_error) { /* malformed server frame */ }
    });
    socket.addEventListener("close", function () { socket = null; if (!leaving) {scheduleReconnect();} });
    socket.addEventListener("error", function () { setConnection("disconnected"); });
  }

  function openRoom(code, nickname) {
    currentRoom = code;
    currentNickname = nickname;
    leaving = false;
    participantId = "";
    reconnectAttempt = 0;
    messagesEl.replaceChildren();
    roomCodeEl.textContent = code;
    lobby.hidden = true;
    room.hidden = false;
    setStatus(roomStatus, "");
    window.history.replaceState(null, "", "/chat/?room=" + encodeURIComponent(code));
    connect();
  }

  function lobbyValues() {
    const nickname = nicknameInput.value.trim();
    const code = normalizeRoomCode(codeInput.value);
    nicknameInput.value = nickname;
    codeInput.value = code;
    if (!validNickname(nickname)) {
      nicknameInput.setAttribute("aria-invalid", "true");
      setStatus(lobbyStatus, errorMessage("nickname_invalid"), "error");
      nicknameInput.focus();
      return null;
    }
    nicknameInput.removeAttribute("aria-invalid");
    return { nickname, code };
  }

  async function createRoom() {
    const values = lobbyValues();
    if (!values || !apiBase) {return;}
    createButton.disabled = true;
    setStatus(lobbyStatus, t("chat.state.creating", "正在创建房间…"), "loading");
    try {
      const response = await fetch(apiBase + "/api/v1/chat/rooms", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      const data = await response.json();
      if (!response.ok) {throw Object.assign(new Error("create failed"), { code: data && data.error && data.error.code });}
      openRoom(data.roomCode, values.nickname);
    } catch (error) {
      setStatus(lobbyStatus, errorMessage(error.code), "error");
    } finally {
      createButton.disabled = false;
    }
  }

  function joinRoom() {
    const values = lobbyValues();
    if (!values) {return;}
    if (!ROOM_CODE.test(values.code)) {
      codeInput.setAttribute("aria-invalid", "true");
      setStatus(lobbyStatus, t("chat.error.code", "请输入有效的 8 位邀请码。"), "error");
      codeInput.focus();
      return;
    }
    codeInput.removeAttribute("aria-invalid");
    openRoom(values.code, values.nickname);
  }

  function leaveRoom() {
    leaving = true;
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
    if (socket) {socket.close(1000, "left");}
    socket = null;
    removeResumeToken(currentRoom);
    currentRoom = "";
    participantId = "";
    room.hidden = true;
    lobby.hidden = false;
    messageInput.value = "";
    counter.textContent = "0";
    window.history.replaceState(null, "", "/chat/");
    setStatus(lobbyStatus, t("chat.state.left", "已退出房间。"), "success");
  }

  function inviteUrl() { return window.location.origin + "/chat/?room=" + encodeURIComponent(currentRoom); }

  createButton.addEventListener("click", createRoom);
  lobbyForm.addEventListener("submit", function (event) { event.preventDefault(); joinRoom(); });
  compose.addEventListener("submit", function (event) {
    event.preventDefault();
    const text = messageInput.value.trim();
    if (!text || text.length > 500 || !socket || socket.readyState !== WebSocket.OPEN) {
      if (text) {setStatus(roomStatus, errorMessage("message_invalid"), "error");}
      return;
    }
    socket.send(JSON.stringify({ type: "message", text, clientMessageId: String(Date.now()) + Math.random().toString(16).slice(2) }));
    messageInput.value = "";
    counter.textContent = "0";
  });
  messageInput.addEventListener("input", function () { counter.textContent = String(messageInput.value.length); });
  messageInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); compose.requestSubmit(); }
  });
  leaveButton.addEventListener("click", leaveRoom);
  copyButton.addEventListener("click", function () {
    const copy = utils.copyText ? utils.copyText(inviteUrl()) : Promise.reject(new Error("copy unavailable"));
    copy.then(function () { setStatus(roomStatus, t("chat.state.copied", "邀请链接已复制。"), "success"); })
      .catch(function () { setStatus(roomStatus, t("chat.error.copy", "复制失败，请从地址栏复制链接。"), "error"); });
  });
  shareButton.addEventListener("click", function () {
    if (navigator.share) {navigator.share({ title: t("chat.title", "临时聊天室"), url: inviteUrl() }).catch(function () { /* user cancelled */ });}
    else {copyButton.click();}
  });
  window.addEventListener("beforeunload", function () { leaving = true; if (socket) {socket.close(1000, "left");} });

  const requestedRoom = normalizeRoomCode(new URLSearchParams(window.location.search).get("room"));
  if (requestedRoom && ROOM_CODE.test(requestedRoom)) {codeInput.value = requestedRoom;}
  if (!apiBase) {
    createButton.disabled = true;
    joinButton.disabled = true;
    setStatus(lobbyStatus, t("chat.error.unconfigured", "聊天室服务尚未配置。"), "error");
  }

  window.CWLChat = { normalizeRoomCode, validNickname, handleFrame };
})();
