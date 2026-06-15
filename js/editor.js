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

  function escapeHtml(value) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;");
  }

  function inlineMarkdown(value) {
    var html = escapeHtml(value);
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    return html;
  }

  function renderMarkdown(markdown) {
    var lines = markdown.replace(/\r\n/g, "\n").split("\n");
    var output = [];
    var inCode = false;
    var codeLines = [];
    var listType = null;

    function closeList() {
      if (listType) {
        output.push("</" + listType + ">");
        listType = null;
      }
    }

    lines.forEach(function (line) {
      var trimmed = line.trim();

      if (trimmed.indexOf("```") === 0) {
        if (inCode) {
          output.push("<pre><code>" + escapeHtml(codeLines.join("\n")) + "</code></pre>");
          codeLines = [];
          inCode = false;
        } else {
          closeList();
          inCode = true;
        }
        return;
      }

      if (inCode) {
        codeLines.push(line);
        return;
      }

      if (!trimmed) {
        closeList();
        return;
      }

      var heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        closeList();
        var level = heading[1].length;
        output.push("<h" + level + ">" + inlineMarkdown(heading[2]) + "</h" + level + ">");
        return;
      }

      var quote = trimmed.match(/^>\s?(.+)$/);
      if (quote) {
        closeList();
        output.push("<blockquote>" + inlineMarkdown(quote[1]) + "</blockquote>");
        return;
      }

      var unordered = trimmed.match(/^[-*+]\s+(.+)$/);
      if (unordered) {
        if (listType !== "ul") {
          closeList();
          output.push("<ul>");
          listType = "ul";
        }
        output.push("<li>" + inlineMarkdown(unordered[1]) + "</li>");
        return;
      }

      var ordered = trimmed.match(/^\d+\.\s+(.+)$/);
      if (ordered) {
        if (listType !== "ol") {
          closeList();
          output.push("<ol>");
          listType = "ol";
        }
        output.push("<li>" + inlineMarkdown(ordered[1]) + "</li>");
        return;
      }

      closeList();
      output.push("<p>" + inlineMarkdown(trimmed) + "</p>");
    });

    if (inCode) {
      output.push("<pre><code>" + escapeHtml(codeLines.join("\n")) + "</code></pre>");
    }
    closeList();
    return output.join("\n");
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

