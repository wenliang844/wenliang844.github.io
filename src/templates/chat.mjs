import { buildPageJsonLd, renderPage } from "./layout.mjs";

export function renderChatPage() {
  const description = "通过邀请码创建或加入临时实时聊天室，房间闲置两小时后自动清除。";
  const descriptionEn = "Create or join a temporary real-time chat room that is cleared after two hours of inactivity.";
  const main = `    <main id="main-content" class="content">
      <section class="chat-page container" aria-labelledby="chat-title">
        <header class="chat-header">
          <span class="eyebrow" data-i18n="chat.eyebrow"><i class="fas fa-comments" aria-hidden="true"></i> 临时会话</span>
          <h1 id="chat-title" data-i18n="chat.title">临时聊天室</h1>
          <p class="lead" data-i18n="chat.lead">创建一个房间，或使用邀请码加入正在进行的会话。</p>
        </header>

        <section class="chat-lobby" data-chat-view="lobby" aria-labelledby="chat-lobby-title">
          <div class="chat-lobby-heading">
            <div>
              <h2 id="chat-lobby-title" data-i18n="chat.lobby.title">进入聊天室</h2>
              <p class="chat-muted" data-i18n="chat.lobby.status">房间最多 20 人，闲置 2 小时后自动清除。</p>
            </div>
            <span class="chat-privacy" data-i18n="chat.lobby.privacy"><i class="fas fa-user-shield" aria-hidden="true"></i> 匿名加入</span>
          </div>
          <form class="chat-lobby-form" data-chat-lobby-form novalidate>
            <label class="chat-field" for="chat-nickname">
              <span data-i18n="chat.nickname">昵称</span>
              <input id="chat-nickname" name="nickname" type="text" minlength="2" maxlength="20" autocomplete="nickname" placeholder="2–20 个字符" data-i18n-ph="chat.nickname.ph" required>
            </label>
            <div class="chat-lobby-actions">
              <button class="chat-primary" type="button" data-chat-create><i class="fas fa-plus" aria-hidden="true"></i><span data-i18n="chat.create">创建房间</span></button>
              <span class="chat-or" data-i18n="chat.or">或</span>
              <label class="chat-field chat-code-field" for="chat-room-code">
                <span data-i18n="chat.code">邀请码</span>
                <input id="chat-room-code" name="roomCode" type="text" minlength="8" maxlength="8" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="8 位邀请码" data-i18n-ph="chat.code.ph">
              </label>
              <button class="chat-secondary" type="submit" data-chat-join><i class="fas fa-sign-in-alt" aria-hidden="true"></i><span data-i18n="chat.join">加入</span></button>
            </div>
          </form>
          <p class="chat-status" data-chat-lobby-status role="status" aria-live="polite"></p>
        </section>

        <section class="chat-room" data-chat-view="room" aria-labelledby="chat-room-title" hidden>
          <header class="chat-room-toolbar">
            <div>
              <span class="chat-room-label" data-i18n="chat.room.label">房间</span>
              <h2 id="chat-room-title" data-chat-room-code>--------</h2>
            </div>
            <div class="chat-room-meta">
              <span class="chat-connection" data-chat-connection data-state="connecting" role="status" aria-live="polite">正在连接</span>
              <span class="chat-online"><i class="fas fa-user" aria-hidden="true"></i> <strong data-chat-online>0</strong><span data-i18n="chat.online"> 人在线</span></span>
            </div>
            <div class="chat-room-actions">
              <button type="button" class="chat-icon-button" data-chat-share title="分享邀请链接" aria-label="分享邀请链接" data-i18n-title="chat.share" data-i18n-aria="chat.share"><i class="fas fa-share-alt" aria-hidden="true"></i></button>
              <button type="button" class="chat-icon-button" data-chat-copy title="复制邀请链接" aria-label="复制邀请链接" data-i18n-title="chat.copy" data-i18n-aria="chat.copy"><i class="fas fa-link" aria-hidden="true"></i></button>
              <button type="button" class="chat-icon-button chat-leave" data-chat-leave title="退出房间" aria-label="退出房间" data-i18n-title="chat.leave" data-i18n-aria="chat.leave"><i class="fas fa-sign-out-alt" aria-hidden="true"></i></button>
            </div>
          </header>
          <ol class="chat-messages" data-chat-messages aria-live="polite" aria-relevant="additions"></ol>
          <p class="chat-room-status" data-chat-room-status role="status" aria-live="polite"></p>
          <form class="chat-compose" data-chat-compose>
            <label for="chat-message" data-i18n="chat.message">消息</label>
            <div class="chat-compose-row">
              <textarea id="chat-message" name="message" rows="2" maxlength="500" placeholder="输入消息" data-i18n-ph="chat.message.ph" required></textarea>
              <button class="chat-send" type="submit" title="发送消息" aria-label="发送消息" data-i18n-title="chat.send" data-i18n-aria="chat.send"><i class="fas fa-paper-plane" aria-hidden="true"></i></button>
            </div>
            <span class="chat-counter"><span data-chat-counter>0</span>/500</span>
          </form>
        </section>
      </section>
    </main>`;

  return renderPage({
    title: "临时聊天室 :: CWLBlog",
    description,
    titleEn: "Temporary Chat :: CWLBlog",
    descriptionEn,
    active: "chat",
    scripts: ["/js/chat.js"],
    page: "chat",
    bodyClass: "colorscheme-dark chat-body",
    main,
    og: { title: "临时聊天室", description, path: "/chat/" },
    jsonLd: buildPageJsonLd({ type: "WebApplication", name: "CWLBlog 临时聊天室", description, path: "/chat/", applicationCategory: "CommunicationApplication", operatingSystem: "Any" }),
  });
}
