import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { versionServiceWorker } from "../scripts/version-service-worker.mjs";

const ROOT = join(import.meta.dirname, "..");

test("PWA cache version follows public static content and stays idempotent", async () => {
  const tempRoot = join(ROOT, "temp");
  await mkdir(tempRoot, { recursive: true });
  const sandbox = await mkdtemp(join(tempRoot, "pwa-version-"));
  try {
    await mkdir(join(sandbox, "css"));
    await writeFile(join(sandbox, "service-worker.js"), 'const CACHE_PREFIX = "cwlblog-public-";\nconst CACHE_NAME = `${CACHE_PREFIX}old`;\n', "utf8");
    await writeFile(join(sandbox, "css", "content.css"), ".before { color: red; }", "utf8");
    await writeFile(join(sandbox, "offline.html"), "offline", "utf8");

    const first = await versionServiceWorker(sandbox);
    const second = await versionServiceWorker(sandbox);
    assert.equal(first.updated, true);
    assert.equal(second.updated, false);
    assert.equal(second.cacheVersion, first.cacheVersion);

    await writeFile(join(sandbox, "css", "content.css"), ".after { color: blue; }", "utf8");
    const changed = await versionServiceWorker(sandbox);
    assert.notEqual(changed.cacheVersion, first.cacheVersion);
    assert.match(await readFile(join(sandbox, "service-worker.js"), "utf8"), new RegExp(changed.cacheVersion));
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});
