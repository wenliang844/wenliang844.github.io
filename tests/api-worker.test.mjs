import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { build } from "esbuild";

const ROOT = join(import.meta.dirname, "..");
const outfile = join(ROOT, "temp", "api-worker-test.mjs");
await mkdir(join(ROOT, "temp"), { recursive: true });
await build({
  entryPoints: [join(ROOT, "worker", "src", "index.ts")],
  outfile,
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
});
const workerModule = await import(`${new URL(`file:///${outfile.replace(/\\/g, "/")}`).href}?v=${Date.now()}`);
const worker = workerModule.default;
const { AiBudget } = workerModule;

const API_ORIGIN = "https://api.example.com";
const SITE_ORIGIN = "https://blog.example.com";
const ENV = {
  SITE_ORIGIN,
  EDITOR_URL: `${SITE_ORIGIN}/editor/?connected=1`,
  GITHUB_CLIENT_ID: "oauth-client",
  GITHUB_CLIENT_SECRET: "oauth-secret",
  GITHUB_TOKEN: "server-repository-token",
  GITHUB_REPOSITORY: "owner/repository",
  GITHUB_BASE_BRANCH: "master",
  OWNER_GITHUB_LOGIN: "owner",
  SESSION_SECRET: "0123456789abcdef0123456789abcdef",
  PREVIEW_URL_TEMPLATE: "https://preview.example.com/?branch={branch}&pr={pr}",
  AUDIT_EVENTS: { writeDataPoint() {} },
};

function context() {
  const promises = [];
  return {
    promises,
    waitUntil(promise) { promises.push(promise); },
  };
}

function request(path, init = {}) {
  return new Request(`${API_ORIGIN}${path}`, init);
}

function cookiePair(setCookie) {
  return setCookie.split(";", 1)[0];
}

function jsonResponse(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

async function authenticate(env = ENV) {
  const start = await worker.fetch(request("/api/v1/auth/github/start"), env, context());
  assert.equal(start.status, 302);
  const authorize = new URL(start.headers.get("location"));
  const state = authorize.searchParams.get("state");
  const oauthCookie = cookiePair(start.headers.get("set-cookie"));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/login/oauth/access_token")) return jsonResponse({ access_token: "temporary-user-token" });
    if (url === "https://api.github.com/user") return jsonResponse({ login: "owner" });
    throw new Error(`Unexpected OAuth request: ${url}`);
  };
  try {
    const callback = await worker.fetch(request(`/api/v1/auth/github/callback?code=code&state=${state}`, {
      headers: { cookie: oauthCookie },
    }), env, context());
    assert.equal(callback.status, 302);
    const setCookies = typeof callback.headers.getSetCookie === "function"
      ? callback.headers.getSetCookie()
      : [callback.headers.get("set-cookie")];
    const session = setCookies.find((value) => value?.startsWith("cwl_session="));
    assert.ok(session, "callback should create a session cookie");
    const sessionCookie = cookiePair(session);
    const sessionResponse = await worker.fetch(request("/api/v1/auth/session", {
      headers: { origin: SITE_ORIGIN, cookie: sessionCookie },
    }), env, context());
    assert.equal(sessionResponse.status, 200);
    const sessionData = await sessionResponse.json();
    return { sessionCookie, csrfToken: sessionData.csrfToken };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function publishPayload(overrides = {}) {
  return {
    title: "边缘发布流程",
    shortTitle: "边缘发布",
    slug: "edge-publish-flow",
    date: "2026-08-06",
    category: "backend-platform",
    series: "enterprise-platforms",
    seriesOrder: 3,
    summary: "通过安全边缘 API 创建内容 PR。",
    description: "单作者博客的 GitHub PR 发布流程。",
    cover: "/images/posts/edge-publish-flow.png",
    coverAlt: "边缘 API 到 GitHub PR 的发布流程",
    tags: ["GitHub", "发布流程"],
    markdown: "## 正文\n\n发布内容。",
    draft: true,
    ...overrides,
  };
}

function pngHeader(width, height) {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
  bytes.set([73, 72, 68, 82], 12);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}

function knowledgeDataset() {
  return {
    version: 1,
    datasetHash: "a".repeat(64),
    documents: [],
    chunks: [{
      id: "manage-system-0-abcdef123456",
      documentId: "manage-system",
      ordinal: 0,
      title: "管理系统工程实践",
      path: "/post/manage-system/",
      text: "管理系统采用模块化前端与权限清晰的后端架构，通过草稿、预览和自动化测试降低发布风险。",
      hash: "b".repeat(64),
      category: "backend-platform",
      series: "enterprise-platforms",
      tags: ["管理系统", "工程实践"],
      modified: "2026-08-06",
    }],
  };
}

function aiEnv(overrides = {}) {
  return {
    ...ENV,
    AI_ENABLED: "true",
    AI_CHAT_MODEL: "chat-model",
    AI_EMBEDDING_MODEL: "embedding-model",
    AI_DAILY_REQUEST_LIMIT: "100",
    AI_REQUESTS_PER_MINUTE: "6",
    AI: {
      async run(_model, input) {
        if (input.text) return { data: [[0.1, 0.2, 0.3]] };
        return { response: "管理系统通过模块化架构和自动化测试降低发布风险。[1]" };
      },
    },
    VECTORIZE: {
      async query() { return { matches: [{ id: "manage-system-0-abcdef123456", score: 0.91 }] }; },
      async upsert() {},
    },
    AI_BUDGET: {
      idFromName() { return "global"; },
      get() { return { async fetch() { return jsonResponse({ ok: true }); } }; },
    },
    ...overrides,
  };
}

test("worker validates content and renders build-compatible front matter", () => {
  const input = workerModule.validatePublishInput(publishPayload());
  const markdown = workerModule.renderPost(input);
  assert.match(markdown, /slug: "edge-publish-flow"/);
  assert.match(markdown, /tags: \["GitHub", "发布流程"\]/);
  assert.match(markdown, /draft: true/);
  assert.match(markdown, /series: "enterprise-platforms"/);
  assert.match(markdown, /## 正文/);
  assert.throws(() => workerModule.validatePublishInput(publishPayload({ date: "2026-02-30" })), /real YYYY-MM-DD/);
  assert.throws(() => workerModule.validatePublishInput(publishPayload({ tags: [] })), /between 1 and 20 tags/);
});

test("OAuth state and owner allowlist produce a signed HttpOnly session", async () => {
  const { sessionCookie, csrfToken } = await authenticate();
  assert.match(sessionCookie, /^cwl_session=/);
  assert.ok(csrfToken.length >= 20);
});

test("short session secrets fail closed without issuing cookies", async () => {
  const response = await worker.fetch(request("/api/v1/auth/github/start"), {
    ...ENV,
    SESSION_SECRET: "too-short",
  }, context());
  assert.equal(response.status, 500);
  assert.equal((await response.json()).error.code, "configuration_error");
  assert.equal(response.headers.get("set-cookie"), null);
});

test("logout clears the signed session cookie", async () => {
  const auth = await authenticate();
  const response = await worker.fetch(request("/api/v1/auth/logout", {
    method: "POST",
    headers: {
      origin: SITE_ORIGIN,
      cookie: auth.sessionCookie,
      "x-csrf-token": auth.csrfToken,
    },
  }), ENV, context());
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie") || "", /^cwl_session=;.*Max-Age=0/);
});

test("OAuth callback rejects a GitHub identity outside the owner allowlist", async () => {
  const start = await worker.fetch(request("/api/v1/auth/github/start"), ENV, context());
  const authorize = new URL(start.headers.get("location"));
  const oauthCookie = cookiePair(start.headers.get("set-cookie"));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/login/oauth/access_token")) return jsonResponse({ access_token: "temporary-user-token" });
    if (url === "https://api.github.com/user") return jsonResponse({ login: "intruder" });
    throw new Error(`Unexpected OAuth request: ${url}`);
  };
  try {
    const callback = await worker.fetch(request(`/api/v1/auth/github/callback?code=code&state=${authorize.searchParams.get("state")}`, {
      headers: { cookie: oauthCookie },
    }), ENV, context());
    assert.equal(callback.status, 403);
    assert.equal((await callback.json()).error.code, "author_denied");
    assert.doesNotMatch(callback.headers.get("set-cookie") || "", /cwl_session=/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("publish rejects missing Origin and invalid CSRF before GitHub access", async () => {
  const { sessionCookie, csrfToken } = await authenticate();
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return jsonResponse({}); };
  try {
    const missingOrigin = await worker.fetch(request("/api/v1/admin/publish", {
      method: "POST",
      headers: { cookie: sessionCookie, "x-csrf-token": csrfToken, "content-type": "application/json" },
      body: JSON.stringify(publishPayload()),
    }), ENV, context());
    assert.equal(missingOrigin.status, 403);
    assert.equal((await missingOrigin.json()).error.code, "origin_denied");

    const invalidCsrf = await worker.fetch(request("/api/v1/admin/publish", {
      method: "POST",
      headers: { origin: SITE_ORIGIN, cookie: sessionCookie, "x-csrf-token": "wrong", "content-type": "application/json" },
      body: JSON.stringify(publishPayload()),
    }), ENV, context());
    assert.equal(invalidCsrf.status, 403);
    assert.equal((await invalidCsrf.json()).error.code, "csrf_failed");
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("publish rejects oversized bodies before reading or calling GitHub", async () => {
  const auth = await authenticate();
  const response = await worker.fetch(request("/api/v1/admin/publish", {
    method: "POST",
    headers: {
      origin: SITE_ORIGIN,
      cookie: auth.sessionCookie,
      "x-csrf-token": auth.csrfToken,
      "content-type": "application/json",
      "content-length": "700000",
    },
    body: JSON.stringify(publishPayload()),
  }), ENV, context());
  assert.equal(response.status, 413);
  assert.equal((await response.json()).error.code, "body_too_large");
});

test("publish creates a content branch, writes Markdown and opens a draft PR", async () => {
  const auth = await authenticate();
  const originalFetch = globalThis.fetch;
  const calls = [];
  let uploaded;
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    const method = init.method || "GET";
    calls.push({ url, method });
    if (url.endsWith("/git/ref/heads/master")) return jsonResponse({ object: { sha: "base-sha" } });
    if (url.endsWith("/git/refs") && method === "POST") return jsonResponse({ ref: "created" }, 201);
    if (url.includes("/contents/src/posts/edge-publish-flow.md?ref=master")) return jsonResponse({ message: "Not Found" }, 404);
    if (url.endsWith("/contents/src/posts/edge-publish-flow.md") && method === "PUT") {
      uploaded = JSON.parse(init.body);
      return jsonResponse({ content: { sha: "content-sha" } }, 201);
    }
    if (url.endsWith("/pulls") && method === "POST") return jsonResponse({ html_url: "https://github.com/owner/repository/pull/42", number: 42 }, 201);
    throw new Error(`Unexpected GitHub request: ${method} ${url}`);
  };
  try {
    const response = await worker.fetch(request("/api/v1/admin/publish", {
      method: "POST",
      headers: {
        origin: SITE_ORIGIN,
        cookie: auth.sessionCookie,
        "x-csrf-token": auth.csrfToken,
        "content-type": "application/json",
      },
      body: JSON.stringify(publishPayload()),
    }), ENV, context());
    assert.equal(response.status, 201);
    const result = await response.json();
    assert.equal(result.prUrl, "https://github.com/owner/repository/pull/42");
    assert.equal(result.pullNumber, 42);
    assert.match(result.previewUrl, /preview\.example\.com/);
    assert.match(result.branch, /^content\/edge-publish-flow-/);
    assert.match(result.branch, /-\d{14}-[A-Za-z0-9_-]{8}$/);
    assert.ok(calls.some((call) => call.method === "POST" && call.url.endsWith("/git/refs")));
    assert.ok(calls.some((call) => call.method === "POST" && call.url.endsWith("/pulls")));
    const content = Buffer.from(uploaded.content, "base64").toString("utf8");
    assert.match(content, /draft: true/);
    assert.match(content, /## 正文/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("publish updates an existing post with its GitHub blob sha and records metadata-only audit data", async () => {
  const auditPoints = [];
  const env = {
    ...ENV,
    PREVIEW_URL_TEMPLATE: "https://preview.example.com/{branchSlug}/{pr}",
    AUDIT_EVENTS: { writeDataPoint(point) { auditPoints.push(point); } },
  };
  const auth = await authenticate(env);
  const originalFetch = globalThis.fetch;
  let uploaded;
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    const method = init.method || "GET";
    if (url.endsWith("/git/ref/heads/master")) return jsonResponse({ object: { sha: "base-sha" } });
    if (url.endsWith("/git/refs") && method === "POST") return jsonResponse({}, 201);
    if (url.includes("/contents/src/posts/edge-publish-flow.md?ref=master")) return jsonResponse({ sha: "existing-blob-sha" });
    if (url.endsWith("/contents/src/posts/edge-publish-flow.md") && method === "PUT") {
      uploaded = JSON.parse(init.body);
      return jsonResponse({}, 200);
    }
    if (url.endsWith("/pulls") && method === "POST") {
      return jsonResponse({ html_url: "https://github.com/owner/repository/pull/43", number: 43 }, 201);
    }
    throw new Error(`Unexpected GitHub request: ${method} ${url}`);
  };
  try {
    const response = await worker.fetch(request("/api/v1/admin/publish", {
      method: "POST",
      headers: {
        origin: SITE_ORIGIN,
        cookie: auth.sessionCookie,
        "x-csrf-token": auth.csrfToken,
        "content-type": "application/json",
      },
      body: JSON.stringify(publishPayload({ markdown: "sensitive article body", draft: false })),
    }), env, context());
    assert.equal(response.status, 201);
    const result = await response.json();
    assert.equal(uploaded.sha, "existing-blob-sha");
    assert.match(uploaded.message, /^Update post:/);
    assert.match(result.previewUrl, /^https:\/\/preview\.example\.com\/content-edge-publish-flow-/);
    const publishAudit = auditPoints.find((point) => point.blobs?.[0] === "publish.success");
    assert.ok(publishAudit, "successful publish should emit an audit event");
    const serializedAudit = JSON.stringify(publishAudit);
    assert.match(serializedAudit, /publish\.success/);
    assert.doesNotMatch(serializedAudit, /sensitive article body|server-repository-token|temporary-user-token/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("publish deletes the temporary branch when PR creation fails", async () => {
  const auth = await authenticate();
  const originalFetch = globalThis.fetch;
  let deleted = false;
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    const method = init.method || "GET";
    if (url.endsWith("/git/ref/heads/master")) return jsonResponse({ object: { sha: "base-sha" } });
    if (url.endsWith("/git/refs") && method === "POST") return jsonResponse({}, 201);
    if (url.includes("/contents/src/posts/edge-publish-flow.md?ref=master")) return jsonResponse({}, 404);
    if (url.endsWith("/contents/src/posts/edge-publish-flow.md") && method === "PUT") return jsonResponse({}, 201);
    if (url.endsWith("/pulls") && method === "POST") return jsonResponse({}, 500, { "x-github-request-id": "failed-pr" });
    if (url.includes("/git/refs/heads/content%2Fedge-publish-flow-") && method === "DELETE") {
      deleted = true;
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected GitHub request: ${method} ${url}`);
  };
  try {
    const response = await worker.fetch(request("/api/v1/admin/publish", {
      method: "POST",
      headers: {
        origin: SITE_ORIGIN,
        cookie: auth.sessionCookie,
        "x-csrf-token": auth.csrfToken,
        "content-type": "application/json",
      },
      body: JSON.stringify(publishPayload()),
    }), ENV, context());
    assert.equal(response.status, 502);
    assert.equal((await response.json()).error.code, "github_failed");
    assert.equal(deleted, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("publish status requires the owner and aggregates sanitized GitHub checks", async () => {
  let githubCalls = 0;
  const unauthenticated = await worker.fetch(request("/api/v1/admin/publish/status?pr=44", {
    headers: { origin: SITE_ORIGIN },
  }), ENV, context());
  assert.equal(unauthenticated.status, 401);
  assert.equal(githubCalls, 0);

  const auth = await authenticate();
  const invalid = await worker.fetch(request("/api/v1/admin/publish/status?pr=0", {
    headers: { origin: SITE_ORIGIN, cookie: auth.sessionCookie },
  }), ENV, context());
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error.code, "invalid_pull_number");

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    githubCalls += 1;
    const url = String(input);
    const pullMatch = url.match(/\/pulls\/(44|45|46)$/);
    if (pullMatch) {
      const number = Number(pullMatch[1]);
      return jsonResponse({
        number,
        html_url: `https://github.com/owner/repository/pull/${number}`,
        state: number === 46 ? "closed" : "open",
        merged: number === 46,
        draft: number === 44,
        head: {
          ref: `content/status-post-20260807100000-abcdef${number}`,
          sha: String(number === 44 ? "a" : number === 45 ? "b" : "c").repeat(40),
        },
      });
    }
    if (url.includes(`/commits/${"a".repeat(40)}/check-runs`)) {
      return jsonResponse({ check_runs: [
        { name: "quality", status: "completed", conclusion: "failure", html_url: "https://github.com/owner/repository/actions/runs/1" },
        { name: "preview", status: "in_progress", conclusion: null, html_url: "javascript:alert(1)" },
      ] });
    }
    if (url.includes(`/commits/${"b".repeat(40)}/check-runs`)) {
      return jsonResponse({ check_runs: [
        { name: "quality", status: "completed", conclusion: "success", html_url: "https://github.com/owner/repository/actions/runs/2" },
        { name: "preview", status: "completed", conclusion: "neutral", html_url: "https://github.com/owner/repository/actions/runs/3" },
      ] });
    }
    if (url.includes(`/commits/${"c".repeat(40)}/check-runs`)) return jsonResponse({ check_runs: [] });
    throw new Error(`Unexpected GitHub status request: ${url}`);
  };
  try {
    const statuses = [];
    for (const pullNumber of [44, 45, 46]) {
      const response = await worker.fetch(request(`/api/v1/admin/publish/status?pr=${pullNumber}`, {
        headers: { origin: SITE_ORIGIN, cookie: auth.sessionCookie },
      }), ENV, context());
      assert.equal(response.status, 200);
      statuses.push(await response.json());
    }
    assert.equal(statuses[0].state, "failure");
    assert.equal(statuses[0].draft, true);
    assert.equal(statuses[0].checks.failed, 1);
    assert.equal(statuses[0].checks.items[1].url, "");
    assert.equal(statuses[1].state, "success");
    assert.equal(statuses[1].checks.completed, 2);
    assert.equal(statuses[2].state, "merged");
    assert.match(statuses[2].previewUrl, /pr=46/);
    assert.equal(githubCalls, 6);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("asset upload uses a short grant, verifies image metadata and stores immutable R2 metadata", async () => {
  const puts = [];
  const auditPoints = [];
  const image = pngHeader(1200, 630);
  const env = {
    ...ENV,
    ASSET_PUBLIC_BASE: "https://assets.example.com",
    ASSETS: { async put(...args) { puts.push(args); } },
    AUDIT_EVENTS: { writeDataPoint(point) { auditPoints.push(point); } },
  };
  const auth = await authenticate(env);
  const grantResponse = await worker.fetch(request("/api/v1/admin/assets/presign", {
    method: "POST",
    headers: {
      origin: SITE_ORIGIN,
      cookie: auth.sessionCookie,
      "x-csrf-token": auth.csrfToken,
      "content-type": "application/json",
    },
    body: JSON.stringify({ fileName: "cover.png", mime: "image/png", bytes: image.byteLength }),
  }), env, context());
  assert.equal(grantResponse.status, 201);
  const grant = await grantResponse.json();
  assert.match(grant.objectKey, /^images\/uploads\/\d{4}\/\d{2}\/[0-9a-f-]+\.png$/);
  assert.equal(grant.publicUrl, `https://assets.example.com/${grant.objectKey}`);
  assert.ok(grant.headers["x-upload-token"]);

  const uploadResponse = await worker.fetch(new Request(grant.uploadUrl, {
    method: "PUT",
    headers: { origin: SITE_ORIGIN, ...grant.headers },
    body: image,
  }), env, context());
  assert.equal(uploadResponse.status, 201);
  const uploaded = await uploadResponse.json();
  assert.equal(uploaded.width, 1200);
  assert.equal(uploaded.height, 630);
  assert.match(uploaded.sha256, /^[0-9a-f]{64}$/);
  assert.equal(puts.length, 1);
  assert.equal(puts[0][0], grant.objectKey);
  assert.equal(puts[0][2].httpMetadata.cacheControl, "public, max-age=31536000, immutable");
  assert.equal(puts[0][2].onlyIf.etagDoesNotMatch, "*");
  assert.equal(puts[0][2].customMetadata.width, "1200");
  const uploadAudit = auditPoints.find((point) => point.blobs?.[0] === "asset.upload.success");
  assert.ok(uploadAudit);
  assert.doesNotMatch(JSON.stringify(uploadAudit), new RegExp(grant.headers["x-upload-token"].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("asset upload rejects unsupported, oversized and forged image data", async () => {
  const env = {
    ...ENV,
    ASSET_PUBLIC_BASE: "https://assets.example.com",
    ASSETS: { async put() { throw new Error("invalid images must not reach R2"); } },
  };
  const auth = await authenticate(env);
  const unsupported = await worker.fetch(request("/api/v1/admin/assets/presign", {
    method: "POST",
    headers: { origin: SITE_ORIGIN, cookie: auth.sessionCookie, "x-csrf-token": auth.csrfToken, "content-type": "application/json" },
    body: JSON.stringify({ fileName: "cover.svg", mime: "image/svg+xml", bytes: 100 }),
  }), env, context());
  assert.equal(unsupported.status, 415);

  const oversized = await worker.fetch(request("/api/v1/admin/assets/presign", {
    method: "POST",
    headers: { origin: SITE_ORIGIN, cookie: auth.sessionCookie, "x-csrf-token": auth.csrfToken, "content-type": "application/json" },
    body: JSON.stringify({ fileName: "cover.png", mime: "image/png", bytes: 9 * 1024 * 1024 }),
  }), env, context());
  assert.equal(oversized.status, 413);

  const forged = new Uint8Array(24);
  const grantResponse = await worker.fetch(request("/api/v1/admin/assets/presign", {
    method: "POST",
    headers: { origin: SITE_ORIGIN, cookie: auth.sessionCookie, "x-csrf-token": auth.csrfToken, "content-type": "application/json" },
    body: JSON.stringify({ fileName: "fake.png", mime: "image/png", bytes: forged.byteLength }),
  }), env, context());
  const grant = await grantResponse.json();
  const uploadResponse = await worker.fetch(new Request(grant.uploadUrl, {
    method: "PUT",
    headers: { origin: SITE_ORIGIN, ...grant.headers },
    body: forged,
  }), env, context());
  assert.equal(uploadResponse.status, 415);
  assert.equal((await uploadResponse.json()).error.code, "invalid_image");
});

test("media library requires the owner session and returns sanitized R2 metadata", async () => {
  const listOptions = [];
  const env = {
    ...ENV,
    ASSET_PUBLIC_BASE: "https://assets.example.com/library",
    ASSETS: {
      async put() {},
      async list(options) {
        listOptions.push(options);
        return {
          truncated: true,
          cursor: "next-page-token",
          objects: [
            {
              key: "images/uploads/2026/08/new-cover.webp",
              size: 2048,
              uploaded: new Date("2026-08-07T03:00:00.000Z"),
              httpMetadata: { contentType: "image/webp" },
              customMetadata: { width: "1600", height: "900", sha256: "a".repeat(64), uploadedBy: "owner" },
            },
            {
              key: "images/uploads/2026/07/old-cover.png",
              size: 1024,
              uploaded: "2026-07-01T02:00:00.000Z",
              customMetadata: { width: "bad", height: "630", sha256: "not-a-hash" },
            },
            {
              key: "private/not-visible.png",
              size: 10,
              uploaded: "2026-08-07T04:00:00.000Z",
            },
          ],
        };
      },
    },
  };

  const unauthenticated = await worker.fetch(request("/api/v1/admin/assets", {
    headers: { origin: SITE_ORIGIN },
  }), env, context());
  assert.equal(unauthenticated.status, 401);
  assert.equal(listOptions.length, 0);

  const auth = await authenticate(env);
  const response = await worker.fetch(request("/api/v1/admin/assets?limit=12&cursor=opaque-cursor", {
    headers: { origin: SITE_ORIGIN, cookie: auth.sessionCookie },
  }), env, context());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), SITE_ORIGIN);
  assert.deepEqual(listOptions[0], {
    prefix: "images/uploads/",
    limit: 12,
    cursor: "opaque-cursor",
    include: ["httpMetadata", "customMetadata"],
  });
  const result = await response.json();
  assert.equal(result.assets.length, 2);
  assert.equal(result.assets[0].publicUrl, "https://assets.example.com/library/images/uploads/2026/08/new-cover.webp");
  assert.equal(result.assets[0].mime, "image/webp");
  assert.equal(result.assets[0].width, 1600);
  assert.equal(result.assets[0].sha256, "a".repeat(64));
  assert.equal(result.assets[0].uploadedBy, undefined);
  assert.equal(result.assets[1].mime, "image/png");
  assert.equal(result.assets[1].width, null);
  assert.equal(result.assets[1].sha256, "");
  assert.equal(result.cursor, "next-page-token");
  assert.equal(result.hasMore, true);
});

test("media library rejects invalid pagination before accessing R2", async () => {
  let listed = false;
  const env = {
    ...ENV,
    ASSET_PUBLIC_BASE: "https://assets.example.com",
    ASSETS: { async put() {}, async list() { listed = true; return { objects: [], truncated: false }; } },
  };
  const auth = await authenticate(env);
  const response = await worker.fetch(request("/api/v1/admin/assets?limit=61", {
    headers: { origin: SITE_ORIGIN, cookie: auth.sessionCookie },
  }), env, context());
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "invalid_asset_page");
  assert.equal(listed, false);
});

test("orphan asset audit compares the published manifest across paginated R2 inventory", async () => {
  const listOptions = [];
  const auditPoints = [];
  const env = {
    ...ENV,
    ASSET_PUBLIC_BASE: "https://assets.example.com",
    AUDIT_EVENTS: { writeDataPoint(point) { auditPoints.push(point); } },
    ASSETS: {
      async put() {},
      async list(options) {
        listOptions.push(options);
        if (!options.cursor) {
          return {
            truncated: true,
            cursor: "page-2",
            objects: [
              {
                key: "images/uploads/2020/01/referenced.webp",
                size: 2000,
                uploaded: "2020-01-01T00:00:00.000Z",
                httpMetadata: { contentType: "image/webp" },
              },
              {
                key: "images/uploads/2020/01/orphan.png",
                size: 3000,
                uploaded: "2020-01-02T00:00:00.000Z",
                customMetadata: { width: "1200", height: "630", sha256: "c".repeat(64) },
              },
            ],
          };
        }
        return {
          truncated: false,
          objects: [{
            key: "images/uploads/2099/01/recent.jpg",
            size: 4000,
            uploaded: "2099-01-01T00:00:00.000Z",
          }],
        };
      },
    },
  };

  const unauthenticated = await worker.fetch(request("/api/v1/admin/assets/orphans", {
    headers: { origin: SITE_ORIGIN },
  }), env, context());
  assert.equal(unauthenticated.status, 401);
  assert.equal(listOptions.length, 0);

  const auth = await authenticate(env);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    assert.equal(String(input), `${SITE_ORIGIN}/asset-references.json`);
    return jsonResponse({
      version: 1,
      contentHash: createHash("sha256").update("images/uploads/2020/01/referenced.webp").digest("hex"),
      references: ["images/uploads/2020/01/referenced.webp"],
    });
  };
  try {
    const response = await worker.fetch(request("/api/v1/admin/assets/orphans?minimumAgeDays=30", {
      headers: { origin: SITE_ORIGIN, cookie: auth.sessionCookie },
    }), env, context());
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.dryRun, true);
    assert.equal(result.minimumAgeDays, 30);
    assert.equal(result.referenceHash, createHash("sha256").update("images/uploads/2020/01/referenced.webp").digest("hex"));
    assert.equal(result.scanned, 3);
    assert.equal(result.referenced, 1);
    assert.equal(result.reclaimableBytes, 3000);
    assert.deepEqual(result.candidates.map((asset) => asset.objectKey), ["images/uploads/2020/01/orphan.png"]);
    assert.equal(result.candidates[0].uploadedBy, undefined);
    assert.equal(listOptions.length, 2);
    assert.equal(listOptions[0].limit, 1000);
    assert.equal(listOptions[1].cursor, "page-2");
    assert.ok(auditPoints.some((point) => point.blobs?.[0] === "asset.orphan.audit"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("orphan asset audit rejects unsafe age and malformed manifests without deleting objects", async () => {
  let listed = false;
  const env = {
    ...ENV,
    ASSET_PUBLIC_BASE: "https://assets.example.com",
    ASSETS: { async put() {}, async list() { listed = true; return { truncated: false, objects: [] }; } },
  };
  const auth = await authenticate(env);
  const invalidAge = await worker.fetch(request("/api/v1/admin/assets/orphans?minimumAgeDays=1", {
    headers: { origin: SITE_ORIGIN, cookie: auth.sessionCookie },
  }), env, context());
  assert.equal(invalidAge.status, 400);
  assert.equal((await invalidAge.json()).error.code, "invalid_orphan_audit");
  assert.equal(listed, false);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse({ version: 1, contentHash: "bad", references: ["../private.png"] });
  try {
    const invalidManifest = await worker.fetch(request("/api/v1/admin/assets/orphans", {
      headers: { origin: SITE_ORIGIN, cookie: auth.sessionCookie },
    }), env, context());
    assert.equal(invalidManifest.status, 502);
    assert.equal((await invalidManifest.json()).error.code, "asset_manifest_invalid");
    assert.equal(listed, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("knowledge chat combines retrieval with cited SSE sources without logging the question", async () => {
  const auditPoints = [];
  const modelCalls = [];
  const env = aiEnv({
    AUDIT_EVENTS: { writeDataPoint(point) { auditPoints.push(point); } },
  });
  const originalAiRun = env.AI.run;
  env.AI.run = async (model, input) => {
    modelCalls.push({ model, input });
    return originalAiRun(model, input);
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    if (String(input) === `${SITE_ORIGIN}/knowledge/chunks.json`) return jsonResponse(knowledgeDataset());
    throw new Error(`Unexpected request: ${input}`);
  };
  try {
    const response = await worker.fetch(request("/api/v1/ai/chat", {
      method: "POST",
      headers: { origin: SITE_ORIGIN, "cf-connecting-ip": "203.0.113.10", "content-type": "application/json" },
      body: JSON.stringify({ question: "管理系统如何降低发布风险？", history: [] }),
    }), env, context());
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /^text\/event-stream/);
    const stream = await response.text();
    assert.match(stream, /event: delta/);
    assert.match(stream, /\[1\]/);
    assert.match(stream, /event: sources/);
    assert.match(stream, /\/post\/manage-system\//);
    assert.equal(modelCalls.length, 2, "one embedding and one grounded answer call are expected");
    assert.equal(modelCalls[1].model, "chat-model");
    const audit = auditPoints.find((point) => point.blobs?.[0] === "ai.answer.success");
    assert.ok(audit);
    assert.doesNotMatch(JSON.stringify(audit), /管理系统如何降低发布风险/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("knowledge chat fails closed when disabled and returns no-evidence without calling the chat model", async () => {
  const disabled = await worker.fetch(request("/api/v1/ai/chat", {
    method: "POST",
    headers: { origin: SITE_ORIGIN, "content-type": "application/json" },
    body: JSON.stringify({ question: "测试问题" }),
  }), { ...ENV, AI_ENABLED: "false" }, context());
  assert.equal(disabled.status, 503);
  assert.equal((await disabled.json()).error.code, "ai_disabled");

  let modelCalls = 0;
  const env = aiEnv({
    AI: { async run(_model, input) { modelCalls += 1; return input.text ? { data: [[0.1, 0.2]] } : { response: "must not run" }; } },
    VECTORIZE: { async query() { return { matches: [] }; }, async upsert() {} },
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    if (String(input) === `${SITE_ORIGIN}/knowledge/chunks.json`) return jsonResponse(knowledgeDataset());
    throw new Error(`Unexpected request: ${input}`);
  };
  try {
    const response = await worker.fetch(request("/api/v1/ai/chat", {
      method: "POST",
      headers: { origin: SITE_ORIGIN, "cf-connecting-ip": "203.0.113.11", "content-type": "application/json" },
      body: JSON.stringify({ question: "量子烹饪是什么？", history: [] }),
    }), env, context());
    assert.equal(response.status, 200);
    const stream = await response.text();
    assert.match(stream, /没有足够依据/);
    assert.match(stream, /"sources":\[\]/);
    assert.equal(modelCalls, 1, "only the query embedding may run without grounded evidence");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("knowledge chat enforces the atomic rate limiter before model access", async () => {
  let modelCalls = 0;
  const env = aiEnv({
    AI: { async run() { modelCalls += 1; return { data: [[0.1]] }; } },
    AI_BUDGET: {
      idFromName() { return "global"; },
      get() { return { async fetch() { return jsonResponse({ error: "rate_limited" }, 429); } }; },
    },
  });
  const response = await worker.fetch(request("/api/v1/ai/chat", {
    method: "POST",
    headers: { origin: SITE_ORIGIN, "cf-connecting-ip": "203.0.113.12", "content-type": "application/json" },
    body: JSON.stringify({ question: "管理系统架构" }),
  }), env, context());
  assert.equal(response.status, 429);
  assert.equal((await response.json()).error.code, "rate_limited");
  assert.equal(modelCalls, 0);
});

test("authenticated knowledge reindex embeds current chunks with dataset isolation metadata", async () => {
  const upserts = [];
  const env = aiEnv({
    VECTORIZE: {
      async query() { return { matches: [] }; },
      async upsert(vectors) { upserts.push(vectors); },
    },
  });
  const auth = await authenticate(env);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    if (String(input) === `${SITE_ORIGIN}/knowledge/chunks.json`) return jsonResponse(knowledgeDataset());
    throw new Error(`Unexpected request: ${input}`);
  };
  try {
    const response = await worker.fetch(request("/api/v1/admin/knowledge/reindex", {
      method: "POST",
      headers: { origin: SITE_ORIGIN, cookie: auth.sessionCookie, "x-csrf-token": auth.csrfToken },
    }), env, context());
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { datasetHash: "a".repeat(64), vectors: 1 });
    assert.equal(upserts.length, 1);
    assert.equal(upserts[0][0].metadata.datasetHash, "a".repeat(64));
    assert.equal(upserts[0][0].id, "manage-system-0-abcdef123456");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AiBudget atomically enforces per-minute and daily limits without retaining raw IPs", async () => {
  const values = new Map();
  const budget = new AiBudget({
    storage: {
      async get(key) { return values.get(key); },
      async put(key, value) { values.set(key, value); },
    },
  });
  const body = JSON.stringify({ ipHash: "hashed-client-identifier", dailyLimit: 10, minuteLimit: 2 });
  assert.equal((await budget.fetch(new Request("https://budget/check", { method: "POST", body }))).status, 200);
  assert.equal((await budget.fetch(new Request("https://budget/check", { method: "POST", body }))).status, 200);
  assert.equal((await budget.fetch(new Request("https://budget/check", { method: "POST", body }))).status, 429);
  const dailyBody = JSON.stringify({ ipHash: "different-hashed-client", dailyLimit: 2, minuteLimit: 10 });
  assert.equal((await budget.fetch(new Request("https://budget/check", { method: "POST", body: dailyBody }))).status, 503);
  assert.doesNotMatch(JSON.stringify([...values]), /203\.0\.113\./);
});
