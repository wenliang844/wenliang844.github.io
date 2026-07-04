import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import { ERROR_SMOKE_ROUTES, FULL_SMOKE_ROUTES, MOBILE_SMOKE_ROUTES, SMOKE_ROUTES, STATIC_PAGES } from "../src/config.mjs";

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
  assert.equal(
    packageJson.scripts["test:browser-smoke:full"],
    "npx --yes --package=playwright node scripts/browser-smoke.mjs --scope full",
  );
  assert.equal(packageJson.scripts["test:pwa-smoke"], "npx --yes --package=playwright node scripts/pwa-smoke.mjs");
  assert.equal(packageJson.scripts["test:http-smoke"], "node scripts/http-smoke.mjs");
  assert.equal(packageJson.scripts["test:http-smoke:full"], "node scripts/http-smoke.mjs --scope full");
  assert.equal(packageJson.scripts["quality:baseline"], "node scripts/write-quality-baseline.mjs");
  assert.equal(packageJson.scripts["quality:baseline:clean"], "node scripts/write-quality-baseline.mjs --require-clean");
  assert.equal(packageJson.scripts["check:quality-baseline"], "node scripts/check-quality-baseline.mjs");
  assert.equal(packageJson.scripts["generate:service-worker"], "node scripts/generate-service-worker.mjs");
  assert.equal(packageJson.scripts["check:service-worker"], "node scripts/generate-service-worker.mjs --check");
  assert.equal(packageJson.scripts["check:vendor"], "node scripts/check-vendor-manifest.mjs");
  assert.equal(
    packageJson.scripts["check:generated"],
    "node scripts/check-generated-drift.mjs && node scripts/check-generated-artifact-manifest.mjs",
  );
  assert.equal(packageJson.scripts["check:i18n"], "node scripts/check-i18n-coverage.mjs");
  assert.equal(packageJson.scripts["check:seo-feed"], "node scripts/check-seo-feed.mjs");
  assert.equal(packageJson.scripts["check:pwa-precache"], "node scripts/check-pwa-precache.mjs");
  assert.equal(packageJson.scripts["check:suggestions-index"], "node scripts/check-suggestions-index.mjs");
  assert.equal(packageJson.scripts["generate:suggestions-index"], "node scripts/check-suggestions-index.mjs --write");
  assert.equal(packageJson.scripts["seo:report"], "node scripts/check-seo-feed.mjs --out");
  assert.match(packageJson.scripts["check:readonly"], /npm run check:vendor/);
  assert.match(packageJson.scripts["check:readonly"], /npm run check:generated/);
  assert.match(packageJson.scripts["check:readonly"], /npm run check:i18n/);
  assert.match(packageJson.scripts["check:readonly"], /npm run check:seo-feed/);
  assert.match(packageJson.scripts["check:readonly"], /npm run check:service-worker/);
  assert.match(packageJson.scripts["check:readonly"], /npm run check:pwa-precache/);
  assert.match(packageJson.scripts["check:readonly"], /npm run check:suggestions-index/);
  assert.match(packageJson.scripts["check:readonly"], /npm run check:quality-baseline/);

  [
    "npm ci",
    "npm run lint:check",
    "npm test",
    "npm run validate:posts",
    "npm run check:vendor",
    "npm run check:generated",
    "npm run check:i18n",
    "npm run check:seo-feed",
    "npm run check:service-worker",
    "npm run check:pwa-precache",
    "npm run check:suggestions-index",
    "npm run check:quality-baseline",
    "npm run quality:baseline:clean -- --out temp/quality-baseline/clean-quality-baseline.json",
    "npm run check:quality-baseline -- --file temp/quality-baseline/clean-quality-baseline.json --require-head --require-clean-scope",
    "npm run build",
    "npm run test:http-smoke",
    "npm run test:browser-smoke",
    "npm run test:pwa-smoke",
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
    steps.findIndex((step) => step.run === "npm run check:vendor") <
      steps.findIndex((step) => step.run === "npm run check:generated"),
    "Vendor manifest check should run before generated artifact drift check",
  );
  assert.ok(
    steps.findIndex((step) => step.run === "npm run check:generated") <
      steps.findIndex((step) => step.run === "npm run check:i18n"),
    "i18n coverage check should run after generated artifact drift check",
  );
  assert.ok(
    steps.findIndex((step) => step.run === "npm run check:i18n") <
      steps.findIndex((step) => step.run === "npm run check:seo-feed"),
    "SEO/feed check should run after i18n coverage check",
  );
  assert.ok(
    steps.findIndex((step) => step.run === "npm run check:seo-feed") <
      steps.findIndex((step) => step.run === "npm run check:service-worker"),
    "Service worker generation check should run after SEO/feed check",
  );
  assert.ok(
    steps.findIndex((step) => step.run === "npm run check:service-worker") <
      steps.findIndex((step) => step.run === "npm run check:pwa-precache"),
    "PWA precache check should run after service worker generation check",
  );
  assert.ok(
    steps.findIndex((step) => step.run === "npm run check:pwa-precache") <
      steps.findIndex((step) => step.run === "npm run check:suggestions-index"),
    "Suggestions index check should run after PWA precache check",
  );
  assert.ok(
    steps.findIndex((step) => step.run === "npm run check:suggestions-index") <
      steps.findIndex((step) => step.run === "npm run check:quality-baseline"),
    "Quality baseline artifact check should run after suggestions index check",
  );
  assert.ok(
    steps.findIndex((step) => step.run === "npm run check:quality-baseline") <
      steps.findIndex((step) => step.run === "npm run quality:baseline:clean -- --out temp/quality-baseline/clean-quality-baseline.json"),
    "Committed quality baseline check should run before generating the clean CI baseline",
  );
  assert.ok(
    steps.findIndex((step) => step.run === "npm run quality:baseline:clean -- --out temp/quality-baseline/clean-quality-baseline.json") <
      steps.findIndex((step) => step.run === "npm run check:quality-baseline -- --file temp/quality-baseline/clean-quality-baseline.json --require-head --require-clean-scope"),
    "Clean quality baseline should be checked after it is generated",
  );
  assert.ok(
    steps.findIndex((step) => step.run === "npm run check:quality-baseline -- --file temp/quality-baseline/clean-quality-baseline.json --require-head --require-clean-scope") <
      steps.findIndex((step) => step.name === "Upload clean quality baseline"),
    "Clean quality baseline should be uploaded after strict validation",
  );
  assert.ok(
    steps.findIndex((step) => step.name === "Upload clean quality baseline") <
      steps.findIndex((step) => step.run === "npm run build"),
    "Clean quality baseline should be captured before build mutates root artifacts",
  );
  assert.equal(stepByName.get("Upload clean quality baseline").uses, "actions/upload-artifact@v5");
  assert.equal(stepByName.get("Upload clean quality baseline").if, "${{ always() && hashFiles('temp/quality-baseline/**') != '' }}");
  assert.equal(stepByName.get("Upload clean quality baseline").with.name, "clean-quality-baseline");
  assert.equal(
    stepByName.get("Upload clean quality baseline").with.path,
    "temp/quality-baseline/",
  );
  assert.equal(stepByName.get("Upload clean quality baseline").with["if-no-files-found"], "error");
  assert.equal(stepByName.get("Upload clean quality baseline").with["retention-days"], 14);
  assert.ok(
    steps.findIndex((step) => step.run === "npm run build") <
      steps.findIndex((step) => step.run === "npm run test:http-smoke"),
    "HTTP smoke should run after the committed site is built",
  );
  assert.ok(
    steps.findIndex((step) => step.run === "npm run test:http-smoke") <
      steps.findIndex((step) => step.run === "npm run test:browser-smoke"),
    "Browser smoke should run after HTTP smoke has checked route availability",
  );
  assert.ok(
    steps.findIndex((step) => step.run === "npm run test:browser-smoke") <
      steps.findIndex((step) => step.name === "Upload browser smoke artifacts"),
    "Browser smoke artifact upload should follow the browser smoke step",
  );
  assert.ok(
    steps.findIndex((step) => step.name === "Upload browser smoke artifacts") <
      steps.findIndex((step) => step.run === "npm run test:pwa-smoke"),
    "Browser smoke artifacts should be collected before the next Playwright smoke step",
  );
  assert.equal(stepByName.get("Upload browser smoke artifacts").if, "failure()");
  assert.equal(stepByName.get("Upload browser smoke artifacts").uses, "actions/upload-artifact@v5");
  assert.equal(stepByName.get("Upload browser smoke artifacts").with.name, "browser-smoke-artifacts");
  assert.equal(stepByName.get("Upload browser smoke artifacts").with.path, "temp/browser-smoke/");
  assert.equal(stepByName.get("Upload browser smoke artifacts").with["if-no-files-found"], "ignore");
  assert.equal(stepByName.get("Upload browser smoke artifacts").with["retention-days"], 7);
});

test("commercial relay sync workflow skips safely when source secret is absent", async () => {
  const workflow = parse(await readFile(join(ROOT, ".github", "workflows", "relay-commercial-sync.yml"), "utf8"));
  const steps = workflow.jobs.sync.steps;
  const stepByName = new Map(steps.map((step) => [step.name, step]));

  assert.equal(workflow.jobs.sync.env.RELAY_COMMERCIAL_REQUIRED, "1");
  assert.equal(workflow.jobs.sync.env.RELAY_COMMERCIAL_MIN_COUNT, "1");
  assert.equal(workflow.jobs.sync.env.RELAY_COMMERCIAL_MIN_SUCCESSFUL_SOURCES, "1");
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
  assert.match(productionValidator, /\['scripts\/http-smoke\.mjs',\s*'--root',\s*BUILD_CHECK_DIR\]/);
  assert.match(productionValidator, /临时构建 HTTP smoke 通过/);
  assert.match(productionValidator, /rm\(BUILD_CHECK_DIR,\s*\{\s*recursive:\s*true,\s*force:\s*true\s*\}\)/);
});

test("production validator checks image dimensions and loading policy across HTML files", async () => {
  const productionValidator = await readFile(join(ROOT, "scripts", "validate-production.mjs"), "utf8");

  assert.match(productionValidator, /function listHtmlFiles/);
  assert.match(productionValidator, /function imagePolicyViolations/);
  assert.match(productionValidator, /image missing width\/height/);
  assert.match(productionValidator, /image missing explicit loading strategy/);
  assert.match(productionValidator, /image missing decoding="async"/);
  assert.match(productionValidator, /HTML 图片属性完整/);
  assert.doesNotMatch(productionValidator, /const htmlFiles = \['index\.html'\]/);
});

test("production validator checks local CSS JS references from HTML and page assets", async () => {
  const productionValidator = await readFile(join(ROOT, "scripts", "validate-production.mjs"), "utf8");

  assert.match(productionValidator, /import\s+\{\s*pageAssetUrls\s*\}\s+from\s+'..\/src\/page-assets\.mjs'/);
  assert.match(productionValidator, /function checkLocalResourceReferences/);
  assert.ok(productionValidator.includes('html.matchAll(/href="([^"]+\\.(?:css|js)(?:[?#][^"]*)?)"/g)'));
  assert.ok(productionValidator.includes('html.matchAll(/src="([^"]+\\.(?:css|js)(?:[?#][^"]*)?)"/g)'));
  assert.match(productionValidator, /pageAssetUrls\(\)\.filter/);
  assert.match(productionValidator, /PAGE_ASSETS/);
  assert.match(productionValidator, /本地 CSS\/JS 资源完整/);
  assert.match(productionValidator, /await checkLocalResourceReferences\(\)/);
});

test("generated artifact drift check compares temporary build output without writing root artifacts", async () => {
  const packageJson = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8"));
  const driftChecker = await readFile(join(ROOT, "scripts", "check-generated-drift.mjs"), "utf8");

  assert.equal(
    packageJson.scripts["check:generated"],
    "node scripts/check-generated-drift.mjs && node scripts/check-generated-artifact-manifest.mjs",
  );
  assert.match(packageJson.scripts["check:readonly"], /npm run check:generated/);
  assert.match(driftChecker, /CHECK_OUT\s*=\s*"temp\/generated-drift-check"/);
  assert.match(driftChecker, /\["scripts\/build\.mjs",\s*"--out",\s*CHECK_OUT\]/);
  assert.match(driftChecker, /expected\.equals\(actual\)/);
  assert.match(driftChecker, /Run npm run build and commit the updated generated artifacts/);
  assert.match(driftChecker, /rm\(CHECK_DIR,\s*\{\s*recursive:\s*true,\s*force:\s*true\s*\}\)/);
});

test("generated artifact ownership manifest is part of generated checks", async () => {
  const manifestChecker = await readFile(join(ROOT, "scripts", "check-generated-artifact-manifest.mjs"), "utf8");
  const manifest = await readFile(join(ROOT, "data", "generated-artifact-manifest.json"), "utf8");

  assert.match(manifestChecker, /generated-artifact-manifest\.json/);
  assert.match(manifestChecker, /staticBuildOutputs/);
  assert.match(manifestChecker, /Committed HTML file is not classified/);
  assert.match(manifestChecker, /post\/\{slug\}\/index\.html/);
  assert.match(manifest, /"manualHtmlPages"/);
  assert.match(manifest, /"copiedAssetDirectories"/);
});

test("HTTP smoke script covers critical public routes and local scripts", async () => {
  const smokeScript = await readFile(join(ROOT, "scripts", "http-smoke.mjs"), "utf8");
  const staticRoutes = new Set(STATIC_PAGES.map((page) => page.path));

  assert.deepEqual(SMOKE_ROUTES, ["/", "/post/", "/tools/", "/contact/", "/ai/", "/trust/"]);
  assert.deepEqual(FULL_SMOKE_ROUTES, STATIC_PAGES.map((page) => page.path));
  assert.deepEqual(ERROR_SMOKE_ROUTES, ["/404.html"]);
  assert.ok(SMOKE_ROUTES.every((route) => staticRoutes.has(route)), "smoke routes should come from STATIC_PAGES");
  assert.match(smokeScript, /import\s+\{\s*ERROR_SMOKE_ROUTES,\s*FULL_SMOKE_ROUTES,\s*SMOKE_ROUTES\s*\}\s+from\s+"..\/src\/config\.mjs"/);
  assert.match(smokeScript, /resolveSmokeRoot/);
  assert.match(smokeScript, /resolveSmokeScope/);
  assert.match(smokeScript, /process\.env\.SMOKE_ROOT/);
  assert.match(smokeScript, /process\.env\.SMOKE_SCOPE/);
  assert.match(smokeScript, /--scope/);
  assert.match(smokeScript, /routesForScope/);
  assert.match(smokeScript, /scope === "full" \? FULL_SMOKE_ROUTES : SMOKE_ROUTES/);
  assert.match(smokeScript, /--root/);
  assert.match(smokeScript, /application\/manifest\+json/);
  assert.match(smokeScript, /smokeManifest/);
  assert.match(smokeScript, /smokePwaArtifacts/);
  assert.match(smokeScript, /\/offline\.html/);
  assert.match(smokeScript, /\/service-worker\.js/);
  assert.match(smokeScript, /\/js\/pwa-register\.js/);
  assert.match(smokeScript, /manifest\.webmanifest icon/);
  assert.match(smokeScript, /rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(smokeScript, /name="theme-color" content="#0f172a"/);
  assert.match(smokeScript, /HTTP smoke \(\$\{SMOKE_SCOPE\}\) passed/);
  assert.match(smokeScript, /main#main-content/);
  assert.match(smokeScript, /is missing an h1/);
  assert.match(smokeScript, /noindex,follow/);
  assert.match(smokeScript, /extractLocalScriptSources/);
  assert.match(smokeScript, /method:\s*"HEAD"/);
});

test("browser smoke script covers critical routes, viewports and tool interactions", async () => {
  const smokeScript = await readFile(join(ROOT, "scripts", "browser-smoke.mjs"), "utf8");
  const staticRoutes = new Set(STATIC_PAGES.map((page) => page.path));

  assert.deepEqual(SMOKE_ROUTES, ["/", "/post/", "/tools/", "/contact/", "/ai/", "/trust/"]);
  assert.deepEqual(FULL_SMOKE_ROUTES, STATIC_PAGES.map((page) => page.path));
  assert.deepEqual(MOBILE_SMOKE_ROUTES, ["/", "/post/", "/tools/", "/trust/"]);
  assert.deepEqual(ERROR_SMOKE_ROUTES, ["/404.html"]);
  assert.ok(MOBILE_SMOKE_ROUTES.every((route) => staticRoutes.has(route)), "mobile smoke routes should come from STATIC_PAGES");
  assert.match(smokeScript, /import\s+\{\s*ERROR_SMOKE_ROUTES,\s*FULL_SMOKE_ROUTES,\s*MOBILE_SMOKE_ROUTES,\s*SMOKE_ROUTES\s*\}\s+from\s+"..\/src\/config\.mjs"/);
  assert.match(smokeScript, /resolveSmokeScope/);
  assert.match(smokeScript, /process\.env\.SMOKE_SCOPE/);
  assert.match(smokeScript, /BROWSER_SMOKE_ARTIFACT_DIR/);
  assert.match(smokeScript, /function saveFailureArtifact/);
  assert.match(smokeScript, /page\.screenshot\(\{\s*path:\s*screenshotPath,\s*fullPage:\s*true\s*\}\)/);
  assert.match(smokeScript, /page\.content\(\)\.then\(\(html\)\s*=>\s*writeFile\(htmlPath,\s*html\)\)/);
  assert.match(smokeScript, /writeFile\(metaPath,\s*`\$\{JSON\.stringify\(metadata,\s*null,\s*2\)\}\\n`\)/);
  assert.match(smokeScript, /Saved browser smoke failure artifacts/);
  assert.match(smokeScript, /--scope/);
  assert.match(smokeScript, /routesForScope/);
  assert.match(smokeScript, /mobileRoutesForScope/);
  assert.match(smokeScript, /scope === "full" \? FULL_SMOKE_ROUTES : SMOKE_ROUTES/);
  assert.match(smokeScript, /scope === "full" \? FULL_SMOKE_ROUTES : MOBILE_SMOKE_ROUTES/);
  assert.match(smokeScript, /name:\s*"desktop"/);
  assert.match(smokeScript, /name:\s*"mobile"/);
  assert.match(smokeScript, /page\.on\("console"/);
  assert.match(smokeScript, /page\.on\("pageerror"/);
  assert.match(smokeScript, /net::ERR_ABORTED/);
  assert.match(smokeScript, /main#main-content/);
  assert.match(smokeScript, /h1:visible/);
  assert.match(smokeScript, /noindex,follow/);
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
  assert.match(smokeScript, /\.gesture-resource-status/);
  assert.match(smokeScript, /data-resource-status="watch"/);
  assert.match(smokeScript, /smokePostListSearchInteractions/);
  assert.match(smokeScript, /#post-search-input/);
  assert.match(smokeScript, /ESClient/);
  assert.match(smokeScript, /Web Worker/);
  assert.match(smokeScript, /post-finance-saas-backend/);
  assert.match(smokeScript, /smokeRelatedPostReasons/);
  assert.match(smokeScript, /\.related-reason/);
  assert.match(smokeScript, /Related post reason did not localize/);
  assert.match(smokeScript, /smokeSearchInteractions/);
  assert.match(smokeScript, /\.nav-search-trigger/);
  assert.match(smokeScript, /BPMN/);
  assert.match(smokeScript, /Cron/);
  assert.match(smokeScript, /\.search-result-section/);
  assert.match(smokeScript, /Search section result does not expose a heading anchor/);
  assert.match(smokeScript, /tool-tab-cron/);
  assert.match(smokeScript, /Tool hash search did not activate Cron/);
  assert.match(smokeScript, /page\.waitForURL/);
  assert.match(smokeScript, /VISIBLE_TIMEOUT_MS\s*=\s*10000/);
  assert.match(smokeScript, /SEARCH_NAVIGATION_TIMEOUT_MS\s*=\s*10000/);
});

test("PWA smoke script verifies service worker registration and offline behavior", async () => {
  const smokeScript = await readFile(join(ROOT, "scripts", "pwa-smoke.mjs"), "utf8");

  assert.match(smokeScript, /navigator\.serviceWorker\?\.ready/);
  assert.match(smokeScript, /navigator\.serviceWorker\?\.controller/);
  assert.match(smokeScript, /context\.setOffline\(true\)/);
  assert.match(smokeScript, /\/search-index\.json/);
  assert.match(smokeScript, /uncached search index/);
  assert.match(smokeScript, /cached search index/);
  assert.match(smokeScript, /\/post\/manage-system\//);
  assert.match(smokeScript, /post-offline-status/);
  assert.match(smokeScript, /cwlSetLang/);
  assert.match(smokeScript, /cached article shows offline reading status/);
  assert.match(smokeScript, /serviceWorkerUpgradeBody/);
  assert.match(smokeScript, /registration\.update/);
  assert.match(smokeScript, /controllerchange/);
  assert.match(smokeScript, /service worker upgrade clears old CWL caches/);
  assert.match(smokeScript, /\/not-cached-route\//);
  assert.match(smokeScript, /\/offline\.html/);
  assert.match(smokeScript, /\/data\/relay-providers\.json/);
  assert.match(smokeScript, /network-only relay data/);
});

test("PWA precache check keeps service worker resources aligned with source rules", async () => {
  const packageJson = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8"));
  const checker = await readFile(join(ROOT, "scripts", "check-pwa-precache.mjs"), "utf8");
  const source = await readFile(join(ROOT, "src", "pwa-precache.mjs"), "utf8");

  assert.equal(packageJson.scripts["check:pwa-precache"], "node scripts/check-pwa-precache.mjs");
  assert.match(packageJson.scripts["check:readonly"], /npm run check:pwa-precache/);
  assert.match(source, /CORE_SCRIPTS/);
  assert.match(source, /PWA_PRECACHE_PAGE_ASSETS/);
  assert.match(source, /pageAssetUrls/);
  assert.match(source, /PWA_PRECACHE_URLS/);
  assert.match(checker, /loadServiceWorkerPrecacheUrls/);
  assert.match(checker, /CWL_PWA_CACHE_POLICY/);
  assert.match(checker, /classifyPwaRequest/);
  assert.match(checker, /artifactOwnershipForPath/);
  assert.match(checker, /pageAssetUrls/);
  assert.match(checker, /Managed precache URL gaps/);
  assert.match(checker, /Page asset URLs covered/);
  assert.match(checker, /fontawesome-all\.min\.css/);
  assert.match(checker, /PWA precache check passed\./);
});

test("service worker generation check keeps the committed worker reproducible", async () => {
  const packageJson = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8"));
  const generator = await readFile(join(ROOT, "scripts", "generate-service-worker.mjs"), "utf8");
  const template = await readFile(join(ROOT, "src", "service-worker-template.mjs"), "utf8");
  const build = await readFile(join(ROOT, "scripts", "build.mjs"), "utf8");

  assert.equal(packageJson.scripts["generate:service-worker"], "node scripts/generate-service-worker.mjs");
  assert.equal(packageJson.scripts["check:service-worker"], "node scripts/generate-service-worker.mjs --check");
  assert.match(packageJson.scripts["check:readonly"], /npm run check:service-worker/);
  assert.match(generator, /renderServiceWorker/);
  assert.match(generator, /--check/);
  assert.match(generator, /is stale\. Run npm run generate:service-worker/);
  assert.match(template, /SERVICE_WORKER_VERSION/);
  assert.match(template, /PWA_CACHE_POLICY_MATRIX/);
  assert.match(template, /uniquePwaPrecacheUrls/);
  assert.match(build, /renderServiceWorker/);
  assert.match(build, /writeFileEnsured\("service-worker\.js",\s*renderServiceWorker\(\)/);
});

test("quality baseline script records commands, coverage and git scope", async () => {
  const packageJson = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8"));
  const baselineScript = await readFile(join(ROOT, "scripts", "write-quality-baseline.mjs"), "utf8");
  const baselineChecker = await readFile(join(ROOT, "scripts", "check-quality-baseline.mjs"), "utf8");
  const baselineCore = await readFile(join(ROOT, "scripts", "quality-baseline-core.mjs"), "utf8");

  assert.equal(packageJson.scripts["quality:baseline"], "node scripts/write-quality-baseline.mjs");
  assert.equal(packageJson.scripts["quality:baseline:clean"], "node scripts/write-quality-baseline.mjs --require-clean");
  assert.equal(packageJson.scripts["check:quality-baseline"], "node scripts/check-quality-baseline.mjs");
  assert.match(baselineCore, /docs\/suggestions\/evidence\/current-quality-baseline\.json/);
  assert.match(baselineScript, /quality-baseline-core\.mjs/);
  assert.match(baselineChecker, /validateQualityBaseline/);
  assert.match(baselineChecker, /--max-age-hours/);
  assert.match(baselineChecker, /--require-head/);
  assert.match(baselineChecker, /--require-clean-scope/);
  assert.match(baselineScript, /Quality baseline requires a clean worktree/);
  assert.match(baselineScript, /clean-commit/);
  assert.match(baselineScript, /pathToFileURL/);
  assert.match(baselineScript, /git",\s*\["status",\s*"--porcelain",\s*"--untracked-files=all"\]/);
  assert.match(baselineScript, /untrackedFileCount/);
  assert.match(baselineScript, /untrackedFiles/);
  assert.match(baselineScript, /npm",\s*args:\s*\["run",\s*"lint:check"\]/);
  assert.match(baselineScript, /npm",\s*args:\s*\["test"\]/);
  assert.match(baselineScript, /id:\s*"vendor-manifest"/);
  assert.match(baselineScript, /npm",\s*args:\s*\["run",\s*"check:vendor"\]/);
  assert.match(baselineScript, /id:\s*"generated-drift"/);
  assert.match(baselineScript, /npm",\s*args:\s*\["run",\s*"check:generated"\]/);
  assert.match(baselineScript, /id:\s*"i18n-coverage"/);
  assert.match(baselineScript, /npm",\s*args:\s*\["run",\s*"check:i18n"\]/);
  assert.match(baselineScript, /id:\s*"seo-feed"/);
  assert.match(baselineScript, /npm",\s*args:\s*\["run",\s*"check:seo-feed"\]/);
  assert.match(baselineScript, /id:\s*"service-worker-generation"/);
  assert.match(baselineScript, /npm",\s*args:\s*\["run",\s*"check:service-worker"\]/);
  assert.match(baselineScript, /id:\s*"pwa-precache"/);
  assert.match(baselineScript, /npm",\s*args:\s*\["run",\s*"check:pwa-precache"\]/);
  assert.match(baselineScript, /id:\s*"suggestions-index"/);
  assert.match(baselineScript, /npm",\s*args:\s*\["run",\s*"check:suggestions-index"\]/);
  assert.match(baselineScript, /npm",\s*args:\s*\["run",\s*"test:coverage"\]/);
  assert.match(baselineScript, /npm",\s*args:\s*\["run",\s*"test:http-smoke"\]/);
  assert.match(baselineScript, /npm",\s*args:\s*\["run",\s*"test:browser-smoke"\]/);
  assert.match(baselineScript, /id:\s*"pwa-smoke"/);
  assert.match(baselineScript, /npm",\s*args:\s*\["run",\s*"test:pwa-smoke"\]/);
  assert.match(baselineScript, /npm",\s*args:\s*\["run",\s*"validate:production"\]/);
  assert.match(baselineCore, /function parseCoverageOutput/);
  assert.match(baselineCore, /function parseI18nCoverageOutput/);
  assert.match(baselineCore, /function parseSeoFeedOutput/);
  assert.match(baselineCore, /function parsePwaPrecacheOutput/);
  assert.match(baselineCore, /function parseServiceWorkerGenerationOutput/);
  assert.match(baselineCore, /function validateQualityBaseline/);
  assert.match(baselineCore, /REQUIRED_BASELINE_COMMAND_IDS/);
  assert.match(baselineCore, /all files\\s\*\\\|/);
  assert.match(baselineCore, /positionalOutput\s*=\s*argv\.find/);
  assert.match(baselineScript, /scope:\s*requireClean\s*\?\s*"clean-commit"\s*:\s*"working-tree"/);
});
