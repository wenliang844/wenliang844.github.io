// 站点级配置。
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

// OG 卡片缩略图（站点根相对路径）。仅当文件真实存在时构建才输出 og:image，
// 缺图时分享卡片退化为纯文字（twitter:card=summary），避免卡片图裂。
const OG_IMAGE = "/images/og-cover.png";
export const SITE = {
  baseURL: "https://wenliang844.github.io",
  title: "CWLBlog",
  // 列表页顶部"X 类系统"统计值（与文章数解耦，手工维护）。
  systems: 4,
  // OG 图经存在性检测后的最终路径（不存在则为 null，模板据此降级为文字卡）。
  ogImage: existsSync(join(HERE, "..", OG_IMAGE.replace(/^\//, ""))) ? OG_IMAGE : null,
};

// sitemap 中需要列出的静态页（文章 URL 由构建脚本动态插入到 /post/ 之后）。
// withDate=false 的页面不输出 lastmod，对齐现有 sitemap。
export const STATIC_PAGES = [
  { path: "/", withDate: true, priority: 0 },
  { path: "/post/", withDate: true, insertPostsAfter: true },
  { path: "/editor/", withDate: true },
  { path: "/contact/", withDate: true },
  { path: "/categories/", withDate: false },
  { path: "/tags/", withDate: true },
];

// 全局搜索索引中额外包含的静态页（文章页由构建脚本动态生成）。
export const SEARCH_PAGES = [
  { title: "Contact",     summary: "联系方式与留言反馈。",                                          path: "/contact/",  tags: ["联系"] },
  { title: "Editor",      summary: "在线 Markdown 编辑器，实时预览与自动保存。",                    path: "/editor/",   tags: ["工具"] },
  { title: "Tags",        summary: "按技术标签浏览博客文章。",                                      path: "/tags/",     tags: ["标签"] },
];
