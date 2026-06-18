// 独立校验 Markdown 文章 front matter，不生成站点产物。

import { readdir, readFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

import {
  normalizeCover,
  normalizeDate,
  normalizeModifiedDate,
  validatePost,
  validateSlug,
  validateUniqueSlug,
} from "./build.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DEFAULT_POSTS_DIR = join(ROOT, "src", "posts");
const PUBLIC_CONTENT_MARKER = /\b(TODO|FIXME|HACK|XXX|SECRET|PASSWORD|PRIVATE_KEY|API_KEY|TOKEN)\b/i;

function parseFrontMatter(raw, file) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    throw new Error("Missing front matter block.");
  }
  return {
    data: parseYaml(match[1]) || {},
    content: raw.slice(match[0].length),
  };
}

function resolvePostsDir(args = process.argv.slice(2)) {
  const index = args.indexOf("--posts-dir");
  if (index === -1) {
    return DEFAULT_POSTS_DIR;
  }

  const dirArg = args[index + 1];
  if (!dirArg || dirArg.startsWith("--")) {
    throw new Error("缺少 --posts-dir <dir> 参数。");
  }

  const postsDir = resolve(ROOT, dirArg);
  const rel = relative(ROOT, postsDir);
  if (rel && (rel.startsWith("..") || isAbsolute(rel))) {
    throw new Error(`--posts-dir 只能指向项目内目录：${dirArg}`);
  }
  return postsDir;
}

function validateTagFields(data, file) {
  if (data.tags && !Array.isArray(data.tags)) {
    throw new Error(`Invalid tags in ${file}: tags must be an array.`);
  }
  if (data.tagsEn && !Array.isArray(data.tagsEn)) {
    throw new Error(`Invalid tagsEn in ${file}: tagsEn must be an array.`);
  }
  if (Array.isArray(data.tags) && Array.isArray(data.tagsEn) && data.tags.length !== data.tagsEn.length) {
    throw new Error(`Invalid tagsEn in ${file}: tagsEn should contain ${data.tags.length} item(s) to match tags.`);
  }
}

function validatePublicContent(raw, file) {
  const lines = raw.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    const match = line.match(PUBLIC_CONTENT_MARKER);
    if (match) {
      throw new Error(`Public content marker "${match[1]}" found in ${file}:${index + 1}.`);
    }
  }
}

export async function validatePosts(postsDir = DEFAULT_POSTS_DIR) {
  const files = (await readdir(postsDir)).filter((file) => file.endsWith(".md")).sort();
  const errors = [];
  const warnings = [];
  const seenSlugs = new Map();

  if (files.length === 0) {
    errors.push("No Markdown posts found.");
  }

  for (const file of files) {
    try {
      const raw = await readFile(join(postsDir, file), "utf8");
      if (!raw.trim()) {
        throw new Error("File is empty.");
      }
      validatePublicContent(raw, file);

      const { data, content } = parseFrontMatter(raw, file);
      validatePost(data, file);
      validateTagFields(data, file);

      const slug = data.slug || file.replace(/\.md$/, "");
      validateSlug(slug, file);
      validateUniqueSlug(slug, file, seenSlugs);

      const date = normalizeDate(data.date);
      normalizeModifiedDate(data.modified, date, file);
      normalizeCover(data.cover, file);

      if (!content.trim()) {
        warnings.push(`${file}: Content body is empty.`);
      }
    } catch (error) {
      errors.push(`${file}: ${error.message}`);
    }
  }

  return { files, errors, warnings };
}

async function main() {
  const postsDir = resolvePostsDir();
  const result = await validatePosts(postsDir);

  if (result.errors.length > 0) {
    console.error("\n❌ Post validation failed:");
    result.errors.forEach((error) => console.error(`  - ${error}`));
    process.exitCode = 1;
    return;
  }

  if (result.warnings.length > 0) {
    console.warn("\n⚠ Post validation warnings:");
    result.warnings.forEach((warning) => console.warn(`  - ${warning}`));
  }

  console.log(`✓ Post front matter valid: ${result.files.length} file(s) checked.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
