import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";

const ROOT = join(import.meta.dirname, "..");

test("CI workflow runs quality gates without write permissions", async () => {
  const workflow = parse(await readFile(join(ROOT, ".github", "workflows", "ci.yml"), "utf8"));
  const steps = workflow.jobs.quality.steps;
  const stepByName = new Map(steps.map((step) => [step.name, step]));
  const packageJson = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8"));

  assert.deepEqual(workflow.on.push.branches, ["master"]);
  assert.deepEqual(workflow.on.pull_request.branches, ["master"]);
  assert.equal(workflow.permissions.contents, "read");
  assert.equal(workflow.jobs.quality["runs-on"], "ubuntu-latest");
  assert.equal(stepByName.get("Checkout").uses, "actions/checkout@v5");
  assert.equal(stepByName.get("Setup Node.js").uses, "actions/setup-node@v5");
  assert.equal(stepByName.get("Setup Node.js").with["node-version"], 22);
  assert.equal(stepByName.get("Setup Node.js").with.cache, "npm");

  [
    "npm ci",
    "npm run lint:check",
    "npm test",
    "npm run build",
    "npm run validate:production",
    "npm run test:coverage",
    "npm audit --audit-level=moderate --registry=https://registry.npmjs.org",
  ].forEach((command) => {
    assert.ok(steps.some((step) => step.run === command), `${command} should run in CI`);
  });

  assert.equal(packageJson.scripts["lint:check"], "eslint js/*.js");
});

test("commercial relay sync workflow skips safely when source secret is absent", async () => {
  const workflow = parse(await readFile(join(ROOT, ".github", "workflows", "relay-commercial-sync.yml"), "utf8"));
  const steps = workflow.jobs.sync.steps;
  const stepByName = new Map(steps.map((step) => [step.name, step]));

  assert.equal(stepByName.get("Check commercial relay source").if, "${{ env.RELAY_COMMERCIAL_SOURCE_URL == '' }}");
  assert.match(stepByName.get("Check commercial relay source").run, /skipping commercial relay sync/);

  [
    "Setup Node.js",
    "Install dependencies",
    "Sync commercial relay data",
    "Validate relay data",
    "Build site",
    "Commit changes",
  ].forEach((name) => {
    assert.equal(
      stepByName.get(name).if,
      "${{ env.RELAY_COMMERCIAL_SOURCE_URL != '' }}",
      `${name} should be skipped when RELAY_COMMERCIAL_SOURCE_URL is empty`,
    );
  });
});
