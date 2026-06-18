(function () {
  const body = document.body;

  /* ----------------------------------------------------------------------
   * Color scheme toggle
   * -------------------------------------------------------------------- */
  const STORAGE_KEY_THEME = "coder-color-scheme";
  let stored = null;

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
      const dark = body.classList.toggle("colorscheme-dark");
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
  const postLinks = Array.prototype.slice.call(document.querySelectorAll(".post-tree-link[data-post-target]"));
  const postPanels = Array.prototype.slice.call(document.querySelectorAll(".blog-article[id]"));

  function showPost(targetId, updateHash) {
    const target = document.getElementById(targetId);
    if (!target) {
      return;
    }

    postPanels.forEach(function (panel) {
      panel.classList.toggle("active", panel.id === targetId);
    });

    postLinks.forEach(function (link) {
      const active = link.getAttribute("data-post-target") === targetId;
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

    const initialSlug = window.location.hash.replace("#", "");
    const initialLink = postLinks.find(function (link) {
      const panel = document.getElementById(link.getAttribute("data-post-target"));
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
  const progress = document.createElement("div");
  progress.className = "read-progress";
  body.appendChild(progress);

  /* ----------------------------------------------------------------------
   * Back-to-top button
   * -------------------------------------------------------------------- */
  const existingToTop = document.querySelector(".to-top");
  const toTop = existingToTop || document.createElement("button");
  toTop.classList.add("to-top");
  toTop.type = "button";
  if (!toTop.innerHTML.trim()) {
    toTop.innerHTML = '<i class="fas fa-arrow-up" aria-hidden="true"></i>';
  }
  toTop.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  if (!existingToTop) {
    body.appendChild(toTop);
  }

  function t(key, fallback) {
    return window.cwlT ? window.cwlT(key, fallback) : fallback;
  }

  function updateToTop() {
    toTop.setAttribute("aria-label", t("dyn.totop", "返回顶部"));
  }

  // 常量定义，避免魔法数字
  const SCROLL_CONSTANTS = {
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
    const doc = document.documentElement;
    const scrollTop = window.scrollY || doc.scrollTop;
    const article = getActiveArticle();
    let ratio = 0;

    if (article) {
      progress.hidden = false;
      const articleTop = article.getBoundingClientRect().top + scrollTop;
      const readableHeight = Math.max(1, article.scrollHeight - window.innerHeight * 0.65);
      ratio = clamp((scrollTop - articleTop) / readableHeight, 0, 1);
    } else {
      progress.hidden = true;
    }

    progress.style.width = (ratio * 100).toFixed(2) + "%";
    toTop.classList.toggle("visible", scrollTop > SCROLL_CONSTANTS.BACK_TO_TOP_THRESHOLD);
    updateActiveToc();
  }

  // 使用节流优化滚动性能
  const throttledScroll = window.CWLUtils
    ? window.CWLUtils.throttle(onScroll, SCROLL_CONSTANTS.SCROLL_THROTTLE)
    : onScroll;

  window.addEventListener("scroll", throttledScroll, { passive: true });
  window.addEventListener("resize", throttledScroll);
  onScroll();

  /* ----------------------------------------------------------------------
   * Copy-to-clipboard buttons on code blocks
   * -------------------------------------------------------------------- */
  // 使用公共工具的 copyText 或降级实现
  const copyText = window.CWLUtils && window.CWLUtils.copyText
    ? window.CWLUtils.copyText
    : function (text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          return navigator.clipboard.writeText(text);
        }
        return new Promise(function (resolve, reject) {
          try {
            const area = document.createElement("textarea");
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
    const button = document.createElement("button");
    button.type = "button";
    button.className = "code-copy";
    button.innerHTML = t("dyn.copy", '<i class="fas fa-copy" aria-hidden="true"></i> 复制');
    button.addEventListener("click", function () {
      const code = pre.querySelector("code") || pre;
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
    const chinese = (text.match(/[一-龥]/g) || []).length;
    const rest = text.replace(/[一-龥]/g, " ").trim();
    const words = rest ? rest.split(/\s+/).length : 0;
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
    const articleId = article.dataset.postSlug || article.id || "article";
    const lang = contentBlock.getAttribute("data-i18n-lang") || "content";
    return "toc-" + slugify(articleId) + "-" + slugify(lang) + "-" + index + "-" + slugify(heading.textContent);
  }

  function clearToc(contentBlock) {
    const existing = contentBlock.querySelector(".article-toc");
    if (existing) {
      existing.remove();
    }
    const article = contentBlock.closest("article.article");
    if (article) {
      const lang = contentBlock.getAttribute("data-i18n-lang") || "content";
      const articleToc = article.querySelector('.article-toc[data-toc-lang="' + lang + '"]');
      if (articleToc) {
        articleToc.remove();
      }
    }
  }

  function setArticleTocOpen(toc, open) {
    const toggle = toc && toc.querySelector(".article-toc-toggle");
    if (!toggle) {return;}
    toc.classList.toggle("is-open", open);
    toc.classList.toggle("is-collapsed", !open);
    toggle.setAttribute("aria-expanded", String(open));
  }

  function buildToc(article, contentBlock) {
    clearToc(contentBlock);

    const headings = Array.prototype.slice.call(contentBlock.querySelectorAll("h2, h3"))
      .filter(function (heading) {
        return (heading.textContent || "").trim();
      });

    if (headings.length < 3) {
      return;
    }

    const toc = document.createElement("aside");
    toc.className = "article-toc is-open";
    toc.setAttribute("aria-label", t("dyn.toc.aria", "目录"));
    toc.setAttribute("data-toc-lang", contentBlock.getAttribute("data-i18n-lang") || "content");
    toc.hidden = contentBlock.hidden;

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "article-toc-toggle";
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", t("dyn.toc.aria", "目录"));
    toggle.innerHTML = '<i class="fas fa-list" aria-hidden="true"></i><span>' +
      t("dyn.toc", "目录") +
      '</span><i class="fas fa-chevron-down article-toc-chevron" aria-hidden="true"></i>';
    toggle.addEventListener("click", function () {
      setArticleTocOpen(toc, toggle.getAttribute("aria-expanded") !== "true");
    });
    toc.appendChild(toggle);

    const list = document.createElement("ol");
    headings.forEach(function (heading, index) {
      heading.id = uniqueHeadingId(article, contentBlock, heading, index);

      const item = document.createElement("li");
      item.className = "toc-depth-" + heading.tagName.slice(1);

      const link = document.createElement("a");
      link.href = "#" + heading.id;
      link.textContent = heading.textContent || "";
      link.addEventListener("click", function () {
        window.setTimeout(updateActiveToc, 80);
      });

      item.appendChild(link);
      list.appendChild(item);
    });

    toc.appendChild(list);
    article.appendChild(toc);
  }

  function updateActiveToc() {
    const article = getActiveArticle();
    const content = article && activeArticleContent(article);
    if (!content) {return;}

    const lang = content.getAttribute("data-i18n-lang") || "content";
    const toc = article.querySelector('.article-toc[data-toc-lang="' + lang + '"]');
    if (!toc) {return;}

    const headings = Array.prototype.slice.call(content.querySelectorAll("h2, h3[id]"));
    if (!headings.length) {return;}

    let active = headings[0];
    headings.forEach(function (heading) {
      if (heading.getBoundingClientRect().top <= SCROLL_CONSTANTS.TOC_OFFSET) {
        active = heading;
      }
    });

    toc.querySelectorAll("a").forEach(function (link) {
      const isActive = link.getAttribute("href") === "#" + active.id;
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
      const article = span.closest("article.article");
      const content = article && activeArticleContent(article);
      if (!content) {return;}
      const prefix = t("dyn.readingPrefix", "约");
      const suffix = t("dyn.readingSuffix", "分钟");
      span.innerHTML = '<i class="fas fa-clock" aria-hidden="true"></i> ' + prefix +
        " " + readingMinutes(content.textContent || "") + " " + suffix;
    });
    document.querySelectorAll(".article-toc").forEach(function (toc) {
      const article = toc.closest("article.article");
      const content = article && activeArticleContent(article);
      const activeLang = content && (content.getAttribute("data-i18n-lang") || "content");
      const tocLang = toc.getAttribute("data-toc-lang") || "content";
      toc.hidden = Boolean(activeLang && tocLang !== activeLang);
      toc.setAttribute("aria-label", t("dyn.toc.aria", "目录"));
      const toggle = toc.querySelector(".article-toc-toggle");
      const title = toggle && toggle.querySelector("span");
      if (toggle) {
        toggle.setAttribute("aria-label", t("dyn.toc.aria", "目录"));
      }
      if (title) {
        title.textContent = t("dyn.toc", "目录");
      }
    });
    onScroll();
  }

  document.querySelectorAll("article.article").forEach(function (article) {
    const content = activeArticleContent(article);
    const meta = article.querySelector(".article-meta");
    if (!content) {
      return;
    }

    if (meta && !meta.querySelector(".reading-time")) {
      const span = document.createElement("span");
      span.className = "reading-time";
      const prefix = t("dyn.readingPrefix", "约");
      const suffix = t("dyn.readingSuffix", "分钟");
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
  const prefersReduced = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
  const revealTargets = Array.prototype.slice.call(
    document.querySelectorAll(".card, .ai-card, .insight-list li, .timeline-stats div, .feedback-item, .post-item")
  );

  if (!prefersReduced && "IntersectionObserver" in window && revealTargets.length) {
    revealTargets.forEach(function (el) {
      el.classList.add("reveal");
    });
    const observer = new IntersectionObserver(function (entries) {
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
  const skillFills = Array.prototype.slice.call(document.querySelectorAll(".skill-fill[data-level]"));
  if (skillFills.length) {
    skillFills.forEach(function (fill) {
      fill.style.setProperty("--level", fill.getAttribute("data-level"));
    });
    if (!prefersReduced && "IntersectionObserver" in window) {
      // Observe the full-width track, not the zero-width fill (a zero-area
      // target never produces an intersection ratio).
      const skillObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            const fill = entry.target.querySelector(".skill-fill");
            if (fill) {
              fill.classList.add("is-filled");
            }
            skillObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.4 });
      skillFills.forEach(function (fill) {
        const track = fill.parentElement || fill;
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
  const canvas = document.querySelector(".cursor-canvas");
  if (!canvas || prefersReduced) {
    return;
  }

  const context = canvas.getContext("2d");
  const particles = [];
  const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  let hue = 190;
  let animationFrame = 0;

  function resizeCanvas() {
    const ratio = window.devicePixelRatio || 1;
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

  function removeParticle(index) {
    particles[index] = particles[particles.length - 1];
    particles.pop();
  }

  function scheduleDraw() {
    if (animationFrame || document.hidden || !particles.length) {
      return;
    }
    animationFrame = window.requestAnimationFrame(draw);
  }

  function stopDraw() {
    if (animationFrame && window.cancelAnimationFrame) {
      window.cancelAnimationFrame(animationFrame);
    }
    animationFrame = 0;
  }

  function draw() {
    animationFrame = 0;
    if (document.hidden || !particles.length) {
      return;
    }

    context.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (let index = particles.length - 1; index >= 0; index -= 1) {
      const particle = particles[index];
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.012;
      particle.life -= 0.018;

      if (particle.life <= 0) {
        removeParticle(index);
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

    scheduleDraw();
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
    scheduleDraw();
  });
  window.addEventListener("pointerleave", function () {
    body.classList.remove("cursor-active");
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      stopDraw();
    } else {
      scheduleDraw();
    }
  });

  resizeCanvas();
})();
