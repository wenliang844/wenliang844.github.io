/* global faceapi */
/* eslint-disable no-unused-vars */
/* =====  Gesture Interaction Animation Tool  ===== */
(function () {
  

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
  const $face    = document.getElementById("gesture-face");
  const $haptics = document.getElementById("gesture-haptics");
  const $sound   = document.getElementById("gesture-sound");

  if (!$canvas) {return;}                       // not on tools page

  const ctx = $canvas.getContext("2d");

  /* ====================================================================
   * 0. State
   * ==================================================================== */
  let handLandmarker  = null;                 // MediaPipe instance
  let cameraStream    = null;                 // MediaStream
  let running         = false;                // detection loop active?
  let mode            = "particle";           // particle | gesture | premium | draw | fruit | detect | face | dance | 3d
  let lastGesture     = "none";               // recognised gesture name
  const lastGestureTime = 0;
  let swipeHistory    = [];                   // palm centre history for swipe
  let waveHistory     = [];                   // wrist x history for wave oscillation

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
    if (cooldowns[name] && now - cooldowns[name] < ms) {return false;}
    cooldowns[name] = now;
    return true;
  }

  /* Drawing hue */
  let drawHue = 200;
  let prevDrawPoint = null;

  /* Object detection state */
  let objectDetector  = null;                // MediaPipe ObjectDetector instance
  const DETECT_INTERVAL = 100;               // throttle detection to ~10 FPS
  let lastDetectTime  = 0;
  let lastDetections  = [];                  // cached detections for inter-frame rendering

  /* ---- Fruit Ninja game state ---- */
  const fruitBladeTrail = [];           /* [{x,y,t}] blade trail points */
  const fruitList       = [];           /* active fruit objects */
  const fruitHalves     = [];           /* sliced half animations */
  const fruitJuice      = [];           /* juice splash particles */
  let fruitScore      = 0;
  let fruitCombo      = 0;
  let fruitComboTime  = 0;            /* last slice timestamp for combo decay */
  let fruitLives      = 3;
  let fruitSpawnTimer = 0;            /* next spawn time */
  let fruitGameOver   = false;
  let fruitDifficulty = 0;            /* increases over time */
  let fruitStartTime  = 0;
  let fruitHighScore  = parseInt((function() { try { return localStorage.getItem("gesture-fruit-hs"); } catch(e) { return "0"; } })() || "0", 10);

  const FRUIT_DEFS = [
    { emoji: "🍎", color: "#e53935", glow: "#ff5252", r: 30, pts: 10 },
    { emoji: "🍊", color: "#ff9800", glow: "#ffb74d", r: 28, pts: 15 },
    { emoji: "🍋", color: "#fdd835", glow: "#fff176", r: 25, pts: 20 },
    { emoji: "🍐", color: "#8bc34a", glow: "#aed581", r: 32, pts: 10 },
    { emoji: "🍇", color: "#7b1fa2", glow: "#ba68c8", r: 22, pts: 25 },
    { emoji: "🍉", color: "#2e7d32", glow: "#66bb6a", r: 38, pts: 30 },
    { emoji: "🍑", color: "#f48fb1", glow: "#f8bbd0", r: 27, pts: 15 },
    { emoji: "🥝", color: "#689f38", glow: "#9ccc65", r: 22, pts: 20 },
    { emoji: "💣", color: "#37474f", glow: "#78909c", r: 26, pts: -50 },
  ];
  const FRUIT_WEIGHTS = [20, 18, 12, 15, 10, 5, 10, 8, 5];

  /* ---- Face Analysis state ---- */
  let faceApiReady     = false;        // face-api.js script loaded?
  let faceModelsLoaded = false;        // all models loaded?
  let lastFaceResults  = [];           // cached face detection results
  let faceFrameCount   = 0;           // frame counter for throttling
  const FACE_INTERVAL  = 3;           // run face detection every N frames

  /* ---- Dance DDR game state ---- */
  const DANCE_DIRS = {
    left:  { arrow: "←", hue: 210, color: "#4488ff", glow: "#66aaff" },
    right: { arrow: "→", hue: 0,   color: "#ff4444", glow: "#ff6666" },
    up:    { arrow: "↑", hue: 140, color: "#44dd44", glow: "#66ff66" },
    down:  { arrow: "↓", hue: 50,  color: "#ffcc00", glow: "#ffdd44" },
  };
  const DANCE_DIR_KEYS = ["left", "right", "up", "down"];

  const danceArrows       = [];
  const danceScore        = 0;
  const danceCombo        = 0;
  const danceMaxCombo     = 0;
  const dancePerfect      = 0;
  const danceGreat        = 0;
  const danceMiss         = 0;
  const dancePhase        = "idle";      /* idle | ready | play | over */
  const danceStartTime    = 0;
  const danceReadyTime    = 0;
  const danceDuration     = 60000;       /* 60 s */
  const danceSpawnIndex   = 0;
  const dancePattern      = [];
  const danceMissEffects  = [];
  const danceJudgmentFX   = [];
  const danceHighScore    = parseInt((function() { try { return localStorage.getItem("gesture-dance-hs"); } catch(e) { return "0"; } })() || "0", 10);
  const dancePulse        = 0;

  /* ---- 3D Reconstruction state ---- */
  let THREE_M = null;                  /* THREE module reference */
  let threeLoaded   = false;
  let threeScene    = null;
  let threeCamera   = null;
  let threeRenderer = null;
  let threePoints   = null;            /* THREE.Points */
  let threeMesh     = null;            /* THREE.Mesh */
  let threeGeometry = null;            /* shared BufferGeometry */
  let threeLights   = [];              /* scene lights */
  let depth3D       = null;            /* Float32Array(GRID_W * GRID_H) smoothed */
  let depthRaw      = null;            /* Float32Array(GRID_W * GRID_H) raw per frame */
  let subMode       = "pointcloud";    /* "pointcloud" | "mesh" */
  let revealProgress = 0;              /* 0-1 progressive reveal */
  let prev3D        = null;            /* previous frame landmarks for delta */
  let threeTargetRot = { x: 0, y: 0 };
  let threeTargetPos = { x: 0, y: 0, z: 3 };
  const captureCanvas  = document.createElement("canvas");
  const captureCtx     = captureCanvas.getContext("2d", { willReadFrequently: true });
  const GRID_W = 100, GRID_H = 75;      /* downsample resolution */
  captureCanvas.width  = GRID_W;
  captureCanvas.height = GRID_H;

  /* ---- Premium interaction state ---- */
  let premiumHaptics = !$haptics || $haptics.checked;
  let premiumSound   = !!($sound && $sound.checked);

  /* ====================================================================
   * 1. MediaPipe CDN Loader
   * ==================================================================== */
  const VISION_CDN =
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs";
  const WASM_BASE =
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm";
  const MODEL_URL =
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task";
  const DETECT_MODEL_URL =
    "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/latest/efficientdet_lite0.tflite";

  async function loadMediaPipe() {
    if (handLandmarker) {return true;}
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

  async function loadObjectDetector() {
    if (objectDetector) {return true;}
    setStatus("loading", "加载物体检测模型…");
    try {
      const vision = await import(/* webpackIgnore: true */ VISION_CDN);
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM_BASE);
      objectDetector = await vision.ObjectDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: DETECT_MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        maxResults: 20,
        scoreThreshold: 0.4,
      });
      setStatus("ready", "物体检测模型已加载");
      return true;
    } catch (e) {
      setStatus("error", "物体检测模型加载失败");
      console.error("[gesture detect]", e);
      return false;
    }
  }

  /* ====================================================================
   * 1b. face-api.js CDN Loader
   * ==================================================================== */
  const FACE_API_CDN =
    "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js";
  const FACE_MODELS_BASE =
    "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/";

  async function loadFaceApi() {
    if (faceModelsLoaded) {return true;}
    if (!faceApiReady) {
      setStatus("loading", "加载人脸分析库…");
      try {
        await new Promise(function (resolve, reject) {
          const s = document.createElement("script");
          s.src = FACE_API_CDN;
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
        faceApiReady = true;
      } catch (e) {
        setStatus("error", "人脸分析库加载失败");
        console.error("[face-api]", e);
        return false;
      }
    }
    setStatus("loading", "加载人脸模型…");
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODELS_BASE),
        faceapi.nets.ageGenderNet.loadFromUri(FACE_MODELS_BASE),
        faceapi.nets.faceExpressionNet.loadFromUri(FACE_MODELS_BASE),
        faceapi.nets.faceLandmark68Net.loadFromUri(FACE_MODELS_BASE),
      ]);
      faceModelsLoaded = true;
      setStatus("ready", "人脸模型已加载");
      return true;
    } catch (e) {
      setStatus("error", "人脸模型加载失败");
      console.error("[face-api models]", e);
      return false;
    }
  }

  /* ====================================================================
   * 1b. Three.js CDN Loader & 3D Reconstruction
   * ==================================================================== */
  const THREE_CDN = "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

  async function loadThree() {
    if (threeLoaded) {return true;}
    setStatus("loading", "加载 3D 引擎…");
    try {
      THREE_M = await import(/* webpackIgnore: true */ THREE_CDN);
      threeLoaded = true;
      return true;
    } catch (e) {
      setStatus("error", "3D 引擎加载失败");
      console.error("[three.js]", e);
      return false;
    }
  }

  function initThreeScene() {
    if (!THREE_M) {return;}
    const viewport = $canvas.parentElement;
    const rect = viewport.getBoundingClientRect();
    const w = Math.floor(rect.width), h = Math.floor(rect.height);
    threeScene = new THREE_M.Scene();
    threeScene.background = new THREE_M.Color(0x080808);
    threeCamera = new THREE_M.PerspectiveCamera(60, w / h, 0.1, 1000);
    threeCamera.position.set(0, 0, 3);
    threeRenderer = new THREE_M.WebGLRenderer({ antialias: true, alpha: true });
    threeRenderer.setSize(w, h);
    threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const ctr = document.getElementById("gesture-three-container");
    if (ctr) { ctr.innerHTML = ""; ctr.appendChild(threeRenderer.domElement); }
    const count = GRID_W * GRID_H;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let r = 0; r < GRID_H; r++) {
      for (let c = 0; c < GRID_W; c++) {
        const i = r * GRID_W + c;
        positions[i * 3] = (c / GRID_W - 0.5) * 4;
        positions[i * 3 + 1] = -(r / GRID_H - 0.5) * 3;
        positions[i * 3 + 2] = 0;
        colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = 0.5;
      }
    }
    threeGeometry = new THREE_M.BufferGeometry();
    threeGeometry.setAttribute("position", new THREE_M.BufferAttribute(positions, 3));
    threeGeometry.setAttribute("color", new THREE_M.BufferAttribute(colors, 3));
    threePoints = new THREE_M.Points(threeGeometry, new THREE_M.PointsMaterial({
      size: 0.025, vertexColors: true, sizeAttenuation: true,
    }));
    threeScene.add(threePoints);
    threeMesh = null;
    threeLights = [new THREE_M.AmbientLight(0x404040, 2), new THREE_M.DirectionalLight(0xffffff, 2)];
    threeLights[1].position.set(2, 3, 4);
    depth3D = new Float32Array(count);
    depthRaw = new Float32Array(count);
    subMode = "pointcloud";
    revealProgress = 0;
    prev3D = null;
    threeTargetRot = { x: 0, y: 0 };
    threeTargetPos = { x: 0, y: 0, z: 3 };
    viewport.classList.add("is-3d-mode");
    const subPanel = document.getElementById("gesture-3d-submodes");
    if (subPanel) {subPanel.hidden = false;}
    const depthEl = document.getElementById("gesture-depth-preview");
    if (depthEl) { depthEl.width = GRID_W; depthEl.height = GRID_H; }
  }

  function cleanupThreeScene() {
    const viewport = $canvas.parentElement;
    viewport.classList.remove("is-3d-mode");
    const subPanel = document.getElementById("gesture-3d-submodes");
    if (subPanel) {subPanel.hidden = true;}
    if (threeGeometry) { threeGeometry.dispose(); threeGeometry = null; }
    if (threePoints) { if (threePoints.parent) {threeScene.remove(threePoints);} threePoints.material.dispose(); threePoints = null; }
    if (threeMesh) { if (threeMesh.parent) {threeScene.remove(threeMesh);} threeMesh.material.dispose(); threeMesh = null; }
    if (threeRenderer) {
      threeRenderer.dispose();
      const ctr = document.getElementById("gesture-three-container");
      if (ctr) {ctr.innerHTML = "";}
      threeRenderer = null;
    }
    threeScene = null; threeCamera = null; threeLights = [];
    depth3D = null; depthRaw = null;
  }

  function estimateDepth(imgData) {
    const data = imgData.data, len = GRID_W * GRID_H;
    for (let i = 0; i < len; i++) {
      const off = i * 4;
      depthRaw[i] = (0.299 * data[off] + 0.587 * data[off + 1] + 0.114 * data[off + 2]) / 255;
    }
    for (let y = 1; y < GRID_H - 1; y++) {
      for (let x = 1; x < GRID_W - 1; x++) {
        const idx = y * GRID_W + x;
        const tl = depthRaw[(y-1)*GRID_W+(x-1)], tc = depthRaw[(y-1)*GRID_W+x], tr = depthRaw[(y-1)*GRID_W+(x+1)];
        const ml = depthRaw[y*GRID_W+(x-1)], mr = depthRaw[y*GRID_W+(x+1)];
        const bl = depthRaw[(y+1)*GRID_W+(x-1)], bc = depthRaw[(y+1)*GRID_W+x], br = depthRaw[(y+1)*GRID_W+(x+1)];
        const gx = -tl + tr - 2*ml + 2*mr - bl + br;
        const gy = -tl - 2*tc - tr + bl + 2*bc + br;
        depthRaw[idx] = Math.min(1, depthRaw[idx] + Math.sqrt(gx * gx + gy * gy) * 0.25);
      }
    }
    for (let j = 0; j < len; j++) { depth3D[j] = depth3D[j] * 0.7 + depthRaw[j] * 0.3; }
  }

  function updatePointCloud(imgData) {
    estimateDepth(imgData);
    const posAttr = threeGeometry.getAttribute("position");
    const colAttr = threeGeometry.getAttribute("color");
    const pos = posAttr.array, col = colAttr.array, pixels = imgData.data;
    const revealCol = revealProgress < 1 ? Math.floor(revealProgress * GRID_W) : GRID_W;
    for (let r = 0; r < GRID_H; r++) {
      for (let c = 0; c < GRID_W; c++) {
        const i = r * GRID_W + c, i3 = i * 3;
        if (c < revealCol) {
          pos[i3] = (c / GRID_W - 0.5) * 4;
          pos[i3 + 1] = -(r / GRID_H - 0.5) * 3;
          pos[i3 + 2] = -(depth3D[i] - 0.5) * 3;
          col[i3] = pixels[i * 4] / 255;
          col[i3 + 1] = pixels[i * 4 + 1] / 255;
          col[i3 + 2] = pixels[i * 4 + 2] / 255;
        }
      }
    }
    if (revealProgress < 1) {revealProgress += 0.015;}
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  }

  function buildMeshIndices() {
    const indices = [];
    for (let r = 0; r < GRID_H - 1; r++) {
      for (let c = 0; c < GRID_W - 1; c++) {
        const i = r * GRID_W + c;
        indices.push(i, i + 1, i + GRID_W);
        indices.push(i + 1, i + GRID_W + 1, i + GRID_W);
      }
    }
    threeGeometry.setIndex(indices);
  }

  function switchToMesh() {
    if (!threeScene || threeMesh) {return;}
    threeScene.remove(threePoints);
    buildMeshIndices();
    threeMesh = new THREE_M.Mesh(threeGeometry, new THREE_M.MeshBasicMaterial({
      vertexColors: true, wireframe: true, transparent: true, opacity: 0.85,
    }));
    threeScene.add(threeMesh);
    threeLights.forEach(function (l) { threeScene.add(l); });
    subMode = "mesh";
  }

  function switchToPointCloud() {
    if (!threeScene || (threePoints && threePoints.parent)) {return;}
    if (threeMesh) { threeScene.remove(threeMesh); threeMesh.material.dispose(); threeMesh = null; }
    threeLights.forEach(function (l) { threeScene.remove(l); });
    threeGeometry.setIndex(null);
    threeScene.add(threePoints);
    subMode = "pointcloud";
  }

  function handleGesture3D(lm, gesture) {
    const palmX = (lm[0].x + lm[5].x + lm[9].x + lm[13].x + lm[17].x) / 5;
    const palmY = (lm[0].y + lm[5].y + lm[9].y + lm[13].y + lm[17].y) / 5;
    if (prev3D) {
      const dx = palmX - prev3D.palmX, dy = palmY - prev3D.palmY;
      switch (gesture) {
        case "open": threeTargetRot.y += dx * 4; threeTargetRot.x += dy * 4; break;
        case "ok": case "pinch":
          var pn = dist(lm[4], lm[8]), pp = prev3D.pinchDist || pn;
          threeTargetPos.z = Math.max(1.5, Math.min(6, threeTargetPos.z + (pp - pn) * 0.008));
          prev3D.pinchDist = pn; break;
        case "point": threeTargetPos.x -= dx * 3; threeTargetPos.y += dy * 3; break;
        case "peace":
          if (cooled("3d-toggle", 600)) {
            if (subMode === "pointcloud") {switchToMesh();} else {switchToPointCloud();}
            updateSubModeButtons();
          } break;
        case "fist": threeTargetRot = { x: 0, y: 0 }; threeTargetPos = { x: 0, y: 0, z: 3 }; break;
        case "wave": revealProgress = 0; break;
        case "swipe-left":  threeTargetRot.y -= 0.4; break;
        case "swipe-right": threeTargetRot.y += 0.4; break;
        case "swipe-up":    threeTargetRot.x -= 0.3; break;
        case "swipe-down":  threeTargetRot.x += 0.3; break;
      }
    }
    prev3D = { palmX: palmX, palmY: palmY, pinchDist: dist(lm[4], lm[8]) };
  }

  function animate3D(lm, gesture) {
    if (!threeRenderer || !threeScene || !threeCamera) {return;}
    handleGesture3D(lm, gesture);
    if ($video.readyState >= 2) {
      captureCtx.drawImage($video, 0, 0, GRID_W, GRID_H);
      updatePointCloud(captureCtx.getImageData(0, 0, GRID_W, GRID_H));
      renderDepthPreview();
    }
    threeScene.rotation.x += (threeTargetRot.x - threeScene.rotation.x) * 0.1;
    threeScene.rotation.y += (threeTargetRot.y - threeScene.rotation.y) * 0.1;
    threeCamera.position.x += (threeTargetPos.x - threeCamera.position.x) * 0.1;
    threeCamera.position.y += (threeTargetPos.y - threeCamera.position.y) * 0.1;
    threeCamera.position.z += (threeTargetPos.z - threeCamera.position.z) * 0.1;
    threeRenderer.render(threeScene, threeCamera);
    drawHandSkeleton(lm, 0.2);
  }

  function renderDepthPreview() {
    const el = document.getElementById("gesture-depth-preview");
    if (!el || !depth3D) {return;}
    const pctx = el.getContext("2d");
    const img = pctx.createImageData(GRID_W, GRID_H);
    const d = img.data;
    for (let i = 0, len = GRID_W * GRID_H; i < len; i++) {
      const v = Math.floor(depth3D[i] * 255);
      d[i * 4] = v; d[i * 4 + 1] = v; d[i * 4 + 2] = v; d[i * 4 + 3] = 255;
    }
    pctx.putImageData(img, 0, 0);
  }

  function updateSubModeButtons() {
    document.querySelectorAll(".gesture-submode-btn").forEach(function (b) {
      b.classList.toggle("active", b.dataset.submode === subMode);
    });
  }

  /* ====================================================================
   * 2. Camera Manager
   * ==================================================================== */
  async function startCamera() {
    if (mode === "detect") {
      if (!(await loadObjectDetector())) {return;}
    } else if (mode === "face") {
      if (!(await loadFaceApi())) {return;}
      if (!(await loadMediaPipe())) {return;}
    } else {
      if (!(await loadMediaPipe())) {return;}
    }
    if (mode === "3d") {
      if (!(await loadThree())) {return;}
    }
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
    if (mode === "3d") {initThreeScene();}
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
    if ($face) {
      $face.textContent = "";
      $face.classList.remove("is-active");
    }
    lastFaceResults = [];
    resetPremiumState();
    cleanupThreeScene();
  }

  function resizeCanvas() {
    const rect = $canvas.parentElement.getBoundingClientRect();
    const w = Math.floor(rect.width);
    const h = Math.floor(rect.height);
    const dpr = window.devicePixelRatio || 1;
    if ($canvas.width !== w * dpr || $canvas.height !== h * dpr) {
      $canvas.width  = w * dpr;
      $canvas.height = h * dpr;
      drawCanvas.width  = w * dpr;
      drawCanvas.height = h * dpr;
    }
    $canvas.style.width  = w + "px";
    $canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (threeRenderer) {
      threeRenderer.setSize(w, h);
      if (threeCamera) { threeCamera.aspect = w / h; threeCamera.updateProjectionMatrix(); }
    }
  }

  /* ====================================================================
   * 3. Detection Loop
   * ==================================================================== */
  function loop() {
    if (!running) {return;}
    if (!document.hidden && $video.readyState >= 2) {
      if (mode === "detect") {
        /* object detection mode – throttle to DETECT_INTERVAL */
        const now = performance.now();
        if (objectDetector && now - lastDetectTime >= DETECT_INTERVAL) {
          lastDetectTime = now;
          const detResult = objectDetector.detectForVideo($video, now);
          handleDetectResults(detResult);
        } else {
          /* between detections, redraw cached results */
          redrawDetections();
        }
        updateFPS();
      } else {
        /* hand gesture modes */
        if (handLandmarker) {
          const result = handLandmarker.detectForVideo($video, performance.now());
          handleResults(result);
        }
        updateFPS();
      }
    }
    requestAnimationFrame(loop);
  }

  function updateFPS() {
    frameCount++;
    const now = performance.now();
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
    const dx = toX(a) - toX(b), dy = toY(a) - toY(b);
    return Math.sqrt(dx * dx + dy * dy);
  }

  /* ====================================================================
   * 5. Gesture Recogniser
   * ==================================================================== */

  /* Finger tip / pip / mcp indices */
  const FINGER = {
    thumb:  { tip: 4,  ip: 3,  mcp: 2 },
    index:  { tip: 8,  pip: 6, mcp: 5 },
    middle: { tip: 12, pip: 10, mcp: 9 },
    ring:   { tip: 16, pip: 14, mcp: 13 },
    pinky:  { tip: 20, pip: 18, mcp: 17 },
  };

  function fingerExtended(lm, key) {
    const f = FINGER[key];
    if (key === "thumb") {
      /* thumb: compare tip x distance from palm centre vs ip */
      const palmX = (lm[0].x + lm[5].x + lm[17].x) / 3;
      return Math.abs(lm[f.tip].x - palmX) > Math.abs(lm[f.ip].x - palmX) * 1.1;
    }
    /* other fingers: tip above (y < ) pip */
    return lm[f.tip].y < lm[f.pip].y;
  }

  function recogniseGesture(lm) {
    const ext = {
      thumb:  fingerExtended(lm, "thumb"),
      index:  fingerExtended(lm, "index"),
      middle: fingerExtended(lm, "middle"),
      ring:   fingerExtended(lm, "ring"),
      pinky:  fingerExtended(lm, "pinky"),
    };
    const count = (ext.thumb?1:0) + (ext.index?1:0) + (ext.middle?1:0) + (ext.ring?1:0) + (ext.pinky?1:0);

    /* OK / Pinch: thumb tip close to index tip */
    const pinchDist = dist(lm[4], lm[8]);
    if (pinchDist < 30) {return count <= 2 ? "ok" : "pinch";}

    /* Fist: all fingers curled */
    if (count === 0) {return "fist";}

    /* Thumbs-up: thumb extended, all others curled */
    if (ext.thumb && !ext.index && !ext.middle && !ext.ring && !ext.pinky) {
      /* verify thumb points upward: tip above wrist by a significant margin */
      if (lm[4].y < lm[0].y - 0.08) {return "thumbs-up";}
    }

    /* Point: only index extended */
    if (ext.index && !ext.middle && !ext.ring && !ext.pinky) {return "point";}

    /* Peace: index + middle extended, others curled */
    if (ext.index && ext.middle && !ext.ring && !ext.pinky) {return "peace";}

    /* Number gestures by non-thumb finger count */
    const fingerCount = (ext.index ? 1 : 0) + (ext.middle ? 1 : 0) +
                      (ext.ring ? 1 : 0) + (ext.pinky ? 1 : 0);

    if (fingerCount === 3 && !ext.thumb) {return "number-3";}
    if (fingerCount === 4 && !ext.thumb) {return "number-4";}

    /* Open palm: all 5 extended */
    if (count >= 4) {return "open";}

    return "none";
  }

  /* Swipe detection: track palm centre over recent frames */
  function detectSwipe(lm) {
    const cx = (lm[0].x + lm[5].x + lm[9].x + lm[13].x + lm[17].x) / 5;
    const cy = (lm[0].y + lm[5].y + lm[9].y + lm[13].y + lm[17].y) / 5;
    swipeHistory.push({ x: cx, y: cy, t: performance.now() });
    if (swipeHistory.length > 10) {swipeHistory.shift();}
    if (swipeHistory.length < 6) {return null;}
    const first = swipeHistory[0];
    const last  = swipeHistory[swipeHistory.length - 1];
    const dt = last.t - first.t;
    if (dt > 600) {return null;}
    const dx = last.x - first.x;
    const dy = last.y - first.y;
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

  /* Wave detection: track wrist x-position for oscillation (back-and-forth) */
  function detectWave(lm) {
    waveHistory.push({ x: lm[0].x, t: performance.now() });
    if (waveHistory.length > 30) {waveHistory.shift();}
    if (waveHistory.length < 8) {return false;}
    /* prune old entries (> 1.2 s) */
    const now = performance.now();
    waveHistory = waveHistory.filter(function (h) { return now - h.t < 1200; });
    if (waveHistory.length < 8) {return false;}
    /* count direction changes */
    let changes = 0;
    let prevDir = 0;
    for (let i = 1; i < waveHistory.length; i++) {
      const dx = waveHistory[i].x - waveHistory[i - 1].x;
      if (Math.abs(dx) < 0.003) {continue;}     /* ignore tiny movements */
      const dir = dx > 0 ? 1 : -1;
      if (prevDir !== 0 && dir !== prevDir) {changes++;}
      prevDir = dir;
    }
    /* require at least 2 direction changes and sufficient total displacement */
    let totalRange = 0;
    for (let j = 1; j < waveHistory.length; j++) {
      totalRange += Math.abs(waveHistory[j].x - waveHistory[j - 1].x);
    }
    if (changes >= 2 && totalRange > 0.15) {
      waveHistory = [];
      return true;
    }
    return false;
  }

  /* ====================================================================
   * 6. Results Dispatcher
   * ==================================================================== */
  function handleResults(result) {
    const cw = $canvas.width / (window.devicePixelRatio || 1);
    const ch = $canvas.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, cw, ch);

    /* Always run face detection if models are loaded (background overlay) */
    if (faceModelsLoaded) {detectFaces();}

    if (!result.landmarks || result.landmarks.length === 0) {
      /* Face mode works even without hands */
      if (mode === "face") {
        setLabel("人脸分析");
        animateFace();
        return;
      }
      /* 3D mode: still render scene without gesture input */
      if (mode === "3d" && threeRenderer) {
        if ($video.readyState >= 2) {
          captureCtx.drawImage($video, 0, 0, GRID_W, GRID_H);
          updatePointCloud(captureCtx.getImageData(0, 0, GRID_W, GRID_H));
          renderDepthPreview();
        }
        threeScene.rotation.x += (threeTargetRot.x - threeScene.rotation.x) * 0.05;
        threeScene.rotation.y += (threeTargetRot.y - threeScene.rotation.y) * 0.05;
        threeCamera.position.x += (threeTargetPos.x - threeCamera.position.x) * 0.05;
        threeCamera.position.y += (threeTargetPos.y - threeCamera.position.y) * 0.05;
        threeCamera.position.z += (threeTargetPos.z - threeCamera.position.z) * 0.05;
        threeRenderer.render(threeScene, threeCamera);
        prev3D = null;
        setLabel("3D 重建");
        return;
      }
      if (mode === "premium") {
        setLabel("高阶动效");
        animatePremium(null, "none", []);
        drawFaceOverlay();
        return;
      }
      setLabel("未检测到手部");
      if (mode === "draw") {
        ctx.drawImage(drawCanvas, 0, 0, $canvas.width, $canvas.height,
          0, 0, cw, ch);
      }
      updateParticles();
      drawFaceOverlay();
      return;
    }

    const lm = result.landmarks[0];           /* primary hand */
    let gesture = recogniseGesture(lm);
    const swipe   = detectSwipe(lm);
    const waving   = detectWave(lm);
    if (swipe) {gesture = swipe;}
    else if (waving && gesture === "open") {gesture = "wave";}

    lastGesture = gesture;
    setLabel(gestureName(gesture));

    switch (mode) {
      case "particle":  animateParticle(lm, gesture); break;
      case "gesture":   animateGesture(lm, gesture);  break;
      case "premium":   animatePremium(lm, gesture, result.landmarks); break;
      case "draw":      animateDraw(lm, gesture);      break;
      case "fruit":     animateFruit(lm, gesture);     break;
      case "face":      animateFace();                 break;
      case "3d":        animate3D(lm, gesture);         break;
    }

    /* Overlay face info on non-face modes */
    if (mode !== "face") {drawFaceOverlay();}
  }

  /* ====================================================================
   * 6b. Object Detection Mode
   * ==================================================================== */

  /* COCO 80-class colour map – hue value per category */
  const DETECT_HUE = {
    person:0, bicycle:20, car:40, motorcycle:60, airplane:80,
    bus:100, train:120, truck:140, boat:160, "traffic light":180,
    "fire hydrant":200, "stop sign":220, "parking meter":240, bench:260,
    bird:280, cat:300, dog:320, horse:340, sheep:10,
    cow:30, elephant:50, bear:70, zebra:90, giraffe:110,
    backpack:130, umbrella:150, handbag:170, tie:190, suitcase:210,
    frisbee:230, skis:250, snowboard:270, "sports ball":290, kite:310,
    "baseball bat":330, "baseball glove":350, skateboard:15, surfboard:45,
    "tennis racket":75, bottle:95, "wine glass":115, cup:135,
    fork:155, knife:175, spoon:195, bowl:215, banana:235,
    apple:255, sandwich:275, orange:295, broccoli:315, carrot:335,
    "hot dog":5, pizza:25, donut:45, cake:65, chair:85,
    couch:105, "potted plant":125, bed:145, "dining table":165,
    toilet:185, tv:205, laptop:225, mouse:245, remote:265,
    keyboard:285, "cell phone":305, microwave:325, oven:345,
    toaster:55, sink:75, refrigerator:95, book:115, clock:135,
    vase:155, scissors:175, "teddy bear":195, "hair drier":215,
    toothbrush:235,
  };

  /* Chinese labels for COCO categories */
  const DETECT_CN = {
    person:"人", bicycle:"自行车", car:"汽车", motorcycle:"摩托车",
    airplane:"飞机", bus:"公交车", train:"火车", truck:"卡车",
    boat:"船", "traffic light":"红绿灯", "fire hydrant":"消防栓",
    "stop sign":"停车标志", "parking meter":"停车计时器", bench:"长椅",
    bird:"鸟", cat:"猫", dog:"狗", horse:"马", sheep:"羊",
    cow:"牛", elephant:"大象", bear:"熊", zebra:"斑马", giraffe:"长颈鹿",
    backpack:"背包", umbrella:"雨伞", handbag:"手提包", tie:"领带",
    suitcase:"行李箱", frisbee:"飞盘", skis:"滑雪板", snowboard:"单板",
    "sports ball":"运动球", kite:"风筝", "baseball bat":"棒球棒",
    "baseball glove":"棒球手套", skateboard:"滑板", surfboard:"冲浪板",
    "tennis racket":"网球拍", bottle:"瓶子", "wine glass":"酒杯",
    cup:"杯子", fork:"叉子", knife:"刀", spoon:"勺子", bowl:"碗",
    banana:"香蕉", apple:"苹果", sandwich:"三明治", orange:"橙子",
    broccoli:"西兰花", carrot:"胡萝卜", "hot dog":"热狗", pizza:"披萨",
    donut:"甜甜圈", cake:"蛋糕", chair:"椅子", couch:"沙发",
    "potted plant":"盆栽", bed:"床", "dining table":"餐桌", toilet:"马桶",
    tv:"电视", laptop:"笔记本电脑", mouse:"鼠标", remote:"遥控器",
    keyboard:"键盘", "cell phone":"手机", microwave:"微波炉", oven:"烤箱",
    toaster:"烤面包机", sink:"水槽", refrigerator:"冰箱", book:"书",
    clock:"时钟", vase:"花瓶", scissors:"剪刀", "teddy bear":"泰迪熊",
    "hair drier":"吹风机", toothbrush:"牙刷",
  };

  /* handle object detection results */
  function handleDetectResults(detResult) {
    const cw = $canvas.width / (window.devicePixelRatio || 1);
    const ch = $canvas.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, cw, ch);

    const dets = detResult && detResult.detections ? detResult.detections : [];
    lastDetections = dets;

    drawDetections(dets, cw, ch);

    const n = dets.length;
    setLabel(n > 0 ? "检测到 " + n + " 个物体" : "未检测到物体");
  }

  /* redraw cached detections between detection frames */
  function redrawDetections() {
    const cw = $canvas.width / (window.devicePixelRatio || 1);
    const ch = $canvas.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, cw, ch);
    drawDetections(lastDetections, cw, ch);
  }

  /* render bounding boxes, labels and confidence */
  function drawDetections(dets, cw, ch) {
    const vw = $video.videoWidth  || 640;
    const vh = $video.videoHeight || 480;

    /* scale from video-native pixels to canvas CSS pixels.
       video is object-fit:cover, mirrored via CSS scaleX(-1). */
    const scale = Math.max(cw / vw, ch / vh);
    const offX = (cw - vw * scale) / 2;
    const offY = (ch - vh * scale) / 2;

    for (let i = 0; i < dets.length; i++) {
      const det  = dets[i];
      const cat  = det.categories && det.categories[0];
      if (!cat) {continue;}
      const bb   = det.boundingBox;
      const name = cat.categoryName || "unknown";
      const pct  = Math.round(cat.score * 100);
      const hue  = DETECT_HUE[name] !== null && DETECT_HUE[name] !== undefined ? DETECT_HUE[name] : (i * 47) % 360;
      const cn   = DETECT_CN[name] || name;

      /* map bounding box to canvas coords */
      const x1 = bb.originX * scale + offX;
      const y1 = bb.originY * scale + offY;
      const bw = bb.width    * scale;
      const bh = bb.height   * scale;

      /* bounding box */
      ctx.strokeStyle = "hsla(" + hue + ", 85%, 60%, 0.9)";
      ctx.lineWidth   = 2.5;
      ctx.shadowColor = "hsla(" + hue + ", 85%, 55%, 0.5)";
      ctx.shadowBlur  = 6;
      roundRect(ctx, x1, y1, bw, bh, 4);
      ctx.stroke();
      ctx.shadowBlur = 0;

      /* label background */
      const label = cn + " " + pct + "%";
      ctx.font = "bold 13px system-ui, sans-serif";
      const tw = ctx.measureText(label).width + 12;
      const th = 20;
      ctx.fillStyle = "hsla(" + hue + ", 85%, 45%, 0.85)";
      roundRect(ctx, x1, y1 - th, tw, th, [4, 4, 0, 0]);
      ctx.fill();

      /* label text */
      ctx.fillStyle = "#fff";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x1 + 6, y1 - th / 2);

      /* corner accents */
      drawCornerAccents(x1, y1, bw, bh, hue);
    }
  }

  /* rounded-rect path helper */
  function roundRect(c, x, y, w, h, r) {
    if (typeof r === "number") {r = [r, r, r, r];}
    c.beginPath();
    c.moveTo(x + r[0], y);
    c.lineTo(x + w - r[1], y);
    c.quadraticCurveTo(x + w, y, x + w, y + r[1]);
    c.lineTo(x + w, y + h - r[2]);
    c.quadraticCurveTo(x + w, y + h, x + w - r[2], y + h);
    c.lineTo(x + r[3], y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r[3]);
    c.lineTo(x, y + r[0]);
    c.quadraticCurveTo(x, y, x + r[0], y);
    c.closePath();
  }

  /* small corner accent marks for visual flair */
  function drawCornerAccents(x, y, w, h, hue) {
    const len = Math.min(10, w * 0.15, h * 0.15);
    ctx.strokeStyle = "hsla(" + hue + ", 90%, 70%, 0.8)";
    ctx.lineWidth   = 3;
    ctx.lineCap     = "round";
    /* top-left */
    ctx.beginPath(); ctx.moveTo(x, y + len); ctx.lineTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
    /* top-right */
    ctx.beginPath(); ctx.moveTo(x + w - len, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + len); ctx.stroke();
    /* bottom-left */
    ctx.beginPath(); ctx.moveTo(x, y + h - len); ctx.lineTo(x, y + h); ctx.lineTo(x + len, y + h); ctx.stroke();
    /* bottom-right */
    ctx.beginPath(); ctx.moveTo(x + w - len, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - len); ctx.stroke();
  }

  /* ====================================================================
   * 7. Particle Mode
   * ==================================================================== */
  function animateParticle(lm, gesture) {
    /* hand centre */
    const cx = toX(lm[0]);
    const cy = toY(lm[0]);

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
          const dx = cx - p.x, dy = cy - p.y;
          const d  = Math.sqrt(dx * dx + dy * dy) || 1;
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

      case "wave":
        /* side-to-side sparkle trail from fingertips */
        if (cooled("wave-sparkle", 80)) {
          [4, 8, 12, 16, 20].forEach(function (idx) {
            spawnParticle(toX(lm[idx]), toY(lm[idx]), "star", 50 + Math.random() * 30, 0.85);
          });
        }
        break;

      case "thumbs-up":
        /* upward flame burst from thumb tip */
        spawnParticle(toX(lm[4]), toY(lm[4]), "star", 30, 0.95);
        spawnParticle(toX(lm[4]), toY(lm[4]), "circle", 35, 0.9);
        break;

      case "number-3":
        /* triple sparkles from 3 extended fingertips */
        if (cooled("num3-sparkle", 120)) {
          [8, 12, 16].forEach(function (idx) {
            spawnParticle(toX(lm[idx]), toY(lm[idx]), "circle", 120, 0.9);
          });
        }
        break;

      case "number-4":
        /* quadruple sparkles from 4 extended fingertips */
        if (cooled("num4-sparkle", 120)) {
          [8, 12, 16, 20].forEach(function (idx) {
            spawnParticle(toX(lm[idx]), toY(lm[idx]), "circle", 200, 0.9);
          });
        }
        break;
    }

    updateParticles();
  }

  /* ====================================================================
   * 8. Gesture Recognition Mode
   * ==================================================================== */
  function animateGesture(lm, gesture) {
    const cw = $canvas.width / (window.devicePixelRatio || 1);
    const ch = $canvas.height / (window.devicePixelRatio || 1);

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
          const px = (toX(lm[4]) + toX(lm[8])) / 2;
          const py = (toY(lm[4]) + toY(lm[8])) / 2;
          rippleAt(px, py, 45);
        }
        break;

      case "fist":
        /* implosion + explosion */
        var cx = toX(lm[0]);
        var cy = toY(lm[9]);
        particles.forEach(function (p) {
          const dx = cx - p.x, dy = cy - p.y;
          const d  = Math.sqrt(dx * dx + dy * dy) || 1;
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

      case "wave":
        /* waving hand – dynamic streaks radiating from palm */
        drawHandSkeleton(lm, 0.4);
        if (cooled("wave-streak", 100)) {
          const wc = toX(lm[0]), wy = toY(lm[9]);
          for (let wi = 0; wi < 6; wi++) {
            const wa = Math.random() * Math.PI * 2;
            particles.push({
              x: wc + Math.cos(wa) * 10,
              y: wy + Math.sin(wa) * 10,
              vx: Math.cos(wa) * (2 + Math.random() * 3),
              vy: Math.sin(wa) * (2 + Math.random() * 3),
              radius: Math.random() * 3 + 2,
              life: 1,
              decay: 0.025,
              hue: 40 + Math.random() * 30,
              shape: "star",
              friction: 0.97,
              gravity: 0,
            });
          }
        }
        break;

      case "thumbs-up":
        /* rising flame from thumb tip */
        drawHandSkeleton(lm, 0.4);
        if (cooled("thumb-flame", 120)) {
          const tx = toX(lm[4]), ty = toY(lm[4]);
          for (let ti = 0; ti < 4; ti++) {
            particles.push({
              x: tx + (Math.random() - 0.5) * 10,
              y: ty,
              vx: (Math.random() - 0.5) * 1.5,
              vy: -(2 + Math.random() * 3),
              radius: Math.random() * 4 + 2,
              life: 1,
              decay: 0.02,
              hue: 20 + Math.random() * 30,
              shape: Math.random() > 0.5 ? "star" : "circle",
              friction: 0.98,
              gravity: -0.02,
            });
          }
        }
        break;

      case "number-3":
        /* three colored arcs */
        drawHandSkeleton(lm, 0.4);
        drawNumberGlow(lm, [8, 12, 16], 120);
        break;

      case "number-4":
        /* four colored arcs */
        drawHandSkeleton(lm, 0.4);
        drawNumberGlow(lm, [8, 12, 16, 20], 200);
        break;
    }

    updateParticles();
  }

  /* ====================================================================
   * 9. Drawing Mode
   * ==================================================================== */
  function animateDraw(lm, gesture) {
    /* draw persistent strokes onto drawCanvas */
    const ix = toX(lm[8]), iy = toY(lm[8]);

    if (gesture === "fist") {
      /* clear drawing */
      if (cooled("draw-clear", 800)) {
        drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
        prevDrawPoint = null;
      }
    } else if (gesture === "ok" || gesture === "pinch" ||
               gesture === "number-3" || gesture === "number-4") {
      /* change colour */
      drawHue = (drawHue + 2) % 360;
      prevDrawPoint = null;  /* break stroke */
    } else if (gesture === "point" || gesture === "open" || gesture === "wave") {
      /* draw line from index tip (wave has open palm) */
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
    } else if (gesture === "thumbs-up") {
      /* draw upward stroke from thumb tip */
      const tx = toX(lm[4]), ty = toY(lm[4]);
      if (prevDrawPoint) {
        drawCtx.beginPath();
        drawCtx.moveTo(prevDrawPoint.x, prevDrawPoint.y);
        drawCtx.lineTo(tx, ty);
        drawCtx.strokeStyle = "hsla(35, 100%, 60%, 0.9)";
        drawCtx.lineWidth = 5;
        drawCtx.lineCap = "round";
        drawCtx.lineJoin = "round";
        drawCtx.shadowColor = "hsla(35, 100%, 55%, 0.6)";
        drawCtx.shadowBlur = 14;
        drawCtx.stroke();
        drawCtx.shadowBlur = 0;
        spawnParticle(tx, ty, "star", 35, 0.8);
      }
      prevDrawPoint = { x: tx, y: ty };
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
   * 9b. Premium Kinetic Mode
   * ==================================================================== */
  function premiumEnv() {
    return {
      canvas: $canvas,
      ctx: ctx,
      toX: toX,
      toY: toY,
      dist: dist,
      roundRect: roundRect,
      drawHandSkeleton: drawHandSkeleton,
      spawnParticle: spawnParticle,
      updateParticles: updateParticles,
      rippleAt: rippleAt,
      haptics: premiumHaptics,
      sound: premiumSound,
    };
  }

  function premiumApi() {
    return window.CWLGesturePremium;
  }

  function resetPremiumState() {
    const api = premiumApi();
    if (api && typeof api.reset === "function") {
      api.reset();
    }
  }

  function premiumFeedback(kind) {
    const api = premiumApi();
    if (api && typeof api.feedback === "function") {
      api.feedback(premiumEnv(), kind);
    }
  }

  function animatePremium(lm, gesture, hands) {
    const api = premiumApi();
    if (api && typeof api.animate === "function") {
      api.animate(premiumEnv(), lm, gesture, hands || []);
      return;
    }
    setLabel("高阶动效未加载");
    updateParticles();
  }
  /* ====================================================================
   * 9c. Fruit Ninja Mode
   * ==================================================================== */
  function fruitCW() { return $canvas.width / (window.devicePixelRatio || 1); }
  function fruitCH() { return $canvas.height / (window.devicePixelRatio || 1); }

  function fruitPickType() {
    let total = 0, i;
    for (i = 0; i < FRUIT_WEIGHTS.length; i++) {total += FRUIT_WEIGHTS[i];}
    let r = Math.random() * total, acc = 0;
    for (i = 0; i < FRUIT_WEIGHTS.length; i++) {
      acc += FRUIT_WEIGHTS[i];
      if (r < acc) {return i;}
    }
    return 0;
  }

  function fruitSpawn() {
    const cw = fruitCW(), ch = fruitCH();
    const ti = fruitPickType();
    const def = FRUIT_DEFS[ti];
    const x = def.r + Math.random() * (cw - def.r * 2);
    const speedY = -(7.5 + Math.random() * 4 + fruitDifficulty * 0.3);
    const speedX = (Math.random() - 0.5) * 3;
    fruitList.push({
      x: x, y: ch + def.r + 10,
      vx: speedX, vy: speedY,
      r: def.r, typeIdx: ti,
      rotation: Math.random() * Math.PI * 2,
      rotSpd: (Math.random() - 0.5) * 0.12,
    });
  }

  function fruitSpawnWave() {
    const count = 2 + Math.floor(Math.random() * (2 + fruitDifficulty * 0.2));
    for (let i = 0; i < count; i++) {
      setTimeout(fruitSpawn, i * 120);
    }
  }

  function fruitReset() {
    fruitList.length = 0;
    fruitHalves.length = 0;
    fruitJuice.length = 0;
    fruitBladeTrail.length = 0;
    fruitScore = 0;
    fruitCombo = 0;
    fruitComboTime = 0;
    fruitLives = 3;
    fruitDifficulty = 0;
    fruitGameOver = false;
    fruitSpawnTimer = performance.now() + 1500;
    fruitStartTime = performance.now();
  }

  function animateFruit(lm, gesture) {
    const cw = fruitCW();
    const ch = fruitCH();
    const now = performance.now();

    /* initialise on first frame */
    if (fruitStartTime === 0 && !fruitGameOver) {fruitReset();}

    /* Game Over screen */
    if (fruitGameOver) {
      drawFruitGameOver(cw, ch);
      if (gesture === "fist" && cooled("fruit-restart", 1000)) {
        fruitReset();
      }
      return;
    }

    /* Difficulty ramp */
    fruitDifficulty = Math.min(10, (now - fruitStartTime) / 15000);

    /* ---- Blade trail from palm ---- */
    const px = toX(lm[0]);
    const py = toY(lm[9]);
    fruitBladeTrail.push({ x: px, y: py, t: now });
    while (fruitBladeTrail.length > 0 && now - fruitBladeTrail[0].t > 350) {
      fruitBladeTrail.shift();
    }

    /* ---- Spawn waves ---- */
    if (now >= fruitSpawnTimer && !fruitGameOver) {
      fruitSpawnWave();
      const interval = Math.max(800, 2200 - fruitDifficulty * 120);
      fruitSpawnTimer = now + interval + Math.random() * 400;
    }

    /* ---- Combo decay (2s) ---- */
    if (fruitCombo > 0 && now - fruitComboTime > 2000) {
      fruitCombo = 0;
    }

    /* ---- Slice detection ---- */
    const slicing = gesture !== "fist" && gesture !== "none";
    if (slicing && fruitBladeTrail.length >= 2) {
      const tip = fruitBladeTrail[fruitBladeTrail.length - 1];
      const prev = fruitBladeTrail[fruitBladeTrail.length - 2];
      const bladeSpeed = Math.sqrt(
        (tip.x - prev.x) * (tip.x - prev.x) +
        (tip.y - prev.y) * (tip.y - prev.y)
      );
      if (bladeSpeed > 4) {
        for (let fi = fruitList.length - 1; fi >= 0; fi--) {
          const fr = fruitList[fi];
          if (fr.sliced) {continue;}
          const d = ptSegDist(fr.x, fr.y, prev.x, prev.y, tip.x, tip.y);
          if (d < fr.r + 6) {
            fr.sliced = true;
            const sliceAngle = Math.atan2(tip.y - prev.y, tip.x - prev.x);
            const def = FRUIT_DEFS[fr.typeIdx];
            if (def.pts < 0) {
              /* bomb hit */
              fruitScore = Math.max(0, fruitScore + def.pts);
              fruitCombo = 0;
              for (let bi = 0; bi < 25; bi++) {
                fruitJuice.push(fruitMakeJuice(fr.x, fr.y, 30, 10, 0.04));
              }
            } else {
              fruitCombo++;
              fruitComboTime = now;
              fruitScore += def.pts * fruitCombo;
              const jCount = Math.min(25, 8 + fruitCombo * 2);
              for (let ji = 0; ji < jCount; ji++) {
                fruitJuice.push(fruitMakeJuice(fr.x, fr.y, def.r * 0.8, def.color, 0.025));
              }
            }
            /* split halves */
            const ha = sliceAngle + Math.PI / 2;
            fruitHalves.push({
              x: fr.x, y: fr.y,
              vx: Math.cos(ha) * 3, vy: -1.5,
              r: fr.r, typeIdx: fr.typeIdx,
              rotation: fr.rotation, rotSpd: 0.08,
              life: 1, side: -1,
            });
            fruitHalves.push({
              x: fr.x, y: fr.y,
              vx: -Math.cos(ha) * 3, vy: -1.5,
              r: fr.r, typeIdx: fr.typeIdx,
              rotation: fr.rotation, rotSpd: -0.08,
              life: 1, side: 1,
            });
            fruitList.splice(fi, 1);
            break;
          }
        }
      }
    }

    /* ---- Physics: fruits ---- */
    for (let pi = fruitList.length - 1; pi >= 0; pi--) {
      const p = fruitList[pi];
      p.vy += 0.16;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotSpd;
      if (p.y - p.r > ch + 20) {
        if (!p.sliced) {
          const pDef = FRUIT_DEFS[p.typeIdx];
          if (pDef.pts > 0) {
            fruitLives--;
            if (fruitLives <= 0) {
              fruitGameOver = true;
              if (fruitScore > fruitHighScore) {
                fruitHighScore = fruitScore;
                try { localStorage.setItem("gesture-fruit-hs", String(fruitHighScore)); } catch (e) { /* */ }
              }
            }
          }
        }
        fruitList.splice(pi, 1);
      }
    }

    /* ---- Physics: halves ---- */
    for (let hi = fruitHalves.length - 1; hi >= 0; hi--) {
      const h = fruitHalves[hi];
      h.vy += 0.18;
      h.x += h.vx;
      h.y += h.vy;
      h.rotation += h.rotSpd;
      h.life -= 0.008;
      if (h.life <= 0 || h.y > ch + 60) { fruitHalves.splice(hi, 1); }
    }

    /* ---- Physics: juice ---- */
    for (let ui = fruitJuice.length - 1; ui >= 0; ui--) {
      const u = fruitJuice[ui];
      u.vy += 0.12;
      u.x += u.vx;
      u.y += u.vy;
      u.life -= u.decay;
      if (u.life <= 0) { fruitJuice.splice(ui, 1); }
    }

    /* ===== RENDER ===== */
    const bgGrad = ctx.createLinearGradient(0, 0, 0, ch);
    bgGrad.addColorStop(0, "#0d1b2a");
    bgGrad.addColorStop(1, "#1b2838");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, cw, ch);

    /* juice particles */
    for (let rj = 0; rj < fruitJuice.length; rj++) {
      const j = fruitJuice[rj];
      ctx.globalAlpha = j.life * 0.8;
      ctx.fillStyle = j.color;
      ctx.beginPath();
      ctx.arc(j.x, j.y, j.size * j.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    /* whole fruits */
    for (let rf = 0; rf < fruitList.length; rf++) {
      drawFruitWhole(fruitList[rf]);
    }
    /* sliced halves */
    for (let rh = 0; rh < fruitHalves.length; rh++) {
      drawFruitHalf(fruitHalves[rh]);
    }
    /* blade trail */
    drawBladeTrail(now);
    /* HUD */
    drawFruitHUD(cw, ch);
    /* combo popup */
    if (fruitCombo >= 2) {
      drawComboPopup(cw, ch, now);
    }
  }

  function drawFruitWhole(f) {
    const def = FRUIT_DEFS[f.typeIdx];
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rotation);
    /* glow */
    ctx.beginPath();
    ctx.arc(0, 0, f.r + 8, 0, Math.PI * 2);
    ctx.fillStyle = def.glow + "22";
    ctx.fill();
    /* body */
    ctx.beginPath();
    ctx.arc(0, 0, f.r, 0, Math.PI * 2);
    const fg = ctx.createRadialGradient(-f.r * 0.3, -f.r * 0.3, f.r * 0.1, 0, 0, f.r);
    fg.addColorStop(0, def.glow);
    fg.addColorStop(1, def.color);
    ctx.fillStyle = fg;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    /* shine */
    ctx.beginPath();
    ctx.arc(-f.r * 0.25, -f.r * 0.25, f.r * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fill();
    /* emoji */
    ctx.font = (f.r * 1.1) + "px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(def.emoji, 0, 1);
    ctx.restore();
  }

  function drawFruitHalf(h) {
    const def = FRUIT_DEFS[h.typeIdx];
    ctx.save();
    ctx.globalAlpha = h.life;
    ctx.translate(h.x, h.y);
    ctx.rotate(h.rotation);
    /* clip to half */
    ctx.beginPath();
    if (h.side < 0) {
      ctx.rect(-h.r - 2, -h.r - 2, h.r * 2 + 4, h.r + 2);
    } else {
      ctx.rect(-h.r - 2, 0, h.r * 2 + 4, h.r + 2);
    }
    ctx.clip();
    /* body */
    ctx.beginPath();
    ctx.arc(0, 0, h.r, 0, Math.PI * 2);
    ctx.fillStyle = def.color;
    ctx.fill();
    /* inner surface */
    ctx.beginPath();
    ctx.ellipse(0, 0, h.r * 0.85, h.r * 0.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = def.glow;
    ctx.globalAlpha = h.life * 0.6;
    ctx.fill();
    /* seeds */
    ctx.globalAlpha = h.life;
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    for (let si = 0; si < 3; si++) {
      ctx.beginPath();
      ctx.arc(-h.r * 0.3 + si * h.r * 0.3, 0, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBladeTrail(now) {
    if (fruitBladeTrail.length < 2) {return;}
    for (let i = 1; i < fruitBladeTrail.length; i++) {
      const p0 = fruitBladeTrail[i - 1];
      const p1 = fruitBladeTrail[i];
      const age = (now - p1.t) / 350;
      const alpha = Math.max(0, 1 - age);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.strokeStyle = "rgba(200, 220, 255, " + (alpha * 0.15) + ")";
      ctx.lineWidth = 18;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.strokeStyle = "rgba(180, 210, 255, " + (alpha * 0.4) + ")";
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.strokeStyle = "rgba(255, 255, 255, " + (alpha * 0.9) + ")";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function drawFruitHUD(cw, ch) {
    ctx.save();
    ctx.font = "bold 28px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 4;
    ctx.fillText("分数: " + fruitScore, 20, 20);
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText("最高: " + fruitHighScore, 20, 54);
    /* hearts */
    ctx.textAlign = "right";
    ctx.font = "24px serif";
    let hearts = "";
    for (let li = 0; li < 3; li++) { hearts += li < fruitLives ? "❤️" : "🖤"; }
    ctx.fillText(hearts, cw - 20, 22);
    /* combo */
    if (fruitCombo >= 2) {
      ctx.textAlign = "center";
      ctx.font = "bold 20px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255, 215, 0, 0.9)";
      ctx.fillText(fruitCombo + "x 连击!", cw / 2, 20);
    }
    /* time */
    const elapsed = Math.floor((performance.now() - fruitStartTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    ctx.textAlign = "center";
    ctx.font = "16px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(mins + ":" + (secs < 10 ? "0" : "") + secs, cw / 2, 46);
    /* hint */
    ctx.font = "13px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillText("✋ 手掌划动切水果  ✊ 握拳重新开始", cw / 2, ch - 12);
    ctx.restore();
  }

  function drawComboPopup(cw, ch, now) {
    const age = (now - fruitComboTime) / 600;
    if (age > 1) {return;}
    const scale = 1 + age * 0.4;
    const alpha = 1 - age;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = "bold " + Math.floor(42 * scale) + "px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffd700";
    ctx.shadowColor = "rgba(255, 200, 0, 0.6)";
    ctx.shadowBlur = 16;
    ctx.fillText(fruitCombo + "x COMBO!", cw / 2, ch * 0.4);
    ctx.restore();
  }

  function drawFruitGameOver(cw, ch) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, cw, ch);
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 48px system-ui, sans-serif";
    ctx.fillStyle = "#ff5252";
    ctx.shadowColor = "rgba(255, 50, 50, 0.5)";
    ctx.shadowBlur = 20;
    ctx.fillText("游戏结束", cw / 2, ch * 0.35);
    ctx.shadowBlur = 0;
    ctx.font = "28px system-ui, sans-serif";
    ctx.fillStyle = "#fff";
    ctx.fillText("得分: " + fruitScore, cw / 2, ch * 0.48);
    if (fruitScore >= fruitHighScore && fruitScore > 0) {
      ctx.font = "20px system-ui, sans-serif";
      ctx.fillStyle = "#ffd700";
      ctx.fillText("🎉 新纪录!", cw / 2, ch * 0.56);
    }
    ctx.font = "16px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText("最高分: " + fruitHighScore, cw / 2, ch * 0.64);
    ctx.font = "18px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText("✊ 握拳重新开始", cw / 2, ch * 0.75);
    ctx.restore();
  }

  function ptSegDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    const cx = ax + t * dx, cy = ay + t * dy;
    return Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));
  }

  function fruitMakeJuice(x, y, spread, color, decay) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 5;
    return {
      x: x + (Math.random() - 0.5) * spread,
      y: y + (Math.random() - 0.5) * spread,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      size: 3 + Math.random() * 4,
      life: 1,
      decay: decay || 0.025,
      color: color || "#ff0",
    };
  }

  /* ====================================================================
   * 9c. Face Analysis Mode
   * ==================================================================== */
  function faceCW() { return $canvas.width / (window.devicePixelRatio || 1); }
  function faceCH() { return $canvas.height / (window.devicePixelRatio || 1); }

  /* Attractiveness score from 68-point facial landmarks (entertainment only) */
  function calcAttractiveness(pts) {
    if (!pts || pts.length < 68) {return 50;}
    const noseX = pts[27].x;
    let symSum = 0, symCount = 0;
    const pairs = [[17,26],[18,25],[19,24],[20,23],[21,22],[36,45],[37,44],[38,43],[39,42],[40,47],[41,46]];
    pairs.forEach(function (pair) {
      const dL = Math.abs(pts[pair[0]].x - noseX);
      const dR = Math.abs(pts[pair[1]].x - noseX);
      const ratio = Math.min(dL, dR) / (Math.max(dL, dR) || 0.001);
      symSum += ratio;
      symCount++;
    });
    const symmetry = symSum / symCount;

    /* 三庭比例: forehead→brow, brow→nose, nose→chin */
    const browY  = (pts[19].y + pts[24].y) / 2;
    const noseY  = pts[33].y;
    const chinY  = pts[8].y;
    const topY   = pts[0].y;
    let totalH = chinY - topY;
    if (totalH <= 0) {totalH = 0.01;}
    const thirdsDev = (Math.abs((browY - topY) / totalH - 0.33) +
                     Math.abs((noseY - browY) / totalH - 0.33) +
                     Math.abs((chinY - noseY) / totalH - 0.33)) / 3;
    const thirds = 1 - Math.min(1, thirdsDev * 3);

    /* 五眼: face width / eye width ≈ 5 */
    const faceW = Math.abs(pts[16].x - pts[0].x) || 0.01;
    const eyeW  = Math.abs(pts[39].x - pts[36].x) || 0.001;
    const fiveEyes = 1 - Math.min(1, Math.abs(faceW / eyeW - 5) / 5);

    /* Nose straightness */
    const noseStraight = 1 - Math.abs(pts[27].x - pts[30].x) / (faceW || 0.01);

    const score = symmetry * 35 + thirds * 25 + fiveEyes * 20 + noseStraight * 20;
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  const EXPR_EMOJI = {
    neutral: "😐", happy: "😄", angry: "😠", sad: "😢",
    disgusted: "🤢", fearful: "😨", surprised: "😲",
  };
  const EXPR_NAMES = {
    neutral: "平静", happy: "开心", angry: "愤怒", sad: "悲伤",
    disgusted: "厌恶", fearful: "恐惧", surprised: "惊讶",
  };

  /* Throttled face detection */
  async function detectFaces() {
    if (!faceModelsLoaded || !$video || $video.readyState < 2) {return;}
    faceFrameCount++;
    if (faceFrameCount % FACE_INTERVAL !== 0) {return;}
    try {
      lastFaceResults = await faceapi
        .detectAllFaces($video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.45 }))
        .withFaceLandmarks()
        .withAgeAndGender()
        .withFaceExpressions();
    } catch (e) {
      lastFaceResults = [];
    }
    /* Update face badge */
    if ($face && lastFaceResults.length > 0) {
      const f = lastFaceResults[0];
      const age = Math.round(f.age);
      const gender = f.gender === "male" ? "男" : "女";
      const topExpr = Object.entries(f.expressions).sort(function (a, b) { return b[1] - a[1]; })[0];
      $face.textContent = (EXPR_EMOJI[topExpr[0]] || "❓") + " " + gender + " " + age + "岁";
      $face.classList.add("is-active");
    } else if ($face) {
      $face.textContent = "";
      $face.classList.remove("is-active");
    }
  }

  /* Full face analysis rendering (face mode) */
  function animateFace() {
    const cw = faceCW(), ch = faceCH();
    updateParticles();

    if (!lastFaceResults || lastFaceResults.length === 0) {
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "16px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillText("正在检测人脸…", cw / 2, ch / 2);
      ctx.restore();
      return;
    }

    lastFaceResults.forEach(function (res) {
      const box = res.detection.box;
      const age = Math.round(res.age);
      const gender = res.gender === "male" ? "男性" : "女性";
      const expressions = res.expressions;
      const topExpr = Object.entries(expressions).sort(function (a, b) { return b[1] - a[1]; })[0];
      const exprName = EXPR_NAMES[topExpr[0]] || topExpr[0];
      const exprEmoji = EXPR_EMOJI[topExpr[0]] || "❓";
      const exprConf = Math.round(topExpr[1] * 100);
      const score = calcAttractiveness(res.landmarks.positions);

      /* Mirror box x because canvas is mirrored */
      const bx = cw - box.x - box.width;
      const by = box.y;
      const bw = box.width;
      const bh = box.height;

      ctx.save();

      /* Bounding box with glow */
      ctx.strokeStyle = "rgba(0, 200, 255, 0.7)";
      ctx.lineWidth = 2;
      ctx.shadowColor = "rgba(0, 200, 255, 0.3)";
      ctx.shadowBlur = 8;
      roundRect(ctx, bx, by, bw, bh, 6);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(0, 200, 255, 0.2)";
      ctx.lineWidth = 1;
      roundRect(ctx, bx - 3, by - 3, bw + 6, bh + 6, 8);
      ctx.stroke();

      /* Landmark dots */
      const pts = res.landmarks.positions;
      ctx.globalAlpha = 0.35;
      pts.forEach(function (p) {
        ctx.beginPath();
        ctx.arc(cw - p.x, p.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0, 200, 255, 0.6)";
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      /* Attribute card */
      const lineH = 20, cardW = 150, cardH = lineH * 4 + 16;
      let cardY = by - 8 - cardH;
      if (cardY < 4) {cardY = by + bh + 8;}

      ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
      roundRect(ctx, bx, cardY, cardW, cardH, 8);
      ctx.fill();
      ctx.strokeStyle = "rgba(0, 200, 255, 0.35)";
      ctx.lineWidth = 1;
      roundRect(ctx, bx, cardY, cardW, cardH, 8);
      ctx.stroke();

      let tx = bx + 10, ty = cardY + 8;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";

      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.fillStyle = "#80deea";
      ctx.fillText("👤 " + gender + "  " + age + " 岁", tx, ty);
      ty += lineH;

      ctx.font = "13px system-ui, sans-serif";
      ctx.fillStyle = "#fff59d";
      ctx.fillText(exprEmoji + " " + exprName + " " + exprConf + "%", tx, ty);
      ty += lineH;

      ctx.font = "13px system-ui, sans-serif";
      ctx.fillStyle = "#a5d6a7";
      ctx.fillText("✨ 颜值评分", tx, ty);
      const barX = tx + 68, barY = ty + 4, barW = 60, barH = 8;
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      roundRect(ctx, barX, barY, barW, barH, 4);
      ctx.fill();
      const fillW = barW * (score / 100);
      if (fillW > 0) {
        const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
        grad.addColorStop(0, "#ff6b6b");
        grad.addColorStop(0.5, "#ffd93d");
        grad.addColorStop(1, "#6bcb77");
        ctx.fillStyle = grad;
        roundRect(ctx, barX, barY, fillW, barH, 4);
        ctx.fill();
      }
      ty += lineH;

      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.fillStyle = "#a5d6a7";
      ctx.fillText("🏆 " + score + " 分", tx, ty);

      /* Expression-driven particles */
      spawnFaceParticles(bx, by, bw, bh, topExpr[0]);

      ctx.restore();
    });
  }

  /* Expression-driven particle effects */
  function spawnFaceParticles(bx, by, bw, bh, expr) {
    if (!cooled("face-particle-" + expr, 120)) {return;}
    for (let i = 0; i < 3; i++) {
      const p = {
        x: bx + Math.random() * bw, y: by - 5,
        vx: (Math.random() - 0.5) * 2, vy: -(1 + Math.random() * 2),
        radius: Math.random() * 3 + 2, life: 1, decay: 0.02,
        shape: "circle", friction: 0.98, gravity: -0.01,
      };
      switch (expr) {
        case "happy":     p.hue = 45;  p.shape = "star"; p.vy = -(2 + Math.random() * 2); break;
        case "angry":     p.hue = 5;   p.radius = Math.random() * 4 + 3; p.gravity = 0.03; break;
        case "sad":       p.hue = 210; p.vy = 1 + Math.random() * 2; p.y = by + bh + 5; p.gravity = 0.05; break;
        case "surprised": p.hue = 290; p.shape = "star"; p.vx = (Math.random() - 0.5) * 5; p.vy = (Math.random() - 0.5) * 5; p.gravity = 0; break;
        case "fearful":   p.hue = 185; p.radius = 2; p.decay = 0.03; break;
        case "disgusted": p.hue = 100; p.gravity = 0.04; break;
        default:          p.hue = 200; p.radius = 2; break;
      }
      particles.push(p);
    }
  }

  /* Lightweight face overlay for non-face modes */
  function drawFaceOverlay() {
    if (!lastFaceResults || lastFaceResults.length === 0) {return;}
    const cw = faceCW();
    ctx.save();
    lastFaceResults.forEach(function (res) {
      const box = res.detection.box;
      const bx = cw - box.x - box.width, by = box.y, bw = box.width, bh = box.height;
      ctx.strokeStyle = "rgba(0, 200, 255, 0.35)";
      ctx.lineWidth = 1;
      roundRect(ctx, bx, by, bw, bh, 4);
      ctx.stroke();
      const age = Math.round(res.age);
      const gender = res.gender === "male" ? "♂" : "♀";
      const topExpr = Object.entries(res.expressions).sort(function (a, b) { return b[1] - a[1]; })[0];
      const label = (EXPR_EMOJI[topExpr[0]] || "❓") + " " + gender + " " + age;
      ctx.font = "11px system-ui, sans-serif";
      const tw = ctx.measureText(label).width + 10;
      let ly = by - 18;
      if (ly < 2) {ly = by + bh + 4;}
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      roundRect(ctx, bx, ly, tw, 16, 3);
      ctx.fill();
      ctx.fillStyle = "rgba(0, 200, 255, 0.85)";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(label, bx + 5, ly + 2);
    });
    ctx.restore();
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
      hue: hue !== null && hue !== undefined ? hue + Math.random() * 30 : (190 + Math.random() * 40),
      shape: shape || "circle",
      friction: 0.98,
      gravity: 0.02,
    });
  }

  function explodeAt(x, y, count) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i + Math.random() * 0.3;
      const speed = 3 + Math.random() * 5;
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
    const count = 24;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i;
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
    const hue = Math.random() * 360;
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 6;
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
    const count = 20;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i;
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
    const cx = toX(lm[0]);
    const cy = toY(lm[9]);
    const count = 15;
    for (let i = 0; i < count; i++) {
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
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
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

      const alpha = p.life * 0.8;
      const r = p.radius * p.life;

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
    for (let i = 0; i < 5; i++) {
      const angle = (Math.PI * 2 / 5) * i - Math.PI / 2;
      const ox = x + Math.cos(angle) * r;
      const oy = y + Math.sin(angle) * r;
      if (i === 0) {ctx.moveTo(ox, oy);} else {ctx.lineTo(ox, oy);}
      const inner = angle + Math.PI / 5;
      ctx.lineTo(x + Math.cos(inner) * r * 0.4, y + Math.sin(inner) * r * 0.4);
    }
    ctx.closePath();
    ctx.fill();
  }

  /* ====================================================================
   * 11. Gesture-Mode Visual Effects
   * ==================================================================== */
  function drawHandSkeleton(lm, alpha) {
    const connections = [
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
    const t = performance.now() * 0.002;
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 5; i++) {
      const y = ch * 0.5 + Math.sin(t + i * 0.8) * ch * 0.25;
      const hue = (t * 50 + i * 60) % 360;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x < cw; x += 10) {
        const wave = Math.sin(x * 0.01 + t * 2 + i) * 20;
        ctx.lineTo(x, y + wave);
      }
      ctx.strokeStyle = "hsla(" + hue + ", 100%, 60%, 0.15)";
      ctx.lineWidth = 8;
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function drawLaser(lm) {
    const ix = toX(lm[8]), iy = toY(lm[8]);
    const mx = toX(lm[5]), my = toY(lm[5]);
    const angle = Math.atan2(iy - my, ix - mx);
    const len = 800;
    const ex = ix + Math.cos(angle) * len;
    const ey = iy + Math.sin(angle) * len;

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

  /* Glowing arcs at fingertip positions for number gestures */
  function drawNumberGlow(lm, indices, hue) {
    const t = performance.now() * 0.003;
    indices.forEach(function (idx, i) {
      const fx = toX(lm[idx]), fy = toY(lm[idx]);
      const r = 12 + Math.sin(t + i * 1.2) * 4;
      ctx.beginPath();
      ctx.arc(fx, fy, r, 0, Math.PI * 2);
      ctx.strokeStyle = "hsla(" + (hue + i * 30) + ", 100%, 65%, 0.7)";
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "hsla(" + (hue + i * 30) + ", 100%, 55%, 0.5)";
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
      /* number label */
      ctx.font = "bold 14px sans-serif";
      ctx.fillStyle = "hsla(" + (hue + i * 30) + ", 100%, 80%, 0.9)";
      ctx.textAlign = "center";
      ctx.fillText(String(i + 1), fx, fy - r - 5);
    });
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

  const GESTURE_NAMES = {
    open:       "✋ 张开手掌",
    fist:       "✊ 握拳",
    point:      "☝️ 数字一 / 指向",
    peace:      "✌️ 数字二 / 和平",
    ok:         "👌 OK",
    pinch:      "🤏 捏合",
    wave:       "👋 挥手",
    "thumbs-up": "👍 点赞",
    "number-3":  "3️⃣ 数字三",
    "number-4":  "4️⃣ 数字四",
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
    fruitList.length = 0;
    fruitHalves.length = 0;
    fruitJuice.length = 0;
    fruitBladeTrail.length = 0;
    fruitStartTime = 0;
    lastDetections = [];
    lastFaceResults = [];
    revealProgress = 0;
    prev3D = null;
    resetPremiumState();
    if ($face) {
      $face.textContent = "";
      $face.classList.remove("is-active");
    }
    const cw = drawCanvas.width / (window.devicePixelRatio || 1);
    const ch = drawCanvas.height / (window.devicePixelRatio || 1);
    drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    ctx.clearRect(0, 0, cw, ch);
  });

  /* Mode switch */
  document.addEventListener("click", function (e) {
    const btn = e.target.closest(".gesture-mode-btn");
    if (!btn) {return;}
    const m = btn.dataset.mode;
    if (!m || m === mode) {return;}
    const prevMode = mode;
    mode = m;
    document.querySelectorAll(".gesture-mode-btn").forEach(function (b) {
      b.classList.toggle("active", b.dataset.mode === m);
    });
    /* clear canvas on mode switch */
    particles.length = 0;
    prevDrawPoint = null;
    const cw = $canvas.width / (window.devicePixelRatio || 1);
    const ch = $canvas.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, cw, ch);
    if (mode !== "draw") {
      drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    }
    /* reset fruit game state on mode switch */
    fruitList.length = 0;
    fruitHalves.length = 0;
    fruitJuice.length = 0;
    fruitBladeTrail.length = 0;
    fruitStartTime = 0;
    /* reset detection state */
    lastDetections = [];
    lastDetectTime = 0;
    /* reset 3D state */
    revealProgress = 0;
    prev3D = null;
    resetPremiumState();
    /* lazy-load models when switching modes while running */
    if (m === "detect" && running && !objectDetector) {
      loadObjectDetector();
    } else if (m !== "detect" && running && !handLandmarker) {
      loadMediaPipe();
    }
    /* lazy-load face-api models when switching to face mode */
    if (m === "face" && running && !faceModelsLoaded) {
      loadFaceApi();
    }
    /* 3D mode lifecycle */
    if (m === "3d" && running) {
      loadThree().then(initThreeScene);
    }
    if (prevMode === "3d" && m !== "3d") {
      cleanupThreeScene();
    }
  });

  if ($haptics) {
    $haptics.addEventListener("change", function () {
      premiumHaptics = $haptics.checked;
      if (premiumHaptics) {
        premiumFeedback("toggle");
      }
    });
  }

  if ($sound) {
    $sound.addEventListener("change", function () {
      premiumSound = $sound.checked;
      if (premiumSound) {
        premiumFeedback("toggle");
      }
    });
  }

  /* Responsive canvas resize */
  window.addEventListener("resize", function () {
    if (running) {resizeCanvas();}
  });

  /* Stop camera when navigating away */
  window.addEventListener("beforeunload", stopCamera);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden && running) {
      /* pause detection but keep stream alive */
    }
  });

  /* Tab-switch detection: release camera when gesture panel is hidden */
  const observer = new MutationObserver(function () {
    const panel = document.querySelector('[data-tool-panel="gesture"]');
    if (panel && panel.hidden && running) {
      stopCamera();
    }
  });
  const gesturePanel = document.querySelector('[data-tool-panel="gesture"]');
  if (gesturePanel) {
    observer.observe(gesturePanel, { attributes: true, attributeFilter: ["hidden"] });
  }

  /* Sub-mode button click (point cloud ↔ mesh) */
  document.addEventListener("click", function (e) {
    const btn = e.target.closest(".gesture-submode-btn");
    if (!btn) {return;}
    const sm = btn.dataset.submode;
    if (!sm || sm === subMode) {return;}
    if (sm === "mesh") {switchToMesh();} else {switchToPointCloud();}
    updateSubModeButtons();
  });

})();
