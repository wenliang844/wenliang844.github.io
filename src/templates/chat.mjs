import { buildPageJsonLd, renderPage } from "./layout.mjs";

const MINNIT_CHAT_URL = "https://organizations.minnit.chat/330715643479128/c/Main?embed";
const MINNIT_EMBED_SCRIPT = "https://minnit.chat/js/embed.js?c=1772345192";

export function renderChatPage() {
  const description = "嵌入式在线聊天室，由 Minnit Chat 提供实时群聊服务。";
  const descriptionEn = "An embedded real-time group chat powered by Minnit Chat.";
  const main = `    <main id="main-content" class="content">
      <section class="chat-page container" aria-labelledby="chat-title">
        <header class="chat-header">
          <span class="eyebrow" data-i18n="chat.eyebrow"><i class="fas fa-comments" aria-hidden="true"></i> 在线交流</span>
          <h1 id="chat-title" data-i18n="chat.title">在线聊天室</h1>
          <p class="lead" data-i18n="chat.lead">输入昵称即可加入实时群聊。</p>
        </header>

        <section class="chat-embed" aria-labelledby="chat-embed-title">
          <div class="chat-embed-heading">
            <div>
              <h2 id="chat-embed-title" data-i18n="chat.provider">CWLBlog 群聊</h2>
              <p data-i18n="chat.privacy">聊天室由 Minnit Chat 托管。请勿发送密码、联系方式等敏感信息。</p>
            </div>
            <a class="chat-external-link" href="${MINNIT_CHAT_URL}" target="_blank" rel="noopener noreferrer" data-i18n="chat.newTab"><i class="fas fa-external-link-alt" aria-hidden="true"></i> 新窗口打开</a>
          </div>

          <div class="chat-frame-shell">
            <span class="minnit-chat-sembed" data-chatname="${MINNIT_CHAT_URL}" data-style="width:100%; height:640px; max-height:75vh;" data-version="1.55">正在加载聊天室…</span>
            <noscript><p class="chat-noscript">请启用 JavaScript，或使用上方链接打开聊天室。</p></noscript>
          </div>

          <p class="powered-by-minnit"><a href="https://minnit.chat" target="_blank" rel="noopener noreferrer">Get your own free chatroom with Minnit Chat</a></p>
        </section>
      </section>
    </main>`;

  return renderPage({
    title: "在线聊天室 :: CWLBlog",
    description,
    titleEn: "Online Chat :: CWLBlog",
    descriptionEn,
    active: "chat",
    scripts: [MINNIT_EMBED_SCRIPT, "/js/chat-embed.js"],
    styles: ["/css/chat.css"],
    page: "chat",
    bodyClass: "colorscheme-dark chat-body",
    main,
    og: { title: "在线聊天室", description, path: "/chat/" },
    jsonLd: buildPageJsonLd({ type: "WebApplication", name: "CWLBlog 在线聊天室", description, path: "/chat/", applicationCategory: "CommunicationApplication", operatingSystem: "Any" }),
  });
}
