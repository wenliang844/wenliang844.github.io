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
  { path: "/", withDate: true, priority: 0 },
  { path: "/about/", withDate: true },
  { path: "/post/", withDate: true, insertPostsAfter: true },
  { path: "/tools/", withDate: true },
  { path: "/editor/", withDate: true },
  { path: "/overleaf/", withDate: true },
  { path: "/contact/", withDate: true },
  { path: "/ai/", withDate: true },
  { path: "/appreciation/", withDate: true },
  { path: "/sponsor/", withDate: true },
  { path: "/categories/", withDate: false },
  { path: "/tags/", withDate: true },
];

// 全局搜索索引中额外包含的静态页（文章页由构建脚本动态生成）。
export const SEARCH_PAGES = [
  {
    title: "关于",
    summary: "关于 CWL、技术栈、项目经历与博客内容。",
    path: "/about/",
    tags: ["关于"],
    i18n: { en: { title: "About", summary: "About CWL, the tech stack, project experience and the blog.", tags: ["About"] } },
  },
  {
    title: "Contact",
    summary: "联系方式与留言反馈。",
    path: "/contact/",
    tags: ["联系"],
    i18n: { en: { title: "Contact", summary: "Contact links and feedback.", tags: ["Contact"] } },
  },
  {
    title: "AI导航",
    summary: "常用 AI 网站和 AI 工具导航，按对话搜索、编程开发、创作设计、效率知识与国产模型分类整理。",
    path: "/ai/",
    tags: ["AI", "工具", "导航"],
    i18n: { en: { title: "AI Navigation", summary: "A categorized directory of frequently used AI websites and tools.", tags: ["AI", "Tools", "Navigation"] } },
  },
  {
    title: "中转站排行榜",
    summary: "分组展示 LinuxDo 站和商业站 AI 中转站数据，包含路由格式、端点、模型、健康状态、成功率和响应耗时。",
    path: "/ai/#relay",
    tags: ["AI", "中转站", "ChatGPT", "Claude", "OpenAI", "Anthropic"],
    i18n: { en: { title: "Relay Ranking", summary: "Grouped AI relay data for LinuxDo and commercial providers, including route format, endpoint, model, health, success rate and latency.", tags: ["AI", "Relay", "ChatGPT", "Claude", "OpenAI", "Anthropic"] } },
  },
  {
    title: "在线工具箱",
    summary: "浏览器本地运行的开发工具箱：JSON 格式化、时间戳转换、Base64、URL 编解码、UUID 生成器和 JWT 解码。",
    path: "/tools/",
    tags: ["工具", "JSON", "时间戳", "Base64", "URL", "UUID", "JWT"],
    i18n: { en: { title: "Toolbox", summary: "Browser-only developer toolbox for JSON formatting, timestamp conversion, Base64, URL codec, UUID generation and JWT decoding.", tags: ["Tool", "JSON", "Timestamp", "Base64", "URL", "UUID", "JWT"] } },
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
    summary: "个人鉴赏榜单：科技研究、影视作品与娱乐项目三张并列排行榜。",
    path: "/appreciation/",
    tags: ["鉴赏", "榜单", "影视"],
    i18n: { en: { title: "Appreciation", summary: "A personal appreciation board: tech, film & TV and entertainment projects ranked side by side.", tags: ["Appreciation", "Ranking", "Film & TV"] } },
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
