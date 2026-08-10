import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { build } from "esbuild";

const ROOT = join(import.meta.dirname, "..");
const outfile = join(ROOT, "temp", "knowledge-retrieval-worker.mjs");
await mkdir(join(ROOT, "temp"), { recursive: true });
await build({
  entryPoints: [join(ROOT, "worker", "src", "index.ts")],
  outfile,
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
});
const { lexicalResults, normalizeCitedAnswer } = await import(`${new URL(`file:///${outfile.replace(/\\/g, "/")}`).href}?v=${Date.now()}`);
const dataset = JSON.parse(await readFile(join(ROOT, "knowledge", "chunks.json"), "utf8"));
const cases = JSON.parse(await readFile(join(ROOT, "tests", "fixtures", "knowledge-eval.json"), "utf8"));
const noEvidenceCases = JSON.parse(await readFile(join(ROOT, "tests", "fixtures", "knowledge-no-evidence.json"), "utf8"));

test("offline knowledge evaluation keeps Top-3 recall at or above 90%", (context) => {
  const misses = [];
  for (const item of cases) {
    const slugs = lexicalResults(item.question, dataset.chunks).slice(0, 3).map((entry) => entry.chunk.documentId);
    if (!slugs.includes(item.expected)) misses.push({ ...item, actual: slugs });
  }
  const recall = (cases.length - misses.length) / cases.length;
  context.diagnostic(`Top-3 recall: ${(recall * 100).toFixed(1)}% (${cases.length - misses.length}/${cases.length})`);
  assert.ok(recall >= 0.9, `top-3 recall ${(recall * 100).toFixed(1)}% is below 90%: ${JSON.stringify(misses)}`);
  assert.deepEqual(new Set(cases.map((item) => item.expected)), new Set(dataset.documents.map((document) => document.id)), "evaluation set must cover every published document");
});

test("offline no-evidence questions stay below the lexical grounding threshold", (context) => {
  const falsePositives = noEvidenceCases.map((question) => {
    const first = lexicalResults(question, dataset.chunks)[0];
    return { question, score: first?.score || 0, documentId: first?.chunk.documentId || "" };
  }).filter((item) => item.score >= 2);
  const rejectionRate = (noEvidenceCases.length - falsePositives.length) / noEvidenceCases.length;
  context.diagnostic(`No-evidence rejection: ${(rejectionRate * 100).toFixed(1)}% (${noEvidenceCases.length - falsePositives.length}/${noEvidenceCases.length})`);
  assert.ok(rejectionRate >= 0.9, `no-evidence rejection ${(rejectionRate * 100).toFixed(1)}% is below 90%: ${JSON.stringify(falsePositives)}`);
});

test("knowledge answers expose only citation indexes backed by returned sources", () => {
  assert.equal(normalizeCitedAnswer({ response: "缓存减少数据库往返。[2] [99]" }, 3), "缓存减少数据库往返。[2]");
  assert.equal(normalizeCitedAnswer({ response: "缓存减少数据库往返。[99]" }, 3), "缓存减少数据库往返。 [1]");
  assert.equal(normalizeCitedAnswer({ response: "没有足够依据回答。[99]" }, 3), "没有足够依据回答。");
  assert.equal(normalizeCitedAnswer({ response: "无来源" }, 0), "无来源");
});

test("knowledge artifact contains only published posts and bounded source paths", () => {
  assert.equal(dataset.version, 1);
  assert.match(dataset.datasetHash, /^[a-f0-9]{64}$/);
  assert.ok(dataset.chunks.length > dataset.documents.length);
  assert.ok(dataset.chunks.every((chunk) => /^\/post\/[A-Za-z0-9_-]+\/$/.test(chunk.path)));
  assert.ok(dataset.chunks.every((chunk) => chunk.text.length >= 40 && chunk.text.length <= 1100));
  assert.equal(new Set(dataset.documents.map((document) => document.id)).size, 6);
});
