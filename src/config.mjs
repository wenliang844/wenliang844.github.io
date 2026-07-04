// 站点级配置。
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

// OG 卡片缩略图（站点根相对路径）。使用已存在的站点图标作为默认分享图，
// 避免手写页和生成页在社交平台分享时缺少 og:image。
const OG_IMAGE = "/images/favicon.png";
export const SITE = {
  baseURL: "https://wenliang844.github.io",
  title: "CWLBlog",
  // 列表页顶部"X 类主题"统计值（与文章数解耦，手工维护）。
  systems: 6,
  // OG 图经存在性检测后的最终路径（不存在则为 null，模板据此降级为文字卡）。
  ogImage: existsSync(join(HERE, "..", OG_IMAGE.replace(/^\//, ""))) ? OG_IMAGE : null,
};

// sitemap 中需要列出的静态页（文章 URL 由构建脚本动态插入到 /post/ 之后）。
// withDate=false 的页面不输出 lastmod，对齐现有 sitemap。
export const STATIC_PAGES = [
  { path: "/", withDate: true, priority: "1.0", smoke: true, mobileSmoke: true },
  { path: "/about/", withDate: true, priority: "0.6" },
  { path: "/post/", withDate: true, insertPostsAfter: true, priority: "0.6", smoke: true, mobileSmoke: true },
  { path: "/tools/", withDate: true, priority: "0.6", smoke: true, mobileSmoke: true },
  { path: "/editor/", withDate: true, priority: "0.6" },
  { path: "/overleaf/", withDate: true, priority: "0.6" },
  { path: "/contact/", withDate: true, priority: "0.6", smoke: true },
  { path: "/ai/", withDate: true, priority: "0.6", smoke: true },
  { path: "/trust/", withDate: true, priority: "0.5", smoke: true, mobileSmoke: true },
  { path: "/appreciation/", withDate: true, priority: "0.6" },
  { path: "/sponsor/", withDate: true, priority: "0.6" },
  { path: "/categories/", withDate: false, priority: "0.6" },
  { path: "/tags/", withDate: true, priority: "0.6" },
];

export const SMOKE_ROUTES = STATIC_PAGES.filter((page) => page.smoke).map((page) => page.path);
export const MOBILE_SMOKE_ROUTES = STATIC_PAGES.filter((page) => page.mobileSmoke).map((page) => page.path);
export const FULL_SMOKE_ROUTES = STATIC_PAGES.map((page) => page.path);
export const ERROR_SMOKE_ROUTES = ["/404.html"];

// 全局搜索索引中额外包含的静态页（文章页由构建脚本动态生成）。
export const SEARCH_PAGES = [
  {
    title: "关于",
    summary: "CWL 的个人经历、技术栈、项目背景和联系方式入口。",
    path: "/about/",
    tags: ["关于", "CWL", "经历", "技术栈"],
    i18n: { en: { title: "About", summary: "CWL profile, technical stack, project background and contact entry.", tags: ["About", "CWL", "Profile", "Tech Stack"] } },
  },
  {
    title: "留言反馈",
    summary: "关于 CWL、联系方式与留言反馈。",
    path: "/contact/",
    tags: ["联系", "反馈", "关于"],
    i18n: { en: { title: "Contact & Feedback", summary: "About CWL, contact links and feedback.", tags: ["Contact", "Feedback", "About"] } },
  },
  {
    title: "中转站排名",
    summary: "中转站排行榜与常用 AI 网站导航，支持快速对比 AI 中转站路由、模型、健康状态、成功率和响应耗时。",
    path: "/ai/",
    tags: ["AI", "中转站", "排名", "导航"],
    i18n: { en: { title: "Relay Ranking", summary: "Relay ranking plus a categorized directory of frequently used AI websites and tools.", tags: ["AI", "Relay", "Ranking", "Navigation"] } },
    searchSections: [
      {
        title: "中转站排行榜",
        summary: "按健康状态、成功率、响应速度和数据新鲜度对 AI 中转站路由进行评分与筛选。",
        body: "中转站排行榜支持按 ChatGPT 格式、Claude 格式、可用状态、异常状态和关键词筛选，适合快速比较路由健康状态、成功率、响应耗时和当前使用情况。",
        path: "/ai/#relay",
        tags: ["AI", "中转站", "评分", "筛选"],
        i18n: { en: { title: "Relay Ranking", summary: "Score and filter AI relay routes by health, success rate, latency and freshness.", body: "Relay ranking supports format, health and keyword filters for comparing route health, success rate, latency and current usage.", path: "/ai/#relay", tags: ["AI", "Relay", "Score", "Filter"] } },
      },
      {
        title: "AI 导航网站",
        summary: "按对话搜索、编程开发、创作设计、效率知识库和国产模型分类整理常用 AI 工具。",
        body: "AI 导航网站覆盖 ChatGPT、Claude、Gemini、Perplexity、Codex、Cursor、Copilot、DeepSeek、Kimi、豆包、通义千问等常用入口。",
        path: "/ai/#nav",
        tags: ["AI", "工具", "导航", "Codex", "DeepSeek"],
        i18n: { en: { title: "AI Websites", summary: "AI tools grouped by chat, coding, creation, productivity and Chinese models.", body: "AI websites include ChatGPT, Claude, Gemini, Perplexity, Codex, Cursor, Copilot, DeepSeek, Kimi and other common entries.", path: "/ai/#nav", tags: ["AI", "Tools", "Navigation", "Codex", "DeepSeek"] } },
      },
    ],
  },
  {
    title: "AI导航网站",
    summary: "常用 AI 网站和 AI 工具导航，按对话搜索、编程开发、创作设计、效率知识与国产模型分类整理。",
    path: "/ai/#nav",
    tags: ["AI", "工具", "导航"],
    i18n: { en: { title: "AI Websites", summary: "A categorized directory of frequently used AI websites and tools.", tags: ["AI", "Tools", "Navigation"] } },
  },
  {
    title: "隐私与信任",
    summary: "本站本机数据、第三方服务、AI 助手、工具箱、订阅、评论和反馈的数据流说明。",
    path: "/trust/",
    tags: ["隐私", "信任", "数据", "安全", "第三方服务"],
    i18n: { en: { title: "Privacy & Trust", summary: "How local data, third-party services, the AI assistant, toolbox, subscriptions, comments and feedback behave on this site.", tags: ["Privacy", "Trust", "Data", "Security", "Third-party services"] } },
    searchSections: [
      {
        title: "保存在本机的数据",
        summary: "说明主题语言、工具草稿、搜索缓存、订阅状态和反馈草稿等浏览器本地记录。",
        body: "本站优先把偏好、工具草稿、搜索缓存和反馈草稿保存在当前浏览器配置中，用户可以通过浏览器站点数据或页面控件清理。",
        path: "/trust/#trust-local-title",
        tags: ["隐私", "本机数据", "localStorage", "缓存"],
        i18n: { en: { title: "Data stored in this browser", summary: "Local records such as language, tool drafts, search cache, subscription state and feedback drafts.", body: "The site keeps preferences, tool drafts, search cache and feedback drafts in this browser profile, with user controls for clearing them.", path: "/trust/#trust-local-title", tags: ["Privacy", "Local data", "localStorage", "Cache"] } },
      },
      {
        title: "可能连接外部服务的场景",
        summary: "列出订阅、评论、赞助、在线反馈、手势资源和 AI 助手可能访问的第三方服务。",
        body: "第三方服务清单覆盖 Giscus、EmailJS、GitHub Pages、jsDelivr、Google Storage、爱发电、PayPal 等外部请求触发场景和用户控制方式。",
        path: "/trust/#trust-services-title",
        tags: ["第三方服务", "Giscus", "EmailJS", "CDN", "赞助"],
        i18n: { en: { title: "When external services may be contacted", summary: "Third-party services used by subscriptions, comments, sponsor links, feedback, gesture assets and assistant features.", body: "The third-party service list covers Giscus, EmailJS, GitHub Pages, jsDelivr, Google Storage, Afdian, PayPal and related user controls.", path: "/trust/#trust-services-title", tags: ["Third-party services", "Giscus", "EmailJS", "CDN", "Sponsor"] } },
      },
      {
        title: "安全说明",
        summary: "概述 CSP、安全边界、本机处理、外链隔离和用户可清理的数据控制。",
        body: "安全说明解释内容安全策略、第三方脚本边界、工具箱本地处理、外链 noopener 隔离，以及隐私或安全问题反馈入口。",
        path: "/trust/#trust-security-title",
        tags: ["安全", "CSP", "本地处理", "反馈"],
        i18n: { en: { title: "Security notes", summary: "Security posture covering CSP, local processing, external link isolation and user data controls.", body: "Security notes explain content security policy, third-party script boundaries, browser-only tools, noopener links and the reporting path for concerns.", path: "/trust/#trust-security-title", tags: ["Security", "CSP", "Local processing", "Feedback"] } },
      },
    ],
  },
  {
    title: "在线工具箱",
    summary: "浏览器本地运行的开发工具箱：JSON、时间戳、编码、哈希、密码、颜色、正则、Markdown 编辑器、Diff、Cron、二维码、YAML、URL 解析、JSONPath、文本处理等工具。",
    path: "/tools/",
    tags: ["工具", "JSON", "时间戳", "Base64", "URL", "UUID", "JWT", "哈希", "密码", "颜色", "正则", "Markdown", "编辑器", "Diff", "Cron", "二维码", "YAML", "JSONPath", "文本处理", "随机数"],
    i18n: { en: { title: "Toolbox", summary: "Browser-only developer toolbox for JSON, timestamps, encoders, hashes, passwords, colors, regex, Markdown editor, diff, cron, QR, YAML, URL parsing, JSONPath and text tools.", tags: ["Tool", "JSON", "Timestamp", "Base64", "URL", "UUID", "JWT", "Hash", "Password", "Color", "Regex", "Markdown", "Editor", "Diff", "Cron", "QR", "YAML", "JSONPath", "Text", "Random"] } },
    searchSections: [
      {
        title: "JSON 格式化",
        summary: "格式化、压缩和校验 JSON 文本，并支持复制处理结果。",
        body: "JSON 格式化工具可在浏览器本地格式化、压缩、校验 JSON 文本，适合快速整理接口响应和配置片段。",
        path: "/tools/#tool-tab-json",
        tags: ["工具", "JSON", "格式化", "压缩"],
        i18n: { en: { title: "JSON Formatter", summary: "Format, minify and validate JSON text with copyable output.", body: "The JSON formatter runs locally in the browser to format, minify and validate API responses or config snippets.", path: "/tools/#tool-tab-json", tags: ["Tool", "JSON", "Format", "Minify"] } },
      },
      {
        title: "在线 API 测试器",
        summary: "输入 URL、Method、Header 和 Body 发起请求，并可保存接口调试历史。",
        body: "在线 API 测试器支持 GET、POST、PUT、PATCH、DELETE、HEAD，请求头、请求体、响应结果、历史记录和中转站配置填入。",
        path: "/tools/#tool-tab-api",
        tags: ["工具", "API", "接口", "中转站"],
        i18n: { en: { title: "Mini API Tester", summary: "Send requests with URL, method, headers and body, then save request history.", body: "The Mini API Tester supports common HTTP methods, headers, bodies, responses, history and relay preset filling.", path: "/tools/#tool-tab-api", tags: ["Tool", "API", "HTTP", "Relay"] } },
      },
      {
        title: "Cron 解析",
        summary: "解析 5 段 Cron 表达式并预测后续执行时间。",
        body: "Cron 解析工具可以解释 5 段表达式，预览后续运行时间，适合检查定时任务、周计划和批处理调度。",
        path: "/tools/#tool-tab-cron",
        tags: ["工具", "Cron", "定时任务", "调度"],
        i18n: { en: { title: "Cron Parser", summary: "Parse 5-field cron expressions and preview next run times.", body: "The Cron parser explains 5-field expressions and previews upcoming runs for scheduled jobs and batch workflows.", path: "/tools/#tool-tab-cron", tags: ["Tool", "Cron", "Schedule", "Jobs"] } },
      },
      {
        title: "JSONPath 查询",
        summary: "用轻量路径表达式查询 JSON 数据。",
        body: "JSONPath 查询工具支持对 JSON 文档执行轻量路径查询，方便定位数组、对象字段和嵌套结构。",
        path: "/tools/#tool-tab-jsonpath",
        tags: ["工具", "JSONPath", "JSON", "查询"],
        i18n: { en: { title: "JSONPath Query", summary: "Query JSON data with lightweight path expressions.", body: "JSONPath Query helps locate arrays, object fields and nested structures inside JSON documents.", path: "/tools/#tool-tab-jsonpath", tags: ["Tool", "JSONPath", "JSON", "Query"] } },
      },
      {
        title: "Markdown 编辑器",
        summary: "在线编辑 Markdown，实时预览、自动保存，并可导出 Markdown 或 HTML。",
        body: "Markdown 编辑器提供实时预览、自动保存、Markdown 导出和 HTML 导出，适合临时写作和格式校验。",
        path: "/tools/#tool-tab-markdown",
        tags: ["工具", "Markdown", "编辑器", "预览"],
        i18n: { en: { title: "Markdown Editor", summary: "Edit Markdown with live preview, auto-save and export to Markdown or HTML.", body: "The Markdown editor provides live preview, auto-save and Markdown or HTML export for quick writing and format checks.", path: "/tools/#tool-tab-markdown", tags: ["Tool", "Markdown", "Editor", "Preview"] } },
      },
      {
        title: "星河",
        summary: "可交互的星河粒子画布，支持主题、星量、速度和鼠标引力切换。",
        body: "星河工具提供本地 canvas 粒子动画，可切换主题、星量、速度和吸引/排斥交互模式。",
        path: "/tools/#tool-tab-galaxy",
        tags: ["工具", "星河", "Galaxy", "Canvas", "动效"],
        i18n: { en: { title: "Galaxy", summary: "Interactive galaxy canvas with themes, star density, speed and pointer gravity controls.", body: "Galaxy is a local canvas particle animation with theme, density, speed and attract or repel interaction controls.", path: "/tools/#tool-tab-galaxy", tags: ["Tool", "Galaxy", "Canvas", "Animation"] } },
      },
    ],
  },
  {
    title: "Editor",
    summary: "在线 Markdown 编辑器，实时预览与自动保存。",
    path: "/editor/",
    tags: ["工具"],
    i18n: { en: { title: "Editor", summary: "Online Markdown editor with live preview and auto-save.", tags: ["Tool"] } },
  },
  {
    title: "Overleaf",
    summary: "Overleaf 风格多格式简历模板，支持 LaTeX、Markdown、moderncv、HTML 源码与预览双向编辑、PDF 下载。",
    path: "/overleaf/",
    tags: ["工具", "简历", "LaTeX", "Markdown", "HTML"],
    i18n: { en: { title: "Overleaf", summary: "Overleaf-style multi-format resume template with LaTeX, Markdown, moderncv and HTML source/preview editing plus PDF download.", tags: ["Tool", "Resume", "LaTeX", "Markdown", "HTML"] } },
  },
  {
    title: "鉴赏",
    summary: "个人鉴赏榜单：科技研究、影视作品、娱乐项目、食物、顿悟与座右铭排行榜。",
    path: "/appreciation/",
    tags: ["鉴赏", "榜单", "影视", "食物", "顿悟", "座右铭"],
    i18n: { en: { title: "Appreciation", summary: "A personal appreciation board: tech, film & TV, joys of life, food, realizations and mottos ranked side by side.", tags: ["Appreciation", "Ranking", "Film & TV", "Food", "Realizations", "Mottos"] } },
  },
  {
    title: "Sponsor",
    summary: "支持 CWLBlog 持续更新，可通过爱发电、PayPal 或国内扫码赞助。",
    path: "/sponsor/",
    tags: ["赞助", "支持"],
    i18n: { en: { title: "Sponsor", summary: "Support CWLBlog via Afdian, PayPal or domestic scan payments.", tags: ["Sponsor", "Support"] } },
  },
  {
    title: "时间归档",
    summary: "按年份浏览项目复盘文章。",
    path: "/categories/",
    tags: ["归档", "时间线"],
    i18n: { en: { title: "Time Archive", summary: "Browse project retrospectives by year.", tags: ["Archive", "Timeline"] } },
  },
  {
    title: "Tags",
    summary: "按技术标签浏览博客文章。",
    path: "/tags/",
    tags: ["标签"],
    i18n: { en: { title: "Tags", summary: "Browse blog posts by technical topic tag.", tags: ["Tags"] } },
  },
];
