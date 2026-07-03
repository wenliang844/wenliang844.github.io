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
  assert.equal(packageJson.engines.node, "20 || >=22");
  assert.equal(
    packageJson.scripts["test:coverage"],
    "node --test --experimental-test-coverage --test-coverage-lines=90 --test-coverage-branches=70 --test-coverage-functions=85 tests/*.test.mjs",
  );
  assert.equal(packageJson.scripts["test:browser-smoke"], "npx --yes --package=playwright node scripts/browser-smoke.mjs");
  assert.equal(packageJson.scripts["test:http-smoke"], "node scripts/http-smoke.mjs");
  assert.equal(packageJson.scripts["quality:baseline"], "node scripts/write-quality-baseline.mjs");

  [
    "npm ci",
    "npm run lint:check",
    "npm test",
    "npm run validate:posts",
    "npm run build",
    "npm run test:http-smoke",
    "npm run validate:production",
    "npm run test:coverage",
    "npm audit --audit-level=moderate --registry=https://registry.npmjs.org",
  ].forEach((command) => {
    assert.ok(steps.some((step) => step.run === command), `${command} should run in CI`);
  });

  assert.equal(packageJson.scripts["lint:check"], "eslint js/*.js");
  assert.equal(packageJson.scripts["validate:posts"], "node scripts/validate-posts.mjs");
  assert.match(packageJson.scripts.validate, /npm run validate:posts/);
  assert.ok(
    steps.findIndex((step) => step.run === "npm run build") <
      steps.findIndex((step) => step.run === "npm run test:http-smoke"),
    "HTTP smoke should run after the committed site is built",
  );
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

test("Dependabot keeps npm and GitHub Actions dependencies current", async () => {
  const config = parse(await readFile(join(ROOT, ".github", "dependabot.yml"), "utf8"));
  const updatesByEcosystem = new Map(config.updates.map((entry) => [entry["package-ecosystem"], entry]));
  const npmUpdates = updatesByEcosystem.get("npm");
  const actionsUpdates = updatesByEcosystem.get("github-actions");

  assert.equal(config.version, 2);
  assert.equal(npmUpdates.directory, "/");
  assert.equal(npmUpdates.schedule.interval, "weekly");
  assert.equal(npmUpdates["open-pull-requests-limit"], 5);
  assert.equal(npmUpdates.groups["dev-dependencies"]["dependency-type"], "development");
  assert.equal(actionsUpdates.directory, "/");
  assert.equal(actionsUpdates.schedule.interval, "weekly");
  assert.equal(actionsUpdates["open-pull-requests-limit"], 5);
});

test("project changelog records dated release history", async () => {
  const readme = await readFile(join(ROOT, "readme.md"), "utf8");
  const changelog = await readFile(join(ROOT, "CHANGELOG.md"), "utf8");
  const productionValidator = await readFile(join(ROOT, "scripts", "validate-production.mjs"), "utf8");

  assert.match(readme, /\[变更日志\]\(CHANGELOG\.md\)/);
  assert.match(changelog, /^# Changelog$/m);
  assert.match(changelog, /^## 2026-06-19$/m);
  assert.match(changelog, /^## 2026-06-18$/m);
  assert.match(changelog, /^### Added$/m);
  assert.match(changelog, /^### Changed$/m);
  assert.match(changelog, /^### Fixed$/m);
  assert.match(changelog, /^### Security$/m);
  assert.match(productionValidator, /'CHANGELOG\.md'/);
});

test("production validator tolerates the full test suite output", async () => {
  const productionValidator = await readFile(join(ROOT, "scripts", "validate-production.mjs"), "utf8");

  assert.match(productionValidator, /TEST_OUTPUT_MAX_BUFFER/);
  assert.match(productionValidator, /maxBuffer:\s*TEST_OUTPUT_MAX_BUFFER/);
});

test("production validator builds into a temporary output directory", async () => {
  const productionValidator = await readFile(join(ROOT, "scripts", "validate-production.mjs"), "utf8");

  assert.match(productionValidator, /BUILD_CHECK_OUT\s*=\s*'temp\/production-validate'/);
  assert.match(productionValidator, /\['scripts\/build\.mjs',\s*'--out',\s*BUILD_CHECK_OUT\]/);
  assert.match(productionValidator, /fileExists\(output,\s*BUILD_CHECK_DIR\)/);
  assert.match(productionValidator, /rm\(BUILD_CHECK_DIR,\s*\{\s*recursive:\s*true,\s*force:\s*true\s*\}\)/);
});

test("HTTP smoke script covers critical public routes and local scripts", async () => {
  const smokeScript = await readFile(join(ROOT, "scripts", "http-smoke.mjs"), "utf8");

  assert.match(smokeScript, /ROUTES\s*=\s*\["\/",\s*"\/tools\/",\s*"\/ai\/",\s*"\/post\/",\s*"\/contact\/",\s*"\/trust\/"\]/);
  assert.match(smokeScript, /main#main-content/);
  assert.match(smokeScript, /is missing an h1/);
  assert.match(smokeScript, /extractLocalScriptSources/);
  assert.match(smokeScript, /method:\s*"HEAD"/);
});

test("browser smoke script covers critical routes, viewports and tool interactions", async () => {
  const smokeScript = await readFile(join(ROOT, "scripts", "browser-smoke.mjs"), "utf8");

  assert.match(smokeScript, /ROUTES\s*=\s*\["\/",\s*"\/tools\/",\s*"\/ai\/",\s*"\/post\/",\s*"\/contact\/",\s*"\/trust\/"\]/);
  assert.match(smokeScript, /name:\s*"desktop"/);
  assert.match(smokeScript, /name:\s*"mobile"/);
  assert.match(smokeScript, /page\.on\("console"/);
  assert.match(smokeScript, /page\.on\("pageerror"/);
  assert.match(smokeScript, /main#main-content/);
  assert.match(smokeScript, /h1:visible/);
  assert.match(smokeScript, /assertNoHorizontalOverflow/);
  assert.match(smokeScript, /assertCanvasHasPixels/);
  assert.match(smokeScript, /data-json-action="format"/);
  assert.match(smokeScript, /random-warning/);
  assert.match(smokeScript, /#galaxy-canvas/);
  assert.match(smokeScript, /data-uuid-generate/);
  assert.match(smokeScript, /STRICT_CLIPBOARD_SMOKE/);
  assert.match(smokeScript, /navigator\.clipboard\.readText/);
  assert.match(smokeScript, /#gesture-start/);
  assert.match(smokeScript, /\.gesture-consent/);
});

test("quality baseline script records commands, coverage and git scope", async () => {
  const packageJson = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8"));
  const baselineScript = await readFile(join(ROOT, "scripts", "write-quality-baseline.mjs"), "utf8");

  assert.equal(packageJson.scripts["quality:baseline"], "node scripts/write-quality-baseline.mjs");
  assert.match(baselineScript, /docs\/suggestions\/evidence\/current-quality-baseline\.json/);
  assert.match(baselineScript, /git",\s*\["status",\s*"--porcelain",\s*"--untracked-files=all"\]/);
  assert.match(baselineScript, /untrackedFileCount/);
  assert.match(baselineScript, /untrackedFiles/);
  assert.match(baselineScript, /npm",\s*args:\s*\["run",\s*"lint:check"\]/);
  assert.match(baselineScript, /npm",\s*args:\s*\["test"\]/);
  assert.match(baselineScript, /npm",\s*args:\s*\["run",\s*"test:coverage"\]/);
  assert.match(baselineScript, /npm",\s*args:\s*\["run",\s*"test:http-smoke"\]/);
  assert.match(baselineScript, /npm",\s*args:\s*\["run",\s*"test:browser-smoke"\]/);
  assert.match(baselineScript, /npm",\s*args:\s*\["run",\s*"validate:production"\]/);
  assert.match(baselineScript, /function parseCoverageOutput/);
  assert.match(baselineScript, /all files\\s\*\\\|/);
  assert.match(baselineScript, /positionalOutput\s*=\s*argv\.find/);
  assert.match(baselineScript, /scope:\s*"working-tree"/);
});
