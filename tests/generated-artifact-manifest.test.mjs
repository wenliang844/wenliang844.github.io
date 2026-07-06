import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  artifactOwnershipForPath,
  dynamicPostPaths,
  exactGeneratedPaths,
  manualHtmlPaths,
  manualStaticPaths,
  staticBuildOutputs,
  validateGeneratedArtifactManifest,
} from "../scripts/check-generated-artifact-manifest.mjs";

async function manifest() {
  return JSON.parse(await readFile("data/generated-artifact-manifest.json", "utf8"));
}

test("generated artifact manifest classifies build outputs and manual pages", async () => {
  const data = await manifest();
  const generated = exactGeneratedPaths(data);
  const manual = manualHtmlPaths(data);
  const manualStatic = manualStaticPaths(data);
  const posts = await dynamicPostPaths(data);

  assert.ok(generated.has("post/index.html"));
  assert.ok(generated.has("search-index.json"));
  assert.ok(generated.has("service-worker.js"));
  assert.ok(manual.has("index.html"));
  assert.ok(manual.has("404.html"));
  assert.ok(manualStatic.has("manifest.webmanifest"));
  assert.ok(posts.has("post/manage-system/index.html"));
  assert.ok(posts.has("post/rule-engine-alerts/index.html"));
});

test("generated artifact manifest classifies PWA precache resource ownership", async () => {
  const data = await manifest();

  assert.deepEqual(await artifactOwnershipForPath(data, "manifest.webmanifest"), {
    type: "manual-static",
    owner: "manual-static-file",
  });
  assert.deepEqual(await artifactOwnershipForPath(data, "css/coder.css"), {
    type: "copied-asset",
    owner: "css",
  });
  assert.deepEqual(await artifactOwnershipForPath(data, "offline.html"), {
    type: "manual-html",
    owner: "manual-static-page",
  });
  assert.equal(await artifactOwnershipForPath(data, "temp/unmanaged.txt"), null);
});

test("generated artifact manifest stays aligned with build script ownership", async () => {
  const data = await manifest();
  const buildOutputs = await staticBuildOutputs();

  assert.ok(buildOutputs.has("tools/index.html"));
  assert.ok(buildOutputs.has("service-worker.js"));
  assert.deepEqual(await validateGeneratedArtifactManifest(data), []);
});

test("generated artifact manifest reports missing ownership metadata", async () => {
  const data = await manifest();
  const broken = {
    ...data,
    generated: {
      ...data.generated,
      exactOutputs: data.generated.exactOutputs.filter((entry) => entry.path !== "tools/index.html"),
    },
  };

  const errors = await validateGeneratedArtifactManifest(broken);
  assert.ok(errors.includes("Build output is missing from generated.exactOutputs: tools/index.html"));
});
