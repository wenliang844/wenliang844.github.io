// 行为测试: performance-monitor.js — 性能监控
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { JSDOM } from "jsdom";

const ROOT = join(import.meta.dirname, "..");

async function loadPerfMonitor(dom) {
  const code = await readFile(join(ROOT, "js", "performance-monitor.js"), "utf8");
  dom.window.eval(code);
  return dom.window.CWLPerformance;
}

function createDom(html) {
  return new JSDOM(html || "<!doctype html><html><body></body></html>", {
    runScripts: "outside-only",
    url: "https://example.com/",
    pretendToBeVisual: true,
  });
}

// ─── 基本初始化 ────────────────────────────────────────────────────────────────

test("performance-monitor initializes with default disabled state", async () => {
  const dom = createDom();
  const pm = await loadPerfMonitor(dom);

  assert.equal(pm.enabled, false, "should be disabled by default");
  assert.equal(pm.metrics.navigation, null, "navigation should be null");
  assert.ok(Array.isArray(pm.metrics.resources), "resources should be array");
  assert.equal(Object.keys(pm.metrics.marks).length, 0, "marks should be empty");
  assert.equal(Object.keys(pm.metrics.measures).length, 0, "measures should be empty");

  dom.window.close();
});

test("performance-monitor does not create observers when disabled", async () => {
  const dom = createDom();
  let observerCreated = false;

  dom.window.PerformanceObserver = class {
    constructor() { observerCreated = true; }
    observe() {}
  };

  const pm = await loadPerfMonitor(dom);

  assert.ok(!observerCreated, "should not create PerformanceObserver when disabled");

  dom.window.close();
});

// ─── PerformanceObserver 创建 ──────────────────────────────────────────────────

test("performance-monitor creates observers when enabled", async () => {
  const observedEntryTypes = [];

  const dom = createDom();
  dom.window.PerformanceObserver = class {
    constructor() {}
    observe(opts) {
      observedEntryTypes.push(...opts.entryTypes);
    }
  };

  const pm = await loadPerfMonitor(dom);
  pm.enabled = true;
  pm.init();

  assert.ok(observedEntryTypes.includes("resource"), "should observe resources");
  assert.ok(observedEntryTypes.includes("largest-contentful-paint"), "should observe LCP");
  assert.ok(observedEntryTypes.includes("first-input"), "should observe FID");
  assert.ok(observedEntryTypes.includes("layout-shift"), "should observe CLS");

  dom.window.close();
});

test("performance-monitor handles missing PerformanceObserver gracefully", async () => {
  const dom = createDom();
  dom.window.PerformanceObserver = undefined;

  const pm = await loadPerfMonitor(dom);
  pm.enabled = true;

  // Should not throw
  pm.init();
  assert.ok(true, "should handle missing PerformanceObserver");

  dom.window.close();
});

// ─── collectNavigationTiming ───────────────────────────────────────────────────

test("performance-monitor collects navigation timing correctly", async () => {
  const dom = createDom();

  const navEntry = {
    domainLookupStart: 0,
    domainLookupEnd: 10,
    connectStart: 10,
    connectEnd: 30,
    requestStart: 30,
    responseEnd: 100,
    domInteractive: 200,
    domContentLoadedEventEnd: 250,
    loadEventStart: 300,
    duration: 350,
  };

  dom.window.performance.getEntriesByType = function (type) {
    return type === "navigation" ? [navEntry] : [];
  };

  const pm = await loadPerfMonitor(dom);
  pm.enabled = true;
  pm.collectNavigationTiming();

  assert.ok(pm.metrics.navigation, "navigation metrics should be set");
  assert.equal(pm.metrics.navigation.dns, 10, "DNS should be 10ms");
  assert.equal(pm.metrics.navigation.tcp, 20, "TCP should be 20ms");
  assert.equal(pm.metrics.navigation.request, 70, "request should be 70ms");
  assert.equal(pm.metrics.navigation.domParse, 100, "domParse should be 100ms");
  assert.equal(pm.metrics.navigation.resourceLoad, 50, "resourceLoad should be 50ms");
  assert.equal(pm.metrics.navigation.total, 350, "total should be 350ms");

  dom.window.close();
});

test("performance-monitor clamps negative durations to zero", async () => {
  const dom = createDom();

  const navEntry = {
    domainLookupStart: 100,
    domainLookupEnd: 50, // negative duration
    connectStart: 200,
    connectEnd: 150,
    requestStart: 300,
    responseEnd: 100, // negative
    domInteractive: 50,
    domContentLoadedEventEnd: 200,
    loadEventStart: 100,
    duration: 0,
  };

  dom.window.performance.getEntriesByType = function (type) {
    return type === "navigation" ? [navEntry] : [];
  };

  const pm = await loadPerfMonitor(dom);
  pm.collectNavigationTiming();

  assert.equal(pm.metrics.navigation.dns, 0, "negative DNS should be clamped to 0");
  assert.equal(pm.metrics.navigation.tcp, 0, "negative TCP should be clamped to 0");

  dom.window.close();
});

test("performance-monitor handles missing getEntriesByType", async () => {
  const dom = createDom();
  dom.window.performance.getEntriesByType = undefined;

  const pm = await loadPerfMonitor(dom);
  pm.collectNavigationTiming();

  assert.equal(pm.metrics.navigation, null, "navigation should remain null");

  dom.window.close();
});

// ─── LCP 观察 ──────────────────────────────────────────────────────────────────

test("performance-monitor records LCP from observer", async () => {
  let lcpCallback = null;
  const dom = createDom();

  dom.window.PerformanceObserver = class {
    constructor(cb) { lcpCallback = cb; }
    observe() {}
  };

  const pm = await loadPerfMonitor(dom);
  pm.enabled = true;
  pm.observeLCP();

  // Simulate LCP entry
  lcpCallback({
    getEntries: () => [{ renderTime: 1500, loadTime: 1200 }],
  });

  assert.equal(pm.metrics.lcp, 1500, "LCP should be recorded as renderTime");

  // Second entry should overwrite
  lcpCallback({
    getEntries: () => [{ renderTime: 2000, loadTime: 1800 }],
  });
  assert.equal(pm.metrics.lcp, 2000, "LCP should update to latest entry");

  dom.window.close();
});

test("performance-monitor LCP falls back to loadTime", async () => {
  let lcpCallback = null;
  const dom = createDom();

  dom.window.PerformanceObserver = class {
    constructor(cb) { lcpCallback = cb; }
    observe() {}
  };

  const pm = await loadPerfMonitor(dom);
  pm.observeLCP();

  lcpCallback({
    getEntries: () => [{ loadTime: 800 }],
  });

  assert.equal(pm.metrics.lcp, 800, "LCP should fall back to loadTime when renderTime is missing");

  dom.window.close();
});

// ─── FID 观察 ──────────────────────────────────────────────────────────────────

test("performance-monitor records FID from observer", async () => {
  let fidCallback = null;
  const dom = createDom();

  dom.window.PerformanceObserver = class {
    constructor(cb) { fidCallback = cb; }
    observe() {}
  };

  const pm = await loadPerfMonitor(dom);
  pm.observeFID();

  fidCallback({
    getEntries: () => [{ startTime: 100, processingStart: 150 }],
  });

  assert.equal(pm.metrics.fid, 50, "FID should be processingStart - startTime");

  dom.window.close();
});

// ─── CLS 观察 ──────────────────────────────────────────────────────────────────

test("performance-monitor accumulates CLS excluding recent input", async () => {
  let clsCallback = null;
  const dom = createDom();

  dom.window.PerformanceObserver = class {
    constructor(cb) { clsCallback = cb; }
    observe() {}
  };

  const pm = await loadPerfMonitor(dom);
  pm.observeCLS();

  // First shift (no recent input)
  clsCallback({
    getEntries: () => [{ value: 0.05, hadRecentInput: false }],
  });
  assert.equal(pm.metrics.cls, 0.05, "CLS should accumulate first shift");

  // Second shift with recent input — should be excluded
  clsCallback({
    getEntries: () => [{ value: 0.1, hadRecentInput: true }],
  });
  assert.equal(pm.metrics.cls, 0.05, "CLS should not include shifts with recent input");

  // Third shift without recent input
  clsCallback({
    getEntries: () => [{ value: 0.03, hadRecentInput: false }],
  });
  assert.equal(pm.metrics.cls, 0.08, "CLS should accumulate non-input shifts");

  dom.window.close();
});

// ─── mark 和 measure ──────────────────────────────────────────────────────────

test("performance-monitor mark and measure work correctly", async () => {
  const dom = createDom();
  const marks = [];
  const measures = [];

  dom.window.performance.mark = function (name) { marks.push(name); };
  dom.window.performance.measure = function () {};
  dom.window.performance.getEntriesByName = function (name) {
    return [{ duration: 42 }];
  };
  dom.window.performance.now = function () { return 123.45; };

  const pm = await loadPerfMonitor(dom);
  pm.mark("start");

  assert.ok(marks.includes("start"), "should call performance.mark");
  assert.equal(pm.metrics.marks["start"], 123.45, "should record now() value");

  pm.measure("duration", "start", "end");
  assert.equal(pm.metrics.measures["duration"], 42, "should record measure duration");

  dom.window.close();
});

test("performance-monitor mark does nothing without performance API", async () => {
  const dom = createDom();
  // Override performance.mark to undefined
  const origMark = dom.window.performance.mark;
  dom.window.performance.mark = undefined;

  const pm = await loadPerfMonitor(dom);
  // Should not throw
  pm.mark("test");
  assert.equal(Object.keys(pm.metrics.marks).length, 0, "marks should remain empty");

  dom.window.performance.mark = origMark;
  dom.window.close();
});

// ─── getReport ─────────────────────────────────────────────────────────────────

test("performance-monitor getReport returns complete structure", async () => {
  const dom = createDom();
  const pm = await loadPerfMonitor(dom);

  const report = pm.getReport();

  assert.equal(report.navigation, null, "navigation should be null by default");
  assert.ok(Array.isArray(report.resources), "resources should be array");
  assert.ok(typeof report.webVitals === "object", "webVitals should be object");
  assert.equal(report.webVitals.lcp, undefined, "LCP should be undefined by default");
  assert.equal(report.webVitals.fid, undefined, "FID should be undefined by default");
  assert.equal(report.webVitals.cls, undefined, "CLS should be undefined by default");
  assert.equal(Object.keys(report.marks).length, 0, "marks should be empty");
  assert.equal(Object.keys(report.measures).length, 0, "measures should be empty");
  assert.equal(report.memory, null, "memory should be null when not available");

  dom.window.close();
});

test("performance-monitor getReport includes memory when available", async () => {
  const dom = createDom();
  dom.window.performance.memory = {
    usedJSHeapSize: 1000000,
    totalJSHeapSize: 2000000,
    jsHeapSizeLimit: 4000000,
  };

  const pm = await loadPerfMonitor(dom);
  const report = pm.getReport();

  assert.ok(report.memory, "memory should be present");
  assert.equal(report.memory.used, 1000000);
  assert.equal(report.memory.total, 2000000);
  assert.equal(report.memory.limit, 4000000);

  dom.window.close();
});

// ─── 慢资源检测 ────────────────────────────────────────────────────────────────

test("performance-monitor records slow resources (>1000ms)", async () => {
  let resourceCallback = null;
  const dom = createDom();

  dom.window.PerformanceObserver = class {
    constructor(cb) { resourceCallback = cb; }
    observe() {}
  };

  const pm = await loadPerfMonitor(dom);
  pm.observeResources();

  // Fast resource — should be ignored
  resourceCallback({
    getEntries: () => [{ name: "fast.js", duration: 500, transferSize: 100, initiatorType: "script" }],
  });
  assert.equal(pm.metrics.resources.length, 0, "fast resource should not be recorded");

  // Slow resource — should be recorded
  resourceCallback({
    getEntries: () => [{ name: "slow.js", duration: 2000, transferSize: 50000, initiatorType: "script" }],
  });
  assert.equal(pm.metrics.resources.length, 1, "slow resource should be recorded");
  assert.equal(pm.metrics.resources[0].name, "slow.js");
  assert.equal(pm.metrics.resources[0].duration, 2000);
  assert.equal(pm.metrics.resources[0].size, 50000);
  assert.equal(pm.metrics.resources[0].type, "script");

  dom.window.close();
});
