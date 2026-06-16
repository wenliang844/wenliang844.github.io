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

test("committed HTML files do not contain broken root-relative links", async () => {
  const { stdout } = await execFileAsync("git", ["ls-files", "*.html"], {
    cwd: ROOT,
    windowsHide: true,
  });

  const files = stdout.trim().split(/\r?\n/).filter(Boolean);
  const broken = [];

  for (const file of files) {
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
