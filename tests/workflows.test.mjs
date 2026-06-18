import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";

const ROOT = join(import.meta.dirname, "..");

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
