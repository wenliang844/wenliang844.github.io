/* =====  Gesture Interaction Animation Tool  ===== */
(function () {
  "use strict";

  /* ---- DOM refs ---- */
  const $start   = document.getElementById("gesture-start");
  const $stop    = document.getElementById("gesture-stop");
  const $clear   = document.getElementById("gesture-clear");
  const $video   = document.getElementById("gesture-video");
  const $canvas  = document.getElementById("gesture-canvas");
  const $overlay = document.getElementById("gesture-overlay");
  const $status  = document.getElementById("gesture-status");
  const $label   = document.getElementById("gesture-label");
  const $fps     = document.getElementById("gesture-fps");

  if (!$canvas) return;                       // not on tools page

  const ctx = $canvas.getContext("2d");

  /* ====================================================================
   * 0. State
   * ==================================================================== */
  let handLandmarker  = null;                 // MediaPipe instance
  let cameraStream    = null;                 // MediaStream
  let running         = false;                // detection loop active?
  let mode            = "particle";           // particle | gesture | draw
  let lastGesture     = "none";               // recognised gesture name
  let lastGestureTime = 0;
  let swipeHistory    = [];                   // palm centre history for swipe

  /* FPS counter */
  let frameCount  = 0;
  let fpsTimer    = performance.now();

  /* Particles (shared pool) */
  const particles = [];
  const MAX_PARTICLES = 600;

  /* Drawing layer – persistent canvas so strokes survive across frames */
  const drawCanvas  = document.createElement("canvas");
  const drawCtx     = drawCanvas.getContext("2d");

  /* Gesture-trigger effect cooldowns */
  const cooldowns = {};
  function cooled(name, ms) {
    const now = performance.now();
    if (cooldowns[name] && now - cooldowns[name] < ms) return false;
    cooldowns[name] = now;
    return true;
  }

  /* Drawing hue */
  let drawHue = 200;
  let prevDrawPoint = null;

  /* ====================================================================
   * 1. MediaPipe CDN Loader
   * ==================================================================== */
  const VISION_CDN =
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs";
  const WASM_BASE =
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm";
  const MODEL_URL =
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task";

  async function loadMediaPipe() {
    if (handLandmarker) return true;
    setStatus("loading", "加载模型…");
    try {
      const { HandLandmarker, FilesetResolver } = await import(/* webpackIgnore: true */ VISION_CDN);
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
      handLandmarker = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numHands: 2,
      });
      setStatus("ready", "模型已加载");
      return true;
    } catch (e) {
      setStatus("error", "模型加载失败");
      console.error("[gesture]", e);
      return false;
    }
  }

  /* ====================================================================
   * 2. Camera Manager
   * ==================================================================== */
  async function startCamera() {
    if (!(await loadMediaPipe())) return;
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });
    } catch (e) {
      setStatus("error", "摄像头访问被拒绝");
      return;
    }
    $video.srcObject = cameraStream;
    await $video.play();
    resizeCanvas();
    $overlay.classList.add("is-hidden");
    $start.disabled = true;
    $stop.disabled  = false;
    running = true;
    setStatus("running", "检测中");
    requestAnimationFrame(loop);
  }

  function stopCamera() {
    running = false;
    if (cameraStream) {
      cameraStream.getTracks().forEach(function (t) { t.stop(); });
      cameraStream = null;
    }
    $video.srcObject = null;
    $start.disabled = false;
    $stop.disabled  = true;
    $overlay.classList.remove("is-hidden");
    setStatus("ready", "就绪");
    $label.textContent = "";
    $fps.textContent   = "";
  }

  function resizeCanvas() {
    var rect = $canvas.parentElement.getBoundingClientRect();
    var w = Math.floor(rect.width);
    var h = Math.floor(rect.height);
    var dpr = window.devicePixelRatio || 1;
    $canvas.width  = w * dpr;
    $canvas.height = h * dpr;
    $canvas.style.width  = w + "px";
    $canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    /* keep draw canvas in sync */
    drawCanvas.width  = w * dpr;
    drawCanvas.height = h * dpr;
    drawCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ====================================================================
   * 3. Detection Loop
   * ==================================================================== */
  function loop() {
    if (!running) return;
    if (!document.hidden && $video.readyState >= 2) {
      var result = handLandmarker.detectForVideo($video, performance.now());
      handleResults(result);
      updateFPS();
    }
    requestAnimationFrame(loop);
  }

  function updateFPS() {
    frameCount++;
    var now = performance.now();
    if (now - fpsTimer >= 1000) {
      $fps.textContent = frameCount + " FPS";
      frameCount = 0;
      fpsTimer = now;
    }
  }

  /* ====================================================================
   * 4. Coordinate Helpers
   * ==================================================================== */
  /* landmarks are normalised 0-1; we need viewport-pixel coords.
     video is mirrored via CSS (scaleX(-1)), but canvas is ALSO mirrored,
     so we can use coords as-is. */
  function toX(lm) { return lm.x * ($canvas.width / (window.devicePixelRatio || 1)); }
  function toY(lm) { return lm.y * ($canvas.height / (window.devicePixelRatio || 1)); }
  function dist(a, b) {
    var dx = toX(a) - toX(b), dy = toY(a) - toY(b);
    return Math.sqrt(dx * dx + dy * dy);
  }

  /* ====================================================================
   * 5. Gesture Recogniser
   * ==================================================================== */

  /* Finger tip / pip / mcp indices */
  var FINGER = {
    thumb:  { tip: 4,  ip: 3,  mcp: 2 },
    index:  { tip: 8,  pip: 6, mcp: 5 },
    middle: { tip: 12, pip: 10, mcp: 9 },
    ring:   { tip: 16, pip: 14, mcp: 13 },
    pinky:  { tip: 20, pip: 18, mcp: 17 },
  };

  function fingerExtended(lm, key) {
    var f = FINGER[key];
    if (key === "thumb") {
      /* thumb: compare tip x distance from palm centre vs ip */
      var palmX = (lm[0].x + lm[5].x + lm[17].x) / 3;
      return Math.abs(lm[f.tip].x - palmX) > Math.abs(lm[f.ip].x - palmX) * 1.1;
    }
    /* other fingers: tip above (y < ) pip */
    return lm[f.tip].y < lm[f.pip].y;
  }

  function recogniseGesture(lm) {
    var ext = {
      thumb:  fingerExtended(lm, "thumb"),
      index:  fingerExtended(lm, "index"),
      middle: fingerExtended(lm, "middle"),
      ring:   fingerExtended(lm, "ring"),
      pinky:  fingerExtended(lm, "pinky"),
    };
    var count = (ext.thumb?1:0) + (ext.index?1:0) + (ext.middle?1:0) + (ext.ring?1:0) + (ext.pinky?1:0);

    /* OK / Pinch: thumb tip close to index tip */
    var pinchDist = dist(lm[4], lm[8]);
    if (pinchDist < 30) return count <= 2 ? "ok" : "pinch";

    /* Fist: all fingers curled */
    if (count === 0) return "fist";

    /* Point: only index extended */
    if (ext.index && !ext.middle && !ext.ring && !ext.pinky) return "point";

    /* Peace: index + middle extended, others curled */
    if (ext.index && ext.middle && !ext.ring && !ext.pinky) return "peace";

    /* Open palm: all extended */
    if (count >= 4) return "open";

    return "none";
  }

  /* Swipe detection: track palm centre over recent frames */
  function detectSwipe(lm) {
    var cx = (lm[0].x + lm[5].x + lm[9].x + lm[13].x + lm[17].x) / 5;
    var cy = (lm[0].y + lm[5].y + lm[9].y + lm[13].y + lm[17].y) / 5;
    swipeHistory.push({ x: cx, y: cy, t: performance.now() });
    if (swipeHistory.length > 10) swipeHistory.shift();
    if (swipeHistory.length < 6) return null;
    var first = swipeHistory[0];
    var last  = swipeHistory[swipeHistory.length - 1];
    var dt = last.t - first.t;
    if (dt > 600) return null;
    var dx = last.x - first.x;
    var dy = last.y - first.y;
    if (Math.abs(dx) > 0.25 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swipeHistory = [];
      return dx > 0 ? "swipe-left" : "swipe-right";  /* mirrored */
    }
    if (Math.abs(dy) > 0.2 && Math.abs(dy) > Math.abs(dx) * 1.5) {
      swipeHistory = [];
      return dy > 0 ? "swipe-down" : "swipe-up";
    }
    return null;
  }

  /* ====================================================================
   * 6. Results Dispatcher
   * ==================================================================== */
  function handleResults(result) {
    var cw = $canvas.width / (window.devicePixelRatio || 1);
    var ch = $canvas.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, cw, ch);

    if (!result.landmarks || result.landmarks.length === 0) {
      setLabel("未检测到手部");
      updateParticles();
      return;
    }

    var lm = result.landmarks[0];           /* primary hand */
    var gesture = recogniseGesture(lm);
    var swipe   = detectSwipe(lm);
    if (swipe) gesture = swipe;

    lastGesture = gesture;
    setLabel(gestureName(gesture));

    switch (mode) {
      case "particle":  animateParticle(lm, gesture); break;
      case "gesture":   animateGesture(lm, gesture);  break;
      case "draw":      animateDraw(lm, gesture);      break;
    }
  }

  /* ====================================================================
   * 7. Particle Mode
   * ==================================================================== */
  function animateParticle(lm, gesture) {
    /* hand centre */
    var cx = toX(lm[0]);
    var cy = toY(lm[0]);

    /* spawn particles at fingertips */
    if (gesture !== "fist") {
      [4, 8, 12, 16, 20].forEach(function (idx) {
        spawnParticle(toX(lm[idx]), toY(lm[idx]));
      });
    }

    /* behaviour per gesture */
    switch (gesture) {
      case "fist":
        /* pull existing particles toward centre, then explode */
        particles.forEach(function (p) {
          var dx = cx - p.x, dy = cy - p.y;
          var d  = Math.sqrt(dx * dx + dy * dy) || 1;
          p.vx += (dx / d) * 0.8;
          p.vy += (dy / d) * 0.8;
          p.friction = 0.96;
        });
        if (cooled("fist-explode", 500)) {
          explodeAt(cx, cy, 40);
        }
        break;

      case "open":
        /* add expanding ring */
        if (cooled("open-ring", 300)) {
          ringAt(cx, cy);
        }
        break;

      case "peace":
        /* spawn star particles from index & middle tips */
        spawnParticle(toX(lm[8]), toY(lm[8]), "star", 255, 0.9);
        spawnParticle(toX(lm[12]), toY(lm[12]), "star", 50, 0.9);
        break;

      case "ok":
        /* golden sparkles from the pinch point */
        var px = (toX(lm[4]) + toX(lm[8])) / 2;
        var py = (toY(lm[4]) + toY(lm[8])) / 2;
        spawnParticle(px, py, "circle", 45, 0.95);
        break;
    }

    updateParticles();
  }

  /* ====================================================================
   * 8. Gesture Recognition Mode
   * ==================================================================== */
  function animateGesture(lm, gesture) {
    var cw = $canvas.width / (window.devicePixelRatio || 1);
    var ch = $canvas.height / (window.devicePixelRatio || 1);

    /* always draw hand skeleton lightly */
    drawHandSkeleton(lm, 0.15);

    switch (gesture) {
      case "open":
        /* wave – rainbow wave across canvas */
        drawRainbowWave(cw, ch);
        drawHandSkeleton(lm, 0.4);
        break;

      case "peace":
        /* fireworks from fingertips */
        if (cooled("peace-firework", 400)) {
          fireworkAt(toX(lm[8]), toY(lm[8]));
          fireworkAt(toX(lm[12]), toY(lm[12]));
        }
        break;

      case "point":
        /* laser from index tip */
        drawLaser(lm);
        break;

      case "ok":
        /* golden ripple */
        if (cooled("ok-ripple", 350)) {
          var px = (toX(lm[4]) + toX(lm[8])) / 2;
          var py = (toY(lm[4]) + toY(lm[8])) / 2;
          rippleAt(px, py, 45);
        }
        break;

      case "fist":
        /* implosion + explosion */
        var cx = toX(lm[0]);
        var cy = toY(lm[9]);
        particles.forEach(function (p) {
          var dx = cx - p.x, dy = cy - p.y;
          var d  = Math.sqrt(dx * dx + dy * dy) || 1;
          p.vx += (dx / d) * 1.2;
          p.vy += (dy / d) * 1.2;
        });
        if (cooled("fist-boom", 600)) {
          explodeAt(cx, cy, 60);
        }
        break;

      case "swipe-left":
      case "swipe-right":
      case "swipe-up":
      case "swipe-down":
        /* light trail */
        if (cooled("swipe-trail", 100)) {
          trailSwipe(lm, gesture);
        }
        break;
    }

    updateParticles();
  }

  /* ====================================================================
   * 9. Drawing Mode
   * ==================================================================== */
  function animateDraw(lm, gesture) {
    /* draw persistent strokes onto drawCanvas */
    var ix = toX(lm[8]), iy = toY(lm[8]);

    if (gesture === "fist") {
      /* clear drawing */
      if (cooled("draw-clear", 800)) {
        drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
        prevDrawPoint = null;
      }
    } else if (gesture === "ok" || gesture === "pinch") {
      /* change colour */
      drawHue = (drawHue + 2) % 360;
      prevDrawPoint = null;  /* break stroke */
    } else if (gesture === "point" || gesture === "open") {
      /* draw line */
      if (prevDrawPoint) {
        drawCtx.beginPath();
        drawCtx.moveTo(prevDrawPoint.x, prevDrawPoint.y);
        drawCtx.lineTo(ix, iy);
        drawCtx.strokeStyle = "hsla(" + drawHue + ", 100%, 65%, 0.9)";
        drawCtx.lineWidth = 4;
        drawCtx.lineCap = "round";
        drawCtx.lineJoin = "round";
        drawCtx.shadowColor = "hsla(" + drawHue + ", 100%, 65%, 0.6)";
        drawCtx.shadowBlur = 12;
        drawCtx.stroke();
        drawCtx.shadowBlur = 0;

        /* sparkle at tip */
        spawnParticle(ix, iy, "circle", drawHue, 0.8);
      }
      prevDrawPoint = { x: ix, y: iy };
    } else {
      /* break stroke for other gestures */
      prevDrawPoint = null;
    }

    /* composite: draw layer + live particles */
    ctx.drawImage(drawCanvas, 0, 0, $canvas.width, $canvas.height,
      0, 0, $canvas.width / (window.devicePixelRatio || 1),
      $canvas.height / (window.devicePixelRatio || 1));

    updateParticles();

    /* draw fingertip cursor */
    ctx.beginPath();
    ctx.arc(ix, iy, 6, 0, Math.PI * 2);
    ctx.fillStyle = "hsla(" + drawHue + ", 100%, 70%, 0.8)";
    ctx.shadowColor = "hsla(" + drawHue + ", 100%, 60%, 0.5)";
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  /* ====================================================================
   * 10. Particle System
   * ==================================================================== */
  function spawnParticle(x, y, shape, hue, life) {
    if (particles.length >= MAX_PARTICLES) {
      /* recycle oldest */
      particles.shift();
    }
    particles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 3,
      vy: (Math.random() - 0.5) * 3 - 1,
      radius: Math.random() * 4 + 2,
      life: life || 1,
      decay: 0.012 + Math.random() * 0.008,
      hue: hue != null ? hue + Math.random() * 30 : (190 + Math.random() * 40),
      shape: shape || "circle",
      friction: 0.98,
      gravity: 0.02,
    });
  }

  function explodeAt(x, y, count) {
    for (var i = 0; i < count; i++) {
      var angle = (Math.PI * 2 / count) * i + Math.random() * 0.3;
      var speed = 3 + Math.random() * 5;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 5 + 2,
        life: 1,
        decay: 0.015 + Math.random() * 0.01,
        hue: Math.random() * 360,
        shape: Math.random() > 0.3 ? "circle" : "star",
        friction: 0.97,
        gravity: 0.03,
      });
    }
  }

  function ringAt(x, y) {
    var count = 24;
    for (var i = 0; i < count; i++) {
      var angle = (Math.PI * 2 / count) * i;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * 4,
        vy: Math.sin(angle) * 4,
        radius: 3,
        life: 1,
        decay: 0.02,
        hue: 200 + Math.random() * 40,
        shape: "circle",
        friction: 0.985,
        gravity: 0,
      });
    }
  }

  function fireworkAt(x, y) {
    var hue = Math.random() * 360;
    for (var i = 0; i < 30; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 2 + Math.random() * 6;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        radius: Math.random() * 3 + 1.5,
        life: 1,
        decay: 0.012 + Math.random() * 0.008,
        hue: hue + Math.random() * 50,
        shape: "circle",
        friction: 0.975,
        gravity: 0.05,
      });
    }
  }

  function rippleAt(x, y, hue) {
    var count = 20;
    for (var i = 0; i < count; i++) {
      var angle = (Math.PI * 2 / count) * i;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * 5,
        vy: Math.sin(angle) * 5,
        radius: 4,
        life: 1,
        decay: 0.025,
        hue: hue || 45,
        shape: "circle",
        friction: 0.99,
        gravity: 0,
      });
    }
  }

  function trailSwipe(lm, gesture) {
    var cx = toX(lm[0]);
    var cy = toY(lm[9]);
    var count = 15;
    for (var i = 0; i < count; i++) {
      particles.push({
        x: cx + (Math.random() - 0.5) * 30,
        y: cy + (Math.random() - 0.5) * 30,
        vx: gesture === "swipe-left" ? -3 - Math.random() * 3 :
            gesture === "swipe-right" ? 3 + Math.random() * 3 :
            (Math.random() - 0.5) * 2,
        vy: gesture === "swipe-up" ? -3 - Math.random() * 3 :
            gesture === "swipe-down" ? 3 + Math.random() * 3 :
            (Math.random() - 0.5) * 2,
        radius: Math.random() * 4 + 2,
        life: 1,
        decay: 0.018,
        hue: Math.random() * 360,
        shape: "circle",
        friction: 0.98,
        gravity: 0,
      });
    }
  }

  function updateParticles() {
    ctx.globalCompositeOperation = "lighter";
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= p.friction;
      p.vy *= p.friction;
      p.life -= p.decay;

      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      var alpha = p.life * 0.8;
      var r = p.radius * p.life;

      ctx.globalAlpha = alpha;

      if (p.shape === "star") {
        drawStar(p.x, p.y, r, p.hue);
      } else {
        /* glow layer */
        ctx.beginPath();
        ctx.fillStyle = "hsla(" + p.hue + ", 90%, 62%, 0.3)";
        ctx.arc(p.x, p.y, r * 2.4, 0, Math.PI * 2);
        ctx.fill();
        /* core */
        ctx.beginPath();
        ctx.fillStyle = "hsla(" + p.hue + ", 90%, 72%, 1)";
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  function drawStar(x, y, r, hue) {
    ctx.fillStyle = "hsla(" + hue + ", 90%, 72%, 1)";
    ctx.beginPath();
    for (var i = 0; i < 5; i++) {
      var angle = (Math.PI * 2 / 5) * i - Math.PI / 2;
      var ox = x + Math.cos(angle) * r;
      var oy = y + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(ox, oy); else ctx.lineTo(ox, oy);
      var inner = angle + Math.PI / 5;
      ctx.lineTo(x + Math.cos(inner) * r * 0.4, y + Math.sin(inner) * r * 0.4);
    }
    ctx.closePath();
    ctx.fill();
  }

  /* ====================================================================
   * 11. Gesture-Mode Visual Effects
   * ==================================================================== */
  function drawHandSkeleton(lm, alpha) {
    var connections = [
      [0,1],[1,2],[2,3],[3,4],
      [0,5],[5,6],[6,7],[7,8],
      [5,9],[9,10],[10,11],[11,12],
      [9,13],[13,14],[14,15],[15,16],
      [13,17],[17,18],[18,19],[19,20],
      [0,17],
    ];
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "rgba(100, 200, 255, 0.6)";
    ctx.lineWidth = 1.5;
    connections.forEach(function (c) {
      ctx.beginPath();
      ctx.moveTo(toX(lm[c[0]]), toY(lm[c[0]]));
      ctx.lineTo(toX(lm[c[1]]), toY(lm[c[1]]));
      ctx.stroke();
    });
    lm.forEach(function (p) {
      ctx.beginPath();
      ctx.arc(toX(p), toY(p), 3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(100, 220, 255, 0.8)";
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawRainbowWave(cw, ch) {
    var t = performance.now() * 0.002;
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < 5; i++) {
      var y = ch * 0.5 + Math.sin(t + i * 0.8) * ch * 0.25;
      var hue = (t * 50 + i * 60) % 360;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (var x = 0; x < cw; x += 10) {
        var wave = Math.sin(x * 0.01 + t * 2 + i) * 20;
        ctx.lineTo(x, y + wave);
      }
      ctx.strokeStyle = "hsla(" + hue + ", 100%, 60%, 0.15)";
      ctx.lineWidth = 8;
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function drawLaser(lm) {
    var ix = toX(lm[8]), iy = toY(lm[8]);
    var mx = toX(lm[5]), my = toY(lm[5]);
    var angle = Math.atan2(iy - my, ix - mx);
    var len = 800;
    var ex = ix + Math.cos(angle) * len;
    var ey = iy + Math.sin(angle) * len;

    /* outer glow */
    ctx.beginPath();
    ctx.moveTo(ix, iy);
    ctx.lineTo(ex, ey);
    ctx.strokeStyle = "rgba(255, 50, 50, 0.15)";
    ctx.lineWidth = 10;
    ctx.stroke();

    /* core */
    ctx.beginPath();
    ctx.moveTo(ix, iy);
    ctx.lineTo(ex, ey);
    ctx.strokeStyle = "rgba(255, 80, 80, 0.6)";
    ctx.lineWidth = 2;
    ctx.stroke();

    /* bright center */
    ctx.beginPath();
    ctx.moveTo(ix, iy);
    ctx.lineTo(ex, ey);
    ctx.strokeStyle = "rgba(255, 200, 200, 0.9)";
    ctx.lineWidth = 1;
    ctx.stroke();

    /* origin glow */
    ctx.beginPath();
    ctx.arc(ix, iy, 8, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 100, 100, 0.7)";
    ctx.shadowColor = "rgba(255, 50, 50, 0.5)";
    ctx.shadowBlur = 20;
    ctx.fill();
    ctx.shadowBlur = 0;

    /* tip spark */
    spawnParticle(ix, iy, "circle", 0, 0.6);
  }

  /* ====================================================================
   * 12. UI Helpers
   * ==================================================================== */
  function setStatus(type, text) {
    $status.textContent = text;
    $status.className = "gesture-badge" + (type === "running" ? " is-active" : "");
  }

  function setLabel(text) {
    $label.textContent = text;
  }

  var GESTURE_NAMES = {
    open:       "✋ 张开手掌",
    fist:       "✊ 握拳",
    point:      "☝️ 指向",
    peace:      "✌️ 和平",
    ok:         "👌 OK",
    pinch:      "🤏 捏合",
    "swipe-left":  "👈 左滑",
    "swipe-right": "👉 右滑",
    "swipe-up":    "👆 上滑",
    "swipe-down":  "👇 下滑",
    none:       "—",
  };
  function gestureName(g) { return GESTURE_NAMES[g] || g; }

  /* ====================================================================
   * 13. Event Bindings
   * ==================================================================== */
  $start.addEventListener("click", startCamera);
  $stop.addEventListener("click", stopCamera);
  $clear.addEventListener("click", function () {
    particles.length = 0;
    prevDrawPoint = null;
    var cw = drawCanvas.width / (window.devicePixelRatio || 1);
    var ch = drawCanvas.height / (window.devicePixelRatio || 1);
    drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    ctx.clearRect(0, 0, cw, ch);
  });

  /* Mode switch */
  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".gesture-mode-btn");
    if (!btn) return;
    var m = btn.dataset.mode;
    if (!m || m === mode) return;
    mode = m;
    document.querySelectorAll(".gesture-mode-btn").forEach(function (b) {
      b.classList.toggle("active", b.dataset.mode === m);
    });
    /* clear canvas on mode switch */
    particles.length = 0;
    prevDrawPoint = null;
    var cw = $canvas.width / (window.devicePixelRatio || 1);
    var ch = $canvas.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, cw, ch);
    if (mode !== "draw") {
      drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    }
  });

  /* Responsive canvas resize */
  window.addEventListener("resize", function () {
    if (running) resizeCanvas();
  });

  /* Stop camera when navigating away */
  window.addEventListener("beforeunload", stopCamera);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden && running) {
      /* pause detection but keep stream alive */
    }
  });

  /* Tab-switch detection: release camera when gesture panel is hidden */
  var observer = new MutationObserver(function () {
    var panel = document.querySelector('[data-tool-panel="gesture"]');
    if (panel && panel.hidden && running) {
      stopCamera();
    }
  });
  var gesturePanel = document.querySelector('[data-tool-panel="gesture"]');
  if (gesturePanel) {
    observer.observe(gesturePanel, { attributes: true, attributeFilter: ["hidden"] });
  }

})();
