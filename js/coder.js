(function () {
  const body = document.body;

  const STORAGE_KEY_THEME = "coder-color-scheme";
  const THEME_MODES = ["auto", "light", "dark"];
  let stored = null;

  try {
    stored = window.CWLUtils ? window.CWLUtils.storageGet(STORAGE_KEY_THEME) : window.localStorage.getItem(STORAGE_KEY_THEME);
  } catch (error) {
    console.warn("Failed to read theme from localStorage:", error);
  }

  const systemThemeQuery = window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;
  let themeMode = THEME_MODES.includes(stored) ? stored : "auto";

  function systemTheme() {
    if (!systemThemeQuery) {
      return "dark";
    }
    return systemThemeQuery.matches ? "dark" : "light";
  }

  function updateThemeButtons(actualTheme) {
    document.querySelectorAll(".theme-toggle").forEach(function (button) {
      button.dataset.themeMode = themeMode;
      button.dataset.themeActual = actualTheme;
      button.title = themeMode === "auto" ? "Auto theme" : actualTheme + " theme";

      const icon = button.querySelector("i");
      if (icon) {
        icon.className = "fas fa-adjust";
      }
    });
  }

  function applyTheme(mode) {
    const actualTheme = mode === "auto" ? systemTheme() : mode;
    body.classList.toggle("colorscheme-dark", actualTheme === "dark");
    body.classList.toggle("colorscheme-light", actualTheme === "light");
    updateThemeButtons(actualTheme);
    document.dispatchEvent(new CustomEvent("cwl:themechange", { detail: { mode: themeMode, actualTheme } }));
  }

  function saveThemeMode(mode) {
    try {
      if (window.CWLUtils) {
        window.CWLUtils.storageSet(STORAGE_KEY_THEME, mode);
      } else {
        window.localStorage.setItem(STORAGE_KEY_THEME, mode);
      }
    } catch (error) {
      console.warn("Failed to save theme to localStorage:", error);
    }
  }

  function nextThemeMode(mode) {
    const index = THEME_MODES.indexOf(mode);
    return THEME_MODES[(index + 1) % THEME_MODES.length];
  }

  applyTheme(themeMode);

  document.querySelectorAll(".theme-toggle").forEach(function (button) {
    button.addEventListener("click", function () {
      themeMode = nextThemeMode(themeMode);
      applyTheme(themeMode);
      saveThemeMode(themeMode);
    });
  });

  if (systemThemeQuery) {
    const handleSystemThemeChange = function () {
      if (themeMode === "auto") {
        applyTheme(themeMode);
      }
    };

    if (systemThemeQuery.addEventListener) {
      systemThemeQuery.addEventListener("change", handleSystemThemeChange);
    } else if (systemThemeQuery.addListener) {
      systemThemeQuery.addListener(handleSystemThemeChange);
    }
  }

  const postLinks = Array.from(document.querySelectorAll(".post-tree-link[data-post-target]"));
  const postPanels = Array.from(document.querySelectorAll(".blog-article[id]"));

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

  window.coderShowPost = showPost;

  const progress = document.createElement("div");
  progress.className = "read-progress";
  body.appendChild(progress);

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

  const t = window.CWLUtils.t;

  function updateToTop() {
    toTop.setAttribute("aria-label", t("dyn.totop", "返回顶部"));
  }

  const SCROLL_CONSTANTS = {
    BACK_TO_TOP_THRESHOLD: 420,
    TOC_OFFSET: 125,
    SCROLL_THROTTLE: 100,
    RESIZE_THROTTLE: 200
  };
  const READING_RESUME_MAX_AGE = 14 * 24 * 60 * 60 * 1000;
  const READING_RESUME_MIN_RATIO = 0.08;
  const READING_RESUME_MAX_RATIO = 0.98;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function getActiveArticle() {
    return document.querySelector(".blog-article.active") ||
      document.querySelector("article.article");
  }

  function activeArticleSlug(article) {
    if (article && article.dataset.postSlug) {
      return article.dataset.postSlug;
    }
    const match = window.location.pathname.match(/\/post\/([^/]+)\//);
    return match ? match[1] : "";
  }

  function readingStorageKey(slug) {
    return "cwl.reading." + slug;
  }

  function readStoredPosition(slug) {
    if (!slug || !window.CWLUtils) {
      return null;
    }
    try {
      const raw = window.CWLUtils.storageGet(readingStorageKey(slug));
      return raw ? JSON.parse(raw) : null;
    } catch (_error) {
      return null;
    }
  }

  function saveReadingPosition(article, ratio) {
    const slug = activeArticleSlug(article);
    if (!slug || !window.CWLUtils || ratio < READING_RESUME_MIN_RATIO) {
      return;
    }
    window.CWLUtils.storageSet(readingStorageKey(slug), JSON.stringify({
      ratio: ratio,
      scroll: window.scrollY || document.documentElement.scrollTop || 0,
      time: Date.now()
    }));
  }

  function removeReadingResume() {
    const existing = document.querySelector(".reading-resume");
    if (existing) {
      existing.remove();
    }
  }

  function scrollArticleToRatio(article, ratio) {
    const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    const articleTop = article.getBoundingClientRect().top + scrollTop;
    const readableHeight = Math.max(1, article.scrollHeight - window.innerHeight * 0.65);
    window.scrollTo({
      top: articleTop + readableHeight * clamp(ratio, 0, 1),
      behavior: "smooth"
    });
  }

  function showReadingResume(article) {
    removeReadingResume();
    const slug = activeArticleSlug(article);
    const saved = readStoredPosition(slug);
    if (!article || !saved || !Number.isFinite(saved.ratio)) {
      return;
    }
    if (Date.now() - Number(saved.time || 0) > READING_RESUME_MAX_AGE) {
      return;
    }
    if (saved.ratio < READING_RESUME_MIN_RATIO || saved.ratio > READING_RESUME_MAX_RATIO) {
      return;
    }

    const prompt = document.createElement("aside");
    prompt.className = "reading-resume";
    prompt.setAttribute("role", "status");
    prompt.setAttribute("aria-live", "polite");

    const text = document.createElement("span");
    text.textContent = t("dyn.resume.text", "上次读到") + " " + Math.round(saved.ratio * 100) + "%";

    const resume = document.createElement("button");
    resume.type = "button";
    resume.className = "reading-resume-btn";
    resume.textContent = t("dyn.resume.continue", "继续阅读");
    resume.addEventListener("click", function () {
      scrollArticleToRatio(article, saved.ratio);
      removeReadingResume();
    });

    const close = document.createElement("button");
    close.type = "button";
    close.className = "reading-resume-close";
    close.setAttribute("aria-label", t("dyn.resume.close", "关闭继续阅读提示"));
    close.textContent = "×";
    close.addEventListener("click", removeReadingResume);

    prompt.appendChild(text);
    prompt.appendChild(resume);
    prompt.appendChild(close);
    body.appendChild(prompt);
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
      saveReadingPosition(article, ratio);
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
  const throttledResize = window.CWLUtils
    ? window.CWLUtils.throttle(onScroll, SCROLL_CONSTANTS.RESIZE_THROTTLE)
    : onScroll;

  window.addEventListener("scroll", throttledScroll, { passive: true });
  window.addEventListener("resize", throttledResize);
  onScroll();
  showReadingResume(getActiveArticle());
  body.classList.add("to-top-ready");

  /* ----------------------------------------------------------------------
   * Copy-to-clipboard buttons on code blocks
   * -------------------------------------------------------------------- */
  // 复制逻辑统一由 utils.js 维护；layout 保证其先于 coder.js 加载。
  const copyText = window.CWLUtils && window.CWLUtils.copyText
    ? window.CWLUtils.copyText
    : function (_text) {
        return Promise.reject(new Error("CWLUtils.copyText is unavailable"));
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
   * Article image lightbox
   * -------------------------------------------------------------------- */
  let lightboxOverlay = null;

  function closeLightbox() {
    if (!lightboxOverlay) {
      return;
    }
    lightboxOverlay.remove();
    lightboxOverlay = null;
    body.classList.remove("lightbox-open");
  }

  function openLightbox(img) {
    if (!img || !img.getAttribute("src")) {
      return;
    }
    closeLightbox();

    const overlay = document.createElement("div");
    overlay.className = "lightbox-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", t("dyn.lightbox.aria", "图片预览"));

    const close = document.createElement("button");
    close.type = "button";
    close.className = "lightbox-close";
    close.setAttribute("aria-label", t("dyn.lightbox.close", "关闭图片预览"));
    close.textContent = "×";

    const preview = document.createElement("img");
    preview.className = "lightbox-image";
    preview.src = img.currentSrc || img.src;
    preview.alt = img.alt || t("dyn.lightbox.image", "文章图片");

    overlay.appendChild(close);
    overlay.appendChild(preview);
    overlay.addEventListener("click", function (event) {
      if (event.target === overlay || event.target === close) {
        closeLightbox();
      }
    });
    body.appendChild(overlay);
    body.classList.add("lightbox-open");
    lightboxOverlay = overlay;
    close.focus();
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && lightboxOverlay) {
      closeLightbox();
    }
  });

  document.querySelectorAll(".article-content img").forEach(function (img) {
    if (img.dataset.lightboxReady === "true") {
      return;
    }
    img.dataset.lightboxReady = "true";
    img.tabIndex = 0;
    img.setAttribute("role", "button");
    img.setAttribute("aria-label", t("dyn.lightbox.open", "查看大图"));
    img.addEventListener("click", function () {
      openLightbox(img);
    });
    img.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openLightbox(img);
      }
    });
  });

  /* ----------------------------------------------------------------------
   * Reading time + table of contents per article
   * -------------------------------------------------------------------- */
  const readingMinutes = window.CWLUtils && window.CWLUtils.readingMinutes;

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

  function hasServerRenderedToc(article) {
    const layout = article.closest(".post-layout");
    return Boolean(layout && layout.querySelector(".toc-sidebar"));
  }

  function buildToc(article, contentBlock) {
    clearToc(contentBlock);

    const headings = Array.from(contentBlock.querySelectorAll("h2, h3"))
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

    const headings = Array.from(content.querySelectorAll("h2, h3[id]"));
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

    // Single post pages already include an SSR TOC; list panels still build one dynamically.
    if (!hasServerRenderedToc(article)) {
      Array.from(article.querySelectorAll(".article-content")).forEach(function (contentBlock) {
        buildToc(article, contentBlock);
      });
    }
  });

  document.addEventListener("cwl:langchange", updateDynamicText);
  document.addEventListener("cwl:postchange", function () {
    updateDynamicText();
    showReadingResume(getActiveArticle());
    onScroll();
  });
  updateDynamicText();

  /* ----------------------------------------------------------------------
   * Scroll reveal
   * -------------------------------------------------------------------- */
  const prefersReduced = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
  const revealTargets = Array.from(
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
  const skillFills = Array.from(document.querySelectorAll(".skill-fill[data-level]"));
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

  function drawParticle(particle) {
    const coreRadius = particle.radius * particle.life;
    const glowRadius = coreRadius * 2.4;

    context.globalAlpha = particle.life * 0.28;
    context.beginPath();
    context.fillStyle = "hsla(" + particle.hue + ", 90%, 62%, 1)";
    context.arc(particle.x, particle.y, glowRadius, 0, Math.PI * 2);
    context.fill();

    context.globalAlpha = particle.life;
    context.beginPath();
    context.arc(particle.x, particle.y, coreRadius, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
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

      drawParticle(particle);
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
