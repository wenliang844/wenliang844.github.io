import { buildPageJsonLd, renderPage } from "./layout.mjs";
import { stylesForRoute } from "../page-assets.mjs";

const TOOLS = [
  { id: "json", icon: "fa-code", title: "JSON 格式化", titleEn: "JSON Formatter", desc: "格式化、压缩和校验 JSON 文本。", descEn: "Format, minify and validate JSON text." },
  { id: "api", icon: "fa-paper-plane", title: "在线 API 测试器", titleEn: "Mini API Tester", desc: "输入 URL、Method、Header 和 Body 发起请求，并保存历史记录。", descEn: "Send requests with URL, method, headers and body, then save request history." },
  { id: "time", icon: "fa-clock", title: "时间戳转换", titleEn: "Timestamp Converter", desc: "秒/毫秒时间戳与本地日期时间互转。", descEn: "Convert seconds/milliseconds timestamps and local date time." },
  { id: "base64", icon: "fa-lock", title: "Base64 编解码", titleEn: "Base64 Codec", desc: "文本与 Base64 互转，支持中文。", descEn: "Encode and decode text with Base64, including Unicode." },
  { id: "url", icon: "fa-link", title: "URL 编解码", titleEn: "URL Codec", desc: "使用 encodeURIComponent / decodeURIComponent。", descEn: "Use encodeURIComponent and decodeURIComponent." },
  { id: "uuid", icon: "fa-fingerprint", title: "UUID 生成器", titleEn: "UUID Generator", desc: "一键生成 UUID v4 并复制。", descEn: "Generate and copy UUID v4 values." },
  { id: "jwt", icon: "fa-key", title: "JWT 解码", titleEn: "JWT Decoder", desc: "本地解析 header 和 payload，不校验签名。", descEn: "Locally parse header and payload without signature verification." },
  { id: "hash", icon: "fa-shield-alt", title: "哈希摘要", titleEn: "Hash Digest", desc: "使用 Web Crypto 生成 SHA 系列文本摘要。", descEn: "Generate SHA text digests with Web Crypto." },
  { id: "password", icon: "fa-user-lock", title: "密码生成器", titleEn: "Password Generator", desc: "基于浏览器安全随机数生成强密码。", descEn: "Generate strong passwords with secure browser randomness." },
  { id: "color", icon: "fa-palette", title: "颜色转换", titleEn: "Color Converter", desc: "HEX、RGB、HSL 互转并给出可读前景色建议。", descEn: "Convert HEX, RGB and HSL, with readable foreground suggestions." },
  { id: "regex", icon: "fa-search", title: "正则测试", titleEn: "Regex Tester", desc: "本地测试 JavaScript 正则表达式和匹配结果。", descEn: "Test JavaScript regular expressions and matches locally." },
  { id: "markdown", icon: "fa-heading", title: "Markdown 编辑器", titleEn: "Markdown Editor", desc: "在线编辑 Markdown，实时预览、自动保存，并可导出为 Markdown 或 HTML。", descEn: "Edit Markdown with live preview, auto-save and export to Markdown or HTML." },
  { id: "diff", icon: "fa-not-equal", title: "文本 Diff", titleEn: "Text Diff", desc: "对比两段文本，输出轻量行级差异。", descEn: "Compare two texts with a lightweight line diff." },
  { id: "jsondiff", icon: "fa-code-branch", title: "JSON Diff", titleEn: "JSON Diff", desc: "对比两个 JSON 的字段、数组和类型差异。", descEn: "Compare two JSON values across fields, arrays and types." },
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
  { id: "cssunit", icon: "fa-vector-square", title: "CSS 单位转换", titleEn: "CSS Unit Converter", desc: "px、rem、em、vw、vh 互相转换。", descEn: "Convert px, rem, em, vw and vh values." },
  { id: "random", icon: "fa-dice", title: "随机数生成", titleEn: "Random Generator", desc: "生成整数、浮点数或随机列表。", descEn: "Generate integers, decimals or random lists." },
  { id: "datediff", icon: "fa-hourglass-half", title: "日期差计算", titleEn: "Date Diff", desc: "计算两个日期之间的天数和时间跨度。", descEn: "Calculate days and duration between two dates." },
  { id: "ua", icon: "fa-desktop", title: "UA 解析", titleEn: "User-Agent Parser", desc: "解析浏览器、系统、设备类型和渲染引擎。", descEn: "Parse browser, OS, device type and rendering engine." },
  { id: "galaxy", icon: "fa-meteor", title: "星河", titleEn: "Galaxy", desc: "可交互的星河粒子画布，支持主题、星量、速度和鼠标引力切换。", descEn: "An interactive galaxy canvas with themes, star density, speed and pointer gravity controls." },
  { id: "gesture", icon: "fa-hand-sparkles", title: "手势交互动画", titleEn: "Gesture Animation", desc: "通过摄像头识别手势，触发炫酷的粒子动画和绘画效果。", descEn: "Detect gestures via webcam and trigger particle animations and drawing effects." },
];

const TOOL_CATEGORIES = [
  { id: "visual", title: "视觉与交互", titleEn: "Visual & Interaction", ids: ["galaxy", "gesture"] },
  { id: "data", title: "数据格式", titleEn: "Data", ids: ["json", "yaml", "jsonpath", "jsondiff", "urlparse", "query"] },
  { id: "api", title: "接口调试", titleEn: "API", ids: ["api"] },
  { id: "security", title: "编码与安全", titleEn: "Encoding & Security", ids: ["base64", "url", "jwt", "hash", "password", "uuid"] },
  { id: "text", title: "文本处理", titleEn: "Text", ids: ["regex", "markdown", "diff", "case", "html", "textstats", "cleantext"] },
  { id: "time", title: "时间与生成", titleEn: "Time & Generate", ids: ["time", "cron", "random", "datediff"] },
  { id: "frontend", title: "前端与媒体", titleEn: "Frontend & Media", ids: ["color", "qr", "unit", "cssunit", "ua"] },
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

function renderToolCategory(category) {
  const tabs = category.ids.map((id) => toolNav(toolById(id), TOOLS.findIndex((tool) => tool.id === id))).join("\n");
  return `            <details class="tool-category" data-tool-category="${category.id}" open>
              <summary class="tool-category-summary">
                <span class="tool-category-chevron" aria-hidden="true"><i class="fas fa-chevron-right"></i></span>
                <span class="tool-category-title" data-i18n="tools.category.${category.id}" data-i18n-en="${attr(category.titleEn)}">${category.title}</span>
                <span class="tool-category-count" aria-label="${category.ids.length} 个工具">${category.ids.length}</span>
              </summary>
              <div class="tool-category-list">
${tabs}
              </div>
            </details>`;
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

const GESTURE_RESOURCE_STATUS = [
  { name: "MediaPipe 视觉运行时", nameEn: "MediaPipe vision runtime", status: "版本锁定", statusEn: "Version locked", state: "locked" },
  { name: "MediaPipe WASM 基础包", nameEn: "MediaPipe WASM base", status: "版本锁定", statusEn: "Version locked", state: "locked" },
  { name: "手部识别模型", nameEn: "Hand landmark model", status: "上游 latest", statusEn: "Upstream latest", state: "watch" },
  { name: "物体检测模型", nameEn: "Object detector model", status: "上游 latest", statusEn: "Upstream latest", state: "watch" },
  { name: "face-api 运行时", nameEn: "face-api runtime", status: "版本锁定", statusEn: "Version locked", state: "locked" },
  { name: "face-api 模型包", nameEn: "face-api model pack", status: "待自托管", statusEn: "Self-hosting planned", state: "watch" },
  { name: "Three.js 3D 运行时", nameEn: "Three.js 3D runtime", status: "版本锁定", statusEn: "Version locked", state: "locked" },
];

function renderGestureResourceStatus() {
  const items = GESTURE_RESOURCE_STATUS.map((item) => `              <li class="gesture-resource-item" data-resource-status="${item.state}">
                <span data-i18n="tools.gesture.resource.${attr(item.state)}.${attr(item.nameEn.replace(/[^a-z0-9]+/gi, "-").toLowerCase())}" data-i18n-en="${attr(item.nameEn)}">${item.name}</span>
                <strong data-i18n="tools.gesture.resource.status.${attr(item.state)}" data-i18n-en="${attr(item.statusEn)}">${item.status}</strong>
              </li>`).join("\n");
  return `            <div class="gesture-resource-status" aria-label="视觉资源治理状态" data-i18n-aria="tools.gesture.resourceStatus" data-i18n-en-aria="Visual resource governance status">
              <p data-i18n="tools.gesture.resourceSummary" data-i18n-en="Resource status: versioned runtime URLs are locked; upstream latest model paths are still planned for self-hosting and hash pinning.">资源状态：运行时 URL 已按版本锁定；latest 模型路径仍计划自托管并记录哈希。</p>
              <ul class="gesture-resource-list">
${items}
              </ul>
            </div>`;
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

function renderApiTool() {
  const tool = toolById("api");
  return `        <section ${panelAttrs(tool)}>
${toolHeader(tool)}
          <div class="tool-actions api-relay-actions">
            <label class="tool-inline"><span data-i18n="tools.label.relayPreset">中转站配置</span>
              <select id="api-relay-select">
                <option value="" data-i18n="tools.api.relayLoading">正在加载中转站...</option>
              </select>
            </label>
            <button class="tool-btn" type="button" data-api-relay-fill data-i18n="tools.btn.fillRelay" data-i18n-html><i class="fas fa-network-wired" aria-hidden="true"></i> 填入中转站</button>
          </div>
          <div class="api-request-line">
            <label class="tool-field api-method-field"><span data-i18n="tools.label.method">Method</span>
              <select id="api-method">
                <option>GET</option>
                <option>POST</option>
                <option>PUT</option>
                <option>PATCH</option>
                <option>DELETE</option>
                <option>HEAD</option>
              </select>
            </label>
            <label class="tool-field"><span data-i18n="tools.label.requestUrl">URL</span>
              <input id="api-url" type="url" spellcheck="false" placeholder="https://api.example.com/v1/chat/completions">
            </label>
          </div>
          <div class="tool-grid">
            <label class="tool-field"><span data-i18n="tools.label.headers">Headers</span>
              <textarea id="api-headers" spellcheck="false" placeholder="Content-Type: application/json&#10;Authorization: Bearer YOUR_API_KEY"></textarea>
            </label>
            <label class="tool-field"><span data-i18n="tools.label.body">Body</span>
              <textarea id="api-body" spellcheck="false" placeholder='{"model":"gpt-5.5","messages":[{"role":"user","content":"ping"}]}'></textarea>
            </label>
          </div>
          <label class="tool-field tool-output-field"><span data-i18n="tools.label.response">响应结果</span>
            <textarea id="api-response" spellcheck="false" readonly></textarea>
          </label>
          <div class="tool-actions">
            <button class="tool-btn primary" type="button" data-api-send data-i18n="tools.btn.sendRequest" data-i18n-html><i class="fas fa-paper-plane" aria-hidden="true"></i> 发送请求</button>
            <button class="tool-btn" type="button" data-api-save data-i18n="tools.btn.saveRequest" data-i18n-html><i class="fas fa-save" aria-hidden="true"></i> 保存请求</button>
            <label class="tool-inline"><span data-i18n="tools.label.saveBody">保存请求体</span>
              <input id="api-save-body-history" type="checkbox">
            </label>
            <label class="tool-inline"><span data-i18n="tools.label.allowRiskyApiTarget">允许本机/内网/非 HTTPS 请求</span>
              <input id="api-allow-risky-target" type="checkbox">
            </label>
            <label class="tool-inline"><span data-i18n="tools.label.history">历史</span>
              <select id="api-history">
                <option value="" data-i18n="tools.api.noHistory">暂无历史</option>
              </select>
            </label>
            <button class="tool-btn" type="button" data-api-load-history data-i18n="tools.btn.loadHistory" data-i18n-html><i class="fas fa-history" aria-hidden="true"></i> 载入</button>
            <button class="tool-btn" type="button" data-api-clear-history data-i18n="tools.btn.clearHistory" data-i18n-html><i class="fas fa-trash-alt" aria-hidden="true"></i> 清空历史</button>
            <button class="tool-btn" type="button" data-copy-target="api-response" data-i18n="tools.btn.copyResult" data-i18n-html><i class="fas fa-copy" aria-hidden="true"></i> 复制结果</button>
          </div>
          <p class="tool-status" id="api-status" role="status" aria-live="polite"></p>
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
            <div class="tool-field">
              <label for="color-input" data-i18n="tools.label.colorInput">颜色值</label>
              <input id="color-input" type="text" placeholder="#2563eb / rgb(37, 99, 235) / hsl(221, 83%, 53%)">
              <label for="color-picker" data-i18n="tools.label.colorPicker">取色器</label>
              <input id="color-picker" type="color" value="#2563eb">
            </div>
            <label class="tool-field"><span data-i18n="tools.label.output">输出结果</span>
              <textarea id="color-output" spellcheck="false" readonly></textarea>
            </label>
          </div>
          <div class="tool-color-preview">
            <span id="color-swatch" class="tool-color-swatch" aria-hidden="true"></span>
            <span id="color-preview-text" data-i18n="tools.color.empty">等待转换颜色</span>
          </div>
          <div id="color-palette" class="tool-palette" aria-label="调色板" data-i18n-aria="tools.label.palette"></div>
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
          <div class="editor-tool">
            <div class="editor-actions">
              <button class="editor-button" type="button" data-action="new" data-i18n="editor.btn.new" data-i18n-html><i class="fas fa-file"></i> 新建</button>
              <button class="editor-button" type="button" data-action="sample" data-i18n="editor.btn.sample" data-i18n-html><i class="fas fa-magic"></i> 示例</button>
              <button class="editor-button" type="button" data-action="copy-html" data-i18n="editor.btn.copyhtml" data-i18n-html><i class="fas fa-copy"></i> 复制 HTML</button>
              <button class="editor-button" type="button" data-action="download-md" data-i18n="editor.btn.md" data-i18n-html><i class="fas fa-download"></i> 导出 MD</button>
              <button class="editor-button" type="button" data-action="download-html" data-i18n="editor.btn.html" data-i18n-html><i class="fas fa-code"></i> 导出 HTML</button>
            </div>
            <div class="editor-meta">
              <label><span data-i18n="editor.title.label">标题</span> <input id="post-title" type="text" placeholder="文章标题" data-i18n-ph="editor.title.ph"></label>
              <label><span data-i18n="editor.shortTitle.label">短标题</span> <input id="post-short-title" type="text" placeholder="列表短标题" data-i18n-ph="editor.shortTitle.ph"></label>
              <label><span data-i18n="editor.slug.label">别名</span> <input id="post-slug" type="text" placeholder="my-new-post" data-i18n-ph="editor.slug.ph"></label>
              <label><span data-i18n="editor.date.label">日期</span> <input id="post-date" type="date"></label>
              <label><span data-i18n="editor.summary.label">摘要</span> <input id="post-summary" type="text" placeholder="一句话摘要" data-i18n-ph="editor.summary.ph"></label>
              <label><span data-i18n="editor.description.label">描述</span> <input id="post-description" type="text" placeholder="搜索与分享描述" data-i18n-ph="editor.description.ph"></label>
            </div>
            <div class="editor-toolbar" role="toolbar" aria-label="Markdown 格式工具" data-i18n-aria="editor.toolbar.aria">
              <button type="button" class="tool-btn" data-md="bold" title="加粗 (Ctrl+B)" aria-label="加粗" data-i18n-title="editor.tool.bold" data-i18n-aria="editor.tool.bold"><i class="fas fa-bold"></i></button>
              <button type="button" class="tool-btn" data-md="italic" title="斜体 (Ctrl+I)" aria-label="斜体" data-i18n-title="editor.tool.italic" data-i18n-aria="editor.tool.italic"><i class="fas fa-italic"></i></button>
              <button type="button" class="tool-btn" data-md="heading" title="标题" aria-label="标题" data-i18n-title="editor.tool.heading" data-i18n-aria="editor.tool.heading"><i class="fas fa-heading"></i></button>
              <span class="tool-sep" aria-hidden="true"></span>
              <button type="button" class="tool-btn" data-md="link" title="链接 (Ctrl+K)" aria-label="链接" data-i18n-title="editor.tool.link" data-i18n-aria="editor.tool.link"><i class="fas fa-link"></i></button>
              <button type="button" class="tool-btn" data-md="image" title="图片" aria-label="图片" data-i18n-title="editor.tool.image" data-i18n-aria="editor.tool.image"><i class="fas fa-image"></i></button>
              <button type="button" class="tool-btn" data-md="code" title="行内代码" aria-label="行内代码" data-i18n-title="editor.tool.code" data-i18n-aria="editor.tool.code"><i class="fas fa-code"></i></button>
              <button type="button" class="tool-btn" data-md="codeblock" title="代码块" aria-label="代码块" data-i18n-title="editor.tool.codeblock" data-i18n-aria="editor.tool.codeblock"><i class="fas fa-laptop-code"></i></button>
              <span class="tool-sep" aria-hidden="true"></span>
              <button type="button" class="tool-btn" data-md="quote" title="引用" aria-label="引用" data-i18n-title="editor.tool.quote" data-i18n-aria="editor.tool.quote"><i class="fas fa-quote-left"></i></button>
              <button type="button" class="tool-btn" data-md="ul" title="无序列表" aria-label="无序列表" data-i18n-title="editor.tool.ul" data-i18n-aria="editor.tool.ul"><i class="fas fa-list-ul"></i></button>
              <button type="button" class="tool-btn" data-md="ol" title="有序列表" aria-label="有序列表" data-i18n-title="editor.tool.ol" data-i18n-aria="editor.tool.ol"><i class="fas fa-list-ol"></i></button>
              <button type="button" class="tool-btn" data-md="table" title="表格" aria-label="表格" data-i18n-title="editor.tool.table" data-i18n-aria="editor.tool.table"><i class="fas fa-table"></i></button>
            </div>
            <div class="editor-layout">
              <section class="editor-pane">
                <div class="pane-title"><span data-i18n="editor.pane.markdown">Markdown</span> <span class="editor-stats" id="editor-stats"></span></div>
                <label class="sr-only" for="markdown-input" data-i18n="editor.input.label">Markdown 原文输入</label>
                <textarea id="markdown-input" spellcheck="false"></textarea>
              </section>
              <section class="preview-pane">
                <div class="pane-title" data-i18n="editor.pane.preview">Preview</div>
                <article id="markdown-preview" class="markdown-preview article-content"></article>
              </section>
            </div>
            <p class="editor-note" data-i18n="editor.note" data-i18n-html>静态 GitHub Pages 不能直接写入仓库；导出的文件可放入当前静态站点生成流程的 <code>src/posts/</code>。提示：选中文字后点工具按钮可包裹格式，支持 Ctrl+B / Ctrl+I / Ctrl+K。</p>
          </div>
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

function renderJsonDiffTool() {
  const tool = toolById("jsondiff");
  return `        <section ${panelAttrs(tool)}>
${toolHeader(tool)}
          <div class="tool-grid">
            <label class="tool-field"><span data-i18n="tools.label.leftJson">左侧 JSON</span>
              <textarea id="jsondiff-left" spellcheck="false" placeholder='{"data":[{"name":"CWL","score":97}]}'></textarea>
            </label>
            <label class="tool-field"><span data-i18n="tools.label.rightJson">右侧 JSON</span>
              <textarea id="jsondiff-right" spellcheck="false" placeholder='{"data":[{"name":"CWL","score":100}]}'></textarea>
            </label>
          </div>
          <label class="tool-field tool-output-field"><span data-i18n="tools.label.diffOutput">差异结果</span>
            <textarea id="jsondiff-output" spellcheck="false" readonly></textarea>
          </label>
          <div class="tool-actions">
            <button class="tool-btn primary" type="button" data-tool-run="json-diff" data-i18n="tools.btn.compare" data-i18n-html><i class="fas fa-code-branch" aria-hidden="true"></i> 对比</button>
            <button class="tool-btn" type="button" data-copy-target="jsondiff-output" data-i18n="tools.btn.copyResult" data-i18n-html><i class="fas fa-copy" aria-hidden="true"></i> 复制结果</button>
          </div>
          <p class="tool-status" id="jsondiff-status" role="status" aria-live="polite"></p>
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
          <div class="cron-builder">
            <label class="tool-field"><span data-i18n="tools.label.minuteInterval">分钟间隔</span>
              <select id="cron-minute-step">
                <option value="1">每 1 分钟</option>
                <option value="5">每 5 分钟</option>
                <option value="10">每 10 分钟</option>
                <option value="15" selected>每 15 分钟</option>
                <option value="30">每 30 分钟</option>
              </select>
            </label>
            <label class="tool-field"><span data-i18n="tools.label.hourStart">开始小时</span>
              <input id="cron-hour-start" type="number" min="0" max="23" step="1" value="9">
            </label>
            <label class="tool-field"><span data-i18n="tools.label.hourEnd">结束小时</span>
              <input id="cron-hour-end" type="number" min="0" max="23" step="1" value="18">
            </label>
            <label class="tool-field"><span data-i18n="tools.label.dayOfMonth">日期</span>
              <input id="cron-day-month" type="text" spellcheck="false" value="*" placeholder="* / 1 / 1,15">
            </label>
            <label class="tool-field"><span data-i18n="tools.label.month">月份</span>
              <input id="cron-month" type="text" spellcheck="false" value="*" placeholder="* / jan / 1,6,12">
            </label>
          </div>
          <div class="tool-check-grid cron-weekdays" aria-label="星期" data-i18n-aria="tools.label.weekdays">
            <label class="tool-check"><input type="checkbox" data-cron-weekday="1" checked> <span>周一</span></label>
            <label class="tool-check"><input type="checkbox" data-cron-weekday="2" checked> <span>周二</span></label>
            <label class="tool-check"><input type="checkbox" data-cron-weekday="3" checked> <span>周三</span></label>
            <label class="tool-check"><input type="checkbox" data-cron-weekday="4" checked> <span>周四</span></label>
            <label class="tool-check"><input type="checkbox" data-cron-weekday="5" checked> <span>周五</span></label>
            <label class="tool-check"><input type="checkbox" data-cron-weekday="6"> <span>周六</span></label>
            <label class="tool-check"><input type="checkbox" data-cron-weekday="0"> <span>周日</span></label>
          </div>
          <label class="tool-field"><span data-i18n="tools.label.cronExpression">Cron 表达式</span>
            <input id="cron-input" type="text" spellcheck="false" value="*/15 9-18 * * 1-5" placeholder="*/15 9-18 * * 1-5">
          </label>
          <label class="tool-field tool-output-field"><span data-i18n="tools.label.output">输出结果</span>
            <textarea id="cron-output" spellcheck="false" readonly></textarea>
          </label>
          <div class="tool-actions">
            <button class="tool-btn primary" type="button" data-cron-generate data-i18n="tools.btn.generateCron" data-i18n-html><i class="fas fa-magic" aria-hidden="true"></i> 生成表达式</button>
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
                <img id="qr-image" alt="QR code" width="256" height="256" loading="lazy" decoding="async" hidden>
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

function renderCssUnitTool() {
  const tool = toolById("cssunit");
  return `        <section ${panelAttrs(tool)}>
${toolHeader(tool)}
          <div class="tool-grid">
            <div class="tool-field">
              <label for="cssunit-value" data-i18n="tools.label.value">数值</label>
              <input id="cssunit-value" type="number" step="any" value="16">
              <label for="cssunit-from" data-i18n="tools.label.fromUnit">来源单位</label>
              <select id="cssunit-from">
                <option value="px">px</option>
                <option value="rem">rem</option>
                <option value="em">em</option>
                <option value="vw">vw</option>
                <option value="vh">vh</option>
              </select>
              <label for="cssunit-root" data-i18n="tools.label.rootFont">根字号 px</label>
              <input id="cssunit-root" type="number" min="1" step="any" value="16">
              <label for="cssunit-context" data-i18n="tools.label.contextFont">当前字号 px</label>
              <input id="cssunit-context" type="number" min="1" step="any" value="16">
              <label for="cssunit-viewport-width" data-i18n="tools.label.viewportWidth">视口宽度 px</label>
              <input id="cssunit-viewport-width" type="number" min="1" step="any" value="1440">
              <label for="cssunit-viewport-height" data-i18n="tools.label.viewportHeight">视口高度 px</label>
              <input id="cssunit-viewport-height" type="number" min="1" step="any" value="900">
            </div>
            <label class="tool-field"><span data-i18n="tools.label.output">输出结果</span>
              <textarea id="cssunit-output" spellcheck="false" readonly></textarea>
            </label>
          </div>
          <div class="tool-actions">
            <button class="tool-btn primary" type="button" data-tool-run="css-unit-convert" data-i18n="tools.btn.convert" data-i18n-html><i class="fas fa-exchange-alt" aria-hidden="true"></i> 转换</button>
            <button class="tool-btn" type="button" data-copy-target="cssunit-output" data-i18n="tools.btn.copyResult" data-i18n-html><i class="fas fa-copy" aria-hidden="true"></i> 复制结果</button>
          </div>
          <p class="tool-status" id="cssunit-status" role="status" aria-live="polite"></p>
        </section>`;
}

function renderRandomTool() {
  const tool = toolById("random");
  return `        <section ${panelAttrs(tool)}>
${toolHeader(tool)}
          <p class="tool-note random-warning" role="note" data-i18n="tools.random.warning" data-i18n-en="Uses regular pseudo-random numbers for sampling, demos and quick picks. Do not use these values as passwords, tokens, verification codes or security credentials.">使用普通伪随机数，适合抽样、演示和快速选择；不要将结果用作密码、令牌、验证码或安全凭据。</p>
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

function renderGestureTool() {
  const tool = toolById("gesture");
  return `        <section ${panelAttrs(tool)}>
${toolHeader(tool)}
          <div class="gesture-controls">
            <button class="tool-btn primary" id="gesture-start" type="button" disabled>
              <i class="fas fa-video" aria-hidden="true"></i> <span data-i18n="tools.gesture.start" data-i18n-en="Start Camera">开启摄像头</span>
            </button>
            <button class="tool-btn" id="gesture-stop" type="button" disabled>
              <i class="fas fa-video-slash" aria-hidden="true"></i> <span data-i18n="tools.gesture.stop" data-i18n-en="Stop Camera">关闭摄像头</span>
            </button>
            <button class="tool-btn" id="gesture-clear" type="button">
              <i class="fas fa-eraser" aria-hidden="true"></i> <span data-i18n="tools.gesture.clear" data-i18n-en="Clear Canvas">清除画布</span>
            </button>
          </div>
          <div class="gesture-supply-chain" role="note">
            <label class="gesture-toggle gesture-consent">
              <input id="gesture-allow-remote-runtime" type="checkbox">
              <span><i class="fas fa-shield-alt" aria-hidden="true"></i> <span data-i18n="tools.gesture.consent" data-i18n-en="I understand the visual runtime and models are downloaded from third-party CDNs.">我了解视觉运行时和模型会从第三方 CDN 下载</span></span>
            </label>
            <p data-i18n="tools.gesture.supplyChain" data-i18n-en="The camera stream stays in this browser for recognition. Starting the tool may download MediaPipe, face-api, Three.js and model files from jsDelivr and Google Storage.">摄像头画面只在本机浏览器识别；启动时可能从 jsDelivr 和 Google Storage 下载 MediaPipe、face-api、Three.js 与模型文件。</p>
${renderGestureResourceStatus()}
          </div>
          <div class="gesture-modes" role="radiogroup" data-i18n-aria="tools.gesture.modeGroup" data-i18n-en-aria="Animation mode">
            <button class="gesture-mode-btn active" data-mode="particle" type="button">
              <i class="fas fa-spa" aria-hidden="true"></i> <span data-i18n="tools.gesture.modeParticle" data-i18n-en="Particles">粒子追踪</span>
            </button>
            <button class="gesture-mode-btn" data-mode="gesture" type="button">
              <i class="fas fa-hand-peace" aria-hidden="true"></i> <span data-i18n="tools.gesture.modeGesture" data-i18n-en="Gestures">手势识别</span>
            </button>
            <button class="gesture-mode-btn" data-mode="premium" type="button">
              <i class="fas fa-magic" aria-hidden="true"></i> <span data-i18n="tools.gesture.modePremium" data-i18n-en="Kinetic">高阶动效</span>
            </button>
            <button class="gesture-mode-btn" data-mode="draw" type="button">
              <i class="fas fa-paint-brush" aria-hidden="true"></i> <span data-i18n="tools.gesture.modeDraw" data-i18n-en="Drawing">指尖绘画</span>
            </button>
            <button class="gesture-mode-btn" data-mode="fruit" type="button">
              <i class="fas fa-apple-alt" aria-hidden="true"></i> <span data-i18n="tools.gesture.modeFruit" data-i18n-en="Fruit Ninja">体感切水果</span>
            </button>
            <button class="gesture-mode-btn" data-mode="face" type="button">
              <i class="fas fa-face-smile" aria-hidden="true"></i> <span data-i18n="tools.gesture.modeFace" data-i18n-en="Face Analysis">人脸分析</span>
            </button>
            <button class="gesture-mode-btn" data-mode="3d" type="button">
              <i class="fas fa-cube" aria-hidden="true"></i> <span data-i18n="tools.gesture.mode3d" data-i18n-en="3D Reconstruction">3D 重建</span>
            </button>
          </div>
          <div class="gesture-3d-submodes" id="gesture-3d-submodes" hidden>
            <button class="gesture-submode-btn active" data-submode="pointcloud" type="button">
              <i class="fas fa-braille" aria-hidden="true"></i> <span data-i18n="tools.gesture.subPointCloud" data-i18n-en="Point Cloud">点云</span>
            </button>
            <button class="gesture-submode-btn" data-submode="mesh" type="button">
              <i class="fas fa-draw-polygon" aria-hidden="true"></i> <span data-i18n="tools.gesture.subMesh" data-i18n-en="Mesh">网格</span>
            </button>
          </div>
          <div class="gesture-feedback-controls">
            <label class="gesture-toggle">
              <input id="gesture-haptics" type="checkbox" checked>
              <span><i class="fas fa-adjust" aria-hidden="true"></i> <span data-i18n="tools.gesture.haptics" data-i18n-en="Haptics">触觉</span></span>
            </label>
            <label class="gesture-toggle">
              <input id="gesture-sound" type="checkbox">
              <span><i class="fas fa-rss" aria-hidden="true"></i> <span data-i18n="tools.gesture.sound" data-i18n-en="Sound">音效</span></span>
            </label>
          </div>
          <div class="gesture-viewport">
            <video id="gesture-video" class="gesture-video" autoplay playsinline muted></video>
            <canvas id="gesture-canvas" class="gesture-canvas"></canvas>
            <div id="gesture-three-container" class="gesture-three-container"></div>
            <canvas id="gesture-depth-preview" class="gesture-depth-preview" width="80" height="60"></canvas>
            <div id="gesture-overlay" class="gesture-overlay">
              <i class="fas fa-hand-sparkles" aria-hidden="true"></i>
              <p data-i18n="tools.gesture.placeholder" data-i18n-en='Click "Start Camera" to begin'>点击"开启摄像头"开始</p>
            </div>
          </div>
          <div class="gesture-info">
            <span id="gesture-status" class="gesture-badge">就绪</span>
            <span id="gesture-label" class="gesture-badge"></span>
            <span id="gesture-fps" class="gesture-badge"></span>
            <span id="gesture-face" class="gesture-badge"></span>
          </div>
          <p class="gesture-privacy">
            <i class="fas fa-shield-alt" aria-hidden="true"></i>
            <span data-i18n="tools.gesture.privacy" data-i18n-en="All data is processed locally in your browser and is never uploaded to any server.">所有数据均在浏览器本地处理，不会上传到任何服务器。</span>
          </p>
        </section>`;
}

function renderGalaxyTool() {
  const tool = toolById("galaxy");
  return `        <section ${panelAttrs(tool)}>
${toolHeader(tool)}
          <div class="galaxy-controls">
            <div class="galaxy-ctrl-group">
              <span class="galaxy-ctrl-label" data-i18n="tools.galaxy.theme" data-i18n-en="Theme">主题</span>
              <div class="galaxy-btn-row" id="galaxy-theme" role="group" aria-label="星河主题" data-i18n-aria="tools.galaxy.theme" data-i18n-en-aria="Galaxy theme">
                <button class="galaxy-theme-btn active" type="button" data-galaxy-theme="bluePurple"><span class="galaxy-theme-dot" style="background:linear-gradient(135deg,#22d3ee,#8b5cf6)" aria-hidden="true"></span><span data-i18n="tools.galaxy.themeBlue" data-i18n-en="Blue">蓝紫</span></button>
                <button class="galaxy-theme-btn" type="button" data-galaxy-theme="pinkOrange"><span class="galaxy-theme-dot" style="background:linear-gradient(135deg,#fb7185,#f59e0b)" aria-hidden="true"></span><span data-i18n="tools.galaxy.themePink" data-i18n-en="Amber">粉橙</span></button>
                <button class="galaxy-theme-btn" type="button" data-galaxy-theme="cyanGreen"><span class="galaxy-theme-dot" style="background:linear-gradient(135deg,#06b6d4,#22c55e)" aria-hidden="true"></span><span data-i18n="tools.galaxy.themeCyan" data-i18n-en="Cyan">青绿</span></button>
                <button class="galaxy-theme-btn" type="button" data-galaxy-theme="rainbow"><span class="galaxy-theme-dot" style="background:linear-gradient(135deg,#ef4444,#eab308,#22c55e,#3b82f6)" aria-hidden="true"></span><span data-i18n="tools.galaxy.themeRainbow" data-i18n-en="Prism">彩虹</span></button>
              </div>
            </div>
            <div class="galaxy-ctrl-group">
              <label class="galaxy-ctrl-label" for="galaxy-speed"><span data-i18n="tools.galaxy.speed" data-i18n-en="Speed">速度</span><span id="galaxy-speed-val">1.0x</span></label>
              <input class="galaxy-range" id="galaxy-speed" type="range" min="0.2" max="3" step="0.1" value="1">
            </div>
            <div class="galaxy-ctrl-group">
              <span class="galaxy-ctrl-label" data-i18n="tools.galaxy.count" data-i18n-en="Stars">星量</span>
              <div class="galaxy-btn-row" id="galaxy-count" role="group" aria-label="星河星量" data-i18n-aria="tools.galaxy.count" data-i18n-en-aria="Star density">
                <button class="galaxy-count-btn" type="button" data-galaxy-count="500">500</button>
                <button class="galaxy-count-btn active" type="button" data-galaxy-count="1000">1000</button>
                <button class="galaxy-count-btn" type="button" data-galaxy-count="1800">1800</button>
                <button class="galaxy-count-btn" type="button" data-galaxy-count="2600">2600</button>
              </div>
            </div>
            <div class="galaxy-ctrl-group">
              <span class="galaxy-ctrl-label" data-i18n="tools.galaxy.interaction" data-i18n-en="Interaction">交互</span>
              <div class="galaxy-btn-row" id="galaxy-interact" role="group" aria-label="星河交互模式" data-i18n-aria="tools.galaxy.interaction" data-i18n-en-aria="Galaxy interaction">
                <button class="galaxy-interact-btn active" type="button" data-galaxy-interact="attract"><i class="fas fa-magnet" aria-hidden="true"></i><span data-i18n="tools.galaxy.attract" data-i18n-en="Attract">吸引</span></button>
                <button class="galaxy-interact-btn" type="button" data-galaxy-interact="repel"><i class="fas fa-expand-arrows-alt" aria-hidden="true"></i><span data-i18n="tools.galaxy.repel" data-i18n-en="Repel">排斥</span></button>
                <button class="galaxy-interact-btn" type="button" data-galaxy-interact="none"><i class="fas fa-ban" aria-hidden="true"></i><span data-i18n="tools.galaxy.none" data-i18n-en="None">关闭</span></button>
              </div>
            </div>
          </div>
          <div class="galaxy-viewport">
            <canvas id="galaxy-canvas" class="galaxy-canvas" aria-label="星河动画画布" data-i18n-aria="tools.galaxy.canvas" data-i18n-en-aria="Galaxy animation canvas"></canvas>
          </div>
          <div class="galaxy-info">
            <span class="galaxy-badge" id="galaxy-fps">0 FPS</span>
            <span class="galaxy-badge" id="galaxy-particles">0 星</span>
          </div>
        </section>`;
}

function renderToolPanel(id) {
  if (id === "json") {
    return renderJsonTool();
  }
  if (id === "api") {
    return renderApiTool();
  }
  if (id === "time") {
    return renderTimeTool();
  }
  if (id === "base64") {
    return renderCodecTool(toolById("base64"), "base64-input", "base64-output", "base64-encode", "base64-decode", "输入要编码或解码的文本", "Text to encode or decode");
  }
  if (id === "url") {
    return renderCodecTool(toolById("url"), "url-input", "url-output", "url-encode", "url-decode", "https://example.com/?q=中文", "https://example.com/?q=search");
  }
  if (id === "uuid") {
    return renderUuidTool();
  }
  if (id === "jwt") {
    return renderJwtTool();
  }
  if (id === "hash") {
    return renderHashTool();
  }
  if (id === "password") {
    return renderPasswordTool();
  }
  if (id === "color") {
    return renderColorTool();
  }
  if (id === "regex") {
    return renderRegexTool();
  }
  if (id === "markdown") {
    return renderMarkdownTool();
  }
  if (id === "diff") {
    return renderDiffTool();
  }
  if (id === "jsondiff") {
    return renderJsonDiffTool();
  }
  if (id === "case") {
    return renderCaseTool();
  }
  if (id === "html") {
    return renderHtmlTool();
  }
  if (id === "cron") {
    return renderCronTool();
  }
  if (id === "qr") {
    return renderQrTool();
  }
  if (id === "yaml") {
    return renderYamlTool();
  }
  if (id === "urlparse") {
    return renderUrlParseTool();
  }
  if (id === "query") {
    return renderQueryTool();
  }
  if (id === "jsonpath") {
    return renderJsonPathTool();
  }
  if (id === "textstats") {
    return renderTextStatsTool();
  }
  if (id === "cleantext") {
    return renderCleanTextTool();
  }
  if (id === "unit") {
    return renderUnitTool();
  }
  if (id === "cssunit") {
    return renderCssUnitTool();
  }
  if (id === "random") {
    return renderRandomTool();
  }
  if (id === "datediff") {
    return renderDateDiffTool();
  }
  if (id === "ua") {
    return renderUaTool();
  }
  if (id === "galaxy") {
    return renderGalaxyTool();
  }
  if (id === "gesture") {
    return renderGestureTool();
  }
  throw new Error(`Unknown tool panel: ${id}`);
}

function renderDeferredToolPanel(id) {
  return `        <template data-tool-template="${id}">
${renderToolPanel(id)}
        </template>`;
}

export function renderToolsPage() {
  const description = "CWLBlog 在线工具箱：Mini Postman、JSON、时间戳、Base64、URL、UUID、JWT、哈希、密码、颜色、正则、Markdown 编辑器、Diff、Cron、二维码、YAML、URL 解析、文本处理和手势交互动画等开发工具。";
  const eagerPanels = new Set(["json"]);
  const panels = TOOLS.map((tool) => (eagerPanels.has(tool.id) ? renderToolPanel(tool.id) : renderDeferredToolPanel(tool.id))).join("\n");
  const main = `    <main id="main-content" class="content">
      <section class="tools-page container">
        <header class="tools-header">
          <span class="eyebrow" data-i18n="tools.eyebrow" data-i18n-en-html='<i class="fas fa-toolbox" aria-hidden="true"></i> Online Toolbox' data-i18n-html><i class="fas fa-toolbox" aria-hidden="true"></i> Online Toolbox</span>
          <h1 data-i18n="tools.h1" data-i18n-en="Toolbox">在线工具箱</h1>
          <p class="lead" data-i18n="tools.lead" data-i18n-en="Useful developer tools for API testing, JSON, timestamps, encoders, hashes, passwords, colors, regex, Markdown, diff, cron, QR codes, YAML, URL parsing and text processing.">常用开发小工具，API 测试器可直连中转站配置，其余工具全部在浏览器本地运行。</p>
        </header>
        <div class="tools-shell">
          <nav class="tools-tabs" role="tablist" aria-label="工具分类列表" data-i18n-aria="tools.tabs" data-i18n-en-aria="Categorized tool list">
${TOOL_CATEGORIES.map(renderToolCategory).join("\n")}
          </nav>
          <div class="tools-panels">
${panels}
          </div>
        </div>
      </section>
    </main>`;

  return renderPage({
    title: "在线工具箱 :: CWLBlog",
    description,
    titleEn: "Toolbox :: CWLBlog",
    descriptionEn: "CWLBlog online toolbox: Mini Postman, JSON, timestamps, Base64, URL, UUID, JWT, hashes, passwords, colors, regex, Markdown editor, diff, cron, QR, YAML, URL parsing, text tools and gesture animation.",
    active: "tools",
    page: "tools",
    connectSrc: "'self' https: http:",
    styles: stylesForRoute("/tools/"),
    scripts: ["/js/vendor/marked.min.js", "/js/vendor/purify.min.js", "/js/vendor/qrcode.min.js", "/js/vendor/highlight.min.js", "/js/tools-core.js", "/js/tools.js", "/js/editor.js"],
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
      description: "Mini Postman、JSON、时间戳、编码、哈希、密码、颜色、正则、Markdown 编辑器、Diff、Cron、二维码、YAML、URL 解析与文本处理等常用开发工具。",
      path: "/tools/",
    },
  });
}
