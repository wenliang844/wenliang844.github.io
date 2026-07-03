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
  },
  {
    title: "在线工具箱",
    summary: "浏览器本地运行的开发工具箱：JSON、时间戳、编码、哈希、密码、颜色、正则、Markdown 编辑器、Diff、Cron、二维码、YAML、URL 解析、JSONPath、文本处理等工具。",
    path: "/tools/",
    tags: ["工具", "JSON", "时间戳", "Base64", "URL", "UUID", "JWT", "哈希", "密码", "颜色", "正则", "Markdown", "编辑器", "Diff", "Cron", "二维码", "YAML", "JSONPath", "文本处理", "随机数"],
    i18n: { en: { title: "Toolbox", summary: "Browser-only developer toolbox for JSON, timestamps, encoders, hashes, passwords, colors, regex, Markdown editor, diff, cron, QR, YAML, URL parsing, JSONPath and text tools.", tags: ["Tool", "JSON", "Timestamp", "Base64", "URL", "UUID", "JWT", "Hash", "Password", "Color", "Regex", "Markdown", "Editor", "Diff", "Cron", "QR", "YAML", "JSONPath", "Text", "Random"] } },
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
