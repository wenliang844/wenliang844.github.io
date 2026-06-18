# Changelog

All notable project changes are recorded here. This file complements the Git
history with a concise, human-readable release trail.

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
