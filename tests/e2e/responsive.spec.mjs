import { test, expect } from "@playwright/test";

const TEST_API_BASE = "https://api.example.com";

function configureApiBase(html) {
  const origin = new URL(TEST_API_BASE).origin;
  return html
    .replace(
      '<meta name="cwl-api-base" content="">',
      `<meta name="cwl-api-base" content="${TEST_API_BASE}">`,
    )
    .replace(/connect-src ([^;\"]+)/, function (directive, sources) {
      return sources.split(/\s+/).includes(origin) ? directive : `${directive} ${origin}`;
    });
}

async function openAssistant(page) {
  const trigger = page.locator(".assistant-nav-trigger");
  if (!(await trigger.isVisible())) {
    await page.locator(".menu-button").click();
  }
  await trigger.click();
}

test("article list remains scannable without horizontal overflow", async ({ page }, testInfo) => {
  await page.goto("/post/");
  await expect(page.locator(".post-summary-card")).toHaveCount(6);
  await expect(page.locator(".post-summary-card picture").first()).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  await testInfo.attach(`post-list-${testInfo.project.name}`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
});

test("mobile article directory is closed until requested", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile-only interaction contract");
  await page.goto("/post/rule-engine-alerts/");
  const toc = page.locator(".toc-sidebar");
  const toggle = page.locator(".toc-toggle");
  await expect(toc).toHaveClass(/is-collapsed/);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("body")).toHaveClass(/toc-open/);
});

test("mobile reading keeps automatic floating prompts out of the content", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile-only reading-shell contract");
  await page.addInitScript(() => {
    localStorage.setItem("cwl.reading.manage-system", JSON.stringify({
      ratio: 0.42,
      scroll: 900,
      time: Date.now(),
    }));
  });
  await page.goto("/post/manage-system/");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(page.locator(".reading-resume")).toHaveCount(0);
  await expect(page.locator(".next-popup")).toBeHidden();
});

test("Pagefind returns a full-body Chinese match", async ({ page }) => {
  await page.goto("/post/");
  const trigger = page.locator(".nav-search-trigger");
  if (!(await trigger.isVisible())) {
    await page.locator(".menu-button").click();
  }
  await trigger.click();
  await page.locator(".search-modal-input").fill("人工巡查");
  await expect(page.locator(".search-modal-results [role=option]").first()).toBeVisible();
  await expect(page.locator(".search-modal-results")).toContainText("人工");
  await expect(page.locator(".search-modal-results")).toContainText("巡查");
});

test("knowledge asset filters keep the graph page within the viewport", async ({ page }) => {
  await page.goto("/knowledge/");
  await expect(page.getByRole("heading", { name: "内容健康看板" })).toBeVisible();
  await expect(page.locator(".knowledge-health-stats > div")).toHaveCount(4);
  await expect(page.locator(".knowledge-coverage progress")).toHaveCount(4);
  await expect(page.locator(".knowledge-inventory li")).toHaveCount(6);
  await page.locator('[data-knowledge-filter="ai-systems"]').click();
  await expect(page.locator(".knowledge-inventory li:visible")).toHaveCount(2);
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
});

test("article recommendations expose a content-based reason", async ({ page }) => {
  await page.goto("/post/manage-system/");
  const recommendations = page.locator(".post-related .related-card");
  await expect(recommendations.first()).toBeVisible();
  await expect(recommendations.first().locator(".related-reason")).not.toHaveText("");
});

test("assistant exposes three stable modes without viewport overflow", async ({ page }) => {
  await page.goto("/knowledge/");
  await openAssistant(page);
  await expect(page.locator('[data-assistant-mode="site"]')).toBeVisible();
  await expect(page.locator('[data-assistant-mode="knowledge"]')).toBeVisible();
  await expect(page.locator('[data-assistant-mode="llm"]')).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
});

test("knowledge assistant renders cited source links from SSE", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One browser project covers the knowledge API workflow");
  await page.route("**/knowledge/", async (route) => {
    const response = await route.fetch();
    const body = configureApiBase(await response.text());
    await route.fulfill({ response, body });
  });
  await page.route("https://api.example.com/api/v1/ai/chat", async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "access-control-allow-origin": "*",
        "content-type": "text/event-stream; charset=utf-8",
      },
      body: [
        'event: delta\ndata: {"text":"工作流通过状态与审计保证可追踪性。[1]"}\n\n',
        'event: sources\ndata: {"sources":[{"title":"Activiti 工作流引擎","url":"/post/activiti-workflow-engine/"}]}\n\n',
        'event: done\ndata: {}\n\n',
      ].join(""),
    });
  });
  await page.goto("/knowledge/");
  await openAssistant(page);
  await page.locator('[data-assistant-mode="knowledge"]').click();
  await page.locator(".assistant-input").fill("工作流如何保证可追踪？");
  await page.locator(".assistant-form").press("Enter");
  await expect(page.locator(".assistant-message.bot").filter({ hasText: "[1]" })).toBeVisible();
  await expect(page.locator('.assistant-links a[href="/post/activiti-workflow-engine/"]')).toBeVisible();
});

test("a visited article remains readable offline", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One browser project is enough for the PWA contract");
  await page.goto("/post/");
  const serviceWorkerUrl = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }));
    }
    return (registration.active || registration.waiting || registration.installing)?.scriptURL || "";
  });
  expect(serviceWorkerUrl).toContain("/service-worker.js");

  await page.goto("/post/rule-engine-alerts/");
  await expect(page.locator("article")).toContainText("规则引擎");
  try {
    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("article")).toContainText("规则引擎");
  } finally {
    await context.setOffline(false);
  }
});

test("authoring assets never enter the shared public service-worker cache", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One browser project is enough for the cache-boundary contract");
  await page.goto("/post/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }));
    }
  });

  await page.goto("/editor/");
  await expect(page.locator(".markdown-editor .cm-editor")).toBeVisible();
  const cachedUrls = await page.evaluate(async () => {
    const urls = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      urls.push(...(await cache.keys()).map((request) => new URL(request.url).pathname));
    }
    return urls;
  });

  expect(cachedUrls).not.toContain("/editor/");
  expect(cachedUrls).not.toContain("/js/editor.js");
  expect(cachedUrls).not.toContain("/js/editor-codemirror.js");
});

test("CodeMirror keeps formatting, preview and draft saving in one workflow", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One desktop project covers the authoring workspace");
  await page.goto("/editor/");
  const codeMirror = page.locator(".markdown-editor .cm-editor");
  await expect(codeMirror).toBeVisible();
  await expect(page.locator("#markdown-input")).toBeHidden();

  await page.evaluate(() => {
    window.CWLMarkdownEditor.setValue("bold", { from: 0, to: 4 });
  });
  await page.locator('[data-md="bold"]').click();
  await expect(page.locator(".cm-content")).toContainText("**bold**");
  await expect(page.locator("#markdown-preview strong")).toHaveText("bold");
  await expect(page.locator("#draft-save-status")).toContainText("已自动保存");

  await page.evaluate(() => {
    window.CWLMarkdownEditor.setValue("## 正文\n\n![](image.png)");
  });
  await expect(page.locator(".cm-lintRange-warning")).toBeVisible();
  await expect(page.locator("#markdown-preview h2")).toHaveText("正文");
});

test("editor publishing stays disabled when no API is configured", async ({ page }) => {
  await page.goto("/editor/");
  await expect(page.locator("#editor-publish-status")).toHaveText("发布 API 未配置");
  await expect(page.locator('[data-action="connect-github"]')).toBeDisabled();
  await expect(page.locator('[data-action="publish-pr"]')).toBeDisabled();
});

test("authenticated media library remains usable within every editor viewport", async ({ page }) => {
  await page.route("**/editor/", async (route) => {
    const response = await route.fetch();
    const body = configureApiBase(await response.text());
    await route.fulfill({ response, body });
  });
  const apiHeaders = {
    "access-control-allow-origin": "http://127.0.0.1:8138",
    "access-control-allow-credentials": "true",
    "content-type": "application/json",
  };
  await page.route("https://api.example.com/api/v1/auth/session", async (route) => {
    await route.fulfill({ status: 200, headers: apiHeaders, body: JSON.stringify({ login: "owner", csrfToken: "browser-only" }) });
  });
  await page.route("https://api.example.com/api/v1/admin/assets?limit=24", async (route) => {
    await route.fulfill({
      status: 200,
      headers: apiHeaders,
      body: JSON.stringify({
        assets: [
          {
            objectKey: "images/uploads/2026/08/architecture.webp",
            publicUrl: "https://assets.example.com/images/uploads/2026/08/architecture.webp",
            mime: "image/webp",
            bytes: 2048,
            width: 1600,
            height: 900,
          },
          {
            objectKey: "images/uploads/2026/08/workflow.png",
            publicUrl: "https://assets.example.com/images/uploads/2026/08/workflow.png",
            mime: "image/png",
            bytes: 4096,
            width: 1200,
            height: 630,
          },
        ],
        cursor: "",
      }),
    });
  });

  await page.goto("/editor/");
  const metadataPanel = page.locator(".editor-meta-panel");
  await metadataPanel.locator("summary").click();
  await expect(metadataPanel).toHaveAttribute("open", "");
  const open = page.locator('[data-action="open-media-library"]');
  await expect(open).toBeEnabled();
  await open.click();
  const dialog = page.locator("#editor-media-library");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".editor-media-item")).toHaveCount(2);
  const dimensions = await page.evaluate(() => {
    const rect = document.getElementById("editor-media-library").getBoundingClientRect();
    return {
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      dialogLeft: rect.left,
      dialogRight: rect.right,
    };
  });
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  expect(dimensions.dialogLeft).toBeGreaterThanOrEqual(0);
  expect(dimensions.dialogRight).toBeLessThanOrEqual(dimensions.viewportWidth);
  await dialog.locator(".editor-media-actions button").first().click();
  await expect(page.locator("#post-cover")).toHaveValue("https://assets.example.com/images/uploads/2026/08/architecture.webp");
  await expect(dialog).toBeHidden();
});

test("authenticated publishing reports CI state within every editor viewport", async ({ page }) => {
  await page.route("**/editor/", async (route) => {
    const response = await route.fetch();
    const body = configureApiBase(await response.text());
    await route.fulfill({ response, body });
  });
  const apiHeaders = {
    "access-control-allow-origin": "http://127.0.0.1:8138",
    "access-control-allow-credentials": "true",
    "content-type": "application/json",
  };
  await page.route("https://api.example.com/api/v1/auth/session", async (route) => {
    await route.fulfill({ status: 200, headers: apiHeaders, body: JSON.stringify({ login: "owner", csrfToken: "browser-only" }) });
  });
  await page.route("https://api.example.com/api/v1/admin/publish", async (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().headers()["x-csrf-token"]).toBe("browser-only");
    await route.fulfill({
      status: 201,
      headers: apiHeaders,
      body: JSON.stringify({
        prUrl: "https://github.com/owner/repository/pull/42",
        previewUrl: "https://preview.example.com/42",
        branch: "content/browser-publish-20260807100000-abcdefgh",
        pullNumber: 42,
      }),
    });
  });
  await page.route("https://api.example.com/api/v1/admin/publish/status?pr=42", async (route) => {
    await route.fulfill({
      status: 200,
      headers: apiHeaders,
      body: JSON.stringify({
        pullNumber: 42,
        state: "success",
        checks: { total: 2, completed: 2, failed: 0, items: [] },
      }),
    });
  });

  await page.goto("/editor/");
  const publish = page.locator('[data-action="publish-pr"]');
  await expect(publish).toBeEnabled();
  await publish.click();
  await expect(page.locator("#editor-ci-status")).toHaveText("CI 已通过，可以合并发布");
  await expect(page.locator("#editor-pr-link")).toHaveAttribute("href", "https://github.com/owner/repository/pull/42");
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  const stored = await page.evaluate(() => Object.values(localStorage).join("\n"));
  expect(stored).not.toContain("browser-only");
});

test("mobile publishing controls do not overflow or cover CodeMirror", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile-only authoring layout contract");
  await page.goto("/editor/");
  const panel = page.locator("#editor-publish-panel");
  const codeMirror = page.locator(".markdown-editor .cm-editor");
  await expect(panel).toBeVisible();
  await expect(codeMirror).toBeVisible();

  const layout = await page.evaluate(() => {
    const panelRect = document.getElementById("editor-publish-panel").getBoundingClientRect();
    const editorRect = document.querySelector(".markdown-editor .cm-editor").getBoundingClientRect();
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      panelBottom: panelRect.bottom,
      editorTop: editorRect.top,
    };
  });
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.panelBottom).toBeLessThanOrEqual(layout.editorTop);
});
