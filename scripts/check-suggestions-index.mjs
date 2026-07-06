#!/usr/bin/env node

import { pathToFileURL } from "node:url";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, normalize, resolve } from "node:path";

const ROOT = process.cwd();
const SUGGESTIONS_DIR = join(ROOT, "docs", "suggestions");
const README_PATH = join(SUGGESTIONS_DIR, "README.md");
const GOVERNANCE_REPORT_PATH = join(SUGGESTIONS_DIR, "evidence", "current-suggestions-governance.json");
const README_INDEX_START = "<!-- suggestions-index:start -->";
const README_INDEX_END = "<!-- suggestions-index:end -->";
const REQUIRED_SUGGESTION_FIELDS = [
  { id: "title", marker: "📌" },
  { id: "location", marker: "📍" },
  { id: "description", marker: "📝" },
  { id: "impact", marker: "⚠️" },
  { id: "solution", marker: "💡" },
  { id: "benefit", marker: "📊" },
  { id: "links", marker: "🔗" },
];
const SUGGESTION_GOVERNANCE_BUDGET = {
  incompleteSuggestionItems: 82,
  missingFieldCounts: {
    title: 0,
    location: 6,
    description: 51,
    impact: 56,
    solution: 55,
    benefit: 15,
    links: 30,
  },
};

function toPosix(path) {
  return path.replace(/\\/g, "/");
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function markdownFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await markdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

function hrefToken(rawHref) {
  let href = rawHref.trim();
  if (href.startsWith("<") && href.endsWith(">")) {
    href = href.slice(1, -1);
  }
  if (!href.startsWith("<")) {
    href = href.split(/\s+/)[0];
  }
  return href;
}

function splitMarkdownHref(rawHref) {
  const href = hrefToken(rawHref);
  const hashIndex = href.indexOf("#");
  return {
    href,
    pathPart: hashIndex >= 0 ? href.slice(0, hashIndex) : href,
    fragment: hashIndex >= 0 ? href.slice(hashIndex + 1) : "",
  };
}

function lineNumberForIndex(text, index) {
  return text.slice(0, index).split("\n").length;
}

function localMarkdownLinks(markdown) {
  const links = [];
  const linkPattern = /!?\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of markdown.matchAll(linkPattern)) {
    const { href, pathPart, fragment } = splitMarkdownHref(match[1]);
    if (
      !href ||
      /^[a-z][a-z0-9+.-]*:/i.test(href) ||
      (!pathPart.includes(".md") && !fragment)
    ) {
      continue;
    }
    links.push({
      href,
      pathPart,
      fragment,
      line: lineNumberForIndex(markdown, match.index || 0),
    });
  }
  return links;
}

function stripInlineMarkdown(text) {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .trim();
}

function firstMarkdownTitle(markdown, fallback) {
  const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/m.exec(markdown);
  return heading ? stripInlineMarkdown(heading[2]) : fallback;
}

function githubHeadingSlug(text) {
  return stripInlineMarkdown(text)
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
}

function uniqueAnchor(base, seen) {
  const count = seen.get(base) || 0;
  seen.set(base, count + 1);
  return count === 0 ? base : `${base}-${count}`;
}

function markdownAnchors(markdown) {
  const anchors = new Set();
  const seen = new Map();
  const headingPattern = /^(#{1,6})\s+(.+?)\s*#*\s*$/gm;
  for (const match of markdown.matchAll(headingPattern)) {
    const heading = match[2].replace(/\s+\{#[-\w\u4e00-\u9fff]+\}\s*$/, "");
    const explicitId = /\s+\{#([-\w\u4e00-\u9fff]+)\}\s*$/.exec(match[2])?.[1];
    if (explicitId) {
      anchors.add(explicitId);
    }
    const slug = githubHeadingSlug(heading);
    if (slug) {
      anchors.add(uniqueAnchor(slug, seen));
    }
    const suggestionId = /^(?:📌\s*)?([A-Z]+(?:-[A-Z]+)*-\d+)\s*(?:\[[^\]]+\])?\s*[:：]\s*(.+)$/.exec(stripInlineMarkdown(heading));
    if (suggestionId) {
      const id = suggestionId[1].toLowerCase();
      const titleSlug = githubHeadingSlug(suggestionId[2]);
      anchors.add(id);
      if (titleSlug) {
        anchors.add(`${id}-${titleSlug}`);
      }
    }
  }

  const htmlAnchorPattern = /<(?:a|[^>]+\s)(?:[^>]*\s)?(?:id|name)=["']([^"']+)["'][^>]*>/gi;
  for (const match of markdown.matchAll(htmlAnchorPattern)) {
    anchors.add(match[1]);
  }
  return anchors;
}

function decodeFragment(fragment) {
  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment;
  }
}

function suggestionStatus(title) {
  if (/已修复|已完成/.test(title)) {
    return /部分|核心|第一阶段|第二阶段|第三阶段/.test(title) ? "partial" : "fixed";
  }
  if (/部分修复|部分完成|核心风险/.test(title)) {
    return "partial";
  }
  return "open";
}

function suggestionItems(markdown, file = "") {
  const headings = [...markdown.matchAll(/^#{2,3}\s+📌\s+(.+)$/gm)];
  const items = [];
  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const start = heading.index || 0;
    const end = index + 1 < headings.length ? headings[index + 1].index || markdown.length : markdown.length;
    const block = markdown.slice(start, end);
    const missingFields = REQUIRED_SUGGESTION_FIELDS
      .filter((field) => !block.includes(field.marker))
      .map((field) => field.id);
    items.push({
      file,
      line: lineNumberForIndex(markdown, start),
      title: stripInlineMarkdown(heading[1]),
      status: suggestionStatus(heading[1]),
      missingFields,
    });
  }
  return items;
}

async function buildSuggestionsGovernanceReport() {
  const files = await markdownFiles(SUGGESTIONS_DIR);
  const markdownFileEntries = [];
  const allItems = [];
  for (const file of files) {
    const relativePath = toPosix(file).slice(toPosix(SUGGESTIONS_DIR).length + 1);
    if (relativePath === "evidence/current-suggestions-governance.json") {
      continue;
    }
    const markdown = await readFile(file, "utf8");
    const items = suggestionItems(markdown, relativePath);
    markdownFileEntries.push({
      path: relativePath,
      suggestionItems: items.length,
      completeSuggestionItems: items.filter((item) => item.missingFields.length === 0).length,
    });
    allItems.push(...items);
  }

  const statusCounts = { fixed: 0, partial: 0, open: 0 };
  const missingFieldCounts = Object.fromEntries(REQUIRED_SUGGESTION_FIELDS.map((field) => [field.id, 0]));
  const incompleteItems = [];
  for (const item of allItems) {
    statusCounts[item.status] += 1;
    for (const field of item.missingFields) {
      missingFieldCounts[field] += 1;
    }
    if (item.missingFields.length > 0) {
      incompleteItems.push({
        file: item.file,
        line: item.line,
        title: item.title,
        missingFields: item.missingFields,
      });
    }
  }

  return {
    schemaVersion: 2,
    source: "scripts/check-suggestions-index.mjs",
    budget: SUGGESTION_GOVERNANCE_BUDGET,
    markdownFiles: markdownFileEntries.length,
    markdownFilesWithSuggestions: markdownFileEntries.filter((entry) => entry.suggestionItems > 0).length,
    moduleReviewFiles: markdownFileEntries.filter((entry) => entry.path.startsWith("module-reviews/")).length,
    suggestionItems: allItems.length,
    completeSuggestionItems: allItems.filter((item) => item.missingFields.length === 0).length,
    incompleteSuggestionItems: incompleteItems.length,
    statusCounts,
    missingFieldCounts,
    incompleteItems,
  };
}

function formatJson(data) {
  return `${JSON.stringify(data, null, 2)}\n`;
}

function governanceBudgetErrors(report) {
  const errors = [];
  if (report.incompleteSuggestionItems > SUGGESTION_GOVERNANCE_BUDGET.incompleteSuggestionItems) {
    errors.push(
      `Suggestions governance incomplete item budget exceeded: ${report.incompleteSuggestionItems} > ${SUGGESTION_GOVERNANCE_BUDGET.incompleteSuggestionItems}.`,
    );
  }

  for (const [field, budget] of Object.entries(SUGGESTION_GOVERNANCE_BUDGET.missingFieldCounts)) {
    const actual = report.missingFieldCounts?.[field] || 0;
    if (actual > budget) {
      errors.push(`Suggestions governance missing field budget exceeded for ${field}: ${actual} > ${budget}.`);
    }
  }
  return errors;
}

async function validateReadmeIndex(errors) {
  const readme = await readFile(README_PATH, "utf8");
  const expected = await renderReadmeModuleIndex();
  if (!readme.includes(README_INDEX_START) || !readme.includes(README_INDEX_END)) {
    errors.push("README.md is missing suggestions-index generated section markers.");
    return;
  }
  if (replaceReadmeModuleIndex(readme, expected) !== readme) {
    errors.push("README.md module review index is stale. Run npm run generate:suggestions-index.");
  }
}

async function validateGovernanceReport(errors) {
  const report = await buildSuggestionsGovernanceReport();
  errors.push(...governanceBudgetErrors(report));
  const expected = formatJson(report);
  if (!(await exists(GOVERNANCE_REPORT_PATH))) {
    errors.push("Suggestions governance report is missing. Run npm run generate:suggestions-index.");
    return;
  }
  const actual = await readFile(GOVERNANCE_REPORT_PATH, "utf8");
  if (actual !== expected) {
    errors.push("Suggestions governance report is stale. Run npm run generate:suggestions-index.");
  }
}

async function moduleReviewEntries() {
  const moduleDir = join(SUGGESTIONS_DIR, "module-reviews");
  const moduleFiles = (await readdir(moduleDir))
    .filter((file) => file.endsWith(".md"))
    .sort();

  const entries = [];
  for (const file of moduleFiles) {
    const relativePath = `module-reviews/${file}`;
    const markdown = await readFile(join(moduleDir, file), "utf8");
    entries.push({
      title: firstMarkdownTitle(markdown, file.replace(/\.md$/, "")),
      relativePath,
    });
  }
  return entries;
}

async function renderReadmeModuleIndex() {
  const entries = await moduleReviewEntries();
  return entries.map((entry) => `- [${entry.title}](${entry.relativePath})`).join("\n");
}

function replaceReadmeModuleIndex(readme, generatedIndex) {
  const start = readme.indexOf(README_INDEX_START);
  const end = readme.indexOf(README_INDEX_END);
  if (start < 0 || end < 0 || end < start) {
    throw new Error("README.md is missing suggestions-index generated section markers.");
  }
  const before = readme.slice(0, start + README_INDEX_START.length);
  const after = readme.slice(end);
  return `${before}\n${generatedIndex}\n${after}`;
}

async function validateMarkdownLinks(errors) {
  const files = await markdownFiles(SUGGESTIONS_DIR);
  const anchorCache = new Map();

  async function anchorsFor(file) {
    if (!anchorCache.has(file)) {
      anchorCache.set(file, markdownAnchors(await readFile(file, "utf8")));
    }
    return anchorCache.get(file);
  }

  for (const file of files) {
    const markdown = await readFile(file, "utf8");
    for (const link of localMarkdownLinks(markdown)) {
      const target = link.pathPart
        ? normalize(resolve(dirname(file), link.pathPart))
        : file;
      if (!target.startsWith(SUGGESTIONS_DIR) || !(await exists(target))) {
        errors.push(`${toPosix(file)}:${link.line} has broken markdown link: ${link.href}`);
        continue;
      }
      if (link.fragment) {
        const anchors = await anchorsFor(target);
        const fragment = decodeFragment(link.fragment);
        if (!anchors.has(fragment)) {
          errors.push(`${toPosix(file)}:${link.line} has broken markdown anchor: ${link.href}`);
        }
      }
    }
  }
}

async function main() {
  const shouldWrite = process.argv.includes("--write");
  if (shouldWrite) {
    const report = await buildSuggestionsGovernanceReport();
    const budgetErrors = governanceBudgetErrors(report);
    if (budgetErrors.length > 0) {
      console.error("Suggestions governance budget check failed:");
      budgetErrors.forEach((error) => console.error(`- ${error}`));
      process.exitCode = 1;
      return;
    }

    const readme = await readFile(README_PATH, "utf8");
    const updated = replaceReadmeModuleIndex(readme, await renderReadmeModuleIndex());
    if (updated !== readme) {
      await writeFile(README_PATH, updated);
      console.log("Updated README suggestions module index.");
    } else {
      console.log("README suggestions module index is already current.");
    }
    await writeFile(GOVERNANCE_REPORT_PATH, formatJson(report));
    console.log("Updated suggestions governance report.");
    return;
  }

  const errors = [];
  await validateReadmeIndex(errors);
  await validateMarkdownLinks(errors);
  await validateGovernanceReport(errors);

  if (errors.length > 0) {
    console.error("Suggestions index check failed:");
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }

  console.log("Suggestions index covers module reviews, local markdown links, heading anchors and governance stats.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export {
  githubHeadingSlug,
  firstMarkdownTitle,
  buildSuggestionsGovernanceReport,
  formatJson,
  governanceBudgetErrors,
  localMarkdownLinks,
  markdownAnchors,
  replaceReadmeModuleIndex,
  renderReadmeModuleIndex,
  SUGGESTION_GOVERNANCE_BUDGET,
  suggestionItems,
  suggestionStatus,
  splitMarkdownHref,
};
