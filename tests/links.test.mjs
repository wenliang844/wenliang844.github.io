import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import assert from "node:assert/strict";

const ROOT = join(import.meta.dirname, "..");
const execFileAsync = promisify(execFile);

function targetForHref(href) {
  if (!href.startsWith("/") || href.startsWith("//")) {
    return null;
  }

  const path = href.split(/[?#]/)[0];
  if (!path || path === "/") {
    return "index.html";
  }
  if (path.endsWith("/")) {
    return join(path.slice(1), "index.html");
  }
  return path.slice(1);
}

async function exists(relPath) {
  try {
    await access(join(ROOT, relPath));
    return true;
  } catch {
    return false;
  }
}

async function htmlFiles() {
  const { stdout } = await execFileAsync("git", ["ls-files", "*.html"], {
    cwd: ROOT,
    windowsHide: true,
  });
  return stdout.trim().split(/\r?\n/).filter(Boolean);
}

test("committed HTML files do not contain broken root-relative links", async () => {
  const broken = [];

  for (const file of await htmlFiles()) {
    const html = await readFile(join(ROOT, file), "utf8");
    for (const match of html.matchAll(/\bhref="([^"]+)"/g)) {
      const target = targetForHref(match[1]);
      if (target && !(await exists(target))) {
        broken.push(`${file}: ${match[1]} -> ${target}`);
      }
    }
  }

  assert.deepEqual(broken, []);
});

test("HTML files load common scripts in a consistent order", async () => {
  const required = [
    "/js/error-handler.js",
    "/js/utils.js",
    "/js/i18n.js",
    "/js/coder.js",
    "/js/search-loader.js",
  ];
  const failures = [];

  for (const file of await htmlFiles()) {
    const html = await readFile(join(ROOT, file), "utf8");
    const positions = required.map((src) => html.indexOf(`src="${src}"`));
    positions.forEach((pos, index) => {
      if (pos === -1) {
        failures.push(`${file}: missing ${required[index]}`);
      }
    });
    for (let i = 1; i < positions.length; i += 1) {
      if (positions[i - 1] !== -1 && positions[i] !== -1 && positions[i - 1] > positions[i]) {
        failures.push(`${file}: ${required[i - 1]} must load before ${required[i]}`);
      }
    }
    if (html.includes('class="navigation-list"') && !html.includes('class="nav-search-trigger"')) {
      failures.push(`${file}: missing global search trigger`);
    }
  }

  assert.deepEqual(failures, []);
});
