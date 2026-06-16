(function () {
  var source = document.getElementById("latex-source");
  var preview = document.getElementById("resume-preview");
  var statusEl = document.getElementById("overleaf-status");

  if (!source || !preview) {
    return;
  }

  var storageKey = "cwl-overleaf-resume-source";
  var applyingFromPreview = false;
  var applyingFromSource = false;

  var defaultLatex = [
    "\\documentclass[11pt,a4paper]{article}",
    "\\usepackage[UTF8]{ctex}",
    "\\usepackage{geometry}",
    "\\geometry{margin=1.4cm}",
    "\\pagestyle{empty}",
    "",
    "\\name{陈文亮}",
    "\\role{AI 全栈工程师 / Java 后端开发工程师}",
    "\\contact{杭州 · 2252694075@qq.com · github.com/wenliang844}",
    "\\summary{专注 Java 后端、服务端架构、工作流引擎与低代码平台。习惯把复杂业务拆成边界清晰、配置统一、失败可排查的工程模块。}",
    "\\skills{Java, Spring Boot, MyBatis, MySQL, Redis, ElasticSearch, RocketMQ, RabbitMQ, Activiti, TypeScript, React, Docker, Jenkins}",
    "",
    "\\section{工作经历}",
    "\\entry{浙江联乾信息科技}{Java 开发工程师}{2023.09 -- 至今}{主导视频智能侦测系统后端重构，整合采集、算法、规则、告警链路；负责财税 SaaS、审批流引擎、低代码平台等后端设计与交付。}",
    "\\entry{杭州端点网络科技}{Java 开发工程师}{2022.09 -- 2023.08}{参与企业级低代码与数字化业务平台研发，负责表单引擎、流程自动化、页面渲染等模块，并参与 React/TypeScript 交互开发。}",
    "",
    "\\section{项目经历}",
    "\\entry{视频智能侦测系统}{后端重构}{Spring Boot / ONNX Runtime / RabbitMQ}{重整“采集 -> 算法 -> 规则 -> 告警”链路，沉淀算法注册、执行器插件化、规则上下文与告警闭环。}",
    "\\entry{财税 SaaS 后端实践}{平台能力建设}{ElasticSearch / RocketMQ / EasyExcel}{围绕财务报表计算、搜索 Starter、多渠道通知中心，沉淀可复用的业务基础能力。}",
    "\\entry{低代码 Schema 与出码}{工程链路}{TypeScript / React / Web Worker}{组织设计器、物料协议、Schema 渲染和浏览器端出码，让页面搭建能力具备可扩展性。}",
    "",
    "\\section{教育与荣誉}",
    "\\entry{江西科技学院}{软件工程 · 本科}{2018.06 -- 2022.07}{蓝桥杯国家二等奖（省一等奖）、ACM 程序设计竞赛铜奖、软考软件设计师（中级）。}",
    "",
    "\\end{document}"
  ].join("\n");

  function t(key, fallback) {
    return window.cwlT ? window.cwlT(key, fallback) : fallback;
  }

  function setStatus(text) {
    if (statusEl) {
      statusEl.textContent = text;
    }
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function latexEscape(value) {
    return String(value == null ? "" : value)
      .replace(/\\/g, "\\textbackslash{}")
      .replace(/([{}%$#&_])/g, "\\$1");
  }

  function readCommand(text, name, fallback) {
    var re = new RegExp("\\\\" + name + "\\{([\\s\\S]*?)\\}");
    var m = text.match(re);
    return m ? m[1].trim() : fallback;
  }

  function readSections(text) {
    var sections = [];
    var sectionRe = /\\section\{([^}]+)\}([\s\S]*?)(?=\\section\{|\\end\{document\}|$)/g;
    var match;
    while ((match = sectionRe.exec(text))) {
      var entries = [];
      var entryRe = /\\entry\{([\s\S]*?)\}\{([\s\S]*?)\}\{([\s\S]*?)\}\{([\s\S]*?)\}/g;
      var body = match[2];
      var entry;
      while ((entry = entryRe.exec(body))) {
        entries.push({
          title: entry[1].trim(),
          subtitle: entry[2].trim(),
          meta: entry[3].trim(),
          desc: entry[4].trim()
        });
      }
      sections.push({ title: match[1].trim(), entries: entries });
    }
    return sections;
  }

  function parseLatex(text) {
    return {
      name: readCommand(text, "name", "陈文亮"),
      role: readCommand(text, "role", "AI 全栈工程师 / Java 后端开发工程师"),
      contact: readCommand(text, "contact", "杭州 · 2252694075@qq.com"),
      summary: readCommand(text, "summary", ""),
      skills: readCommand(text, "skills", ""),
      sections: readSections(text)
    };
  }

  function editable(field, value) {
    return '<span contenteditable="true" data-latex-field="' + field + '">' + escapeHtml(value) + "</span>";
  }

  function renderPreview(model) {
    var skills = model.skills
      .split(/[,，]/)
      .map(function (s) { return s.trim(); })
      .filter(Boolean)
      .map(function (s, i) {
        return '<span contenteditable="true" data-skill-index="' + i + '">' + escapeHtml(s) + "</span>";
      })
      .join("");

    var sections = model.sections.map(function (section, si) {
      var entries = section.entries.map(function (entry, ei) {
        return '<div class="latex-entry" data-section-index="' + si + '" data-entry-index="' + ei + '">' +
          '<div class="latex-entry-head">' +
          '<strong contenteditable="true" data-entry-field="title">' + escapeHtml(entry.title) + "</strong>" +
          '<span contenteditable="true" data-entry-field="meta">' + escapeHtml(entry.meta) + "</span>" +
          "</div>" +
          '<div class="latex-entry-sub" contenteditable="true" data-entry-field="subtitle">' + escapeHtml(entry.subtitle) + "</div>" +
          '<p contenteditable="true" data-entry-field="desc">' + escapeHtml(entry.desc) + "</p>" +
          "</div>";
      }).join("");
      return '<section class="latex-section" data-section-index="' + si + '">' +
        '<h2 contenteditable="true" data-section-title>' + escapeHtml(section.title) + "</h2>" +
        entries +
        "</section>";
    }).join("");

    preview.innerHTML =
      '<header class="latex-resume-head">' +
      '<h1>' + editable("name", model.name) + "</h1>" +
      '<p class="latex-role">' + editable("role", model.role) + "</p>" +
      '<p class="latex-contact">' + editable("contact", model.contact) + "</p>" +
      "</header>" +
      '<section class="latex-section latex-summary">' +
      "<h2>Profile</h2>" +
      '<p contenteditable="true" data-latex-field="summary">' + escapeHtml(model.summary) + "</p>" +
      "</section>" +
      '<section class="latex-section latex-skills">' +
      "<h2>Skills</h2>" +
      '<div class="latex-skill-list">' + skills + "</div>" +
      "</section>" +
      sections;
  }

  function replaceCommand(text, name, value) {
    var re = new RegExp("\\\\" + name + "\\{[\\s\\S]*?\\}");
    var line = "\\" + name + "{" + latexEscape(value) + "}";
    return re.test(text) ? text.replace(re, line) : line + "\n" + text;
  }

  function replaceEntry(text, sectionIndex, entryIndex, field, value) {
    var sections = [];
    var cursor = 0;
    var re = /\\section\{[^}]+\}[\s\S]*?(?=\\section\{|\\end\{document\}|$)/g;
    var match;
    while ((match = re.exec(text))) {
      sections.push({ start: match.index, end: re.lastIndex, text: match[0] });
    }
    var sec = sections[sectionIndex];
    if (!sec) return text;

    var entries = [];
    var entryRe = /\\entry\{([\s\S]*?)\}\{([\s\S]*?)\}\{([\s\S]*?)\}\{([\s\S]*?)\}/g;
    var entry;
    while ((entry = entryRe.exec(sec.text))) {
      entries.push({ start: entry.index, end: entryRe.lastIndex, parts: [entry[1], entry[2], entry[3], entry[4]] });
    }
    var item = entries[entryIndex];
    if (!item) return text;

    var map = { title: 0, subtitle: 1, meta: 2, desc: 3 };
    item.parts[map[field]] = latexEscape(value);
    var next = "\\entry{" + item.parts.join("}{") + "}";
    var sectionText = sec.text.slice(0, item.start) + next + sec.text.slice(item.end);
    return text.slice(0, sec.start) + sectionText + text.slice(sec.end + cursor);
  }

  function replaceSectionTitle(text, sectionIndex, value) {
    var count = -1;
    return text.replace(/\\section\{([^}]+)\}/g, function (m) {
      count += 1;
      return count === sectionIndex ? "\\section{" + latexEscape(value) + "}" : m;
    });
  }

  function replaceSkillsFromPreview(text) {
    var values = Array.prototype.slice.call(preview.querySelectorAll("[data-skill-index]"))
      .map(function (el) { return (el.textContent || "").trim(); })
      .filter(Boolean);
    return replaceCommand(text, "skills", values.join(", "));
  }

  function syncFromSource() {
    if (applyingFromPreview) return;
    applyingFromSource = true;
    renderPreview(parseLatex(source.value));
    try {
      window.localStorage.setItem(storageKey, source.value);
    } catch (error) {}
    setStatus(t("overleaf.status.compiled", "Compiled from source"));
    applyingFromSource = false;
  }

  function syncFromPreview(target) {
    if (applyingFromSource) return;
    applyingFromPreview = true;
    var text = source.value;
    var value = (target.textContent || "").trim();
    var field = target.getAttribute("data-latex-field");

    if (field) {
      text = replaceCommand(text, field, value);
    } else if (target.hasAttribute("data-skill-index")) {
      text = replaceSkillsFromPreview(text);
    } else if (target.hasAttribute("data-section-title")) {
      var section = target.closest("[data-section-index]");
      text = replaceSectionTitle(text, Number(section.getAttribute("data-section-index")), value);
    } else if (target.hasAttribute("data-entry-field")) {
      var entryEl = target.closest("[data-section-index][data-entry-index]");
      text = replaceEntry(
        text,
        Number(entryEl.getAttribute("data-section-index")),
        Number(entryEl.getAttribute("data-entry-index")),
        target.getAttribute("data-entry-field"),
        value,
      );
    }

    source.value = text;
    try {
      window.localStorage.setItem(storageKey, source.value);
    } catch (error) {}
    setStatus(t("overleaf.status.synced", "Preview edits synced to source"));
    applyingFromPreview = false;
  }

  function copySource(button) {
    function done(ok) {
      var label = button.querySelector("span");
      if (!label) return;
      var old = label.textContent;
      label.textContent = ok ? t("overleaf.status.copied", "Copied") : t("overleaf.status.copyfail", "Copy failed");
      window.setTimeout(function () { label.textContent = old; }, 1400);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(source.value).then(function () { done(true); }, function () { done(false); });
    } else {
      done(false);
    }
  }

  function printPdf() {
    setStatus(t("overleaf.status.pdf", "Use the print dialog to save as PDF"));
    window.print();
  }

  source.value = (function () {
    try {
      return window.localStorage.getItem(storageKey) || defaultLatex;
    } catch (error) {
      return defaultLatex;
    }
  })();
  syncFromSource();

  source.addEventListener("input", syncFromSource);

  preview.addEventListener("input", function (event) {
    var target = event.target;
    if (target && target.matches("[contenteditable='true']")) {
      syncFromPreview(target);
    }
  });

  document.addEventListener("click", function (event) {
    var button = event.target.closest("[data-overleaf-action]");
    if (!button) return;
    var action = button.getAttribute("data-overleaf-action");
    if (action === "compile") syncFromSource();
    if (action === "copy") copySource(button);
    if (action === "reset") {
      source.value = defaultLatex;
      syncFromSource();
    }
    if (action === "pdf") printPdf();
  });

  document.addEventListener("cwl:langchange", function () {
    setStatus(t("overleaf.status.ready", "Ready"));
  });
})();
