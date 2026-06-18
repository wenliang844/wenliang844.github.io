const READING_SPEED_CHINESE = 350;
const READING_SPEED_ENGLISH = 200;

export function readingMinutes(text) {
  const value = String(text === null || text === undefined ? "" : text);
  const chinese = (value.match(/[一-龥]/g) || []).length;
  const rest = value.replace(/[一-龥]/g, " ").trim();
  const words = rest ? rest.split(/\s+/).length : 0;
  return Math.max(
    1,
    Math.round(chinese / READING_SPEED_CHINESE + words / READING_SPEED_ENGLISH),
  );
}
