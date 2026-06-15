(function () {
  var key = "coder-color-scheme";
  var body = document.body;
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

  var canvas = document.querySelector(".cursor-canvas");
  if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  var context = canvas.getContext("2d");
  var particles = [];
  var pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  var hue = 205;

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
      hue: hue + Math.random() * 30
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
