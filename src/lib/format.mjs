// 日期格式化工具。所有文章日期以 "YYYY-MM-DD" 字符串提供，
// 这里手工解析，避免 new Date(str) 的时区漂移问题。

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// 固定发布时刻，与现有 RSS / sitemap 保持一致。
const FIXED_TIME = "09:30:00";
const FIXED_TZ = "+0800";

function parts(value) {
  const dateStr = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`Invalid date "${dateStr}". Expected YYYY-MM-DD.`);
  }
  const [y, m, d] = dateStr.split("-").map((n) => Number.parseInt(n, 10));
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    throw new Error(`Invalid date "${dateStr}". Impossible calendar date.`);
  }
  return { y, m, d, dateStr };
}

// "2026-06-16" → 原值，用于 <time datetime> 和 tree 显示。
export function isoDate(dateStr) {
  return parts(dateStr).dateStr;
}

// "2026-06-16" → "June 16, 2026"，用于 article-meta。
export function longDate(dateStr) {
  const { y, m, d } = parts(dateStr);
  return `${MONTHS_LONG[m - 1]} ${d}, ${y}`;
}

// "2026-06-16" → "Tue, 16 Jun 2026 09:30:00 +0800"，用于 RSS pubDate。
export function rfc822(dateStr) {
  const { y, m, d } = parts(dateStr);
  const weekday = WEEKDAYS_SHORT[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const dd = String(d).padStart(2, "0");
  return `${weekday}, ${dd} ${MONTHS_SHORT[m - 1]} ${y} ${FIXED_TIME} ${FIXED_TZ}`;
}

// "2026-06-16" → "2026-06-16T09:30:00+08:00"，用于 sitemap lastmod。
export function sitemapDate(dateStr) {
  return `${parts(dateStr).dateStr}T${FIXED_TIME}+08:00`;
}

// HTML 属性值转义，用于把标题等文本安全放进 data-* / value 等属性。
export function escapeAttr(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// HTML 文本节点转义，用于模板中直接输出用户/文章元数据。
export function escapeHtml(value) {
  return escapeAttr(value).replace(/'/g, "&#39;");
}

// XML 文本/属性转义，用于 RSS 与 sitemap。
export function escapeXml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
