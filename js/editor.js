(function () {
  const storageKey = "wenliang-markdown-editor";
  const titleInput = document.getElementById("post-title");
  const shortTitleInput = document.getElementById("post-short-title");
  const slugInput = document.getElementById("post-slug");
  const dateInput = document.getElementById("post-date");
  const summaryInput = document.getElementById("post-summary");
  const descriptionInput = document.getElementById("post-description");
  const markdownInput = document.getElementById("markdown-input");
  const preview = document.getElementById("markdown-preview");
  const statsEl = document.getElementById("editor-stats");

  if (!titleInput || !shortTitleInput || !slugInput || !dateInput || !summaryInput || !descriptionInput || !markdownInput || !preview) {
    return;
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
      .replace(/[^a-z0-9一-龥]+/g, "-")
      .replace(/^-+|-+$/g, "") || "new-post";
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

  function frontMatter() {
    const title = titleInput.value.trim();
    const shortTitle = shortTitleInput.value.trim() || title;
    const summary = summaryInput.value.trim() || sampleSummary();
    const description = descriptionInput.value.trim() || summary;
    return [
      "---",
      "title: " + yamlString(title),
      "shortTitle: " + yamlString(shortTitle),
      "date: " + dateInput.value,
      "modified: " + dateInput.value,
      "summary: " + yamlString(summary),
      "description: " + yamlString(description),
      "draft: false",
      "---",
      ""
    ].join("\n");
  }

  function currentState() {
    return {
      title: titleInput.value,
      shortTitle: shortTitleInput.value,
      slug: slugInput.value,
      date: dateInput.value,
      summary: summaryInput.value,
      description: descriptionInput.value,
      markdown: markdownInput.value
    };
  }

  function saveState() {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(currentState()));
    } catch (error) {
      // localStorage 存储失败（如超出配额），不影响编辑功能
    }
  }

  function updateStats() {
    if (!statsEl) {
      return;
    }
    const text = markdownInput.value;
    const chars = text.length;
    const chinese = (text.match(/[一-龥]/g) || []).length;
    const rest = text.replace(/[一-龥]/g, " ").trim();
    const words = rest ? rest.split(/\s+/).length : 0;
    const totalWords = chinese + words;
    const minutes = Math.max(1, Math.round(chinese / 350 + words / 200));
    statsEl.textContent = t("editor.stats", "{words} 词 · {chars} 字符 · 约 {minutes} 分钟")
      .replace("{words}", totalWords)
      .replace("{chars}", chars)
      .replace("{minutes}", minutes);
  }

  function render() {
    preview.innerHTML = renderMarkdown(markdownInput.value);
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

  function loadState() {
    let stored = null;
    try {
      stored = JSON.parse(window.localStorage.getItem(storageKey));
    } catch (error) {
      // localStorage 读取失败，使用默认值
    }

    titleInput.value = stored && stored.title ? stored.title : sampleTitle();
    shortTitleInput.value = stored && stored.shortTitle ? stored.shortTitle : titleInput.value;
    slugInput.value = stored && stored.slug ? stored.slug : slugify(titleInput.value);
    dateInput.value = stored && stored.date ? stored.date : today();
    summaryInput.value = stored && stored.summary ? stored.summary : sampleSummary();
    descriptionInput.value = stored && stored.description ? stored.description : summaryInput.value;
    markdownInput.value = stored && stored.markdown ? stored.markdown : sampleMarkdown();
  }

  /* ----------------------------------------------------------------------
   * Toolbar: wrap/insert Markdown around the current selection
   * -------------------------------------------------------------------- */
  function applyFormat(kind) {
    const start = markdownInput.selectionStart;
    const end = markdownInput.selectionEnd;
    const value = markdownInput.value;
    const selected = value.slice(start, end);
    const before = value.slice(0, start);
    const after = value.slice(end);
    let inner, newStart, newEnd;

    function wrap(left, right, placeholder) {
      inner = selected || placeholder;
      const text = left + inner + right;
      markdownInput.value = before + text + after;
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
      markdownInput.value = before + text + after;
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
        markdownInput.value = before + linkText + after;
        newStart = start + 1;
        newEnd = newStart + inner.length;
        break;
      }
      case "image": {
        inner = selected || t("editor.fmt.image", "图片描述");
        const imgText = "![" + inner + "](https://)";
        markdownInput.value = before + imgText + after;
        newStart = start + 2;
        newEnd = newStart + inner.length;
        break;
      }
      case "codeblock": {
        inner = selected || t("editor.fmt.codeblock", "在此粘贴代码");
        const block = "```\n" + inner + "\n```";
        markdownInput.value = before + block + after;
        newStart = start + 4;
        newEnd = newStart + inner.length;
        break;
      }
      case "table": {
        const table = t("editor.fmt.table", "| 列1 | 列2 |\n| --- | --- |\n| 内容 | 内容 |");
        markdownInput.value = before + table + after;
        newStart = start;
        newEnd = start + table.length;
        break;
      }
      default: return;
    }

    markdownInput.focus();
    markdownInput.setSelectionRange(newStart, newEnd);
    render();
  }

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
  summaryInput.addEventListener("input", saveState);
  descriptionInput.addEventListener("input", saveState);
  markdownInput.addEventListener("input", debouncedRender);

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

  document.querySelectorAll("[data-action]").forEach(function (button) {
    button.addEventListener("click", function () {
      const action = button.getAttribute("data-action");
      const slug = slugify(slugInput.value || titleInput.value);

      if (action === "new") {
        titleInput.value = "";
        shortTitleInput.value = "";
        slugInput.value = "";
        dateInput.value = today();
        summaryInput.value = "";
        descriptionInput.value = "";
        markdownInput.value = "";
        render();
      }

      if (action === "sample") {
        titleInput.value = sampleTitle();
        shortTitleInput.value = titleInput.value;
        slugInput.value = slugify(titleInput.value);
        dateInput.value = today();
        summaryInput.value = sampleSummary();
        descriptionInput.value = summaryInput.value;
        markdownInput.value = sampleMarkdown();
        render();
      }

      if (action === "copy-html") {
        copyHtml(button);
      }

      if (action === "download-md") {
        download(slug + ".md", frontMatter() + markdownInput.value + "\n", "text/markdown;charset=utf-8");
      }

      if (action === "download-html") {
        download(slug + ".html", preview.innerHTML + "\n", "text/html;charset=utf-8");
      }
    });
  });

  loadState();
  render();
  document.addEventListener("cwl:langchange", updateStats);
})();
