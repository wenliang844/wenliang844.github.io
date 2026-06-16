(function () {
  var storageKey = "wenliang-markdown-editor";
  var titleInput = document.getElementById("post-title");
  var slugInput = document.getElementById("post-slug");
  var dateInput = document.getElementById("post-date");
  var markdownInput = document.getElementById("markdown-input");
  var preview = document.getElementById("markdown-preview");
  var statsEl = document.getElementById("editor-stats");

  if (!titleInput || !slugInput || !dateInput || !markdownInput || !preview) {
    return;
  }

  var sampleMarkdown = [
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

  // Configure marked once: GitHub-flavored Markdown with hard line breaks,
  // and syntax highlighting via highlight.js when available.
  if (window.marked && typeof window.marked.setOptions === "function") {
    window.marked.setOptions({
      gfm: true,
      breaks: true,
      highlight: function (code, lang) {
        if (window.hljs) {
          try {
            if (lang && window.hljs.getLanguage(lang)) {
              return window.hljs.highlight(code, { language: lang }).value;
            }
            return window.hljs.highlightAuto(code).value;
          } catch (error) {}
        }
        return code;
      }
    });
  }

  function renderMarkdown(markdown) {
    var raw = markdown || "";
    var html;

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

  function frontMatter() {
    return [
      "---",
      "title: \"" + titleInput.value.replace(/\"/g, "\\\\\"") + "\"",
      "date: " + dateInput.value,
      "draft: false",
      "---",
      ""
    ].join("\n");
  }

  function currentState() {
    return {
      title: titleInput.value,
      slug: slugInput.value,
      date: dateInput.value,
      markdown: markdownInput.value
    };
  }

  function saveState() {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(currentState()));
    } catch (error) {}
  }

  function updateStats() {
    if (!statsEl) {
      return;
    }
    var text = markdownInput.value;
    var chars = text.length;
    var chinese = (text.match(/[一-龥]/g) || []).length;
    var rest = text.replace(/[一-龥]/g, " ").trim();
    var words = rest ? rest.split(/\s+/).length : 0;
    var totalWords = chinese + words;
    var minutes = Math.max(1, Math.round(chinese / 350 + words / 200));
    statsEl.textContent = totalWords + " 词 · " + chars + " 字符 · 约 " + minutes + " 分钟";
  }

  function render() {
    preview.innerHTML = renderMarkdown(markdownInput.value);
    // Re-highlight any code blocks marked says were not pre-highlighted.
    if (window.hljs) {
      preview.querySelectorAll("pre code").forEach(function (block) {
        if (!block.dataset.highlighted) {
          try {
            window.hljs.highlightElement(block);
          } catch (error) {}
          block.dataset.highlighted = "yes";
        }
      });
    }
    updateStats();
    saveState();
  }

  function download(filename, content, type) {
    var blob = new Blob([content], { type: type });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function loadState() {
    var stored = null;
    try {
      stored = JSON.parse(window.localStorage.getItem(storageKey));
    } catch (error) {}

    titleInput.value = stored && stored.title ? stored.title : "新文章标题";
    slugInput.value = stored && stored.slug ? stored.slug : slugify(titleInput.value);
    dateInput.value = stored && stored.date ? stored.date : today();
    markdownInput.value = stored && stored.markdown ? stored.markdown : sampleMarkdown;
  }

  /* ----------------------------------------------------------------------
   * Toolbar: wrap/insert Markdown around the current selection
   * -------------------------------------------------------------------- */
  function applyFormat(kind) {
    var start = markdownInput.selectionStart;
    var end = markdownInput.selectionEnd;
    var value = markdownInput.value;
    var selected = value.slice(start, end);
    var before = value.slice(0, start);
    var after = value.slice(end);
    var inner, newStart, newEnd;

    function wrap(left, right, placeholder) {
      inner = selected || placeholder;
      var text = left + inner + right;
      markdownInput.value = before + text + after;
      newStart = start + left.length;
      newEnd = newStart + inner.length;
    }

    function linePrefix(prefix) {
      inner = selected || "";
      var lines = (inner || "列表项").split("\n");
      var text = lines.map(function (line, i) {
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
      case "bold": wrap("**", "**", "粗体"); break;
      case "italic": wrap("*", "*", "斜体"); break;
      case "code": wrap("`", "`", "代码"); break;
      case "heading": linePrefix("## "); break;
      case "quote": linePrefix("> "); break;
      case "ul": linePrefix("- "); break;
      case "ol": linePrefix("1. "); break;
      case "link":
        inner = selected || "链接文字";
        var linkText = "[" + inner + "](https://)";
        markdownInput.value = before + linkText + after;
        newStart = start + 1;
        newEnd = newStart + inner.length;
        break;
      case "image":
        inner = selected || "图片描述";
        var imgText = "![" + inner + "](https://)";
        markdownInput.value = before + imgText + after;
        newStart = start + 2;
        newEnd = newStart + inner.length;
        break;
      case "codeblock":
        inner = selected || "在此粘贴代码";
        var block = "```\n" + inner + "\n```";
        markdownInput.value = before + block + after;
        newStart = start + 4;
        newEnd = newStart + inner.length;
        break;
      case "table":
        var table = "| 列1 | 列2 |\n| --- | --- |\n| 内容 | 内容 |";
        markdownInput.value = before + table + after;
        newStart = start;
        newEnd = start + table.length;
        break;
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
    var map = { b: "bold", i: "italic", k: "link" };
    var action = map[event.key.toLowerCase()];
    if (action) {
      event.preventDefault();
      applyFormat(action);
    }
  });

  /* ----------------------------------------------------------------------
   * Synced scrolling between editor and preview
   * -------------------------------------------------------------------- */
  var syncing = null;
  function linkScroll(source, target) {
    source.addEventListener("scroll", function () {
      if (syncing && syncing !== source) {
        return;
      }
      syncing = source;
      var max = source.scrollHeight - source.clientHeight;
      var ratio = max > 0 ? source.scrollTop / max : 0;
      var targetMax = target.scrollHeight - target.clientHeight;
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
  titleInput.addEventListener("input", function () {
    slugInput.value = slugify(titleInput.value);
    render();
  });
  slugInput.addEventListener("input", saveState);
  dateInput.addEventListener("input", saveState);
  markdownInput.addEventListener("input", render);

  function copyHtml(button) {
    var html = preview.innerHTML;
    var done = function (ok) {
      var original = button.innerHTML;
      button.innerHTML = ok
        ? '<i class="fas fa-check"></i> 已复制'
        : '<i class="fas fa-copy"></i> 复制失败';
      window.setTimeout(function () { button.innerHTML = original; }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(html).then(function () { done(true); }, function () { done(false); });
    } else {
      try {
        var area = document.createElement("textarea");
        area.value = html;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        area.remove();
        done(true);
      } catch (error) {
        done(false);
      }
    }
  }

  document.querySelectorAll("[data-action]").forEach(function (button) {
    button.addEventListener("click", function () {
      var action = button.getAttribute("data-action");
      var slug = slugify(slugInput.value || titleInput.value);

      if (action === "new") {
        titleInput.value = "";
        slugInput.value = "";
        dateInput.value = today();
        markdownInput.value = "";
        render();
      }

      if (action === "sample") {
        titleInput.value = "新文章标题";
        slugInput.value = slugify(titleInput.value);
        dateInput.value = today();
        markdownInput.value = sampleMarkdown;
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
})();
