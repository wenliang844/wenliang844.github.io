# Changelog

All notable project changes are recorded here. This file complements the Git
history with a concise, human-readable release trail.

## 2026-08-10

### Security

- Replaced site-wide `connect-src https:` with page-capability allowlists for analytics, subscriptions, fixed AI presets, Web3Forms, and the configured edge API; arbitrary HTTPS remains isolated to the toolbox API tester.
- Made assistant relay endpoints read-only, coerced mutated and legacy custom endpoints to fixed presets, validated the origin immediately before each model fetch, and stopped persisting BYOK API keys.
- Added regression coverage that rejects broad public-page network access and verifies old stored endpoints and secrets are erased during configuration migration.
- Added an explicit offline knowledge evaluation gate with full-document coverage, ≥90% Top-3 recall, ≥90% off-topic rejection, and bounded citation indexes in model responses.

### Added

- Added a deterministic content-health dashboard and `knowledge/health.json` artifact covering freshness, topic targets, link/graph isolation, and a prioritized maintenance queue.
- Added monthly checksummed content snapshots, optional read-only R2 mirroring, 90-day CI artifacts, and an isolated restore rehearsal that refuses to overwrite an existing directory.
- Added content-hashed PWA cache versioning so public CSS, JavaScript, images, fonts, offline markup, and manifest changes automatically evict stale shared assets.

## 2026-08-07

### Added

- Added Astro 7 Content Collections with a typed post schema, static `/post/` route generation, scoped output synchronization, and zero-diagnostic `astro check` CI validation.
- Added an Astro migration contract that preserves Git as the content source and keeps legacy URLs, canonical metadata, RSS, knowledge artifacts, and GitHub Pages root deployment stable during gradual migration.
- Added an authenticated, paginated R2 media library that lets the editor filter and reuse uploaded images as covers or Markdown body assets without exposing private object metadata.
- Added a build-time uploaded-asset reference manifest and authenticated R2 orphan audit with a mandatory dry-run response and minimum-age protection.
- Added authenticated pull-request status aggregation and bounded editor polling for GitHub Check Runs, merge, failure, and closed states.
- Replaced script-side `unsafe-inline` across all HTML with exact JSON-LD SHA-256 hashes, disabled inline event handlers, and scoped WASM/CDN script permissions to the tool workspace.
- Removed style-side `unsafe-inline` from every public route by replacing runtime style mutation with classes, data attributes, native progress, CSS-sized canvases, and image swatches; retained a tested route-only exception for CodeMirror runtime measurement.
- Granted the narrow `wasm-unsafe-eval` capability to Pagefind consumers and moved global error-toast styling into the static stylesheet so strict public-page CSP remains functional in real browsers.

### Changed

- Raised the supported Node.js runtime to 22.12.0 and shared one post-domain transformation between Astro routes and the compatibility build pipeline.
- Updated production validation to execute the complete hybrid build and require the Astro generation marker on article output.

## 2026-08-06

### Added

- Added category and series pages, continuous series navigation, article revision metadata, and a knowledge asset graph derived from tags, series, and internal references.
- Added Pagefind full-text search, full-content RSS, responsive AVIF/WebP cover generation, required cover alternative text, and privacy-aware Umami/Plausible event tracking.
- Added IndexedDB multi-draft editing, draft build exclusion, a public-content-only PWA, responsive Playwright tests, Lighthouse budgets, and source secret scanning.
- Added a route-isolated CodeMirror 6 Markdown workspace with slash commands, keyboard formatting, live diagnostics, synchronized preview, and a strict `tsc --noEmit` quality gate.
- Added WikiLink parsing, build-time internal-link validation, article backlinks, and content-reference edges in the knowledge graph.
- Added a deployable Cloudflare Worker for single-owner GitHub OAuth, signed sessions, CSRF/Origin enforcement, content validation, branch/PR publishing, preview URLs, failure rollback, and Analytics Engine audit events.
- Added editor-side tags, GitHub connection state, PR publishing controls, and PR/preview result links without persisting credentials or CSRF tokens.
- Added authenticated R2 image uploads with five-minute signed grants, server-side signature/dimension validation, SHA-256 metadata, random immutable object keys, and editor cover selection.
- Added explainable build-time article recommendations weighted by content links, series, category, shared tags, and publication proximity.
- Added grounded knowledge Q&A with stable public chunks, hybrid lexical/vector retrieval, cited SSE responses, atomic rate/budget control, manual reindexing, and scheduled vector refresh.

### Changed

- Replaced full-article list rendering with scannable summary cards while preserving legacy `/post/#slug` anchors.
- Disabled incomplete article language switching, made the mobile table of contents a closed-by-default bottom drawer, and split new content styles into `css/content.css`.
- Upgraded Sharp and Playwright; the official npm registry audit now reports zero known vulnerabilities.
- Removed automatic resume and next-article overlays from compact viewports so reading controls do not cover article or recommendation content.

### Security

- Removed browser-distributed AI credentials and limited offline caching to same-origin public GET requests. Authoring routes and future API routes explicitly bypass the Service Worker.
- Extended the private-route cache boundary to subresources whose referrer is an authoring route, and rotated the public cache to evict any previously cached editor bundles.
- Scoped generated-page CSP script origins by capability: Giscus is granted only on article pages and jsDelivr only on the tool workspace.

## 2026-06-19

### Added

- Added GitHub Actions quality gates, Dependabot checks, Node.js engine metadata,
  production validation, post front matter validation, coverage thresholds, and
  a structured changelog.
- Added per-page and article structured data, article cover/social images,
  image sitemap support, third-party resource hints, Markdown image loading
  hints, and full-site skip links.
- Added UX improvements for theme auto mode, mobile navigation overlay, search
  shortcut hints, subscription error states, local feedback clearing, compact
  mobile sharing, and JWT signature verification warnings.

### Changed

- Optimized particle animation scheduling and rendering, mobile backdrop-filter
  usage, search asset prewarming, blog article item caching, reading progress
  resize throttling, and hot-path particle removal.
- Consolidated RSS rendering, script deduplication, reading time calculation,
  HTML tidying protections, copy helpers, i18n helpers, DOM collection handling,
  and editor export front matter.
- Improved bfcache compatibility by moving giscus observer cleanup to
  `pagehide`.

### Fixed

- Fixed missing CSP metadata, unsafe DOM rendering paths in search/giscus/QR
  flows, sitemap priority output, duplicate heading anchor handling, duplicate
  client TOC rendering, deprecated Navigation Timing and marked APIs, invalid
  subscription feedback states, and load-time back-to-top flicker.
- Fixed public content leakage risk by scanning posts for sensitive draft
  markers before build and CI validation.

### Security

- Removed the front-end hard-coded API key path, added source secret scanning,
  added full-site meta CSP validation, and added `npm audit` to the quality
  gates.

## 2026-06-18

### Added

- Added the toolbox experience for JSON, Base64, URL, UUID, and JWT utilities.
- Added the local-rule AI assistant experience and bilingual UI support.
- Added Giscus comments, article sharing, RSS/Atom/JSON feeds, sitemap output,
  and static-site build automation.

### Changed

- Expanded the blog into a tested static-site pipeline with Markdown posts,
  generated article pages, tag/archive pages, and production validation.
