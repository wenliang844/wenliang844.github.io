(function () {
  const storageKey = "wenliang-markdown-editor";
  const draftListKey = storageKey + "-drafts";
  const activeDraftKey = storageKey + "-active";
  const databaseName = "cwlblog-editor";
  const databaseStore = "drafts";
  const titleInput = document.getElementById("post-title");
  const shortTitleInput = document.getElementById("post-short-title");
  const slugInput = document.getElementById("post-slug");
  const dateInput = document.getElementById("post-date");
  const categoryInput = document.getElementById("post-category");
  const seriesInput = document.getElementById("post-series");
  const seriesOrderInput = document.getElementById("post-series-order");
  const summaryInput = document.getElementById("post-summary");
  const descriptionInput = document.getElementById("post-description");
  const tagsInput = document.getElementById("post-tags");
  const coverInput = document.getElementById("post-cover");
  const coverAltInput = document.getElementById("post-cover-alt");
  const coverFileInput = document.getElementById("post-cover-file");
  const uploadCoverButton = document.querySelector('[data-action="upload-cover"]');
  const assetUploadStatus = document.getElementById("editor-asset-upload-status");
  const mediaLibraryButton = document.querySelector('[data-action="open-media-library"]');
  const mediaDialog = document.getElementById("editor-media-library");
  const mediaSearchInput = document.getElementById("editor-media-search");
  const mediaStatus = document.getElementById("editor-media-status");
  const mediaGrid = document.getElementById("editor-media-grid");
  const mediaMoreButton = document.getElementById("editor-media-more");
  const markdownInput = document.getElementById("markdown-input");
  const preview = document.getElementById("markdown-preview");
  const statsEl = document.getElementById("editor-stats");
  const draftInput = document.getElementById("post-draft");
  const draftSelect = document.getElementById("draft-select");
  const saveStatus = document.getElementById("draft-save-status");
  const apiMeta = document.querySelector('meta[name="cwl-api-base"]');
  const publishPanel = document.getElementById("editor-publish-panel");
  const publishStatus = document.getElementById("editor-publish-status");
  const connectButton = document.querySelector('[data-action="connect-github"]');
  const publishButton = document.querySelector('[data-action="publish-pr"]');
  const reindexButton = document.querySelector('[data-action="reindex-knowledge"]');
  const logoutButton = document.querySelector('[data-action="logout-github"]');
  const prLink = document.getElementById("editor-pr-link");
  const previewLink = document.getElementById("editor-preview-link");
  const ciStatus = document.getElementById("editor-ci-status");
  const drafts = new Map();
  let currentDraftId = "";
  let databasePromise = null;
  let publishSession = null;
  let mediaAssets = [];
  let mediaCursor = "";
  let mediaLoaded = false;
  let mediaLoading = false;
  let publishPollTimer = 0;
  let publishPollAttempts = 0;
  let activePullNumber = 0;

  if (!titleInput || !shortTitleInput || !slugInput || !dateInput || !summaryInput || !descriptionInput || !markdownInput || !preview) {
    return;
  }

  function markdownAdapter() {
    return window.CWLMarkdownEditor || null;
  }

  function getMarkdown() {
    const adapter = markdownAdapter();
    return adapter ? adapter.getValue() : markdownInput.value;
  }

  function setMarkdown(value, selection) {
    markdownInput.value = value;
    if (selection) {
      markdownInput.selectionStart = selection.from;
      markdownInput.selectionEnd = selection.to;
    }
    const adapter = markdownAdapter();
    if (adapter && adapter.getValue() !== value) {
      adapter.setValue(value, selection);
    } else if (adapter && selection) {
      adapter.setValue(value, selection);
    }
  }

  function markdownSelection() {
    const adapter = markdownAdapter();
    return adapter
      ? adapter.getSelection()
      : { from: markdownInput.selectionStart, to: markdownInput.selectionEnd };
  }

  function focusMarkdown() {
    const adapter = markdownAdapter();
    if (adapter) {
      adapter.focus();
    } else {
      markdownInput.focus();
    }
  }

  const sampleMarkdownZh = [
    "# 新文章标题",
    "",
    "> 在这里记录一篇新的博客。",
    "",
    "## 目标",
    "",
    "- 梳理问题背景",
    "- 记录解决方案",
    "- 总结后续优化",
    "",
    "## 代码片段",
    "",
    "```java",
    "public class HelloBlog {",
    "    public static void main(String[] args) {",
    "        System.out.println(\"Hello, blog!\");",
    "    }",
    "}",
    "```",
    "",
    "[返回博客列表](/post/)"
  ].join("\n");

  const t = window.CWLUtils.t;

  function sampleTitle() {
    return t("editor.sample.title", "新文章标题");
  }

  function sampleSummary() {
    return t("editor.sample.summary", "在这里记录一篇新的博客。");
  }

  function sampleMarkdown() {
    return t("editor.sample.markdown", sampleMarkdownZh);
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function slugify(value) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "post-" + today().replace(/-/g, "");
  }

  function createDraftId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return "draft-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
  }

  function readStorage(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  }

  function removeStorage(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      // Storage can be unavailable in privacy modes; editing still works in memory.
    }
  }

  function parseStoredJson(key, fallback) {
    try {
      const value = JSON.parse(readStorage(key));
      return value === null ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function openDatabase() {
    if (databasePromise) {
      return databasePromise;
    }
    databasePromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) {
        reject(new Error("IndexedDB unavailable"));
        return;
      }
      const request = window.indexedDB.open(databaseName, 1);
      request.onupgradeneeded = function () {
        const db = request.result;
        if (!db.objectStoreNames.contains(databaseStore)) {
          db.createObjectStore(databaseStore, { keyPath: "id" });
        }
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error("Unable to open draft database")); };
    });
    return databasePromise;
  }

  function databaseRequest(mode, operation) {
    return openDatabase().then(function (db) {
      return new Promise(function (resolve, reject) {
        const transaction = db.transaction(databaseStore, mode);
        const store = transaction.objectStore(databaseStore);
        const request = operation(store);
        request.onsuccess = function () { resolve(request.result); };
        request.onerror = function () { reject(request.error || new Error("Draft database request failed")); };
      });
    });
  }

  function readFallbackDrafts() {
    const stored = parseStoredJson(draftListKey, []);
    return Array.isArray(stored) ? stored : [];
  }

  function writeFallbackDrafts() {
    writeStorage(draftListKey, JSON.stringify(Array.from(drafts.values())));
  }

  function persistDraft(state) {
    return databaseRequest("readwrite", function (store) { return store.put(state); })
      .then(function () {
        removeStorage(draftListKey);
      })
      .catch(function () {
        writeFallbackDrafts();
      });
  }

  function deletePersistedDraft(id) {
    return databaseRequest("readwrite", function (store) { return store.delete(id); })
      .catch(function () {
        writeFallbackDrafts();
      });
  }

  // Configure marked once: GitHub-flavored Markdown with hard line breaks.
  // marked v5+ ignores the old highlight option; code blocks are highlighted
  // after rendering through highlightElement below.
  if (window.marked && typeof window.marked.setOptions === "function") {
    window.marked.setOptions({
      gfm: true,
      breaks: true
    });
  }

  function renderMarkdown(markdown) {
    const raw = markdown || "";
    let html;

    if (window.marked) {
      html = typeof window.marked.parse === "function"
        ? window.marked.parse(raw)
        : window.marked(raw);
    } else {
      html = "<pre>" + raw
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;") + "</pre>";
    }

    // Always sanitize before injecting into the DOM. Keep the class attribute
    // so highlight.js token spans (hljs-*) and language classes survive.
    if (window.DOMPurify) {
      html = window.DOMPurify.sanitize(html);
    }
    return html;
  }

  function yamlString(value) {
    const normalized = (value || "")
      .replace(/\r?\n/g, " ")
      .trim();
    return "\"" + normalized
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"') + "\"";
  }

  function postTags() {
    if (!tagsInput) {
      return [];
    }
    return Array.from(new Set(tagsInput.value
      .split(/[,，]/)
      .map(function (tag) { return tag.trim(); })
      .filter(Boolean)));
  }

  function frontMatter() {
    const title = titleInput.value.trim();
    const shortTitle = shortTitleInput.value.trim() || title;
    const summary = summaryInput.value.trim() || sampleSummary();
    const description = descriptionInput.value.trim() || summary;
    const lines = [
      "---",
      "title: " + yamlString(title),
      "shortTitle: " + yamlString(shortTitle),
      "slug: " + yamlString(slugify(slugInput.value || title)),
      "date: " + dateInput.value,
      "modified: " + dateInput.value,
      "category: " + yamlString(categoryInput ? categoryInput.value : "ai-coding"),
      "summary: " + yamlString(summary),
      "description: " + yamlString(description),
      "draft: " + String(draftInput ? draftInput.checked : false),
      "tags: [" + postTags().map(yamlString).join(", ") + "]",
    ];
    if (seriesInput && seriesInput.value) {
      lines.push("series: " + yamlString(seriesInput.value));
      lines.push("order: " + String(Math.max(1, Number.parseInt(seriesOrderInput ? seriesOrderInput.value : "1", 10) || 1)));
    }
    if (coverInput && coverInput.value.trim()) {
      lines.push("cover: " + yamlString(coverInput.value));
      lines.push("coverAlt: " + yamlString(coverAltInput ? coverAltInput.value : ""));
    }
    return lines.concat([
      "---",
      ""
    ]).join("\n");
  }

  function currentState() {
    return {
      id: currentDraftId,
      title: titleInput.value,
      shortTitle: shortTitleInput.value,
      slug: slugInput.value,
      date: dateInput.value,
      category: categoryInput ? categoryInput.value : "ai-coding",
      series: seriesInput ? seriesInput.value : "",
      seriesOrder: seriesOrderInput ? seriesOrderInput.value : "1",
      summary: summaryInput.value,
      description: descriptionInput.value,
      tags: tagsInput ? tagsInput.value : "",
      cover: coverInput ? coverInput.value : "",
      coverAlt: coverAltInput ? coverAltInput.value : "",
      markdown: getMarkdown(),
      draft: draftInput ? draftInput.checked : false,
      updatedAt: new Date().toISOString()
    };
  }

  function draftLabel(state) {
    return (state.title || state.shortTitle || t("editor.drafts.untitled", "未命名草稿")).trim();
  }

  function refreshDraftSelect() {
    if (!draftSelect) {
      return;
    }
    const sorted = Array.from(drafts.values()).sort(function (a, b) {
      return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
    });
    draftSelect.replaceChildren();
    sorted.forEach(function (state) {
      const option = document.createElement("option");
      option.value = state.id;
      option.textContent = draftLabel(state);
      draftSelect.appendChild(option);
    });
    draftSelect.value = currentDraftId;
  }

  function setSaveStatus(key, fallback) {
    if (saveStatus) {
      saveStatus.textContent = t(key, fallback);
    }
  }

  function saveState() {
    if (!currentDraftId) {
      currentDraftId = createDraftId();
    }
    const state = currentState();
    drafts.set(currentDraftId, state);
    writeStorage(storageKey, JSON.stringify(state));
    writeStorage(activeDraftKey, currentDraftId);
    refreshDraftSelect();
    setSaveStatus("editor.drafts.saving", "保存中...");
    persistDraft(state).finally(function () {
      setSaveStatus("editor.drafts.saved", "已自动保存");
    });
  }

  function updateStats() {
    if (!statsEl) {
      return;
    }
    const text = getMarkdown();
    const chars = text.length;
    const chinese = (text.match(/[一-龥]/g) || []).length;
    const rest = text.replace(/[一-龥]/g, " ").trim();
    const words = rest ? rest.split(/\s+/).length : 0;
    const totalWords = chinese + words;
    const minutes = window.CWLUtils.readingMinutes(text);
    statsEl.textContent = t("editor.stats", "{words} 词 · {chars} 字符 · 约 {minutes} 分钟")
      .replace("{words}", totalWords)
      .replace("{chars}", chars)
      .replace("{minutes}", minutes);
  }

  function render() {
    preview.innerHTML = renderMarkdown(getMarkdown());
    // Highlight rendered code blocks after marked has produced the preview.
    if (window.hljs) {
      preview.querySelectorAll("pre code").forEach(function (block) {
        if (!block.dataset.highlighted) {
          try {
            window.hljs.highlightElement(block);
          } catch (error) {
            // 高亮失败，保留原始代码
          }
          block.dataset.highlighted = "yes";
        }
      });
    }
    updateStats();
    saveState();
  }

  function download(filename, content, type) {
    const blob = new Blob([content], { type: type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function applyState(stored, useSample) {
    const state = stored || {};
    titleInput.value = state.title || (useSample ? sampleTitle() : "");
    shortTitleInput.value = state.shortTitle || (useSample ? titleInput.value : "");
    slugInput.value = state.slug ? slugify(state.slug) : (useSample ? slugify(titleInput.value) : "");
    dateInput.value = state.date || today();
    if (categoryInput) {
      categoryInput.value = state.category || "ai-coding";
    }
    if (seriesInput) {
      seriesInput.value = state.series || "";
    }
    if (seriesOrderInput) {
      seriesOrderInput.value = state.seriesOrder || "1";
      seriesOrderInput.disabled = !(seriesInput && seriesInput.value);
    }
    summaryInput.value = state.summary || (useSample ? sampleSummary() : "");
    descriptionInput.value = state.description || (useSample ? summaryInput.value : "");
    if (tagsInput) {
      tagsInput.value = state.tags || (useSample ? "技术博客, 写作" : "");
    }
    if (coverInput) {
      coverInput.value = state.cover || "";
    }
    if (coverAltInput) {
      coverAltInput.value = state.coverAlt || "";
    }
    setMarkdown(state.markdown || (useSample ? sampleMarkdown() : ""));
    if (draftInput) {
      draftInput.checked = typeof state.draft === "boolean" ? state.draft : Boolean(useSample);
    }
  }

  function loadInitialState() {
    const stored = parseStoredJson(storageKey, null);
    currentDraftId = readStorage(activeDraftKey) || (stored && stored.id) || createDraftId();
    applyState(stored, true);
  }

  async function initializeDraftStore() {
    const legacyState = currentState();
    let storedDrafts;
    try {
      storedDrafts = await databaseRequest("readonly", function (store) { return store.getAll(); });
    } catch (error) {
      storedDrafts = readFallbackDrafts();
    }
    if (!window.document || !window.document.documentElement) {
      return;
    }
    if (!Array.isArray(storedDrafts) || !storedDrafts.length) {
      storedDrafts = [legacyState];
    }
    storedDrafts.forEach(function (state) {
      if (state && state.id) {
        drafts.set(state.id, state);
      }
    });
    if (!drafts.has(currentDraftId)) {
      drafts.set(currentDraftId, legacyState);
    }
    refreshDraftSelect();
    await persistDraft(drafts.get(currentDraftId));
  }

  /* ----------------------------------------------------------------------
   * Toolbar: wrap/insert Markdown around the current selection
   * -------------------------------------------------------------------- */
  function applyFormat(kind) {
    const selection = markdownSelection();
    const start = selection.from;
    const end = selection.to;
    const value = getMarkdown();
    const selected = value.slice(start, end);
    const before = value.slice(0, start);
    const after = value.slice(end);
    let inner, newStart, newEnd, nextValue;

    function wrap(left, right, placeholder) {
      inner = selected || placeholder;
      const text = left + inner + right;
      nextValue = before + text + after;
      newStart = start + left.length;
      newEnd = newStart + inner.length;
    }

    function linePrefix(prefix) {
      inner = selected || "";
      const lines = (inner || t("editor.fmt.list", "列表项")).split("\n");
      const text = lines.map(function (line, i) {
        if (prefix === "1. ") {
          return (i + 1) + ". " + line;
        }
        return prefix + line;
      }).join("\n");
      nextValue = before + text + after;
      newStart = start;
      newEnd = start + text.length;
    }

    switch (kind) {
      case "bold": wrap("**", "**", t("editor.fmt.bold", "粗体")); break;
      case "italic": wrap("*", "*", t("editor.fmt.italic", "斜体")); break;
      case "code": wrap("`", "`", t("editor.fmt.code", "代码")); break;
      case "heading": linePrefix("## "); break;
      case "quote": linePrefix("> "); break;
      case "ul": linePrefix("- "); break;
      case "ol": linePrefix("1. "); break;
      case "link": {
        inner = selected || t("editor.fmt.link", "链接文字");
        const linkText = "[" + inner + "](https://)";
        nextValue = before + linkText + after;
        newStart = start + 1;
        newEnd = newStart + inner.length;
        break;
      }
      case "image": {
        inner = selected || t("editor.fmt.image", "图片描述");
        const imgText = "![" + inner + "](https://)";
        nextValue = before + imgText + after;
        newStart = start + 2;
        newEnd = newStart + inner.length;
        break;
      }
      case "codeblock": {
        inner = selected || t("editor.fmt.codeblock", "在此粘贴代码");
        const block = "```\n" + inner + "\n```";
        nextValue = before + block + after;
        newStart = start + 4;
        newEnd = newStart + inner.length;
        break;
      }
      case "table": {
        const table = t("editor.fmt.table", "| 列1 | 列2 |\n| --- | --- |\n| 内容 | 内容 |");
        nextValue = before + table + after;
        newStart = start;
        newEnd = start + table.length;
        break;
      }
      default: return;
    }

    setMarkdown(nextValue, { from: newStart, to: newEnd });
    focusMarkdown();
    render();
  }

  window.CWLApplyMarkdownFormat = applyFormat;

  document.querySelectorAll(".tool-btn[data-md]").forEach(function (button) {
    button.addEventListener("click", function () {
      applyFormat(button.getAttribute("data-md"));
    });
  });

  // Keyboard shortcuts inside the textarea.
  markdownInput.addEventListener("keydown", function (event) {
    if (!(event.ctrlKey || event.metaKey)) {
      return;
    }
    const map = { b: "bold", i: "italic", k: "link" };
    const action = map[event.key.toLowerCase()];
    if (action) {
      event.preventDefault();
      applyFormat(action);
    }
  });

  /* ----------------------------------------------------------------------
   * Synced scrolling between editor and preview
   * -------------------------------------------------------------------- */
  let syncing = null;
  function linkScroll(source, target) {
    source.addEventListener("scroll", function () {
      if (syncing && syncing !== source) {
        return;
      }
      syncing = source;
      const max = source.scrollHeight - source.clientHeight;
      const ratio = max > 0 ? source.scrollTop / max : 0;
      const targetMax = target.scrollHeight - target.clientHeight;
      target.scrollTop = ratio * targetMax;
      window.requestAnimationFrame(function () {
        syncing = null;
      });
    }, { passive: true });
  }
  linkScroll(markdownInput, preview);
  linkScroll(preview, markdownInput);

  /* ----------------------------------------------------------------------
   * Inputs + actions
   * -------------------------------------------------------------------- */
  const debouncedRender = window.CWLUtils && window.CWLUtils.debounce
    ? window.CWLUtils.debounce(render, 150)
    : render;

  titleInput.addEventListener("input", function () {
    slugInput.value = slugify(titleInput.value);
    if (!shortTitleInput.value.trim()) {
      shortTitleInput.value = titleInput.value;
    }
    debouncedRender();
  });
  shortTitleInput.addEventListener("input", saveState);
  slugInput.addEventListener("input", saveState);
  dateInput.addEventListener("input", saveState);
  if (categoryInput) {
    categoryInput.addEventListener("change", saveState);
  }
  if (seriesInput) {
    seriesInput.addEventListener("change", function () {
      if (seriesOrderInput) {
        seriesOrderInput.disabled = !seriesInput.value;
      }
      saveState();
    });
  }
  if (seriesOrderInput) {
    seriesOrderInput.addEventListener("input", saveState);
  }
  summaryInput.addEventListener("input", saveState);
  descriptionInput.addEventListener("input", saveState);
  if (tagsInput) {
    tagsInput.addEventListener("input", saveState);
  }
  if (coverInput) {
    coverInput.addEventListener("input", saveState);
  }
  if (coverAltInput) {
    coverAltInput.addEventListener("input", saveState);
  }
  if (coverFileInput) {
    coverFileInput.addEventListener("change", function () {
      const file = coverFileInput.files && coverFileInput.files[0];
      setAssetUploadStatus(file ? file.name + " · " + Math.ceil(file.size / 1024) + " KB" : "选择图片后上传");
      updatePublishControls();
    });
  }
  if (draftInput) {
    draftInput.addEventListener("change", saveState);
  }
  markdownInput.addEventListener("input", debouncedRender);

  if (draftSelect) {
    draftSelect.addEventListener("change", function () {
      const next = drafts.get(draftSelect.value);
      if (!next) {
        return;
      }
      currentDraftId = next.id;
      writeStorage(activeDraftKey, currentDraftId);
      applyState(next, false);
      render();
    });
  }

  function copyHtml(button) {
    const html = preview.innerHTML;
    const done = function (ok) {
      const original = button.innerHTML;
      button.innerHTML = ok
        ? t("editor.btn.copied", '<i class="fas fa-check"></i> 已复制')
        : t("editor.btn.copyfail", '<i class="fas fa-copy"></i> 复制失败');
      window.setTimeout(function () { button.innerHTML = original; }, 1600);
    };
    Promise.resolve(window.CWLUtils.copyText(html)).then(done, function () { done(false); });
  }

  function configuredApiBase() {
    const value = apiMeta ? apiMeta.getAttribute("content").trim() : "";
    if (!value) {
      return "";
    }
    try {
      const url = new URL(value, window.location.origin);
      const local = url.hostname === "127.0.0.1" || url.hostname === "localhost";
      if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
        return "";
      }
      return url.origin + url.pathname.replace(/\/$/, "");
    } catch (error) {
      return "";
    }
  }

  function setPublishStatus(message, state) {
    if (!publishStatus) {
      return;
    }
    publishStatus.textContent = message;
    publishStatus.dataset.state = state || "idle";
  }

  function updatePublishControls() {
    const configured = Boolean(configuredApiBase());
    if (connectButton) {
      connectButton.disabled = !configured || Boolean(publishSession);
      connectButton.hidden = Boolean(publishSession);
    }
    if (publishButton) {
      publishButton.disabled = !configured || !publishSession;
    }
    if (reindexButton) {
      reindexButton.disabled = !configured || !publishSession;
    }
    if (logoutButton) {
      logoutButton.hidden = !publishSession;
    }
    if (uploadCoverButton) {
      uploadCoverButton.disabled = !configured || !publishSession || !coverFileInput || coverFileInput.files.length === 0;
    }
    if (mediaLibraryButton) {
      mediaLibraryButton.disabled = !configured || !publishSession;
    }
    if (mediaMoreButton) {
      mediaMoreButton.disabled = !configured || !publishSession || mediaLoading;
    }
  }

  function setAssetUploadStatus(message, state) {
    if (!assetUploadStatus) {
      return;
    }
    assetUploadStatus.textContent = message;
    assetUploadStatus.dataset.state = state || "idle";
  }

  function setMediaStatus(message, state) {
    if (!mediaStatus) {
      return;
    }
    mediaStatus.textContent = message;
    mediaStatus.dataset.state = state || "idle";
  }

  function mediaIcon(className) {
    const icon = document.createElement("i");
    icon.className = className;
    icon.setAttribute("aria-hidden", "true");
    return icon;
  }

  function formatMediaBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 1) {
      return "未知大小";
    }
    if (bytes < 1024 * 1024) {
      return Math.max(1, Math.round(bytes / 1024)) + " KB";
    }
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function useMediaAsCover(asset) {
    if (coverInput) {
      coverInput.value = asset.publicUrl;
    }
    saveState();
    setAssetUploadStatus("已从媒体库选择封面，请填写封面说明", "success");
    closeMediaLibrary();
    if (coverAltInput) {
      coverAltInput.focus();
    }
  }

  function insertMediaInBody(asset) {
    const selection = markdownSelection();
    const alt = "图片说明";
    const markdown = `![${alt}](${asset.publicUrl})`;
    const value = getMarkdown();
    const nextValue = value.slice(0, selection.from) + markdown + value.slice(selection.to);
    setMarkdown(nextValue, {
      from: selection.from + 2,
      to: selection.from + 2 + alt.length
    });
    render();
    closeMediaLibrary();
    focusMarkdown();
  }

  function renderMediaLibrary() {
    if (!mediaGrid) {
      return;
    }
    const query = mediaSearchInput ? mediaSearchInput.value.trim().toLowerCase() : "";
    const visible = mediaAssets.filter(function (asset) {
      return !query || asset.objectKey.toLowerCase().includes(query) || asset.mime.toLowerCase().includes(query);
    });
    mediaGrid.replaceChildren();
    if (!visible.length && !mediaLoading) {
      const empty = document.createElement("p");
      empty.className = "editor-media-empty";
      empty.textContent = mediaAssets.length ? "没有匹配的图片" : "媒体库暂无图片";
      mediaGrid.appendChild(empty);
    }
    visible.forEach(function (asset) {
      const item = document.createElement("article");
      item.className = "editor-media-item";
      const image = document.createElement("img");
      image.src = asset.publicUrl;
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.referrerPolicy = "no-referrer";

      const body = document.createElement("div");
      body.className = "editor-media-item-body";
      const key = document.createElement("span");
      key.className = "editor-media-key";
      key.textContent = asset.objectKey;
      key.title = asset.objectKey;
      const meta = document.createElement("span");
      meta.className = "editor-media-meta";
      const dimensions = asset.width && asset.height ? `${asset.width}×${asset.height} · ` : "";
      meta.textContent = dimensions + formatMediaBytes(asset.bytes);

      const actions = document.createElement("div");
      actions.className = "editor-media-actions";
      const cover = document.createElement("button");
      cover.className = "editor-button";
      cover.type = "button";
      cover.append(mediaIcon("fas fa-image"), document.createTextNode(" 封面"));
      cover.addEventListener("click", function () { useMediaAsCover(asset); });
      const insert = document.createElement("button");
      insert.className = "editor-button";
      insert.type = "button";
      insert.append(mediaIcon("fas fa-file-import"), document.createTextNode(" 正文"));
      insert.addEventListener("click", function () { insertMediaInBody(asset); });
      actions.append(cover, insert);
      body.append(key, meta, actions);
      item.append(image, body);
      mediaGrid.appendChild(item);
    });
    if (mediaMoreButton) {
      mediaMoreButton.hidden = !mediaCursor;
    }
  }

  async function loadMediaLibrary(append) {
    if (!publishSession || mediaLoading) {
      return;
    }
    mediaLoading = true;
    updatePublishControls();
    setMediaStatus(append ? "正在加载更多图片..." : "正在加载媒体库...", "loading");
    try {
      const path = "/api/v1/admin/assets?limit=24" + (append && mediaCursor ? "&cursor=" + encodeURIComponent(mediaCursor) : "");
      const result = await apiRequest(path);
      const assets = Array.isArray(result.assets) ? result.assets.filter(function (asset) {
        if (!asset || typeof asset.objectKey !== "string" || !asset.objectKey.startsWith("images/uploads/")) {
          return false;
        }
        if (typeof asset.publicUrl !== "string" || !/^https:\/\//.test(asset.publicUrl)) {
          return false;
        }
        return typeof asset.mime === "string" && /^image\/(avif|jpeg|png|webp)$/.test(asset.mime);
      }) : [];
      const combined = append ? mediaAssets.concat(assets) : assets;
      const unique = new Map();
      combined.forEach(function (asset) { unique.set(asset.objectKey, asset); });
      mediaAssets = Array.from(unique.values());
      mediaCursor = typeof result.cursor === "string" && result.cursor.length <= 1024 ? result.cursor : "";
      mediaLoaded = true;
      setMediaStatus("已加载 " + mediaAssets.length + " 张图片", "success");
    } catch (error) {
      setMediaStatus(error && error.message ? error.message : "媒体库加载失败", "error");
    } finally {
      mediaLoading = false;
      updatePublishControls();
      renderMediaLibrary();
    }
  }

  function openMediaLibrary() {
    if (!publishSession || !mediaDialog) {
      return;
    }
    mediaDialog.hidden = false;
    if (typeof mediaDialog.showModal === "function" && !mediaDialog.open) {
      mediaDialog.showModal();
    } else {
      mediaDialog.setAttribute("open", "");
    }
    if (!mediaLoaded) {
      loadMediaLibrary(false);
    } else {
      renderMediaLibrary();
    }
  }

  function closeMediaLibrary() {
    if (!mediaDialog) {
      return;
    }
    if (typeof mediaDialog.close === "function" && mediaDialog.open) {
      mediaDialog.close();
    }
    mediaDialog.removeAttribute("open");
    mediaDialog.hidden = true;
  }

  function clearPublishLinks() {
    [prLink, previewLink].forEach(function (link) {
      if (!link) {
        return;
      }
      link.hidden = true;
      link.removeAttribute("href");
    });
  }

  function setCiStatus(message, state) {
    if (!ciStatus) {
      return;
    }
    ciStatus.textContent = message;
    ciStatus.dataset.state = state || "idle";
    ciStatus.hidden = !message;
  }

  function stopPublishPolling(clearStatus) {
    if (publishPollTimer) {
      window.clearTimeout(publishPollTimer);
      publishPollTimer = 0;
    }
    publishPollAttempts = 0;
    activePullNumber = 0;
    if (clearStatus) {
      setCiStatus("", "idle");
    }
  }

  function schedulePublishPoll() {
    if (!activePullNumber || publishPollAttempts >= 30) {
      if (activePullNumber) {
        setCiStatus("CI 状态跟踪已暂停，请通过 PR 页面继续查看", "muted");
      }
      return;
    }
    publishPollTimer = window.setTimeout(pollPublishStatus, 10000);
  }

  async function pollPublishStatus() {
    const pullNumber = activePullNumber;
    if (!publishSession || !pullNumber) {
      return;
    }
    publishPollTimer = 0;
    publishPollAttempts += 1;
    try {
      const result = await apiRequest("/api/v1/admin/publish/status?pr=" + encodeURIComponent(pullNumber));
      if (result.pullNumber !== pullNumber || !["pending", "success", "failure", "merged", "closed"].includes(result.state)) {
        throw new Error("发布状态响应无效");
      }
      const checks = result.checks || {};
      if (result.state === "pending") {
        setCiStatus("CI 检查中（" + Number(checks.completed || 0) + "/" + Number(checks.total || 0) + "）", "loading");
        schedulePublishPoll();
        return;
      }
      const messages = {
        success: "CI 已通过，可以合并发布",
        failure: "CI 未通过，请打开 PR 查看失败项",
        merged: "PR 已合并，等待站点部署完成",
        closed: "PR 已关闭"
      };
      setCiStatus(messages[result.state], result.state === "success" || result.state === "merged" ? "success" : "error");
      stopPublishPolling(false);
    } catch (error) {
      if (publishPollAttempts >= 30) {
        setCiStatus(error && error.message ? error.message : "CI 状态查询失败", "error");
        stopPublishPolling(false);
      } else {
        setCiStatus("CI 状态暂不可用，将自动重试", "muted");
        schedulePublishPoll();
      }
    }
  }

  function startPublishPolling(pullNumber) {
    stopPublishPolling(true);
    if (!Number.isSafeInteger(pullNumber) || pullNumber < 1) {
      return;
    }
    activePullNumber = pullNumber;
    setCiStatus("正在读取 CI 状态...", "loading");
    pollPublishStatus();
  }

  function publishPayload() {
    return {
      title: titleInput.value.trim(),
      shortTitle: shortTitleInput.value.trim() || titleInput.value.trim(),
      slug: slugify(slugInput.value || titleInput.value),
      date: dateInput.value,
      category: categoryInput ? categoryInput.value : "ai-coding",
      series: seriesInput ? seriesInput.value : "",
      seriesOrder: Math.max(1, Number.parseInt(seriesOrderInput ? seriesOrderInput.value : "1", 10) || 1),
      summary: summaryInput.value.trim(),
      description: descriptionInput.value.trim(),
      cover: coverInput ? coverInput.value.trim() : "",
      coverAlt: coverAltInput ? coverAltInput.value.trim() : "",
      tags: postTags(),
      markdown: getMarkdown(),
      draft: draftInput ? draftInput.checked : false
    };
  }

  async function apiRequest(path, options) {
    const base = configuredApiBase();
    if (!base) {
      throw new Error("发布 API 未配置");
    }
    const response = await window.fetch(base + path, Object.assign({ credentials: "include" }, options || {}));
    const body = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      throw new Error(body && body.error && body.error.message ? body.error.message : "发布服务请求失败");
    }
    return body;
  }

  async function refreshPublishSession() {
    if (!publishPanel) {
      return;
    }
    stopPublishPolling(true);
    clearPublishLinks();
    if (!configuredApiBase()) {
      publishSession = null;
      setPublishStatus("发布 API 未配置", "muted");
      updatePublishControls();
      return;
    }
    setPublishStatus("检查 GitHub 会话...", "loading");
    try {
      publishSession = await apiRequest("/api/v1/auth/session");
      setPublishStatus("已连接 " + publishSession.login, "success");
    } catch (error) {
      publishSession = null;
      setPublishStatus("尚未连接 GitHub", "muted");
    }
    updatePublishControls();
  }

  async function publishPullRequest() {
    if (!publishSession || !publishButton) {
      return;
    }
    stopPublishPolling(true);
    clearPublishLinks();
    publishButton.disabled = true;
    setPublishStatus("正在创建内容分支与 PR...", "loading");
    try {
      const result = await apiRequest("/api/v1/admin/publish", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": publishSession.csrfToken
        },
        body: JSON.stringify(publishPayload())
      });
      if (prLink) {
        prLink.href = result.prUrl;
        prLink.hidden = false;
      }
      if (previewLink && result.previewUrl) {
        previewLink.href = result.previewUrl;
        previewLink.hidden = false;
      }
      setPublishStatus("发布 PR 已创建", "success");
      startPublishPolling(Number(result.pullNumber));
    } catch (error) {
      setPublishStatus(error && error.message ? error.message : "创建 PR 失败", "error");
    } finally {
      updatePublishControls();
    }
  }

  async function uploadCoverAsset() {
    if (!publishSession || !coverFileInput || !coverFileInput.files.length || !uploadCoverButton) {
      return;
    }
    const file = coverFileInput.files[0];
    if (!/^image\/(avif|jpeg|png|webp)$/.test(file.type) || file.size < 1 || file.size > 8 * 1024 * 1024) {
      setAssetUploadStatus("仅支持 8 MB 以内的 AVIF、JPEG、PNG 或 WebP", "error");
      return;
    }
    uploadCoverButton.disabled = true;
    setAssetUploadStatus("正在申请上传许可...", "loading");
    try {
      const grant = await apiRequest("/api/v1/admin/assets/presign", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": publishSession.csrfToken
        },
        body: JSON.stringify({ fileName: file.name, mime: file.type, bytes: file.size })
      });
      setAssetUploadStatus("正在校验并上传图片...", "loading");
      const response = await window.fetch(grant.uploadUrl, {
        method: "PUT",
        headers: grant.headers,
        body: file,
        credentials: "omit"
      });
      const result = await response.json().catch(function () { return {}; });
      if (!response.ok) {
        throw new Error(result && result.error && result.error.message ? result.error.message : "图片上传失败");
      }
      if (coverInput) {
        coverInput.value = result.publicUrl || grant.publicUrl;
      }
      coverFileInput.value = "";
      mediaLoaded = false;
      mediaAssets = [];
      mediaCursor = "";
      saveState();
      setAssetUploadStatus("图片已上传（" + result.width + "×" + result.height + "）", "success");
    } catch (error) {
      setAssetUploadStatus(error && error.message ? error.message : "图片上传失败", "error");
    } finally {
      updatePublishControls();
    }
  }

  async function logoutPublishSession() {
    if (!publishSession) {
      return;
    }
    try {
      await apiRequest("/api/v1/auth/logout", {
        method: "POST",
        headers: { "x-csrf-token": publishSession.csrfToken }
      });
    } catch (error) {
      setPublishStatus(error && error.message ? error.message : "断开失败", "error");
      return;
    }
    publishSession = null;
    mediaLoaded = false;
    mediaAssets = [];
    mediaCursor = "";
    closeMediaLibrary();
    stopPublishPolling(true);
    clearPublishLinks();
    setPublishStatus("尚未连接 GitHub", "muted");
    updatePublishControls();
  }

  async function reindexKnowledge() {
    if (!publishSession || !reindexButton) {
      return;
    }
    reindexButton.disabled = true;
    setPublishStatus("正在更新知识向量索引...", "loading");
    try {
      const result = await apiRequest("/api/v1/admin/knowledge/reindex", {
        method: "POST",
        headers: { "x-csrf-token": publishSession.csrfToken }
      });
      setPublishStatus("知识索引已更新（" + result.vectors + " 个分块）", "success");
    } catch (error) {
      setPublishStatus(error && error.message ? error.message : "知识索引更新失败", "error");
    } finally {
      updatePublishControls();
    }
  }

  document.querySelectorAll("[data-action]").forEach(function (button) {
    button.addEventListener("click", function () {
      const action = button.getAttribute("data-action");
      const slug = slugify(slugInput.value || titleInput.value);

      if (action === "new") {
        currentDraftId = createDraftId();
        titleInput.value = "";
        shortTitleInput.value = "";
        slugInput.value = "";
        dateInput.value = today();
        summaryInput.value = "";
        descriptionInput.value = "";
        if (tagsInput) {
          tagsInput.value = "";
        }
        setMarkdown("");
        if (draftInput) {
          draftInput.checked = true;
        }
        render();
      }

      if (action === "sample") {
        titleInput.value = sampleTitle();
        shortTitleInput.value = titleInput.value;
        slugInput.value = slugify(titleInput.value);
        dateInput.value = today();
        summaryInput.value = sampleSummary();
        descriptionInput.value = summaryInput.value;
        if (tagsInput) {
          tagsInput.value = "技术博客, 写作";
        }
        setMarkdown(sampleMarkdown());
        if (draftInput) {
          draftInput.checked = true;
        }
        render();
      }

      if (action === "delete-draft") {
        const shouldDelete = typeof window.confirm !== "function" || window.confirm(
          t("editor.drafts.confirmDelete", "删除当前本地草稿？")
        );
        if (!shouldDelete) {
          return;
        }
        const deletedId = currentDraftId;
        drafts.delete(deletedId);
        deletePersistedDraft(deletedId);
        const replacement = Array.from(drafts.values()).sort(function (a, b) {
          return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
        })[0];
        if (replacement) {
          currentDraftId = replacement.id;
          applyState(replacement, false);
        } else {
          currentDraftId = createDraftId();
          applyState(null, false);
          if (draftInput) {
            draftInput.checked = true;
          }
        }
        render();
      }

      if (action === "copy-html") {
        copyHtml(button);
      }

      if (action === "connect-github") {
        const base = configuredApiBase();
        if (base) {
          window.location.assign(base + "/api/v1/auth/github/start");
        }
      }

      if (action === "publish-pr") {
        publishPullRequest();
      }

      if (action === "upload-cover") {
        uploadCoverAsset();
      }

      if (action === "open-media-library") {
        openMediaLibrary();
      }

      if (action === "close-media-library") {
        closeMediaLibrary();
      }

      if (action === "load-more-media") {
        loadMediaLibrary(true);
      }

      if (action === "logout-github") {
        logoutPublishSession();
      }

      if (action === "reindex-knowledge") {
        reindexKnowledge();
      }

      if (action === "download-md") {
        download(slug + ".md", frontMatter() + getMarkdown() + "\n", "text/markdown;charset=utf-8");
      }

      if (action === "download-html") {
        download(slug + ".html", preview.innerHTML + "\n", "text/html;charset=utf-8");
      }
    });
  });

  loadInitialState();
  if (mediaSearchInput) {
    mediaSearchInput.addEventListener("input", renderMediaLibrary);
  }
  if (mediaDialog) {
    mediaDialog.addEventListener("cancel", function (event) {
      event.preventDefault();
      closeMediaLibrary();
    });
  }
  render();
  initializeDraftStore();
  refreshPublishSession();
  document.addEventListener("cwl:langchange", updateStats);
})();
