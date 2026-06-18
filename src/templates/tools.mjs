import { renderPage } from "./layout.mjs";

const TOOLS = [
  { id: "json", icon: "fa-code", title: "JSON 格式化", titleEn: "JSON Formatter", desc: "格式化、压缩和校验 JSON 文本。", descEn: "Format, minify and validate JSON text." },
  { id: "time", icon: "fa-clock", title: "时间戳转换", titleEn: "Timestamp Converter", desc: "秒/毫秒时间戳与本地日期时间互转。", descEn: "Convert seconds/milliseconds timestamps and local date time." },
  { id: "base64", icon: "fa-lock", title: "Base64 编解码", titleEn: "Base64 Codec", desc: "文本与 Base64 互转，支持中文。", descEn: "Encode and decode text with Base64, including Unicode." },
  { id: "url", icon: "fa-link", title: "URL 编解码", titleEn: "URL Codec", desc: "使用 encodeURIComponent / decodeURIComponent。", descEn: "Use encodeURIComponent and decodeURIComponent." },
  { id: "uuid", icon: "fa-fingerprint", title: "UUID 生成器", titleEn: "UUID Generator", desc: "一键生成 UUID v4 并复制。", descEn: "Generate and copy UUID v4 values." },
  { id: "jwt", icon: "fa-key", title: "JWT 解码", titleEn: "JWT Decoder", desc: "本地解析 header 和 payload，不校验签名。", descEn: "Locally parse header and payload without signature verification." },
];

function attr(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toolNav(tool, index) {
  return `            <button class="tool-tab${index === 0 ? " active" : ""}" id="tool-tab-${tool.id}" type="button" role="tab" data-tool-tab="${tool.id}" aria-controls="tool-${tool.id}" aria-label="${attr(tool.title)}" aria-selected="${index === 0 ? "true" : "false"}" tabindex="${index === 0 ? "0" : "-1"}" data-i18n-aria="tools.nav.${tool.id}" data-i18n-en-aria="${attr(tool.titleEn)}"${index === 0 ? ' aria-current="true"' : ""}>
              <i class="fas ${tool.icon}" aria-hidden="true"></i>
              <span data-i18n="tools.nav.${tool.id}" data-i18n-en="${attr(tool.titleEn)}">${tool.title}</span>
            </button>`;
}

function panelAttrs(tool, active = false) {
  return `class="tool-panel${active ? " active" : ""}" id="tool-${tool.id}" data-tool-panel="${tool.id}" role="tabpanel" aria-labelledby="tool-tab-${tool.id}" tabindex="0"${active ? "" : " hidden"}`;
}

function toolHeader(tool) {
  return `          <header class="tool-panel-head">
            <span class="tool-panel-icon" aria-hidden="true"><i class="fas ${tool.icon}"></i></span>
            <div>
              <h2 data-i18n="tools.${tool.id}.title" data-i18n-en="${attr(tool.titleEn)}">${tool.title}</h2>
              <p data-i18n="tools.${tool.id}.desc" data-i18n-en="${attr(tool.descEn)}">${tool.desc}</p>
            </div>
          </header>`;
}

function renderJsonTool() {
  return `        <section ${panelAttrs(TOOLS[0], true)}>
${toolHeader(TOOLS[0])}
          <div class="tool-grid">
            <label class="tool-field"><span data-i18n="tools.label.jsonInput">输入 JSON</span>
              <textarea id="json-input" spellcheck="false" placeholder='{"name":"CWLBlog"}'></textarea>
            </label>
            <label class="tool-field"><span data-i18n="tools.label.output">输出结果</span>
              <textarea id="json-output" spellcheck="false" readonly></textarea>
            </label>
          </div>
          <div class="tool-actions">
            <button class="tool-btn primary" type="button" data-json-action="format" data-i18n="tools.btn.format" data-i18n-html><i class="fas fa-align-left" aria-hidden="true"></i> 格式化</button>
            <button class="tool-btn" type="button" data-json-action="minify" data-i18n="tools.btn.minify" data-i18n-html><i class="fas fa-compress-alt" aria-hidden="true"></i> 压缩</button>
            <button class="tool-btn" type="button" data-copy-target="json-output" data-i18n="tools.btn.copyResult" data-i18n-html><i class="fas fa-copy" aria-hidden="true"></i> 复制结果</button>
          </div>
          <p class="tool-status" id="json-status" role="status" aria-live="polite"></p>
        </section>`;
}

function renderTimeTool() {
  return `        <section ${panelAttrs(TOOLS[1])}>
${toolHeader(TOOLS[1])}
          <div class="time-now">
            <span data-i18n="tools.label.now">当前时间戳</span>
            <strong id="time-now-ms">-</strong>
            <small id="time-now-local">-</small>
          </div>
          <div class="tool-grid">
            <div class="tool-field">
              <label for="timestamp-input" data-i18n="tools.label.timestamp">时间戳（秒或毫秒）</label>
              <input id="timestamp-input" type="text" inputmode="numeric" placeholder="1718697600">
              <button class="tool-btn primary" type="button" data-time-action="from-timestamp" data-i18n="tools.btn.toDate" data-i18n-html><i class="fas fa-arrow-right" aria-hidden="true"></i> 转日期</button>
              <pre class="tool-output" id="timestamp-output"></pre>
            </div>
            <div class="tool-field">
              <label for="datetime-input" data-i18n="tools.label.datetime">日期时间</label>
              <input id="datetime-input" type="datetime-local">
              <button class="tool-btn primary" type="button" data-time-action="from-date" data-i18n="tools.btn.toTimestamp" data-i18n-html><i class="fas fa-arrow-right" aria-hidden="true"></i> 转时间戳</button>
              <pre class="tool-output" id="datetime-output"></pre>
            </div>
          </div>
          <p class="tool-status" id="time-status" role="status" aria-live="polite"></p>
        </section>`;
}

function renderCodecTool(tool, inputId, outputId, encodeAction, decodeAction, placeholder, placeholderEn = placeholder) {
  return `        <section ${panelAttrs(tool)}>
${toolHeader(tool)}
          <div class="tool-grid">
            <label class="tool-field"><span data-i18n="tools.label.input">输入</span>
              <textarea id="${inputId}" spellcheck="false" placeholder="${attr(placeholder)}" data-i18n-ph="tools.${tool.id}.placeholder" data-i18n-en-ph="${attr(placeholderEn)}"></textarea>
            </label>
            <label class="tool-field"><span data-i18n="tools.label.output">输出结果</span>
              <textarea id="${outputId}" spellcheck="false" readonly></textarea>
            </label>
          </div>
          <div class="tool-actions">
            <button class="tool-btn primary" type="button" data-codec-action="${encodeAction}" data-i18n="tools.btn.encode" data-i18n-html><i class="fas fa-arrow-down" aria-hidden="true"></i> 编码</button>
            <button class="tool-btn" type="button" data-codec-action="${decodeAction}" data-i18n="tools.btn.decode" data-i18n-html><i class="fas fa-arrow-up" aria-hidden="true"></i> 解码</button>
            <button class="tool-btn" type="button" data-copy-target="${outputId}" data-i18n="tools.btn.copyResult" data-i18n-html><i class="fas fa-copy" aria-hidden="true"></i> 复制结果</button>
          </div>
          <p class="tool-status" id="${tool.id}-status" role="status" aria-live="polite"></p>
        </section>`;
}

function renderUuidTool() {
  return `        <section ${panelAttrs(TOOLS[4])}>
${toolHeader(TOOLS[4])}
          <div class="uuid-box">
            <output id="uuid-output" data-empty="true" data-i18n="tools.uuid.empty">点击生成 UUID</output>
          </div>
          <div class="tool-actions">
            <button class="tool-btn primary" type="button" data-uuid-generate data-i18n="tools.btn.generateUuid" data-i18n-html><i class="fas fa-sync-alt" aria-hidden="true"></i> 生成 UUID</button>
            <button class="tool-btn" type="button" data-copy-target="uuid-output" data-i18n="tools.btn.copy" data-i18n-html><i class="fas fa-copy" aria-hidden="true"></i> 复制</button>
          </div>
          <p class="tool-status" id="uuid-status" role="status" aria-live="polite"></p>
        </section>`;
}

function renderJwtTool() {
  return `        <section ${panelAttrs(TOOLS[5])}>
${toolHeader(TOOLS[5])}
          <label class="tool-field"><span data-i18n="tools.label.jwt">JWT</span>
            <textarea id="jwt-input" spellcheck="false" placeholder="eyJhbGciOi..."></textarea>
          </label>
          <div class="tool-actions">
            <button class="tool-btn primary" type="button" data-jwt-decode data-i18n="tools.btn.decodeJwt" data-i18n-html data-i18n-en-html='<i class="fas fa-unlock-alt" aria-hidden="true"></i> Decode JWT'><i class="fas fa-unlock-alt" aria-hidden="true"></i> 解码</button>
          </div>
          <div class="jwt-grid">
            <label class="tool-field"><span data-i18n="tools.label.header">Header</span>
              <textarea id="jwt-header-output" spellcheck="false" readonly></textarea>
            </label>
            <label class="tool-field"><span data-i18n="tools.label.payload">Payload</span>
              <textarea id="jwt-payload-output" spellcheck="false" readonly></textarea>
            </label>
          </div>
          <p class="tool-status" id="jwt-status" role="status" aria-live="polite"></p>
        </section>`;
}

export function renderToolsPage() {
  const main = `    <main class="content">
      <section class="tools-page container">
        <header class="tools-header">
          <span class="eyebrow" data-i18n="tools.eyebrow" data-i18n-en-html='<i class="fas fa-toolbox" aria-hidden="true"></i> Online Toolbox' data-i18n-html><i class="fas fa-toolbox" aria-hidden="true"></i> Online Toolbox</span>
          <h1 data-i18n="tools.h1" data-i18n-en="Toolbox">在线工具箱</h1>
          <p class="lead" data-i18n="tools.lead" data-i18n-en="Useful browser-only tools for JSON, timestamps, Base64, URLs, UUID and JWT decoding.">常用开发小工具，全部在浏览器本地运行，不依赖后端。</p>
        </header>
        <div class="tools-shell">
          <nav class="tools-tabs" role="tablist" aria-label="工具列表" data-i18n-aria="tools.tabs" data-i18n-en-aria="Tool list">
${TOOLS.map(toolNav).join("\n")}
          </nav>
          <div class="tools-panels">
${renderJsonTool()}
${renderTimeTool()}
${renderCodecTool(TOOLS[2], "base64-input", "base64-output", "base64-encode", "base64-decode", "输入要编码或解码的文本", "Text to encode or decode")}
${renderCodecTool(TOOLS[3], "url-input", "url-output", "url-encode", "url-decode", "https://example.com/?q=中文", "https://example.com/?q=search")}
${renderUuidTool()}
${renderJwtTool()}
          </div>
        </div>
      </section>
    </main>`;

  return renderPage({
    title: "在线工具箱 :: CWLBlog",
    description: "CWLBlog 在线工具箱：JSON 格式化、时间戳转换、Base64、URL 编解码、UUID 生成器和 JWT 解码。",
    titleEn: "Toolbox :: CWLBlog",
    descriptionEn: "CWLBlog online toolbox: JSON formatting, timestamp conversion, Base64, URL codec, UUID generator and JWT decoder.",
    active: "tools",
    page: "tools",
    scripts: ["/js/tools-core.js", "/js/tools.js"],
    main,
    og: {
      title: "在线工具箱 :: CWLBlog",
      description: "JSON、时间戳、Base64、URL、UUID 与 JWT 等常用开发工具。",
      path: "/tools/",
    },
  });
}
