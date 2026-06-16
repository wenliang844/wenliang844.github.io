(function () {
  var body = document.body;

  /* ----------------------------------------------------------------------
   * Color scheme toggle
   * -------------------------------------------------------------------- */
  var key = "coder-color-scheme";
  var stored = null;

  try {
    stored = window.localStorage.getItem(key);
  } catch (error) {}

  if (stored === "dark") {
    body.classList.remove("colorscheme-light");
    body.classList.add("colorscheme-dark");
  }

  document.querySelectorAll(".theme-toggle").forEach(function (button) {
    button.addEventListener("click", function () {
      var dark = body.classList.toggle("colorscheme-dark");
      body.classList.toggle("colorscheme-light", !dark);
      try {
        window.localStorage.setItem(key, dark ? "dark" : "light");
      } catch (error) {}
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
   * Reading progress bar
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
  toTop.setAttribute("aria-label", "返回顶部");
  toTop.innerHTML = '<i class="fas fa-arrow-up" aria-hidden="true"></i>';
  toTop.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  body.appendChild(toTop);

  function onScroll() {
    var doc = document.documentElement;
    var scrollTop = window.pageYOffset || doc.scrollTop;
    var height = doc.scrollHeight - doc.clientHeight;
    var ratio = height > 0 ? scrollTop / height : 0;
    progress.style.width = (ratio * 100).toFixed(2) + "%";
    toTop.classList.toggle("visible", scrollTop > 420);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();

  /* ----------------------------------------------------------------------
   * Copy-to-clipboard buttons on code blocks
   * -------------------------------------------------------------------- */
  function copyText(text) {
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
  }

  document.querySelectorAll(".article-content pre").forEach(function (pre) {
    if (pre.querySelector(".code-copy")) {
      return;
    }
    var button = document.createElement("button");
    button.type = "button";
    button.className = "code-copy";
    button.innerHTML = '<i class="fas fa-copy" aria-hidden="true"></i> 复制';
    button.addEventListener("click", function () {
      var code = pre.querySelector("code") || pre;
      copyText(code.innerText).then(function () {
        button.classList.add("copied");
        button.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i> 已复制';
        window.setTimeout(function () {
          button.classList.remove("copied");
          button.innerHTML = '<i class="fas fa-copy" aria-hidden="true"></i> 复制';
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
    return Math.max(1, Math.round(chinese / 350 + words / 200));
  }

  document.querySelectorAll("article.article").forEach(function (article) {
    var content = article.querySelector(".article-content");
    var meta = article.querySelector(".article-meta");
    if (!content) {
      return;
    }

    if (meta && !meta.querySelector(".reading-time")) {
      var span = document.createElement("span");
      span.className = "reading-time";
      span.innerHTML = '<i class="fas fa-clock" aria-hidden="true"></i> 阅读约 ' +
        readingMinutes(content.textContent || "") + " 分钟";
      meta.appendChild(document.createTextNode(" "));
      meta.appendChild(span);
    }

    // Build a TOC only for longer articles (>= 3 section headings).
    var headings = Array.prototype.slice.call(content.querySelectorAll("h2"));
    if (headings.length >= 3 && !content.querySelector(".article-toc")) {
      var toc = document.createElement("nav");
      toc.className = "article-toc";
      toc.setAttribute("aria-label", "目录");
      var list = "<strong>目录</strong><ol>";
      headings.forEach(function (heading, index) {
        if (!heading.id) {
          heading.id = "section-" + index + "-" + (heading.textContent || "")
            .trim().toLowerCase().replace(/[^a-z0-9一-龥]+/g, "-").replace(/^-+|-+$/g, "");
        }
        list += '<li><a href="#' + heading.id + '">' + heading.textContent + "</a></li>";
      });
      list += "</ol>";
      toc.innerHTML = list;
      content.insertBefore(toc, content.firstChild);
    }
  });

  /* ----------------------------------------------------------------------
   * Scroll reveal
   * -------------------------------------------------------------------- */
  var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var revealTargets = Array.prototype.slice.call(
    document.querySelectorAll(".card, .insight-list li, .timeline-stats div, .feedback-item, .post-item")
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
