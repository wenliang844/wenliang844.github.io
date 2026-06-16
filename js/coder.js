(function () {
  var body = document.body;

  /* ----------------------------------------------------------------------
   * Color scheme toggle
   * -------------------------------------------------------------------- */
  var STORAGE_KEY_THEME = "coder-color-scheme";
  var stored = null;

  try {
    stored = window.CWLUtils ? window.CWLUtils.storageGet(STORAGE_KEY_THEME) : window.localStorage.getItem(STORAGE_KEY_THEME);
  } catch (error) {
    console.warn("Failed to read theme from localStorage:", error);
  }

  // 默认暗色：页面 body 初始即 colorscheme-dark，仅当用户显式存过 "light" 才切回亮色。
  if (stored === "light") {
    body.classList.remove("colorscheme-dark");
    body.classList.add("colorscheme-light");
  }

  document.querySelectorAll(".theme-toggle").forEach(function (button) {
    button.addEventListener("click", function () {
      var dark = body.classList.toggle("colorscheme-dark");
      body.classList.toggle("colorscheme-light", !dark);
      try {
        if (window.CWLUtils) {
          window.CWLUtils.storageSet(STORAGE_KEY_THEME, dark ? "dark" : "light");
        } else {
          window.localStorage.setItem(STORAGE_KEY_THEME, dark ? "dark" : "light");
        }
      } catch (error) {
        console.warn("Failed to save theme to localStorage:", error);
      }
    });
  });

  /* ----------------------------------------------------------------------
   * Blog list: switch between inline article panels
   * -------------------------------------------------------------------- */
  var postLinks = Array.prototype.slice.call(document.querySelectorAll(".post-tree-link[data-post-target]"));
  var postPanels = Array.prototype.slice.call(document.querySelectorAll(".blog-article[id]"));

  function showPost(targetId, updateHash) {
    var target = document.getElementById(targetId);
    if (!target) {
      return;
    }

    postPanels.forEach(function (panel) {
      panel.classList.toggle("active", panel.id === targetId);
    });

    postLinks.forEach(function (link) {
      var active = link.getAttribute("data-post-target") === targetId;
      link.classList.toggle("active", active);
      if (active) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    if (updateHash && target.dataset.postSlug) {
      window.history.replaceState(null, "", "#" + target.dataset.postSlug);
    }

    document.dispatchEvent(new CustomEvent("cwl:postchange", {
      detail: { targetId: targetId, slug: target.dataset.postSlug || "" }
    }));
  }

  if (postLinks.length && postPanels.length) {
    postLinks.forEach(function (link) {
      link.addEventListener("click", function (event) {
        event.preventDefault();
        showPost(link.getAttribute("data-post-target"), true);
      });
    });

    var initialSlug = window.location.hash.replace("#", "");
    var initialLink = postLinks.find(function (link) {
      var panel = document.getElementById(link.getAttribute("data-post-target"));
      return panel && panel.dataset.postSlug === initialSlug;
    });

    if (initialLink) {
      showPost(initialLink.getAttribute("data-post-target"), false);
    }
  }

  // Expose so other scripts (search/tag filter) can drive panel switching.
  window.coderShowPost = showPost;

  /* ----------------------------------------------------------------------
   * Reading progress bar & scroll handling with throttle
   * -------------------------------------------------------------------- */
  var progress = document.createElement("div");
  progress.className = "read-progress";
  body.appendChild(progress);

  /* ----------------------------------------------------------------------
   * Back-to-top button
   * -------------------------------------------------------------------- */
  var toTop = document.createElement("button");
  toTop.className = "to-top";
  toTop.type = "button";
  toTop.innerHTML = '<i class="fas fa-arrow-up" aria-hidden="true"></i>';
  toTop.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  body.appendChild(toTop);

  function t(key, fallback) {
    return window.cwlT ? window.cwlT(key, fallback) : fallback;
  }

  function updateToTop() {
    toTop.setAttribute("aria-label", t("dyn.totop", "返回顶部"));
  }

  // 常量定义，避免魔法数字
  var SCROLL_CONSTANTS = {
    BACK_TO_TOP_THRESHOLD: 420,    // 显示返回顶部按钮的滚动距离
    READING_SPEED_CHINESE: 350,     // 中文阅读速度（字/分钟）
    READING_SPEED_ENGLISH: 200,     // 英文阅读速度（词/分钟）
    TOC_OFFSET: 125,                // TOC 激活偏移量
    SCROLL_THROTTLE: 100            // 滚动事件节流时间（毫秒）
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function getActiveArticle() {
    return document.querySelector(".blog-article.active") ||
      document.querySelector("article.article");
  }

  function onScroll() {
    var doc = document.documentElement;
    var scrollTop = window.pageYOffset || doc.scrollTop;
    var article = getActiveArticle();
    var ratio = 0;

    if (article) {
      var articleTop = article.getBoundingClientRect().top + scrollTop;
      var readableHeight = Math.max(1, article.scrollHeight - window.innerHeight * 0.65);
      ratio = clamp((scrollTop - articleTop) / readableHeight, 0, 1);
    } else {
      var height = doc.scrollHeight - doc.clientHeight;
      ratio = height > 0 ? scrollTop / height : 0;
    }

    progress.style.width = (ratio * 100).toFixed(2) + "%";
    toTop.classList.toggle("visible", scrollTop > SCROLL_CONSTANTS.BACK_TO_TOP_THRESHOLD);
    updateActiveToc();
  }

  // 使用节流优化滚动性能
  var throttledScroll = window.CWLUtils
    ? window.CWLUtils.throttle(onScroll, SCROLL_CONSTANTS.SCROLL_THROTTLE)
    : onScroll;

  window.addEventListener("scroll", throttledScroll, { passive: true });
  window.addEventListener("resize", throttledScroll);
  onScroll();

  /* ----------------------------------------------------------------------
   * Copy-to-clipboard buttons on code blocks
   * -------------------------------------------------------------------- */
  // 使用公共工具的 copyText 或降级实现
  var copyText = window.CWLUtils && window.CWLUtils.copyText
    ? window.CWLUtils.copyText
    : function (text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          return navigator.clipboard.writeText(text);
        }
        return new Promise(function (resolve, reject) {
          try {
            var area = document.createElement("textarea");
            area.value = text;
            area.style.position = "fixed";
            area.style.opacity = "0";
            document.body.appendChild(area);
            area.select();
            document.execCommand("copy");
            area.remove();
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      };

  document.querySelectorAll(".article-content pre").forEach(function (pre) {
    if (pre.querySelector(".code-copy")) {
      return;
    }
    var button = document.createElement("button");
    button.type = "button";
    button.className = "code-copy";
    button.innerHTML = t("dyn.copy", '<i class="fas fa-copy" aria-hidden="true"></i> 复制');
    button.addEventListener("click", function () {
      var code = pre.querySelector("code") || pre;
      copyText(code.innerText).then(function () {
        button.classList.add("copied");
        button.innerHTML = t("dyn.copied", '<i class="fas fa-check" aria-hidden="true"></i> 已复制');
        window.setTimeout(function () {
          button.classList.remove("copied");
          button.innerHTML = t("dyn.copy", '<i class="fas fa-copy" aria-hidden="true"></i> 复制');
        }, 1600);
      });
    });
    pre.appendChild(button);
  });

  /* ----------------------------------------------------------------------
   * Reading time + table of contents per article
   * -------------------------------------------------------------------- */
  function readingMinutes(text) {
    var chinese = (text.match(/[一-龥]/g) || []).length;
    var rest = text.replace(/[一-龥]/g, " ").trim();
    var words = rest ? rest.split(/\s+/).length : 0;
    return Math.max(1, Math.round(
      chinese / SCROLL_CONSTANTS.READING_SPEED_CHINESE +
      words / SCROLL_CONSTANTS.READING_SPEED_ENGLISH
    ));
  }

  function activeArticleContent(article) {
    return article.querySelector(".article-content:not([hidden])") ||
      article.querySelector(".article-content");
  }

  function slugify(text) {
    return (text || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9一-龥]+/g, "-")
      .replace(/^-+|-+$/g, "") || "section";
  }

  function uniqueHeadingId(article, contentBlock, heading, index) {
    if (heading.id) {
      return heading.id;
    }
    var articleId = article.dataset.postSlug || article.id || "article";
    var lang = contentBlock.getAttribute("data-i18n-lang") || "content";
    return "toc-" + slugify(articleId) + "-" + slugify(lang) + "-" + index + "-" + slugify(heading.textContent);
  }

  function clearToc(contentBlock) {
    var existing = contentBlock.querySelector(".article-toc");
    if (existing) {
      existing.remove();
    }
  }

  function buildToc(article, contentBlock) {
    clearToc(contentBlock);

    var headings = Array.prototype.slice.call(contentBlock.querySelectorAll("h2, h3"))
      .filter(function (heading) {
        return (heading.textContent || "").trim();
      });

    if (headings.length < 3) {
      return;
    }

    var toc = document.createElement("nav");
    toc.className = "article-toc";
    toc.setAttribute("aria-label", t("dyn.toc.aria", "目录"));

    var title = document.createElement("strong");
    title.textContent = t("dyn.toc", "目录");
    toc.appendChild(title);

    var list = document.createElement("ol");
    headings.forEach(function (heading, index) {
      heading.id = uniqueHeadingId(article, contentBlock, heading, index);

      var item = document.createElement("li");
      item.className = "toc-depth-" + heading.tagName.slice(1);

      var link = document.createElement("a");
      link.href = "#" + heading.id;
      link.textContent = heading.textContent || "";
      link.addEventListener("click", function () {
        window.setTimeout(updateActiveToc, 80);
      });

      item.appendChild(link);
      list.appendChild(item);
    });

    toc.appendChild(list);
    contentBlock.insertBefore(toc, contentBlock.firstChild);
  }

  function updateActiveToc() {
    var article = getActiveArticle();
    var content = article && activeArticleContent(article);
    if (!content) return;

    var toc = content.querySelector(".article-toc");
    if (!toc) return;

    var headings = Array.prototype.slice.call(content.querySelectorAll("h2, h3[id]"));
    if (!headings.length) return;

    var active = headings[0];
    headings.forEach(function (heading) {
      if (heading.getBoundingClientRect().top <= SCROLL_CONSTANTS.TOC_OFFSET) {
        active = heading;
      }
    });

    toc.querySelectorAll("a").forEach(function (link) {
      var isActive = link.getAttribute("href") === "#" + active.id;
      link.classList.toggle("active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "true");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function updateDynamicText() {
    updateToTop();
    document.querySelectorAll(".code-copy:not(.copied)").forEach(function (button) {
      button.innerHTML = t("dyn.copy", '<i class="fas fa-copy" aria-hidden="true"></i> 复制');
    });
    document.querySelectorAll(".reading-time").forEach(function (span) {
      var article = span.closest("article.article");
      var content = article && activeArticleContent(article);
      if (!content) return;
      var prefix = t("dyn.readingPrefix", "阅读约");
      var suffix = t("dyn.readingSuffix", "分钟");
      span.innerHTML = '<i class="fas fa-clock" aria-hidden="true"></i> ' + prefix +
        " " + readingMinutes(content.textContent || "") + " " + suffix;
    });
    document.querySelectorAll(".article-toc").forEach(function (toc) {
      toc.setAttribute("aria-label", t("dyn.toc.aria", "目录"));
      var strong = toc.querySelector("strong");
      if (strong) {
        strong.textContent = t("dyn.toc", "目录");
      }
    });
    onScroll();
  }

  document.querySelectorAll("article.article").forEach(function (article) {
    var content = activeArticleContent(article);
    var meta = article.querySelector(".article-meta");
    if (!content) {
      return;
    }

    if (meta && !meta.querySelector(".reading-time")) {
      var span = document.createElement("span");
      span.className = "reading-time";
      var prefix = t("dyn.readingPrefix", "阅读约");
      var suffix = t("dyn.readingSuffix", "分钟");
      span.innerHTML = '<i class="fas fa-clock" aria-hidden="true"></i> ' + prefix +
        " " + readingMinutes(content.textContent || "") + " " + suffix;
      meta.appendChild(document.createTextNode(" "));
      meta.appendChild(span);
    }

    // Build a TOC only for longer articles (>= 3 section headings).
    Array.prototype.slice.call(article.querySelectorAll(".article-content")).forEach(function (contentBlock) {
      buildToc(article, contentBlock);
    });
  });

  document.addEventListener("cwl:langchange", updateDynamicText);
  document.addEventListener("cwl:postchange", function () {
    updateDynamicText();
    onScroll();
  });
  updateDynamicText();

  /* ----------------------------------------------------------------------
   * Scroll reveal
   * -------------------------------------------------------------------- */
  var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var revealTargets = Array.prototype.slice.call(
    document.querySelectorAll(".card, .ai-card, .insight-list li, .timeline-stats div, .feedback-item, .post-item")
  );

  if (!prefersReduced && "IntersectionObserver" in window && revealTargets.length) {
    revealTargets.forEach(function (el) {
      el.classList.add("reveal");
    });
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    revealTargets.forEach(function (el) {
      observer.observe(el);
    });
  }

  // Animate skill bars (.skill-fill[data-level]) to their target width.
  var skillFills = Array.prototype.slice.call(document.querySelectorAll(".skill-fill[data-level]"));
  if (skillFills.length) {
    skillFills.forEach(function (fill) {
      fill.style.setProperty("--level", fill.getAttribute("data-level"));
    });
    if (!prefersReduced && "IntersectionObserver" in window) {
      // Observe the full-width track, not the zero-width fill (a zero-area
      // target never produces an intersection ratio).
      var skillObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var fill = entry.target.querySelector(".skill-fill");
            if (fill) {
              fill.classList.add("is-filled");
            }
            skillObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.4 });
      skillFills.forEach(function (fill) {
        var track = fill.parentElement || fill;
        skillObserver.observe(track);
      });
    } else {
      skillFills.forEach(function (fill) {
        fill.classList.add("is-filled");
      });
    }
  }

  /* ----------------------------------------------------------------------
   * Cursor particle trail (decorative; skipped under reduced motion)
   * -------------------------------------------------------------------- */
  var canvas = document.querySelector(".cursor-canvas");
  if (!canvas || prefersReduced) {
    return;
  }

  var context = canvas.getContext("2d");
  var particles = [];
  var pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  var hue = 190;

  function resizeCanvas() {
    var ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(window.innerWidth * ratio);
    canvas.height = Math.floor(window.innerHeight * ratio);
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function addParticle(x, y) {
    particles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 1.6,
      vy: (Math.random() - 0.5) * 1.6,
      radius: Math.random() * 4 + 2,
      life: 1,
      hue: hue + Math.random() * 40
    });

    if (particles.length > 90) {
      particles.shift();
    }
  }

  function draw() {
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (var index = particles.length - 1; index >= 0; index -= 1) {
      var particle = particles[index];
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.012;
      particle.life -= 0.018;

      if (particle.life <= 0) {
        particles.splice(index, 1);
        continue;
      }

      context.beginPath();
      context.fillStyle = "hsla(" + particle.hue + ", 90%, 62%, " + particle.life + ")";
      context.shadowColor = "hsla(" + particle.hue + ", 90%, 62%, 0.7)";
      context.shadowBlur = 14;
      context.arc(particle.x, particle.y, particle.radius * particle.life, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;
    }

    window.requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("pointermove", function (event) {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    hue = (hue + 2) % 360;
    body.classList.add("cursor-active");
    body.style.setProperty("--cursor-x", pointer.x + "px");
    body.style.setProperty("--cursor-y", pointer.y + "px");
    addParticle(pointer.x, pointer.y);
  });
  window.addEventListener("pointerleave", function () {
    body.classList.remove("cursor-active");
  });

  resizeCanvas();
  draw();
})();
