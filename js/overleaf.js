(function () {
  const source = document.getElementById("latex-source");
  const preview = document.getElementById("resume-preview");
  const statusEl = document.getElementById("overleaf-status");
  const formatSelect = document.getElementById("resume-format");
  const sourceBadge = document.getElementById("resume-source-badge");
  const previewScroll = preview ? preview.closest(".overleaf-preview-scroll") : null;

  if (!source || !preview) {
    return;
  }

  const legacyStorageKey = "cwl-overleaf-resume-source";
  const formatStorageKey = "cwl-overleaf-resume-format";
  const sourceStoragePrefix = "cwl-overleaf-resume-source:";
  let applyingFromPreview = false;
  let applyingFromSource = false;
  let currentFormat = "latex";
  let currentModel = null;

  const defaultModel = {
    name: "陈文亮",
    role: "AI 全栈工程师 / Java 后端开发工程师",
    contact: "杭州 · 2252694075@qq.com · github.com/wenliang844",
    summary: "专注 Java 后端、服务端架构、工作流引擎与低代码平台。习惯把复杂业务拆成边界清晰、配置统一、失败可排查的工程模块。",
    skills: "Java, Spring Boot, MyBatis, MySQL, Redis, ElasticSearch, RocketMQ, RabbitMQ, Activiti, TypeScript, React, Docker, Jenkins",
    sections: [
      {
        title: "教育与荣誉",
        entries: [
          {
            title: "江西科技学院",
            subtitle: "软件工程 · 本科",
            meta: "2018.06 -- 2022.07",
            desc: "蓝桥杯国家二等奖（省一等奖）、ACM 程序设计竞赛铜奖、软考软件设计师（中级）。"
          }
        ]
      },
      {
        title: "工作经历",
        entries: [
          {
            title: "浙江联乾信息科技",
            subtitle: "Java 开发工程师",
            meta: "2023.09 -- 至今",
            desc: "主导视频智能侦测系统后端重构，整合采集、算法、规则、告警链路；负责财税 SaaS、审批流引擎、低代码平台等后端设计与交付。"
          },
          {
            title: "杭州端点网络科技",
            subtitle: "Java 开发工程师",
            meta: "2022.09 -- 2023.08",
            desc: "参与企业级低代码与数字化业务平台研发，负责表单引擎、流程自动化、页面渲染等模块，并参与 React/TypeScript 交互开发。"
          }
        ]
      },
      {
        title: "项目经历",
        entries: [
          {
            title: "视频智能侦测系统",
            subtitle: "后端重构",
            meta: "Spring Boot / ONNX Runtime / RabbitMQ",
            desc: "重整“采集 -> 算法 -> 规则 -> 告警”链路，沉淀算法注册、执行器插件化、规则上下文与告警闭环。"
          },
          {
            title: "财税 SaaS 后端实践",
            subtitle: "平台能力建设",
            meta: "ElasticSearch / RocketMQ / EasyExcel",
            desc: "围绕财务报表计算、搜索 Starter、多渠道通知中心，沉淀可复用的业务基础能力。"
          },
          {
            title: "低代码 Schema 与出码",
            subtitle: "工程链路",
            meta: "TypeScript / React / Web Worker",
            desc: "组织设计器、物料协议、Schema 渲染和浏览器端出码，让页面搭建能力具备可扩展性。"
          }
        ]
      },
      {
        title: "专业技能",
        entries: [
          {
            title: "后端开发",
            subtitle: "Java / Spring Boot / MyBatis",
            meta: "核心",
            desc: "熟悉 RESTful API、权限认证、复杂业务建模、SQL 优化、缓存设计与消息队列异步化。"
          },
          {
            title: "工程与平台",
            subtitle: "Activiti / ElasticSearch / Docker / Jenkins",
            meta: "熟练",
            desc: "具备工作流引擎、搜索 Starter、低代码 Schema、CI/CD 与线上问题排查经验。"
          },
          {
            title: "前端协作",
            subtitle: "TypeScript / React",
            meta: "掌握",
            desc: "能够参与中后台页面交互、组件接入和前后端联调，支持完整交付链路。"
          }
        ]
      }
    ]
  };

  const t = window.CWLUtils.t;

  function setStatus(text) {
    if (statusEl) {
      statusEl.textContent = text;
    }
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function text(value) {
    return String(value === null || value === undefined ? "" : value).trim();
  }

  function compactInline(value) {
    return text(value)
      .replace(/\s*\n+\s*/g, " ")
      .replace(/\s{2,}/g, " ");
  }

  function isProfileTitle(title) {
    return ["profile", "summary", "个人简介", "简介"].indexOf(text(title).toLowerCase()) >= 0;
  }

  function isLegacySkillsTitle(title) {
    return ["skills", "skill", "技能"].indexOf(text(title).toLowerCase()) >= 0;
  }

  function isProfessionalSkillsTitle(title) {
    return text(title) === "专业技能";
  }

  function createTextSection(title, body) {
    const desc = compactInline(String(body || "").replace(/^[-*]\s+/gm, ""));
    return {
      title: title,
      entries: desc ? [
        {
          title: title === "专业技能" ? "技能清单" : "内容",
          subtitle: "",
          meta: "",
          desc: desc
        }
      ] : []
    };
  }

  function orderSections(sections) {
    const education = [];
    const middle = [];
    const professionalSkills = [];
    sections.forEach(function (section) {
      if (text(section.title) === "教育与荣誉") {
        education.push(section);
      } else if (isProfessionalSkillsTitle(section.title)) {
        professionalSkills.push(section);
      } else {
        middle.push(section);
      }
    });
    return education.concat(middle, professionalSkills);
  }

  function cloneModel(model) {
    return JSON.parse(JSON.stringify(model || defaultModel));
  }

  function normalizeModel(model) {
    const next = cloneModel(model);
    next.name = text(next.name) || defaultModel.name;
    next.role = text(next.role) || defaultModel.role;
    next.contact = text(next.contact) || defaultModel.contact;
    next.summary = compactInline(next.summary);
    next.skills = compactInline(Array.isArray(next.skills) ? next.skills.join(", ") : next.skills);
    next.sections = Array.isArray(next.sections) ? next.sections : [];
    next.sections = next.sections.map(function (section) {
      return {
        title: text(section.title) || "Section",
        entries: (Array.isArray(section.entries) ? section.entries : []).map(function (entry) {
          return {
            title: text(entry.title),
            subtitle: text(entry.subtitle),
            meta: text(entry.meta),
            desc: text(entry.desc)
          };
        }).filter(function (entry) {
          return entry.title || entry.subtitle || entry.meta || entry.desc;
        })
      };
    }).filter(function (section) {
      return section.title || section.entries.length;
    });
    next.sections = orderSections(next.sections);
    return next;
  }

  function latexEscape(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/\\/g, "\\textbackslash{}")
      .replace(/([{}%$#&_])/g, "\\$1");
  }

  function latexUnescape(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/\\textbackslash\{\}/g, "\\")
      .replace(/\\([{}%$#&_])/g, "$1");
  }

  function readCommand(sourceText, name, fallback) {
    const re = new RegExp("\\\\" + name + "\\{([\\s\\S]*?)\\}");
    const match = sourceText.match(re);
    return match ? latexUnescape(match[1].trim()) : fallback;
  }

  function readLatexSections(sourceText) {
    const sections = [];
    const sectionRe = /\\section\{([^}]+)\}([\s\S]*?)(?=\\section\{|\\end\{document\}|$)/g;
    let match;
    while ((match = sectionRe.exec(sourceText))) {
      const entries = [];
      const entryRe = /\\entry\{([\s\S]*?)\}\{([\s\S]*?)\}\{([\s\S]*?)\}\{([\s\S]*?)\}/g;
      const body = match[2];
      let entry;
      while ((entry = entryRe.exec(body))) {
        entries.push({
          title: latexUnescape(entry[1].trim()),
          subtitle: latexUnescape(entry[2].trim()),
          meta: latexUnescape(entry[3].trim()),
          desc: latexUnescape(entry[4].trim())
        });
      }
      sections.push({ title: latexUnescape(match[1].trim()), entries: entries });
    }
    return sections;
  }

  function parseLatex(sourceText) {
    const sections = readLatexSections(sourceText).filter(function (section) {
      return !isProfileTitle(section.title);
    }).map(function (section) {
      if (isLegacySkillsTitle(section.title)) {
        section.title = "专业技能";
      }
      return section;
    });
    const legacySkills = readCommand(sourceText, "skills", "");
    if (legacySkills && !sections.some(function (section) { return isProfessionalSkillsTitle(section.title); })) {
      sections.push(createTextSection("专业技能", legacySkills));
    }
    return normalizeModel({
      name: readCommand(sourceText, "name", defaultModel.name),
      role: readCommand(sourceText, "role", defaultModel.role),
      contact: readCommand(sourceText, "contact", defaultModel.contact),
      summary: readCommand(sourceText, "summary", defaultModel.summary),
      skills: legacySkills || defaultModel.skills,
      sections: sections
    });
  }

  function renderLatex(model) {
    model = normalizeModel(model);
    const lines = [
      "\\documentclass[11pt,a4paper]{article}",
      "\\usepackage[UTF8]{ctex}",
      "\\usepackage{geometry}",
      "\\geometry{margin=1.4cm}",
      "\\pagestyle{empty}",
      "",
      "\\newcommand{\\name}[1]{\\begin{center}{\\LARGE\\bfseries #1}\\end{center}}",
      "\\newcommand{\\role}[1]{\\begin{center}\\textbf{#1}\\end{center}}",
      "\\newcommand{\\contact}[1]{\\begin{center}#1\\end{center}}",
      "\\newcommand{\\entry}[4]{\\noindent\\textbf{#1}\\hfill #3\\\\\\textit{#2}\\\\#4\\par\\vspace{0.6em}}",
      "",
      "\\begin{document}",
      "\\name{" + latexEscape(model.name) + "}",
      "\\role{" + latexEscape(model.role) + "}",
      "\\contact{" + latexEscape(model.contact) + "}",
      ""
    ];
    model.sections.forEach(function (section) {
      lines.push("\\section{" + latexEscape(section.title) + "}");
      section.entries.forEach(function (entry) {
        lines.push("\\entry{" + latexEscape(entry.title) + "}{" + latexEscape(entry.subtitle) + "}{" + latexEscape(entry.meta) + "}{" + latexEscape(entry.desc) + "}");
      });
      lines.push("");
    });
    lines.push("\\end{document}");
    return lines.join("\n");
  }

  function markdownEscape(value) {
    return String(value === null || value === undefined ? "" : value).replace(/\n{3,}/g, "\n\n").trim();
  }

  function parseMarkdown(sourceText) {
    const lines = sourceText.replace(/\r\n/g, "\n").split("\n");
    const model = cloneModel(defaultModel);
    const nameLine = lines.find(function (line) { return /^#\s+/.test(line); });
    if (nameLine) {model.name = nameLine.replace(/^#\s+/, "").trim();}

    const nameIndex = nameLine ? lines.indexOf(nameLine) : -1;
    const afterName = lines.slice(nameIndex + 1).map(text).filter(Boolean);
    if (afterName[0]) {
      const roleMatch = afterName[0].match(/^\*\*(.*?)\*\*$/);
      model.role = roleMatch ? roleMatch[1] : afterName[0];
    }
    if (afterName[1] && !/^##\s+/.test(afterName[1])) {
      model.contact = afterName[1];
    }

    const blocks = [];
    const sectionRe = /^##\s+(.+)$/gm;
    let sectionMatch;
    while ((sectionMatch = sectionRe.exec(sourceText))) {
      blocks.push({ title: sectionMatch[1].trim(), start: sectionMatch.index, bodyStart: sectionRe.lastIndex });
    }
    blocks.forEach(function (block, index) {
      block.body = sourceText.slice(block.bodyStart, blocks[index + 1] ? blocks[index + 1].start : sourceText.length).trim();
    });

    const sections = [];
    blocks.forEach(function (block) {
      const titleKey = block.title.toLowerCase();
      if (isProfileTitle(titleKey)) {
        model.summary = block.body.replace(/^>\s?/gm, "").trim();
        return;
      }
      if (isLegacySkillsTitle(titleKey)) {
        model.skills = compactInline(block.body.replace(/^[-*]\s+/gm, ""));
        sections.push(createTextSection("专业技能", block.body));
        return;
      }

      const entries = [];
      const entryRe = /^###\s+(.+)$/gm;
      const entryHeads = [];
      let entryMatch;
      while ((entryMatch = entryRe.exec(block.body))) {
        entryHeads.push({ title: entryMatch[1].trim(), start: entryMatch.index, bodyStart: entryRe.lastIndex });
      }
      entryHeads.forEach(function (head, entryIndex) {
        const body = block.body.slice(head.bodyStart, entryHeads[entryIndex + 1] ? entryHeads[entryIndex + 1].start : block.body.length).trim();
        const bodyLines = body.split("\n").map(text).filter(Boolean);
        let subtitle = "";
        let meta = "";
        let descLines = bodyLines;
        if (bodyLines[0]) {
          const metaMatch = bodyLines[0].match(/^\*\*(.*?)\*\*(?:\s*[·|-]\s*(.*))?$/);
          if (metaMatch) {
            subtitle = metaMatch[1] || "";
            meta = metaMatch[2] || "";
            descLines = bodyLines.slice(1);
          }
        }
        entries.push({
          title: head.title,
          subtitle: subtitle,
          meta: meta,
          desc: descLines.join(" ").replace(/^[-*]\s+/, "")
        });
      });
      if (!entryHeads.length && block.body) {
        entries.push(createTextSection(block.title, block.body).entries[0]);
      }
      sections.push({ title: block.title, entries: entries });
    });
    model.sections = sections.length ? sections : defaultModel.sections;
    return normalizeModel(model);
  }

  function renderMarkdown(model) {
    model = normalizeModel(model);
    const lines = [
      "# " + markdownEscape(model.name),
      "",
      "**" + markdownEscape(model.role) + "**",
      markdownEscape(model.contact),
      ""
    ];
    model.sections.forEach(function (section) {
      lines.push("## " + markdownEscape(section.title));
      section.entries.forEach(function (entry) {
        lines.push("");
        lines.push("### " + markdownEscape(entry.title));
        lines.push("**" + markdownEscape(entry.subtitle) + "**" + (entry.meta ? " · " + markdownEscape(entry.meta) : ""));
        lines.push(markdownEscape(entry.desc));
      });
      lines.push("");
    });
    return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
  }

  function splitContact(contact) {
    const parts = String(contact || "").split(/[·|]/).map(text).filter(Boolean);
    const email = parts.find(function (part) { return /@/.test(part); }) || "";
    const github = parts.find(function (part) { return /github/i.test(part); }) || "";
    const location = parts.find(function (part) { return part !== email && part !== github; }) || "";
    return {
      location: location,
      email: email,
      github: github.replace(/^https?:\/\//, "").replace(/^github\.com\//i, "")
    };
  }

  function composeContact(parts) {
    return [parts.location, parts.email, parts.github ? "github.com/" + parts.github : ""].filter(Boolean).join(" · ");
  }

  function parseModerncv(sourceText) {
    const contact = splitContact(defaultModel.contact);
    const nameMatch = sourceText.match(/\\name\{([\s\S]*?)\}\{([\s\S]*?)\}/);
    const addressMatch = sourceText.match(/\\address\{([\s\S]*?)\}/);
    const emailMatch = sourceText.match(/\\email\{([\s\S]*?)\}/);
    const githubMatch = sourceText.match(/\\social\[github\]\{([\s\S]*?)\}/) || sourceText.match(/\\homepage\{(?:https?:\/\/)?(?:github\.com\/)?([\s\S]*?)\}/);
    if (addressMatch) {contact.location = latexUnescape(addressMatch[1].trim());}
    if (emailMatch) {contact.email = latexUnescape(emailMatch[1].trim());}
    if (githubMatch) {contact.github = latexUnescape(githubMatch[1].trim()).replace(/^github\.com\//i, "");}

    const sections = [];
    const sectionRe = /\\section\{([^}]+)\}([\s\S]*?)(?=\\section\{|\\end\{document\}|$)/g;
    let sectionMatch;
    while ((sectionMatch = sectionRe.exec(sourceText))) {
      const sectionTitle = latexUnescape(sectionMatch[1].trim());
      const body = sectionMatch[2];
      if (isProfileTitle(sectionTitle)) {
        continue;
      }
      if (isLegacySkillsTitle(sectionTitle)) {
        const cvitemMatch = body.match(/\\cvitem\{(?:Skills)?\}\{([\s\S]*?)\}/) || body.match(/\\cvitem\{\}\{([\s\S]*?)\}/);
        sections.push(createTextSection("专业技能", latexUnescape(cvitemMatch ? cvitemMatch[1] : body)));
        continue;
      }
      const entries = [];
      const entryRe = /\\cventry\{([\s\S]*?)\}\{([\s\S]*?)\}\{([\s\S]*?)\}\{([\s\S]*?)\}\{([\s\S]*?)\}\{([\s\S]*?)\}/g;
      let entryMatch;
      while ((entryMatch = entryRe.exec(body))) {
        entries.push({
          meta: latexUnescape(entryMatch[1].trim()),
          title: latexUnescape(entryMatch[2].trim()),
          subtitle: latexUnescape(entryMatch[3].trim()),
          desc: latexUnescape(entryMatch[6].trim())
        });
      }
      sections.push({ title: sectionTitle, entries: entries });
    }

    return normalizeModel({
      name: nameMatch ? latexUnescape((nameMatch[1] + nameMatch[2]).trim()) : defaultModel.name,
      role: readCommand(sourceText, "title", defaultModel.role),
      contact: composeContact(contact),
      summary: readCommand(sourceText, "quote", defaultModel.summary),
      sections: sections.length ? sections : defaultModel.sections
    });
  }

  function renderModerncv(model) {
    model = normalizeModel(model);
    const contact = splitContact(model.contact);
    const lines = [
      "\\documentclass[11pt,a4paper,sans]{moderncv}",
      "\\moderncvstyle{classic}",
      "\\moderncvcolor{green}",
      "\\usepackage[UTF8]{ctex}",
      "\\usepackage[scale=0.82]{geometry}",
      "",
      "\\name{" + latexEscape(model.name) + "}{}",
      "\\title{" + latexEscape(model.role) + "}",
      "\\address{" + latexEscape(contact.location) + "}{}{}",
      contact.email ? "\\email{" + latexEscape(contact.email) + "}" : "",
      contact.github ? "\\social[github]{" + latexEscape(contact.github) + "}" : "",
      "",
      "\\begin{document}",
      "\\makecvtitle",
      ""
    ].filter(function (line) { return line !== ""; });
    model.sections.forEach(function (section) {
      lines.push("\\section{" + latexEscape(section.title) + "}");
      section.entries.forEach(function (entry) {
        lines.push("\\cventry{" + latexEscape(entry.meta) + "}{" + latexEscape(entry.title) + "}{" + latexEscape(entry.subtitle) + "}{}{}{" + latexEscape(entry.desc) + "}");
      });
      lines.push("");
    });
    lines.push("\\end{document}");
    return lines.join("\n");
  }

  function parseHtml(sourceText) {
    if (!window.DOMParser) {
      return cloneModel(defaultModel);
    }
    const doc = new DOMParser().parseFromString(sourceText, "text/html");
    const root = doc.querySelector(".resume-html") || doc.body;
    const summaryText = root.querySelector(".resume-profile .resume-summary, .resume-profile p");
    const skillsText = root.querySelector(".resume-skills .resume-skill-text, .resume-skills p");
    const skills = skillsText
      ? text(skillsText.textContent)
      : Array.from(root.querySelectorAll(".resume-skills li, .resume-skills span"))
        .map(function (el) { return text(el.textContent); })
        .filter(Boolean)
        .join(", ");
    const sections = Array.from(root.querySelectorAll("section.resume-section")).map(function (section) {
      const title = text((section.querySelector("h2") || {}).textContent);
      return {
        title: isLegacySkillsTitle(title) ? "专业技能" : title,
        entries: Array.from(section.querySelectorAll(".resume-entry")).map(function (entry) {
          return {
            title: text((entry.querySelector("h3") || {}).textContent),
            subtitle: text((entry.querySelector(".resume-entry-subtitle") || {}).textContent),
            meta: text((entry.querySelector(".resume-entry-meta") || {}).textContent),
            desc: text((entry.querySelector(".resume-entry-desc") || {}).textContent)
          };
        })
      };
    }).filter(function (section) {
      return !isProfileTitle(section.title);
    });
    if (skills && !sections.some(function (section) { return isProfessionalSkillsTitle(section.title); })) {
      sections.push(createTextSection("专业技能", skills));
    }
    return normalizeModel({
      name: text((root.querySelector("h1") || {}).textContent) || defaultModel.name,
      role: text((root.querySelector(".resume-role") || {}).textContent) || defaultModel.role,
      contact: text((root.querySelector(".resume-contact") || {}).textContent) || defaultModel.contact,
      summary: text((summaryText || {}).textContent) || defaultModel.summary,
      skills: skills || defaultModel.skills,
      sections: sections.length ? sections : defaultModel.sections
    });
  }

  function renderHtml(model) {
    model = normalizeModel(model);
    const sectionHtml = model.sections.map(function (section) {
      const entries = section.entries.map(function (entry) {
        return [
          '      <div class="resume-entry">',
          "        <h3>" + escapeHtml(entry.title) + "</h3>",
          '        <p class="resume-entry-subtitle">' + escapeHtml(entry.subtitle) + "</p>",
          '        <p class="resume-entry-meta">' + escapeHtml(entry.meta) + "</p>",
          '        <p class="resume-entry-desc">' + escapeHtml(entry.desc) + "</p>",
          "      </div>"
        ].join("\n");
      }).join("\n");
      return [
        '    <section class="resume-section">',
        "      <h2>" + escapeHtml(section.title) + "</h2>",
        entries,
        "    </section>"
      ].join("\n");
    }).join("\n");
    return [
      "<!doctype html>",
      '<html lang="zh-CN">',
      "<head>",
      '  <meta charset="utf-8">',
      "  <title>" + escapeHtml(model.name) + " Resume</title>",
      "</head>",
      "<body>",
      '  <article class="resume-html">',
      "    <header>",
      "      <h1>" + escapeHtml(model.name) + "</h1>",
      '      <p class="resume-role">' + escapeHtml(model.role) + "</p>",
      '      <p class="resume-contact">' + escapeHtml(model.contact) + "</p>",
      "    </header>",
      sectionHtml,
      "  </article>",
      "</body>",
      "</html>"
    ].join("\n");
  }

  const formats = {
    latex: {
      label: "LaTeX",
      file: "resume.tex",
      parse: parseLatex,
      render: renderLatex
    },
    markdown: {
      label: "Markdown",
      file: "resume.md",
      parse: parseMarkdown,
      render: renderMarkdown
    },
    moderncv: {
      label: "moderncv",
      file: "resume-moderncv.tex",
      parse: parseModerncv,
      render: renderModerncv
    },
    html: {
      label: "HTML",
      file: "resume.html",
      parse: parseHtml,
      render: renderHtml
    }
  };

  function renderSource(model) {
    return formats[currentFormat].render(model);
  }

  function parseSource(value) {
    try {
      return formats[currentFormat].parse(value);
    } catch (error) {
      setStatus(t("overleaf.status.parsefail", "Source parsed with fallback values"));
      return currentModel || cloneModel(defaultModel);
    }
  }

  function saveState() {
    try {
      window.localStorage.setItem(formatStorageKey, currentFormat);
      window.localStorage.setItem(sourceStoragePrefix + currentFormat, source.value);
    } catch (error) {
      // localStorage 存储失败，不影响编辑功能
    }
  }

  function updateFormatUi() {
    const format = formats[currentFormat];
    if (formatSelect) {
      formatSelect.value = currentFormat;
    }
    if (sourceBadge) {
      sourceBadge.textContent = format.file;
    }
    source.setAttribute("aria-label", format.label + " source");
  }

  function editable(field, value) {
    return '<span contenteditable="true" data-resume-field="' + field + '">' + escapeHtml(value) + "</span>";
  }

  function renderPreview(model) {
    model = normalizeModel(model);
    const sections = model.sections.map(function (section, sectionIndex) {
      const entries = section.entries.map(function (entry, entryIndex) {
        return [
          '<div class="latex-entry" data-section-index="' + sectionIndex + '" data-entry-index="' + entryIndex + '">',
          '<div class="latex-entry-head">',
          '<span class="latex-entry-title-wrap"><strong contenteditable="true" data-entry-field="title">' + escapeHtml(entry.title) + "</strong>" +
            (entry.subtitle ? '<em class="latex-entry-sub" contenteditable="true" data-entry-field="subtitle">' + escapeHtml(entry.subtitle) + "</em>" : "") +
            "</span>",
          '<span contenteditable="true" data-entry-field="meta">' + escapeHtml(entry.meta) + "</span>",
          "</div>",
          '<p contenteditable="true" data-entry-field="desc">' + escapeHtml(entry.desc) + "</p>",
          "</div>"
        ].join("");
      }).join("");
      return '<section class="latex-section" data-section-index="' + sectionIndex + '">' +
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
      sections;
  }

  function syncFromSource() {
    if (applyingFromPreview) {return;}
    applyingFromSource = true;
    currentModel = parseSource(source.value);
    renderPreview(currentModel);
    saveState();
    setStatus(t("overleaf.status.compiled", "Compiled from source") + " · " + formats[currentFormat].label);
    applyingFromSource = false;
  }

  function updateModelFromPreview(target) {
    const value = text(target.textContent);
    const field = target.getAttribute("data-resume-field");
    if (field) {
      currentModel[field] = value;
      return;
    }
    if (target.hasAttribute("data-section-title")) {
      const sectionEl = target.closest("[data-section-index]");
      const section = currentModel.sections[Number(sectionEl.getAttribute("data-section-index"))];
      if (section) {section.title = value;}
      return;
    }
    if (target.hasAttribute("data-entry-field")) {
      const entryEl = target.closest("[data-section-index][data-entry-index]");
      const sectionIndex = Number(entryEl.getAttribute("data-section-index"));
      const entryIndex = Number(entryEl.getAttribute("data-entry-index"));
      const entry = currentModel.sections[sectionIndex] && currentModel.sections[sectionIndex].entries[entryIndex];
      if (entry) {
        entry[target.getAttribute("data-entry-field")] = value;
      }
    }
  }

  function syncFromPreview(target) {
    if (applyingFromSource) {return;}
    applyingFromPreview = true;
    currentModel = normalizeModel(currentModel || cloneModel(defaultModel));
    updateModelFromPreview(target);
    source.value = renderSource(currentModel);
    saveState();
    setStatus(t("overleaf.status.synced", "Preview edits synced to source") + " · " + formats[currentFormat].label);
    applyingFromPreview = false;
  }

  function copySource(button) {
    function done(ok) {
      const label = button.querySelector("span");
      if (!label) {return;}
      const old = label.textContent;
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

  function switchFormat(nextFormat) {
    if (!formats[nextFormat] || nextFormat === currentFormat) {return;}
    currentModel = parseSource(source.value);
    currentFormat = nextFormat;
    source.value = renderSource(currentModel);
    updateFormatUi();
    saveState();
    setStatus(t("overleaf.status.format", "Source format switched to") + " " + formats[currentFormat].label);
  }

  function resetCurrentTemplate() {
    currentModel = cloneModel(defaultModel);
    source.value = renderSource(currentModel);
    renderPreview(currentModel);
    saveState();
    setStatus(t("overleaf.status.reset", "Template restored") + " · " + formats[currentFormat].label);
  }

  function loadInitialFormat() {
    try {
      const saved = window.localStorage.getItem(formatStorageKey);
      return formats[saved] ? saved : "markdown";
    } catch (error) {
      return "markdown";
    }
  }

  function loadInitialSource(format) {
    try {
      return window.localStorage.getItem(sourceStoragePrefix + format) ||
        (format === "latex" ? window.localStorage.getItem(legacyStorageKey) : "") ||
        formats[format].render(defaultModel);
    } catch (error) {
      return formats[format].render(defaultModel);
    }
  }

  currentFormat = loadInitialFormat();
  source.value = loadInitialSource(currentFormat);
  updateFormatUi();
  syncFromSource();

  source.addEventListener("input", syncFromSource);

  let scrolling = null;
  function linkScroll(sourceEl, targetEl) {
    if (!sourceEl || !targetEl) {return;}
    sourceEl.addEventListener("scroll", function () {
      if (scrolling && scrolling !== sourceEl) {
        return;
      }
      scrolling = sourceEl;
      const max = sourceEl.scrollHeight - sourceEl.clientHeight;
      const ratio = max > 0 ? sourceEl.scrollTop / max : 0;
      const targetMax = targetEl.scrollHeight - targetEl.clientHeight;
      targetEl.scrollTop = ratio * targetMax;
      window.requestAnimationFrame(function () {
        scrolling = null;
      });
    }, { passive: true });
  }
  linkScroll(source, previewScroll);
  linkScroll(previewScroll, source);

  if (formatSelect) {
    formatSelect.addEventListener("change", function () {
      switchFormat(formatSelect.value);
    });
  }

  preview.addEventListener("input", function (event) {
    const target = event.target;
    if (target && target.matches("[contenteditable='true']")) {
      syncFromPreview(target);
    }
  });

  document.addEventListener("click", function (event) {
    const button = event.target.closest("[data-overleaf-action]");
    if (!button) {return;}
    const action = button.getAttribute("data-overleaf-action");
    if (action === "compile") {syncFromSource();}
    if (action === "copy") {copySource(button);}
    if (action === "reset") {resetCurrentTemplate();}
    if (action === "pdf") {printPdf();}
  });

  document.addEventListener("cwl:langchange", function () {
    setStatus(t("overleaf.status.ready", "Ready") + " · " + formats[currentFormat].label);
  });
})();
