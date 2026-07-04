import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { JSDOM } from "jsdom";

const execFileAsync = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SENTINEL = "__CWL_I18N_MISSING__";

const ATTRIBUTE_SPECS = [
  {
    attr: "data-i18n-html",
    selector: "[data-i18n-html]",
    inlineAttrs: ["data-i18n-en-html", "data-i18n-en"],
    key(el) {
      return el.getAttribute("data-i18n-html") || el.getAttribute("data-i18n");
    },
  },
  {
    attr: "data-i18n",
    selector: "[data-i18n]:not([data-i18n-html])",
    inlineAttrs: ["data-i18n-en"],
    key(el) {
      return el.getAttribute("data-i18n");
    },
  },
  {
    attr: "data-i18n-aria",
    selector: "[data-i18n-aria]",
    inlineAttrs: ["data-i18n-en-aria"],
    key(el) {
      return el.getAttribute("data-i18n-aria");
    },
  },
  {
    attr: "data-i18n-ph",
    selector: "[data-i18n-ph]",
    inlineAttrs: ["data-i18n-en-ph"],
    key(el) {
      return el.getAttribute("data-i18n-ph");
    },
  },
  {
    attr: "data-i18n-title",
    selector: "[data-i18n-title]",
    inlineAttrs: ["data-i18n-en-title"],
    key(el) {
      return el.getAttribute("data-i18n-title");
    },
  },
];

function hasInlineEnglish(el, attrs) {
  return attrs.some((attr) => (el.getAttribute(attr) || "").trim());
}

async function listCommittedHtmlFiles(root = ROOT) {
  const { stdout } = await execFileAsync("git", ["ls-files", "*.html"], {
    cwd: root,
    maxBuffer: 1024 * 1024,
  });
  return stdout
    .split(/\r?\n/)
    .map((file) => file.trim())
    .filter(Boolean);
}

async function loadEnglishLookup(root = ROOT) {
  const i18nCode = await readFile(join(root, "js", "i18n.js"), "utf8");
  const dom = new JSDOM("<!doctype html><html><head><title></title></head><body></body></html>", {
    runScripts: "outside-only",
    url: "https://example.test/",
  });

  dom.window.eval(i18nCode);
  dom.window.cwlSetLang("en");

  return function hasEnglishKey(key) {
    return dom.window.cwlT(key, SENTINEL) !== SENTINEL;
  };
}

function collectRequiredKeys(html, file) {
  const dom = new JSDOM(html);
  const { document } = dom.window;
  const entries = [];

  for (const spec of ATTRIBUTE_SPECS) {
    for (const el of document.querySelectorAll(spec.selector)) {
      const key = (spec.key(el) || "").trim();
      if (!key || hasInlineEnglish(el, spec.inlineAttrs)) {
        continue;
      }
      entries.push({ file, key, attr: spec.attr });
    }
  }

  const page = (document.body?.getAttribute("data-i18n-page") || "").trim();
  if (page) {
    if (!(document.body.getAttribute("data-i18n-title-en") || "").trim()) {
      entries.push({ file, key: `head.title.${page}`, attr: "body[data-i18n-page]" });
    }
    if (!(document.body.getAttribute("data-i18n-desc-en") || "").trim()) {
      entries.push({ file, key: `head.desc.${page}`, attr: "body[data-i18n-page]" });
    }
  }

  return entries;
}

async function checkI18nCoverage({ root = ROOT, files } = {}) {
  const htmlFiles = files || await listCommittedHtmlFiles(root);
  const hasEnglishKey = await loadEnglishLookup(root);
  const missing = [];
  const required = [];

  for (const file of htmlFiles) {
    const html = await readFile(join(root, file), "utf8");
    for (const entry of collectRequiredKeys(html, file)) {
      required.push(entry);
      if (!hasEnglishKey(entry.key)) {
        missing.push(entry);
      }
    }
  }

  const uniqueKeys = new Set(required.map((entry) => entry.key));
  return {
    checkedFiles: htmlFiles.length,
    requiredReferences: required.length,
    uniqueRequiredKeys: uniqueKeys.size,
    missing,
  };
}

function formatI18nCoverageReport(result) {
  const header = [
    `i18n coverage checked ${result.checkedFiles} HTML files`,
    `Required key references: ${result.requiredReferences}`,
    `Unique required keys: ${result.uniqueRequiredKeys}`,
    `Missing English keys: ${result.missing.length}`,
  ].join("\n");

  if (result.missing.length === 0) {
    return `${header}\nOK: all required data-i18n keys have English coverage.`;
  }

  const lines = result.missing
    .map((entry) => `${entry.file}: ${entry.key} (${entry.attr})`)
    .sort();
  return `${header}\n\nMissing keys:\n${lines.join("\n")}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const result = await checkI18nCoverage();
    console.log(formatI18nCoverageReport(result));
    if (result.missing.length > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`i18n coverage check failed: ${message}`);
    process.exitCode = 1;
  }
}

export {
  ATTRIBUTE_SPECS,
  checkI18nCoverage,
  collectRequiredKeys,
  formatI18nCoverageReport,
  listCommittedHtmlFiles,
  loadEnglishLookup,
};
