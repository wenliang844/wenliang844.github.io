(function () {
  var storageKey = "wenliang-markdown-editor";
  var titleInput = document.getElementById("post-title");
  var slugInput = document.getElementById("post-slug");
  var dateInput = document.getElementById("post-date");
  var markdownInput = document.getElementById("markdown-input");
  var preview = document.getElementById("markdown-preview");

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
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "") || "new-post";
  }

  // Configure marked once: GitHub-flavored Markdown with hard line breaks.
  if (window.marked && typeof window.marked.setOptions === "function") {
    window.marked.setOptions({ gfm: true, breaks: true });
  }

  function renderMarkdown(markdown) {
    var raw = markdown || "";
    var html;

    if (window.marked) {
      html = typeof window.marked.parse === "function"
        ? window.marked.parse(raw)
        : window.marked(raw);
    } else {
      // Fallback if the library failed to load: show escaped plain text.
      html = "<pre>" + raw
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;") + "</pre>";
    }

    // Always sanitize before injecting into the DOM.
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

  function render() {
    preview.innerHTML = renderMarkdown(markdownInput.value);
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

  titleInput.addEventListener("input", function () {
    slugInput.value = slugify(titleInput.value);
    render();
  });
  slugInput.addEventListener("input", saveState);
  dateInput.addEventListener("input", saveState);
  markdownInput.addEventListener("input", render);

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

