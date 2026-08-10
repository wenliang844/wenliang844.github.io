import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createContentBackup, restoreContentBackup, verifyContentBackup } from "../scripts/backup-content.mjs";

const ROOT = join(import.meta.dirname, "..");

test("content backup creates a checksummed snapshot and restores only into a new directory", async () => {
  const tempRoot = join(ROOT, "temp");
  await mkdir(tempRoot, { recursive: true });
  const sandbox = await mkdtemp(join(tempRoot, "backup-test-"));
  const snapshot = join(sandbox, "snapshot");
  const restored = join(sandbox, "restored");
  try {
    const manifest = await createContentBackup({ root: ROOT, outDir: snapshot, createdAt: "2026-08-10T00:00:00.000Z", revision: "test-revision" });
    assert.equal(manifest.version, 1);
    assert.ok(manifest.files.some((entry) => entry.path === "src/posts/manage-system.md"));
    assert.ok(manifest.files.some((entry) => entry.path === "src/config.mjs"));
    assert.ok(manifest.files.every((entry) => !entry.path.startsWith("images/generated/")));
    assert.deepEqual((await verifyContentBackup(snapshot)).files, manifest.files);

    await restoreContentBackup({ backupDir: snapshot, outDir: restored });
    assert.equal(await readFile(join(restored, "src", "posts", "manage-system.md"), "utf8"), await readFile(join(ROOT, "src", "posts", "manage-system.md"), "utf8"));
    await assert.rejects(restoreContentBackup({ backupDir: snapshot, outDir: restored }), /already exists/);
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});

test("content backup verification rejects tampering and traversal entries", async () => {
  const tempRoot = join(ROOT, "temp");
  await mkdir(tempRoot, { recursive: true });
  const sandbox = await mkdtemp(join(tempRoot, "backup-security-"));
  const snapshot = join(sandbox, "snapshot");
  try {
    await createContentBackup({ root: ROOT, outDir: snapshot });
    await writeFile(join(snapshot, "src", "config.mjs"), "tampered", "utf8");
    await assert.rejects(verifyContentBackup(snapshot), /integrity check failed/);

    const manifestPath = join(snapshot, "backup-manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.files[0].path = "../outside.txt";
    await writeFile(manifestPath, JSON.stringify(manifest), "utf8");
    await assert.rejects(verifyContentBackup(snapshot), /Unsafe backup path/);
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});
