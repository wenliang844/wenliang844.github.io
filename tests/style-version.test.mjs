import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { versionStylesheets } from "../scripts/build-styles.mjs";

const ROOT = join(import.meta.dirname, "..");

async function fixture(t) {
  await mkdir(join(ROOT, ".run"), { recursive: true });
  const root = await mkdtemp(join(ROOT, ".run", "style-version-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "css"));
  await writeFile(join(root, "css", "coder-home.min.css"), ".honor-photo-image{height:280px}\n");
  return root;
}

test("homepage CSS uses a stable content version and changes its URL after a style update", async (t) => {
  const root = await fixture(t);
  const html = '<link rel="stylesheet" href="https://example.com/theme.css">\r\n<link rel="stylesheet" href="/css/coder-home.min.css">\r\n<main>Keep homepage content</main>';
  const path = join(root, "index.html");
  await writeFile(path, html);
  assert.equal(await versionStylesheets(root), 1);
  const first = (await readFile(path, "utf8")).match(/\?v=([a-f0-9]+)/)[1];
  assert.match(first, /^[a-f0-9]{12}$/);
  const expected = html.replace('/css/coder-home.min.css"', `/css/coder-home.min.css?v=${first}"`);
  assert.equal(await readFile(path, "utf8"), expected);
  assert.equal(await versionStylesheets(root), 0);
  assert.equal(await readFile(path, "utf8"), expected);
  await writeFile(join(root, "css", "coder-home.min.css"), ".honor-photo-image{height:220px}\n");
  await versionStylesheets(root);
  const changed = (await readFile(path, "utf8")).match(/\?v=([a-f0-9]+)/)[1];
  assert.notEqual(changed, first);
  assert.equal(await readFile(path, "utf8"), expected.replace(first, changed));
});

test("stylesheet versions cover nested published routes while excluding offline and temporary HTML", async (t) => {
  const root = await fixture(t);
  const html = '<link href="/css/coder-home.min.css?v=old&amp;legacy=1" rel="stylesheet">';
  for (const directory of ["post/example", ".run", "src"]) await mkdir(join(root, directory), { recursive: true });
  const published = ["index.html", "404.html", "post/index.html", "post/example/index.html"];
  const excluded = ["offline.html", ".run/preview.html", "src/template.html"];
  for (const path of [...published, ...excluded]) await writeFile(join(root, path), html);
  assert.equal(await versionStylesheets(root), published.length);
  const output = await readFile(join(root, "index.html"), "utf8");
  assert.match(output, /coder-home\.min\.css\?v=[a-f0-9]{12}"/);
  assert.doesNotMatch(output, /old|legacy/);
  for (const path of published) assert.equal(await readFile(join(root, path), "utf8"), output);
  for (const path of excluded) assert.equal(await readFile(join(root, path), "utf8"), html);
  await writeFile(join(root, "index.html"), '<link rel="stylesheet" href="/css/missing.css">');
  await assert.rejects(versionStylesheets(root), /ENOENT/);
});
