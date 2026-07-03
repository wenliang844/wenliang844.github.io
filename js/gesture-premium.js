/* eslint-disable strict, curly, no-var */
/* =====  Premium Gesture Interaction Effects  ===== */
(function () {
  "use strict";

  var env = null;
  var ctx = null;
  var haptics = true;
  var sound = false;
  var audioCtx = null;
  var motion = { last: null, vx: 0, vy: 0, speed: 0, adaptivePeak: 900, predicted: null };
  var spring = {
    x: 0, y: 0, vx: 0, vy: 0,
    scale: 1, rotation: 0, tiltX: 0, tiltY: 0,
    progress: 0, peek: 0, dock: null, initialized: false,
  };
  var trail = [];
  var twoHandBase = null;
  var lastDock = null;
  var cooldowns = {};

  function bind(api) {
    env = api;
    ctx = api.ctx;
    haptics = !!api.haptics;
    sound = !!api.sound;
  }

  function cw() { return env.canvas.width / (window.devicePixelRatio || 1); }
  function ch() { return env.canvas.height / (window.devicePixelRatio || 1); }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function cooled(name, ms) {
    var now = performance.now();
    if (cooldowns[name] && now - cooldowns[name] < ms) return false;
    cooldowns[name] = now;
    return true;
  }

  function center(lm) {
    return {
      x: (env.toX(lm[0]) + env.toX(lm[5]) + env.toX(lm[9]) + env.toX(lm[13]) + env.toX(lm[17])) / 5,
      y: (env.toY(lm[0]) + env.toY(lm[5]) + env.toY(lm[9]) + env.toY(lm[13]) + env.toY(lm[17])) / 5,
    };
  }

  function rr(x, y, w, h, r) {
    env.roundRect(ctx, x, y, w, h, r);
  }

  function readableText(text, x, y, options) {
    var opts = options || {};
    var width = cw();
    ctx.save();
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ctx.font = opts.font || "13px system-ui, sans-serif";
    ctx.fillStyle = opts.fill || "rgba(255,255,255,0.86)";
    ctx.textAlign = opts.align || "center";
    ctx.textBaseline = opts.baseline || "middle";
    if (opts.shadow) {
      ctx.shadowColor = opts.shadow;
      ctx.shadowBlur = opts.shadowBlur || 8;
    }
    ctx.fillText(text, width - x, y);
    ctx.restore();
  }

  function feedback(kind) {
    if (haptics && navigator.vibrate) {
      navigator.vibrate(kind === "lock" ? [18, 24, 18] : 16);
    }
    if (!sound) return;
    playTone(kind === "lock" ? 560 : 360, kind === "lock" ? 0.12 : 0.08);
  }

  function playTone(freq, duration) {
    try {
      var AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return;
      if (!audioCtx) audioCtx = new AudioCtor();
      if (audioCtx.state === "suspended") audioCtx.resume();
      var now = audioCtx.currentTime;
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.045, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.03);
    } catch (e) {
      /* optional feedback */
    }
  }

  function reset() {
    motion.last = null;
    motion.vx = 0;
    motion.vy = 0;
    motion.speed = 0;
    motion.predicted = null;
    spring.x = 0;
    spring.y = 0;
    spring.vx = 0;
    spring.vy = 0;
    spring.scale = 1;
    spring.rotation = 0;
    spring.tiltX = 0;
    spring.tiltY = 0;
    spring.progress = 0;
    spring.peek = 0;
    spring.dock = null;
    spring.initialized = false;
    trail.length = 0;
    twoHandBase = null;
    lastDock = null;
  }

  function updateMotion(lm) {
    var width = cw();
    var height = ch();
    var now = performance.now();
    var point = center(lm);
    if (!motion.last) {
      motion.last = { x: point.x, y: point.y, t: now };
      motion.predicted = { x: point.x, y: point.y };
      return { x: point.x, y: point.y, vx: 0, vy: 0, speed: 0, dt: 16, progress: 0, predicted: motion.predicted };
    }

    var dt = clamp(now - motion.last.t, 16, 80);
    var rawVx = (point.x - motion.last.x) / dt * 1000;
    var rawVy = (point.y - motion.last.y) / dt * 1000;
    motion.vx = lerp(motion.vx, rawVx, 0.38);
    motion.vy = lerp(motion.vy, rawVy, 0.38);
    motion.speed = Math.sqrt(motion.vx * motion.vx + motion.vy * motion.vy);
    motion.adaptivePeak = Math.max(650, lerp(
      motion.adaptivePeak,
      Math.max(650, motion.speed),
      motion.speed > motion.adaptivePeak ? 0.08 : 0.015
    ));
    var lead = clamp(0.12 + motion.speed / 7000, 0.12, 0.28);
    motion.predicted = {
      x: clamp(point.x + motion.vx * lead, 28, width - 28),
      y: clamp(point.y + motion.vy * lead, 28, height - 28),
    };
    motion.last = { x: point.x, y: point.y, t: now };
    trail.push({ x: point.x, y: point.y, t: now, speed: motion.speed });
    while (trail.length && now - trail[0].t > 680) trail.shift();

    return {
      x: point.x,
      y: point.y,
      vx: motion.vx,
      vy: motion.vy,
      speed: motion.speed,
      dt: dt,
      progress: clamp(motion.speed / motion.adaptivePeak, 0, 1),
      predicted: motion.predicted,
    };
  }

  function idleMotion() {
    motion.vx *= 0.82;
    motion.vy *= 0.82;
    motion.speed *= 0.82;
    while (trail.length && performance.now() - trail[0].t > 680) trail.shift();
    return {
      x: spring.initialized ? spring.x : cw() / 2,
      y: spring.initialized ? spring.y : ch() / 2,
      vx: motion.vx,
      vy: motion.vy,
      speed: motion.speed,
      dt: 16,
      progress: 0,
      predicted: { x: cw() / 2, y: ch() / 2 },
    };
  }

  function getIntent(m, gesture, lm) {
    var intent = { key: "follow", name: "弹簧跟随", progress: m.progress, hue: 198 };
    var absX = Math.abs(m.vx);
    var absY = Math.abs(m.vy);

    if (gesture === "fist") {
      return { key: "reset", name: "回收", progress: 1, hue: 12 };
    }
    if (gesture === "ok" || gesture === "pinch") {
      var pinch = lm ? clamp(1 - env.dist(lm[4], lm[8]) / 105, 0, 1) : 0;
      return { key: "select", name: "精确选择", progress: Math.max(0.45, pinch), hue: 46 };
    }
    if (gesture === "peace") {
      return { key: "layer", name: "空间层级", progress: Math.max(0.45, m.progress), hue: 275 };
    }
    if (gesture === "open") {
      return { key: "reveal", name: "渐进展开", progress: Math.max(0.32, m.progress), hue: 152 };
    }
    if (m.speed > 520 && absX > absY * 1.2) {
      return {
        key: m.vx > 0 ? "predict-right" : "predict-left",
        name: m.vx > 0 ? "预测右滑" : "预测左滑",
        progress: m.progress,
        hue: m.vx > 0 ? 215 : 188,
      };
    }
    if (m.speed > 520 && absY > absX * 1.1) {
      return {
        key: m.vy > 0 ? "predict-down" : "predict-up",
        name: m.vy > 0 ? "预测下滑" : "预测上滑",
        progress: m.progress,
        hue: m.vy > 0 ? 332 : 122,
      };
    }
    return intent;
  }

  function twoHands(hands) {
    if (!hands || hands.length < 2) {
      twoHandBase = null;
      return null;
    }
    var a = center(hands[0]);
    var b = center(hands[1]);
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    var span = Math.sqrt(dx * dx + dy * dy) || 1;
    var angle = Math.atan2(dy, dx);
    if (!twoHandBase) twoHandBase = { span: span, angle: angle };
    return {
      a: a,
      b: b,
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      span: span,
      scale: clamp(span / twoHandBase.span, 0.72, 1.48),
      rotation: clamp(angle - twoHandBase.angle, -0.75, 0.75),
    };
  }

  function docks() {
    var width = cw();
    var height = ch();
    var r = clamp(Math.min(width, height) * 0.15, 48, 82);
    return [
      { id: "left", label: "左侧", x: width * 0.17, y: height * 0.5, r: r, hue: 205 },
      { id: "right", label: "右侧", x: width * 0.83, y: height * 0.5, r: r, hue: 32 },
      { id: "top", label: "顶部", x: width * 0.5, y: height * 0.18, r: r * 0.88, hue: 152 },
      { id: "focus", label: "中心", x: width * 0.5, y: height * 0.52, r: r * 0.72, hue: 276 },
    ];
  }

  function nearestDock(point, dockList, intent) {
    var best = null;
    dockList.forEach(function (dock) {
      var dx = point.x - dock.x;
      var dy = point.y - dock.y;
      var distance = Math.sqrt(dx * dx + dy * dy);
      if (!best || distance < best.distance) {
        best = {
          id: dock.id,
          label: dock.label,
          x: dock.x,
          y: dock.y,
          r: dock.r,
          hue: dock.hue,
          distance: distance,
          active: distance < dock.r * (intent.key === "select" ? 1.36 : 1),
        };
      }
    });
    return best;
  }

  function updateSpring(m, intent, gesture, two, dock) {
    var width = cw();
    var height = ch();
    if (!spring.initialized) {
      spring.x = m.x || width / 2;
      spring.y = m.y || height / 2;
      spring.initialized = true;
    }

    var targetX = m.predicted.x;
    var targetY = m.predicted.y;
    var isMagnet = dock && dock.active;
    if (two) {
      targetX = two.x;
      targetY = two.y;
    }
    if (isMagnet) {
      targetX = dock.x;
      targetY = dock.y;
    }
    if (gesture === "fist") {
      targetX = width / 2;
      targetY = height / 2;
      if (cooled("reset", 500)) feedback("reset");
    }

    var dt = clamp(m.dt / 1000, 0.016, 0.05);
    var stiffness = 82 + intent.progress * 78 + (isMagnet ? 76 : 0);
    var damping = 12 + intent.progress * 9 + (isMagnet ? 3 : 0);
    spring.vx += (targetX - spring.x) * stiffness * dt;
    spring.vy += (targetY - spring.y) * stiffness * dt;
    spring.vx *= Math.exp(-damping * dt);
    spring.vy *= Math.exp(-damping * dt);
    spring.x = clamp(spring.x + spring.vx * dt, 32, width - 32);
    spring.y = clamp(spring.y + spring.vy * dt, 32, height - 32);

    var desiredScale = 1 + intent.progress * 0.2;
    var desiredRotation = clamp(m.vx / 1500, -0.32, 0.32);
    if (two) {
      desiredScale = two.scale;
      desiredRotation = two.rotation;
    }
    if (isMagnet) desiredScale = Math.max(desiredScale, 1.16);
    if (gesture === "fist") desiredScale = 0.82;
    spring.scale = lerp(spring.scale, desiredScale, 0.16);
    spring.rotation = lerp(spring.rotation, desiredRotation, 0.16);
    spring.tiltX = lerp(spring.tiltX, clamp(-m.vy / 1200, -0.24, 0.24), 0.18);
    spring.tiltY = lerp(spring.tiltY, clamp(m.vx / 1200, -0.24, 0.24), 0.18);
    spring.progress = lerp(spring.progress, intent.progress, 0.15);
    spring.peek = lerp(
      spring.peek,
      m.speed < 130 && (gesture === "open" || gesture === "point" || gesture === "ok" || gesture === "pinch") ? 1 : 0,
      0.08
    );

    spring.dock = isMagnet ? dock.id : null;
    if (spring.dock && lastDock !== spring.dock) {
      lastDock = spring.dock;
      feedback("lock");
      env.rippleAt(dock.x, dock.y, dock.hue);
    } else if (!spring.dock) {
      lastDock = null;
    }
  }

  function backdrop() {
    var width = cw();
    var height = ch();
    var t = performance.now() * 0.001;
    var bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, "#071217");
    bg.addColorStop(0.48, "#15102a");
    bg.addColorStop(1, "#1a1408");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 1;
    for (var x = (t * 18) % 42; x < width; x += 42) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x - height * 0.26, height);
      ctx.stroke();
    }
    for (var y = (t * 14) % 38; y < height; y += 38) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y + width * 0.12);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawDocks(dockList, nearest) {
    dockList.forEach(function (dock) {
      var active = nearest && nearest.id === dock.id && nearest.active;
      var pulse = 0.5 + Math.sin(performance.now() * 0.004 + dock.hue) * 0.5;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = active ? 0.72 : 0.28;
      ctx.beginPath();
      ctx.arc(dock.x, dock.y, dock.r * (active ? 1.08 : 0.92 + pulse * 0.06), 0, Math.PI * 2);
      ctx.strokeStyle = "hsla(" + dock.hue + ", 90%, 66%, " + (active ? 0.75 : 0.36) + ")";
      ctx.lineWidth = active ? 3 : 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(dock.x, dock.y, dock.r * 0.34, 0, Math.PI * 2);
      ctx.fillStyle = "hsla(" + dock.hue + ", 90%, 58%, " + (active ? 0.2 : 0.08) + ")";
      ctx.fill();
      ctx.restore();
      readableText(dock.label, dock.x, dock.y + dock.r + 16, {
        font: "12px system-ui, sans-serif",
        fill: active ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.45)",
      });
    });
  }

  function drawTrail(now) {
    if (trail.length < 2) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var i = 1; i < trail.length; i++) {
      var a = trail[i - 1];
      var b = trail[i];
      var age = clamp((now - b.t) / 680, 0, 1);
      var alpha = (1 - age) * clamp(b.speed / 900, 0.18, 0.72);
      var hue = 185 + clamp(b.speed / 12, 0, 80);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = "hsla(" + hue + ", 92%, 66%, " + alpha + ")";
      ctx.lineWidth = 2 + clamp(b.speed / 260, 0, 7);
      ctx.lineCap = "round";
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPrediction(m, intent, nearest) {
    var p = m.predicted;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 18 + intent.progress * 18, 0, Math.PI * 2);
    ctx.strokeStyle = "hsla(" + intent.hue + ", 90%, 72%, " + (0.3 + intent.progress * 0.35) + ")";
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 7]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(spring.x, spring.y);
    ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = "hsla(" + intent.hue + ", 90%, 70%, 0.22)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (nearest && nearest.active) {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(nearest.x, nearest.y);
      ctx.strokeStyle = "hsla(" + nearest.hue + ", 90%, 70%, 0.45)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawTwoHand(two) {
    if (!two) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    var grad = ctx.createLinearGradient(two.a.x, two.a.y, two.b.x, two.b.y);
    grad.addColorStop(0, "rgba(83, 226, 255, 0.55)");
    grad.addColorStop(0.5, "rgba(255, 214, 102, 0.46)");
    grad.addColorStop(1, "rgba(207, 124, 255, 0.55)");
    ctx.strokeStyle = grad;
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(two.a.x, two.a.y);
    ctx.lineTo(two.b.x, two.b.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(two.x, two.y, clamp(two.span * 0.18, 24, 86), 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.26)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  function drawCard(intent) {
    var hue = intent.hue;
    var w = 124 + spring.peek * 34;
    var h = 76 + spring.peek * 26;

    if (spring.peek > 0.32) {
      ctx.save();
      ctx.globalAlpha = (spring.peek - 0.32) / 0.68 * 0.8;
      ctx.translate(spring.x + 12, spring.y - 14);
      ctx.rotate(spring.rotation * 0.55);
      ctx.scale(spring.scale * 1.08, spring.scale * 1.08);
      rr(-w * 0.58, -h * 0.68, w * 1.16, h * 1.36, 8);
      ctx.fillStyle = "rgba(255,255,255,0.075)";
      ctx.fill();
      ctx.strokeStyle = "hsla(" + hue + ", 86%, 70%, 0.22)";
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(spring.x, spring.y);
    ctx.rotate(spring.rotation);
    ctx.scale(spring.scale, spring.scale);
    ctx.shadowColor = "hsla(" + hue + ", 92%, 62%, 0.42)";
    ctx.shadowBlur = 28 + spring.progress * 26;
    rr(-w / 2, -h / 2, w, h, 8);
    var card = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    card.addColorStop(0, "hsla(" + hue + ", 86%, 66%, 0.42)");
    card.addColorStop(0.52, "rgba(255,255,255,0.12)");
    card.addColorStop(1, "hsla(" + ((hue + 76) % 360) + ", 82%, 56%, 0.32)");
    ctx.fillStyle = card;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,0.34)";
    ctx.lineWidth = 1;
    ctx.stroke();

    var shineX = clamp(spring.tiltY * 120, -28, 28);
    var shineY = clamp(spring.tiltX * 90, -18, 18);
    ctx.globalCompositeOperation = "lighter";
    ctx.beginPath();
    ctx.arc(shineX, shineY, 24 + spring.progress * 18, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255," + (0.12 + spring.progress * 0.12) + ")";
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.beginPath();
    ctx.arc(-w * 0.28 + spring.tiltY * 20, -h * 0.08 + spring.tiltX * 18, 12, 0, Math.PI * 2);
    ctx.fillStyle = "hsla(" + ((hue + 34) % 360) + ", 94%, 68%, 0.88)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(w * 0.26 + spring.tiltY * 12, h * 0.1 + spring.tiltX * 12, 8, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.fill();
    ctx.restore();

    readableText(intent.name, spring.x, spring.y + h * spring.scale * 0.72, {
      font: "700 13px system-ui, sans-serif",
      fill: "rgba(255,255,255,0.92)",
      shadow: "rgba(0,0,0,0.5)",
      shadowBlur: 5,
    });
  }

  function hud(m, intent, two) {
    var width = cw();
    var height = ch();
    var speed = Math.round(m.speed);
    var progress = Math.round(spring.progress * 100);
    var dock = spring.dock ? "磁吸 " + spring.dock : "自由";
    ctx.save();
    ctx.globalAlpha = 0.76;
    rr(width / 2 - 168, 14, 336, 34, 8);
    ctx.fillStyle = "rgba(0,0,0,0.34)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.stroke();
    ctx.restore();
    readableText("速度 " + speed + " px/s · " + intent.name + " · " + dock, width / 2, 31, {
      font: "700 13px system-ui, sans-serif",
      fill: "rgba(255,255,255,0.9)",
    });

    ctx.save();
    ctx.globalAlpha = 0.7;
    rr(width / 2 - 132, height - 44, 264, 24, 8);
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fill();
    ctx.restore();
    readableText("进度 " + progress + "%" + (two ? " · 双手缩放/旋转" : ""), width / 2, height - 32, {
      font: "12px system-ui, sans-serif",
      fill: "rgba(255,255,255,0.72)",
    });
  }

  function animate(api, lm, gesture, hands) {
    bind(api);
    var now = performance.now();
    var m = lm ? updateMotion(lm) : idleMotion();
    var intent = getIntent(m, gesture, lm);
    var two = twoHands(hands);
    var dockList = docks();
    var nearest = nearestDock(m.predicted, dockList, intent);

    backdrop();
    updateSpring(m, intent, gesture, two, nearest);
    drawDocks(dockList, nearest);
    drawTrail(now);
    if (lm) env.drawHandSkeleton(lm, 0.12);
    drawTwoHand(two);
    drawPrediction(m, intent, nearest);
    if (lm && cooled("sparks", 85)) {
      env.spawnParticle(m.x, m.y, intent.key === "layer" ? "star" : "circle", intent.hue, 0.7);
    }
    env.updateParticles();
    drawCard(intent);
    hud(m, intent, two);
  }

  window.CWLGesturePremium = {
    animate: animate,
    reset: reset,
    feedback: function (api, kind) {
      bind(api);
      feedback(kind || "toggle");
    },
  };
})();
