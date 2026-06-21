import { buildPageJsonLd, renderPage } from "./layout.mjs";

const TOOLS = [
  { id: "json", icon: "fa-code", title: "JSON 格式化", titleEn: "JSON Formatter", desc: "格式化、压缩和校验 JSON 文本。", descEn: "Format, minify and validate JSON text." },
  { id: "time", icon: "fa-clock", title: "时间戳转换", titleEn: "Timestamp Converter", desc: "秒/毫秒时间戳与本地日期时间互转。", descEn: "Convert seconds/milliseconds timestamps and local date time." },
  { id: "base64", icon: "fa-lock", title: "Base64 编解码", titleEn: "Base64 Codec", desc: "文本与 Base64 互转，支持中文。", descEn: "Encode and decode text with Base64, including Unicode." },
  { id: "url", icon: "fa-link", title: "URL 编解码", titleEn: "URL Codec", desc: "使用 encodeURIComponent / decodeURIComponent。", descEn: "Use encodeURIComponent and decodeURIComponent." },
  { id: "uuid", icon: "fa-fingerprint", title: "UUID 生成器", titleEn: "UUID Generator", desc: "一键生成 UUID v4 并复制。", descEn: "Generate and copy UUID v4 values." },
  { id: "jwt", icon: "fa-key", title: "JWT 解码", titleEn: "JWT Decoder", desc: "本地解析 header 和 payload，不校验签名。", descEn: "Locally parse header and payload without signature verification." },
  { id: "hash", icon: "fa-shield-alt", title: "哈希摘要", titleEn: "Hash Digest", desc: "使用 Web Crypto 生成 SHA 系列文本摘要。", descEn: "Generate SHA text digests with Web Crypto." },
  { id: "password", icon: "fa-user-lock", title: "密码生成器", titleEn: "Password Generator", desc: "基于浏览器安全随机数生成强密码。", descEn: "Generate strong passwords with secure browser randomness." },
  { id: "color", icon: "fa-palette", title: "颜色转换", titleEn: "Color Converter", desc: "HEX、RGB、HSL 互转并给出可读前景色建议。", descEn: "Convert HEX, RGB and HSL, with readable foreground suggestions." },
  { id: "regex", icon: "fa-search", title: "正则测试", titleEn: "Regex Tester", desc: "本地测试 JavaScript 正则表达式和匹配结果。", descEn: "Test JavaScript regular expressions and matches locally." },
  { id: "markdown", icon: "fa-heading", title: "Markdown 预览", titleEn: "Markdown Preview", desc: "将 Markdown 渲染为经过清理的 HTML 预览。", descEn: "Render Markdown to sanitized HTML preview." },
  { id: "diff", icon: "fa-not-equal", title: "文本 Diff", titleEn: "Text Diff", desc: "对比两段文本，输出轻量行级差异。", descEn: "Compare two texts with a lightweight line diff." },
  { id: "case", icon: "fa-font", title: "命名转换", titleEn: "Case Converter", desc: "一键生成 camel、snake、kebab、Pascal 等命名形式。", descEn: "Generate camel, snake, kebab, Pascal and other case styles." },
  { id: "html", icon: "fa-tags", title: "HTML 实体", titleEn: "HTML Entities", desc: "HTML 特殊字符实体编码与解码。", descEn: "Encode and decode HTML entities." },
  { id: "cron", icon: "fa-calendar-alt", title: "Cron 解析", titleEn: "Cron Parser", desc: "解析 5 段 Cron 表达式并预测后续执行时间。", descEn: "Parse 5-field cron expressions and preview next run times." },
  { id: "qr", icon: "fa-qrcode", title: "二维码生成", titleEn: "QR Generator", desc: "把文本或链接生成可复制的本地二维码。", descEn: "Generate local QR codes for text or links." },
  { id: "yaml", icon: "fa-project-diagram", title: "YAML / JSON", titleEn: "YAML / JSON", desc: "JSON 与常见 YAML 配置片段互转。", descEn: "Convert JSON and common YAML configuration snippets." },
  { id: "urlparse", icon: "fa-sitemap", title: "URL 解析", titleEn: "URL Parser", desc: "拆解 URL 的协议、主机、路径、参数和锚点。", descEn: "Break down protocol, host, path, query and hash." },
  { id: "query", icon: "fa-list-ul", title: "查询参数", titleEn: "Query Builder", desc: "在表单文本与 URL 查询字符串之间互转。", descEn: "Convert form-style text and URL query strings." },
  { id: "jsonpath", icon: "fa-filter", title: "JSONPath 查询", titleEn: "JSONPath Query", desc: "用轻量路径表达式查询 JSON 数据。", descEn: "Query JSON data with lightweight path expressions." },
  { id: "textstats", icon: "fa-chart-bar", title: "文本统计", titleEn: "Text Stats", desc: "统计字符、词数、行数、阅读时间和字节数。", descEn: "Count characters, words, lines, reading time and bytes." },
  { id: "cleantext", icon: "fa-broom", title: "文本清理", titleEn: "Text Cleaner", desc: "去除多余空白、空行、重复行并排序。", descEn: "Trim whitespace, empty lines, duplicate lines and sort." },
  { id: "unit", icon: "fa-ruler-combined", title: "单位换算", titleEn: "Unit Converter", desc: "长度、重量、温度和数据大小快速换算。", descEn: "Convert length, weight, temperature and data size." },
  { id: "random", icon: "fa-dice", title: "随机数生成", titleEn: "Random Generator", desc: "生成整数、浮点数或随机列表。", descEn: "Generate integers, decimals or random lists." },
  { id: "datediff", icon: "fa-hourglass-half", title: "日期差计算", titleEn: "Date Diff", desc: "计算两个日期之间的天数和时间跨度。", descEn: "Calculate days and duration between two dates." },
  { id: "ua", icon: "fa-desktop", title: "UA 解析", titleEn: "User-Agent Parser", desc: "解析浏览器、系统、设备类型和渲染引擎。", descEn: "Parse browser, OS, device type and rendering engine." },
];

function attr(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toolById(id) {
  const tool = TOOLS.find((entry) => entry.id === id);
  if (!tool) {
    throw new Error(`Unknown tool: ${id}`);
  }
  return tool;
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
  const tool = toolById("json");
  return `        <section ${panelAttrs(tool, true)}>
${toolHeader(tool)}
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
  const tool = toolById("time");
  return `        <section ${panelAttrs(tool)}>
${toolHeader(tool)}
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
  const tool = toolById("uuid");
  return `        <section ${panelAttrs(tool)}>
${toolHeader(tool)}
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
  const tool = toolById("jwt");
  return `        <section ${panelAttrs(tool)}>
${toolHeader(tool)}
          <label class="tool-field"><span data-i18n="tools.label.jwt">JWT</span>
            <textarea id="jwt-input" spellcheck="false" placeholder="eyJhbGciOi..."></textarea>
          </label>
          <div class="tool-actions">
            <button class="tool-btn primary" type="button" data-jwt-decode data-i18n="tools.btn.decodeJwt" data-i18n-html data-i18n-en-html='<i class="fas fa-unlock-alt" aria-hidden="true"></i> Decode JWT'><i class="fas fa-unlock-alt" aria-hidden="true"></i> 解码</button>
          </div>
          <p class="tool-status is-error jwt-warning" role="note" data-i18n="tools.jwt.warning" data-i18n-en="Warning: decoded JWT content has not been signature-verified. Do not use it for security decisions.">警告：以下 JWT 内容未经签名验证，不可用于安全决策。</p>
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

function renderHashTool() {
  const tool = toolById("hash");
  return `        <section ${panelAttrs(tool)}>
${toolHeader(tool)}
          <div class="tool-grid">
            <label class="tool-field"><span data-i18n="tools.label.inputText">输入文本</span>
              <textarea id="hash-input" spellcheck="false" placeholder="hello CWLBlog"></textarea>
            </label>
            <label class="tool-field"><span data-i18n="tools.label.output">输出结果</span>
              <textarea id="hash-output" spellcheck="false" readonly></textarea>
            </label>
          </div>
          <div class="tool-actions">
            <label class="tool-inline"><span data-i18n="tools.label.algorithm">算法</span>
              <select id="hash-algorithm">
                <option value="SHA-256">SHA-256</option>
                <option value="SHA-384">SHA-384</option>
                <option value="SHA-512">SHA-512</option>
                <option value="SHA-1">SHA-1</option>
              </select>
            </label>
            <button class="tool-btn primary" type="button" data-hash-generate data-i18n="tools.btn.generateHash" data-i18n-html><i class="fas fa-fingerprint" aria-hidden="true"></i> 生成摘要</button>
            <button class="tool-btn" type="button" data-copy-target="hash-output" data-i18n="tools.btn.copyResult" data-i18n-html><i class="fas fa-copy" aria-hidden="true"></i> 复制结果</button>
          </div>
          <p class="tool-status" id="hash-status" role="status" aria-live="polite"></p>
        </section>`;
}

function renderPasswordTool() {
  const tool = toolById("password");
  return `        <section ${panelAttrs(tool)}>
${toolHeader(tool)}
          <div class="tool-grid">
            <div class="tool-field">
              <label for="password-length" data-i18n="tools.label.passwordLength">长度</label>
              <input id="password-length" type="number" min="8" max="128" step="1" value="20" inputmode="numeric">
              <div class="tool-check-grid" aria-label="密码字符集" data-i18n-aria="tools.label.passwordSets">
                <label class="tool-check"><input id="password-lower" type="checkbox" checked> <span data-i18n="tools.label.lowercase">小写字母</span></label>
                <label class="tool-check"><input id="password-upper" type="checkbox" checked> <span data-i18n="tools.label.uppercase">大写字母</span></label>
                <label class="tool-check"><input id="password-number" type="checkbox" checked> <span data-i18n="tools.label.numbers">数字</span></label>
                <label class="tool-check"><input id="password-symbol" type="checkbox" checked> <span data-i18n="tools.label.symbols">符号</span></label>
              </div>
            </div>
            <label class="tool-field"><span data-i18n="tools.label.output">输出结果</span>
              <textarea id="password-output" spellcheck="false" readonly></textarea>
            </label>
          </div>
          <div class="tool-actions">
            <button class="tool-btn primary" type="button" data-password-generate data-i18n="tools.btn.generatePassword" data-i18n-html><i class="fas fa-sync-alt" aria-hidden="true"></i> 生成密码</button>
            <button class="tool-btn" type="button" data-copy-target="password-output" data-i18n="tools.btn.copy" data-i18n-html><i class="fas fa-copy" aria-hidden="true"></i> 复制</button>
          </div>
          <p class="tool-status" id="password-status" role="status" aria-live="polite"></p>
        </section>`;
}

function renderColorTool() {
  const tool = toolById("color");
  return `        <section ${panelAttrs(tool)}>
${toolHeader(tool)}
          <div class="tool-grid">
            <label class="tool-field"><span data-i18n="tools.label.colorInput">颜色值</span>
              <input id="color-input" type="text" placeholder="#2563eb / rgb(37, 99, 235) / hsl(221, 83%, 53%)">
            </label>
            <label class="tool-field"><span data-i18n="tools.label.output">输出结果</span>
              <textarea id="color-output" spellcheck="false" readonly></textarea>
            </label>
          </div>
          <div class="tool-color-preview">
            <span id="color-swatch" class="tool-color-swatch" aria-hidden="true"></span>
            <span id="color-preview-text" data-i18n="tools.color.empty">等待转换颜色</span>
          </div>
          <div class="tool-actions">
            <button class="tool-btn primary" type="button" data-color-convert data-i18n="tools.btn.convert" data-i18n-html><i class="fas fa-exchange-alt" aria-hidden="true"></i> 转换</button>
            <button class="tool-btn" type="button" data-copy-target="color-output" data-i18n="tools.btn.copyResult" data-i18n-html><i class="fas fa-copy" aria-hidden="true"></i> 复制结果</button>
          </div>
          <p class="tool-status" id="color-status" role="status" aria-live="polite"></p>
        </section>`;
}

function renderRegexTool() {
  const tool = toolById("regex");
  return `        <section ${panelAttrs(tool)}>
${toolHeader(tool)}
          <div class="tool-grid">
            <div class="tool-field">
              <label for="regex-pattern" data-i18n="tools.label.regexPattern">表达式</label>
              <input id="regex-pattern" type="text" placeholder="\\b\\w+@\\w+\\.com\\b">
              <label for="regex-flags" data-i18n="tools.label.regexFlags">Flags</label>
              <input id="regex-flags" type="text" value="gi" spellcheck="false" placeholder="gim">
              <label for="regex-input" data-i18n="tools.label.testText">测试文本</label>
              <textarea id="regex-input" spellcheck="false" placeholder="email@example.com"></textarea>
            </div>
            <label class="tool-field"><span data-i18n="tools.label.matches">匹配结果</span>
              <textarea id="regex-output" spellcheck="false" readonly></textarea>
            </label>
          </div>
          <div class="tool-actions">
            <button class="tool-btn primary" type="button" data-regex-test data-i18n="tools.btn.testRegex" data-i18n-html><i class="fas fa-play" aria-hidden="true"></i> 测试</button>
            <button class="tool-btn" type="button" data-copy-target="regex-output" data-i18n="tools.btn.copyResult" data-i18n-html><i class="fas fa-copy" aria-hidden="true"></i> 复制结果</button>
          </div>
          <p class="tool-status" id="regex-status" role="status" aria-live="polite"></p>
        </section>`;
}

function renderMarkdownTool() {
  const tool = toolById("markdown");
  return `        <section ${panelAttrs(tool)}>
${toolHeader(tool)}
          <div class="tool-grid">
            <label class="tool-field"><span data-i18n="tools.label.markdownInput">Markdown</span>
              <textarea id="markdown-input" spellcheck="false" placeholder="# Hello&#10;&#10;- item"></textarea>
            </label>
            <div class="tool-field">
              <span data-i18n="tools.label.preview">预览</span>
              <div id="markdown-preview" class="tool-preview" aria-live="polite"></div>
            </div>
          </div>
          <label class="tool-field tool-output-field"><span data-i18n="tools.label.htmlOutput">HTML 输出</span>
            <textarea id="markdown-output" spellcheck="false" readonly></textarea>
          </label>
          <div class="tool-actions">
            <button class="tool-btn primary" type="button" data-markdown-render data-i18n="tools.btn.preview" data-i18n-html><i class="fas fa-eye" aria-hidden="true"></i> 预览</button>
            <button class="tool-btn" type="button" data-copy-target="markdown-output" data-i18n="tools.btn.copyHtml" data-i18n-html><i class="fas fa-copy" aria-hidden="true"></i> 复制 HTML</button>
          </div>
          <p class="tool-status" id="markdown-status" role="status" aria-live="polite"></p>
        </section>`;
}

function renderDiffTool() {
  const tool = toolById("diff");
  return `        <section ${panelAttrs(tool)}>
${toolHeader(tool)}
          <div class="tool-grid">
            <label class="tool-field"><span data-i18n="tools.label.leftText">左侧文本</span>
              <textarea id="diff-left" spellcheck="false" placeholder="line 1&#10;line 2"></textarea>
            </label>
            <label class="tool-field"><span data-i18n="tools.label.rightText">右侧文本</span>
              <textarea id="diff-right" spellcheck="false" placeholder="line 1&#10;line 3"></textarea>
            </label>
          </div>
          <label class="tool-field tool-output-field"><span data-i18n="tools.label.diffOutput">差异结果</span>
            <textarea id="diff-output" spellcheck="false" readonly></textarea>
          </label>
          <div class="tool-actions">
            <button class="tool-btn primary" type="button" data-diff-run data-i18n="tools.btn.compare" data-i18n-html><i class="fas fa-not-equal" aria-hidden="true"></i> 对比</button>
            <button class="tool-btn" type="button" data-copy-target="diff-output" data-i18n="tools.btn.copyResult" data-i18n-html><i class="fas fa-copy" aria-hidden="true"></i> 复制结果</button>
          </div>
          <p class="tool-status" id="diff-status" role="status" aria-live="polite"></p>
        </section>`;
}

function renderCaseTool() {
  const tool = toolById("case");
  return `        <section ${panelAttrs(tool)}>
${toolHeader(tool)}
          <div class="tool-grid">
            <label class="tool-field"><span data-i18n="tools.label.inputText">输入文本</span>
              <textarea id="case-input" spellcheck="false" placeholder="user profile id"></textarea>
            </label>
            <label class="tool-field"><span data-i18n="tools.label.output">输出结果</span>
              <textarea id="case-output" spellcheck="false" readonly></textarea>
            </label>
          </div>
          <div class="tool-actions">
            <button class="tool-btn primary" type="button" data-case-convert data-i18n="tools.btn.convert" data-i18n-html><i class="fas fa-exchange-alt" aria-hidden="true"></i> 转换</button>
            <button class="tool-btn" type="button" data-copy-target="case-output" data-i18n="tools.btn.copyResult" data-i18n-html><i class="fas fa-copy" aria-hidden="true"></i> 复制结果</button>
          </div>
          <p class="tool-status" id="case-status" role="status" aria-live="polite"></p>
        </section>`;
}

function renderHtmlTool() {
  return renderCodecTool(
    toolById("html"),
    "html-input",
    "html-output",
    "html-encode",
    "html-decode",
    "<div class=\"card\">CWL & Codex</div>",
    "<div class=\"card\">CWL & Codex</div>",
  );
}

function renderCronTool() {
  const tool = toolById("cron");
  return `        <section ${panelAttrs(tool)}>
${toolHeader(tool)}
          <label class="tool-field"><span data-i18n="tools.label.cronExpression">Cron 表达式</span>
            <input id="cron-input" type="text" spellcheck="false" value="*/15 9-18 * * 1-5" placeholder="*/15 9-18 * * 1-5">
          </label>
          <label class="tool-field tool-output-field"><span data-i18n="tools.label.output">输出结果</span>
            <textarea id="cron-output" spellcheck="false" readonly></textarea>
          </label>
          <div class="tool-actions">
            <button class="tool-btn primary" type="button" data-cron-parse data-i18n="tools.btn.parseCron" data-i18n-html><i class="fas fa-calendar-check" aria-hidden="true"></i> 解析</button>
            <button class="tool-btn" type="button" data-copy-target="cron-output" data-i18n="tools.btn.copyResult" data-i18n-html><i class="fas fa-copy" aria-hidden="true"></i> 复制结果</button>
          </div>
          <p class="tool-status" id="cron-status" role="status" aria-live="polite"></p>
        </section>`;
}

function renderQrTool() {
  const tool = toolById("qr");
  return `        <section ${panelAttrs(tool)}>
${toolHeader(tool)}
          <div class="tool-grid">
            <label class="tool-field"><span data-i18n="tools.label.qrInput">文本或链接</span>
              <textarea id="qr-input" spellcheck="false" placeholder="https://wenliang844.github.io/tools/"></textarea>
            </label>
            <div class="tool-field">
              <span data-i18n="tools.label.preview">预览</span>
              <div class="qr-box">
                <img id="qr-image" alt="QR code" hidden>
                <span id="qr-empty" data-i18n="tools.qr.empty">等待生成二维码</span>
              </div>
            </div>
          </div>
          <label class="tool-field tool-output-field"><span data-i18n="tools.label.dataUrl">Data URL</span>
            <textarea id="qr-output" spellcheck="false" readonly></textarea>
          </label>
          <div class="tool-actions">
            <button class="tool-btn primary" type="button" data-qr-generate data-i18n="tools.btn.generateQr" data-i18n-html><i class="fas fa-qrcode" aria-hidden="true"></i> 生成二维码</button>
            <button class="tool-btn" type="button" data-copy-target="qr-output" data-i18n="tools.btn.copyDataUrl" data-i18n-html><i class="fas fa-copy" aria-hidden="true"></i> 复制 Data URL</button>
          </div>
          <p class="tool-status" id="qr-status" role="status" aria-live="polite"></p>
        </section>`;
}

function renderTextActionTool(id, inputLabel, inputId, outputId, action, buttonKey, buttonText, icon, placeholder, placeholderEn = placeholder) {
  const tool = toolById(id);
  return `        <section ${panelAttrs(tool)}>
${toolHeader(tool)}
          <div class="tool-grid">
            <label class="tool-field"><span data-i18n="tools.label.${inputLabel}">${inputLabel}</span>
              <textarea id="${inputId}" spellcheck="false" placeholder="${attr(placeholder)}" data-i18n-ph="tools.${id}.placeholder" data-i18n-en-ph="${attr(placeholderEn)}"></textarea>
            </label>
            <label class="tool-field"><span data-i18n="tools.label.output">输出结果</span>
              <textarea id="${outputId}" spellcheck="false" readonly></textarea>
            </label>
          </div>
          <div class="tool-actions">
            <button class="tool-btn primary" type="button" data-tool-run="${action}" data-i18n="${buttonKey}" data-i18n-html><i class="fas ${icon}" aria-hidden="true"></i> ${buttonText}</button>
            <button class="tool-btn" type="button" data-copy-target="${outputId}" data-i18n="tools.btn.copyResult" data-i18n-html><i class="fas fa-copy" aria-hidden="true"></i> 复制结果</button>
          </div>
          <p class="tool-status" id="${id}-status" role="status" aria-live="polite"></p>
        </section>`;
}

function renderYamlTool() {
  const tool = toolById("yaml");
  return `        <section ${panelAttrs(tool)}>
${toolHeader(tool)}
          <div class="tool-grid">
            <label class="tool-field"><span data-i18n="tools.label.configInput">配置文本</span>
              <textarea id="yaml-input" spellcheck="false" placeholder='{"name":"CWLBlog","tags":["tool","json"]}' data-i18n-ph="tools.yaml.placeholder" data-i18n-en-ph='{"name":"CWLBlog","tags":["tool","json"]}'></textarea>
            </label>
            <label class="tool-field"><span data-i18n="tools.label.output">输出结果</span>
              <textarea id="yaml-output" spellcheck="false" readonly></textarea>
            </label>
          </div>
          <div class="tool-actions">
            <button class="tool-btn primary" type="button" data-tool-run="json-to-yaml" data-i18n="tools.btn.toYaml" data-i18n-html><i class="fas fa-arrow-down" aria-hidden="true"></i> 转 YAML</button>
            <button class="tool-btn" type="button" data-tool-run="yaml-to-json" data-i18n="tools.btn.toJson" data-i18n-html><i class="fas fa-arrow-up" aria-hidden="true"></i> 转 JSON</button>
            <button class="tool-btn" type="button" data-copy-target="yaml-output" data-i18n="tools.btn.copyResult" data-i18n-html><i class="fas fa-copy" aria-hidden="true"></i> 复制结果</button>
          </div>
          <p class="tool-status" id="yaml-status" role="status" aria-live="polite"></p>
        </section>`;
}

function renderUrlParseTool() {
  return renderTextActionTool("urlparse", "urlInput", "urlparse-input", "urlparse-output", "parse-url", "tools.btn.parse", "解析", "fa-sitemap", "https://example.com:443/docs?a=1&b=中文#top", "https://example.com/docs?a=1#top");
}

function renderQueryTool() {
  return renderTextActionTool("query", "queryInput", "query-input", "query-output", "query-toggle", "tools.btn.convert", "转换", "fa-exchange-alt", "name=CWLBlog\nq=在线工具箱", "name=CWLBlog\nq=toolbox");
}

function renderJsonPathTool() {
  const tool = toolById("jsonpath");
  return `        <section ${panelAttrs(tool)}>
${toolHeader(tool)}
          <div class="tool-grid">
            <label class="tool-field"><span data-i18n="tools.label.jsonInput">输入 JSON</span>
              <textarea id="jsonpath-input" spellcheck="false" placeholder='{"users":[{"name":"CWL"}]}'></textarea>
            </label>
            <div class="tool-field">
              <label for="jsonpath-path" data-i18n="tools.label.pathExpression">路径表达式</label>
              <input id="jsonpath-path" type="text" spellcheck="false" value="$.users[0].name" placeholder="$.users[0].name">
              <label for="jsonpath-output" data-i18n="tools.label.output">输出结果</label>
              <textarea id="jsonpath-output" spellcheck="false" readonly></textarea>
            </div>
          </div>
          <div class="tool-actions">
            <button class="tool-btn primary" type="button" data-tool-run="jsonpath" data-i18n="tools.btn.query" data-i18n-html><i class="fas fa-filter" aria-hidden="true"></i> 查询</button>
            <button class="tool-btn" type="button" data-copy-target="jsonpath-output" data-i18n="tools.btn.copyResult" data-i18n-html><i class="fas fa-copy" aria-hidden="true"></i> 复制结果</button>
          </div>
          <p class="tool-status" id="jsonpath-status" role="status" aria-live="polite"></p>
        </section>`;
}

function renderTextStatsTool() {
  return renderTextActionTool("textstats", "inputText", "textstats-input", "textstats-output", "text-stats", "tools.btn.analyze", "分析", "fa-chart-bar", "输入一段需要统计的文本", "Paste text to analyze");
}

function renderCleanTextTool() {
  const tool = toolById("cleantext");
  return `        <section ${panelAttrs(tool)}>
${toolHeader(tool)}
          <div class="tool-grid">
            <label class="tool-field"><span data-i18n="tools.label.inputText">输入文本</span>
              <textarea id="cleantext-input" spellcheck="false" placeholder="  alpha  &#10;&#10;beta&#10;alpha"></textarea>
            </label>
            <label class="tool-field"><span data-i18n="tools.label.output">输出结果</span>
              <textarea id="cleantext-output" spellcheck="false" readonly></textarea>
            </label>
          </div>
          <div class="tool-actions">
            <label class="tool-check"><input id="cleantext-trim" type="checkbox" checked> <span data-i18n="tools.label.trimLines">修剪行首尾</span></label>
            <label class="tool-check"><input id="cleantext-empty" type="checkbox" checked> <span data-i18n="tools.label.removeEmpty">移除空行</span></label>
            <label class="tool-check"><input id="cleantext-dupes" type="checkbox"> <span data-i18n="tools.label.removeDupes">移除重复行</span></label>
            <label class="tool-check"><input id="cleantext-sort" type="checkbox"> <span data-i18n="tools.label.sortLines">排序</span></label>
            <button class="tool-btn primary" type="button" data-tool-run="clean-text" data-i18n="tools.btn.clean" data-i18n-html><i class="fas fa-broom" aria-hidden="true"></i> 清理</button>
            <button class="tool-btn" type="button" data-copy-target="cleantext-output" data-i18n="tools.btn.copyResult" data-i18n-html><i class="fas fa-copy" aria-hidden="true"></i> 复制结果</button>
          </div>
          <p class="tool-status" id="cleantext-status" role="status" aria-live="polite"></p>
        </section>`;
}

function renderUnitTool() {
  const tool = toolById("unit");
  return `        <section ${panelAttrs(tool)}>
${toolHeader(tool)}
          <div class="tool-grid">
            <div class="tool-field">
              <label for="unit-value" data-i18n="tools.label.value">数值</label>
              <input id="unit-value" type="number" step="any" value="1">
              <label for="unit-type" data-i18n="tools.label.unitType">类型</label>
              <select id="unit-type">
                <option value="length">长度</option>
                <option value="weight">重量</option>
                <option value="temperature">温度</option>
                <option value="data">数据大小</option>
              </select>
              <label for="unit-from" data-i18n="tools.label.fromUnit">来源单位</label>
              <input id="unit-from" type="text" value="m" placeholder="m / kg / c / mb">
            </div>
            <label class="tool-field"><span data-i18n="tools.label.output">输出结果</span>
              <textarea id="unit-output" spellcheck="false" readonly></textarea>
            </label>
          </div>
          <div class="tool-actions">
            <button class="tool-btn primary" type="button" data-tool-run="unit-convert" data-i18n="tools.btn.convert" data-i18n-html><i class="fas fa-exchange-alt" aria-hidden="true"></i> 转换</button>
            <button class="tool-btn" type="button" data-copy-target="unit-output" data-i18n="tools.btn.copyResult" data-i18n-html><i class="fas fa-copy" aria-hidden="true"></i> 复制结果</button>
          </div>
          <p class="tool-status" id="unit-status" role="status" aria-live="polite"></p>
        </section>`;
}

function renderRandomTool() {
  const tool = toolById("random");
  return `        <section ${panelAttrs(tool)}>
${toolHeader(tool)}
          <div class="tool-grid">
            <div class="tool-field">
              <label for="random-min" data-i18n="tools.label.min">最小值</label>
              <input id="random-min" type="number" step="any" value="1">
              <label for="random-max" data-i18n="tools.label.max">最大值</label>
              <input id="random-max" type="number" step="any" value="100">
              <label for="random-count" data-i18n="tools.label.count">数量</label>
              <input id="random-count" type="number" min="1" max="1000" step="1" value="10">
              <label class="tool-check"><input id="random-integer" type="checkbox" checked> <span data-i18n="tools.label.integer">整数</span></label>
              <label class="tool-check"><input id="random-unique" type="checkbox"> <span data-i18n="tools.label.unique">不重复</span></label>
            </div>
            <label class="tool-field"><span data-i18n="tools.label.output">输出结果</span>
              <textarea id="random-output" spellcheck="false" readonly></textarea>
            </label>
          </div>
          <div class="tool-actions">
            <button class="tool-btn primary" type="button" data-tool-run="random-generate" data-i18n="tools.btn.generate" data-i18n-html><i class="fas fa-dice" aria-hidden="true"></i> 生成</button>
            <button class="tool-btn" type="button" data-copy-target="random-output" data-i18n="tools.btn.copyResult" data-i18n-html><i class="fas fa-copy" aria-hidden="true"></i> 复制结果</button>
          </div>
          <p class="tool-status" id="random-status" role="status" aria-live="polite"></p>
        </section>`;
}

function renderDateDiffTool() {
  const tool = toolById("datediff");
  return `        <section ${panelAttrs(tool)}>
${toolHeader(tool)}
          <div class="tool-grid">
            <div class="tool-field">
              <label for="datediff-start" data-i18n="tools.label.startDate">开始日期</label>
              <input id="datediff-start" type="datetime-local">
              <label for="datediff-end" data-i18n="tools.label.endDate">结束日期</label>
              <input id="datediff-end" type="datetime-local">
            </div>
            <label class="tool-field"><span data-i18n="tools.label.output">输出结果</span>
              <textarea id="datediff-output" spellcheck="false" readonly></textarea>
            </label>
          </div>
          <div class="tool-actions">
            <button class="tool-btn primary" type="button" data-tool-run="date-diff" data-i18n="tools.btn.calculate" data-i18n-html><i class="fas fa-calculator" aria-hidden="true"></i> 计算</button>
            <button class="tool-btn" type="button" data-copy-target="datediff-output" data-i18n="tools.btn.copyResult" data-i18n-html><i class="fas fa-copy" aria-hidden="true"></i> 复制结果</button>
          </div>
          <p class="tool-status" id="datediff-status" role="status" aria-live="polite"></p>
        </section>`;
}

function renderUaTool() {
  return renderTextActionTool("ua", "uaInput", "ua-input", "ua-output", "parse-ua", "tools.btn.parse", "解析", "fa-desktop", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36");
}

export function renderToolsPage() {
  const description = "CWLBlog 在线工具箱：JSON、时间戳、Base64、URL、UUID、JWT、哈希、密码、颜色、正则、Markdown、Diff、Cron、二维码、YAML、URL 解析和文本处理等本地工具。";
  const main = `    <main id="main-content" class="content">
      <section class="tools-page container">
        <header class="tools-header">
          <span class="eyebrow" data-i18n="tools.eyebrow" data-i18n-en-html='<i class="fas fa-toolbox" aria-hidden="true"></i> Online Toolbox' data-i18n-html><i class="fas fa-toolbox" aria-hidden="true"></i> Online Toolbox</span>
          <h1 data-i18n="tools.h1" data-i18n-en="Toolbox">在线工具箱</h1>
          <p class="lead" data-i18n="tools.lead" data-i18n-en="Useful browser-only tools for JSON, timestamps, encoders, hashes, passwords, colors, regex, Markdown, diff, cron, QR codes, YAML, URL parsing and text processing.">常用开发小工具，全部在浏览器本地运行，不依赖后端。</p>
        </header>
        <div class="tools-shell">
          <nav class="tools-tabs" role="tablist" aria-label="工具列表" data-i18n-aria="tools.tabs" data-i18n-en-aria="Tool list">
${TOOLS.map(toolNav).join("\n")}
          </nav>
          <div class="tools-panels">
${renderJsonTool()}
${renderTimeTool()}
${renderCodecTool(toolById("base64"), "base64-input", "base64-output", "base64-encode", "base64-decode", "输入要编码或解码的文本", "Text to encode or decode")}
${renderCodecTool(toolById("url"), "url-input", "url-output", "url-encode", "url-decode", "https://example.com/?q=中文", "https://example.com/?q=search")}
${renderUuidTool()}
${renderJwtTool()}
${renderHashTool()}
${renderPasswordTool()}
${renderColorTool()}
${renderRegexTool()}
${renderMarkdownTool()}
${renderDiffTool()}
${renderCaseTool()}
${renderHtmlTool()}
${renderCronTool()}
${renderQrTool()}
${renderYamlTool()}
${renderUrlParseTool()}
${renderQueryTool()}
${renderJsonPathTool()}
${renderTextStatsTool()}
${renderCleanTextTool()}
${renderUnitTool()}
${renderRandomTool()}
${renderDateDiffTool()}
${renderUaTool()}
          </div>
        </div>
      </section>
    </main>`;

  return renderPage({
    title: "在线工具箱 :: CWLBlog",
    description,
    titleEn: "Toolbox :: CWLBlog",
    descriptionEn: "CWLBlog online toolbox: JSON, timestamps, Base64, URL, UUID, JWT, hashes, passwords, colors, regex, Markdown, diff, cron, QR, YAML, URL parsing and text tools.",
    active: "tools",
    page: "tools",
    scripts: ["/js/vendor/marked.min.js", "/js/vendor/purify.min.js", "/js/vendor/qrcode.min.js", "/js/tools-core.js", "/js/tools.js"],
    jsonLd: buildPageJsonLd({
      type: "WebApplication",
      name: "CWLBlog 在线工具箱",
      description,
      path: "/tools/",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Any",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      featureList: TOOLS.map((tool) => tool.titleEn || tool.title),
    }),
    main,
    og: {
      title: "在线工具箱 :: CWLBlog",
      description: "JSON、时间戳、编码、哈希、密码、颜色、正则、Markdown、Diff、Cron、二维码、YAML、URL 解析与文本处理等常用开发工具。",
      path: "/tools/",
    },
  });
}
