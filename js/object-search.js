/* =====  Object Recognition & Photo Search Tool  ===== */
(function () {
  

  /* ---- DOM refs ---- */
  const $start    = document.getElementById("obj-start");
  const $stop     = document.getElementById("obj-stop");
  const $video    = document.getElementById("obj-video");
  const $canvas   = document.getElementById("obj-canvas");
  const $overlay  = document.getElementById("obj-overlay");
  const $status   = document.getElementById("obj-status");
  const $label    = document.getElementById("obj-label");
  const $fps      = document.getElementById("obj-fps");
  const $capture  = document.getElementById("obj-capture");
  const $result   = document.getElementById("obj-result");
  const $photo    = document.getElementById("obj-photo");
  const $resLabel = document.getElementById("obj-result-label");
  const $resConf  = document.getElementById("obj-result-confidence");
  const $searchText = document.getElementById("obj-search-text");
  const $searchLens = document.getElementById("obj-search-lens");
  const $recapture  = document.getElementById("obj-recapture");

  if (!$canvas) {return;}

  const ctx = $canvas.getContext("2d");

  /* ====================================================================
   * 0. State
   * ==================================================================== */
  let objectDetector = null;
  let cameraStream   = null;
  let running        = false;
  let detections     = [];
  let topDetection   = null;
  let capturedPhoto  = null;

  /* FPS counter */
  let frameCount = 0;
  let fpsTimer   = performance.now();

  /* ====================================================================
   * 1. Constants
   * ==================================================================== */
  const VISION_CDN =
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs";
  const WASM_BASE =
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm";
  const MODEL_URL =
    "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/latest/efficientdet_lite0.tflite";

  /* COCO 80-class label → Chinese */
  const LABEL_ZH = {
    "person": "人", "bicycle": "自行车", "car": "汽车", "motorcycle": "摩托车",
    "airplane": "飞机", "bus": "公共汽车", "train": "火车", "truck": "卡车",
    "boat": "船", "traffic light": "交通灯", "fire hydrant": "消防栓",
    "stop sign": "停车标志", "parking meter": "停车计时器", "bench": "长椅",
    "bird": "鸟", "cat": "猫", "dog": "狗", "horse": "马", "sheep": "羊",
    "cow": "牛", "elephant": "大象", "bear": "熊", "zebra": "斑马",
    "giraffe": "长颈鹿", "backpack": "背包", "umbrella": "雨伞",
    "handbag": "手提包", "tie": "领带", "suitcase": "手提箱",
    "frisbee": "飞盘", "skis": "滑雪板", "snowboard": "滑雪单板",
    "sports ball": "运动球", "kite": "风筝", "baseball bat": "棒球棒",
    "baseball glove": "棒球手套", "skateboard": "滑板", "surfboard": "冲浪板",
    "tennis racket": "网球拍", "bottle": "瓶子", "wine glass": "酒杯",
    "cup": "杯子", "fork": "叉子", "knife": "刀", "spoon": "勺子",
    "bowl": "碗", "banana": "香蕉", "apple": "苹果", "sandwich": "三明治",
    "orange": "橙子", "broccoli": "西兰花", "carrot": "胡萝卜",
    "hot dog": "热狗", "pizza": "披萨", "donut": "甜甜圈", "cake": "蛋糕",
    "chair": "椅子", "couch": "沙发", "potted plant": "盆栽", "bed": "床",
    "dining table": "餐桌", "toilet": "马桶", "tv": "电视",
    "laptop": "笔记本电脑", "mouse": "鼠标", "remote": "遥控器",
    "keyboard": "键盘", "cell phone": "手机", "microwave": "微波炉",
    "oven": "烤箱", "toaster": "烤面包机", "sink": "水槽",
    "refrigerator": "冰箱", "book": "书", "clock": "时钟", "vase": "花瓶",
    "scissors": "剪刀", "teddy bear": "泰迪熊", "hair drier": "吹风机",
    "toothbrush": "牙刷"
  };

  /* ====================================================================
   * 2. MediaPipe Object Detector Loader
   * ==================================================================== */
  async function loadModel() {
    if (objectDetector) {return true;}
    setStatus("loading", "加载模型…");
    try {
      const mod = await import(/* webpackIgnore: true */ VISION_CDN);
      const fileset = await mod.FilesetResolver.forVisionTasks(WASM_BASE);
      objectDetector = await mod.ObjectDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        maxResults: 5,
        scoreThreshold: 0.45,
      });
      setStatus("ready", "模型已加载");
      return true;
    } catch (e) {
      setStatus("error", "模型加载失败");
      console.error("[object-search]", e);
      return false;
    }
  }

  /* ====================================================================
   * 3. Camera Manager
   * ==================================================================== */
  function describeCameraError(error) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return "当前浏览器不支持摄像头，或页面不是 HTTPS/localhost";
    }
    if (!window.isSecureContext) {
      return "请使用 HTTPS 或 localhost 打开页面后再启用摄像头";
    }
    switch (error && error.name) {
      case "NotAllowedError":
      case "SecurityError":
        return "摄像头权限被拒绝，请在地址栏允许摄像头后刷新页面";
      case "NotFoundError":
      case "DevicesNotFoundError":
        return "未找到可用摄像头，请连接设备或检查系统隐私设置";
      case "NotReadableError":
      case "TrackStartError":
        return "摄像头被占用或被系统阻止，请关闭其他占用摄像头的应用";
      case "OverconstrainedError":
      case "ConstraintNotSatisfiedError":
        return "当前摄像头不支持请求参数，请切换摄像头或降低分辨率";
      default:
        return "摄像头启动失败，请检查浏览器权限和系统摄像头设置";
    }
  }

  async function requestCamera(preferredVideo) {
    try {
      return await navigator.mediaDevices.getUserMedia({ video: preferredVideo });
    } catch (error) {
      if (error && (error.name === "OverconstrainedError" || error.name === "ConstraintNotSatisfiedError")) {
        return navigator.mediaDevices.getUserMedia({ video: true });
      }
      throw error;
    }
  }

  async function startCamera() {
    if (!(await loadModel())) {return;}
    try {
      cameraStream = await requestCamera({ facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } });
    } catch (e) {
      setStatus("error", describeCameraError(e));
      console.error("[object-search] camera start failed", e);
      return;
    }
    $video.srcObject = cameraStream;
    await $video.play();
    resizeCanvas();
    $overlay.classList.add("is-hidden");
    $start.disabled  = true;
    $stop.disabled   = false;
    $capture.disabled = false;
    $result.hidden   = true;
    capturedPhoto    = null;
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
    $start.disabled  = false;
    $stop.disabled   = true;
    $capture.disabled = true;
    $overlay.classList.remove("is-hidden");
    setStatus("ready", "就绪");
    $label.textContent = "";
    $fps.textContent   = "";
    detections   = [];
    topDetection = null;
  }

  function resizeCanvas() {
    const rect = $canvas.parentElement.getBoundingClientRect();
    const w = Math.floor(rect.width);
    const h = Math.floor(rect.height);
    const dpr = window.devicePixelRatio || 1;
    if ($canvas.width !== w * dpr || $canvas.height !== h * dpr) {
      $canvas.width  = w * dpr;
      $canvas.height = h * dpr;
    }
    $canvas.style.width  = w + "px";
    $canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ====================================================================
   * 4. Detection Loop
   * ==================================================================== */
  function loop() {
    if (!running) {return;}
    if (!document.hidden && $video.readyState >= 2) {
      const result = objectDetector.detectForVideo($video, performance.now());
      handleResults(result);
      updateFPS();
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
   * 5. Results Handler – draw bounding boxes
   * ==================================================================== */
  function handleResults(result) {
    const cw = $canvas.width / (window.devicePixelRatio || 1);
    const ch = $canvas.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, cw, ch);

    detections = result.detections || [];
    if (!detections.length) {
      setLabel("未检测到物体");
      topDetection = null;
      return;
    }

    topDetection = detections[0];

    /* scale: MediaPipe coords are relative to video natural size */
    const scaleX = cw / $video.videoWidth;
    const scaleY = ch / $video.videoHeight;

    detections.forEach(function (det) {
      const bb = det.boundingBox;
      const cat  = det.categories[0];
      const name = cat.categoryName;
      const score = (cat.score * 100).toFixed(1);
      const labelText = (LABEL_ZH[name] || name) + " " + score + "%";

      const x = bb.originX * scaleX;
      const y = bb.originY * scaleY;
      const w = bb.width   * scaleX;
      const h = bb.height  * scaleY;

      /* bounding box */
      ctx.strokeStyle = "rgba(0, 200, 255, 0.85)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);

      /* label background */
      ctx.font = "bold 13px sans-serif";
      const tw = ctx.measureText(labelText).width;
      ctx.fillStyle = "rgba(0, 160, 220, 0.75)";
      ctx.fillRect(x, y > 22 ? y - 22 : y, tw + 10, 20);

      /* label text */
      ctx.fillStyle = "#fff";
      ctx.fillText(labelText, x + 5, y > 22 ? y - 6 : y + 14);
    });

    /* update badge */
    const topCat = topDetection.categories[0];
    const topZh  = LABEL_ZH[topCat.categoryName] || topCat.categoryName;
    setLabel(topZh + " (" + (topCat.score * 100).toFixed(1) + "%)");
  }

  /* ====================================================================
   * 6. Photo Capture
   * ==================================================================== */
  function capturePhoto() {
    if (!running || $video.readyState < 2) {return;}

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width  = $video.videoWidth;
    tempCanvas.height = $video.videoHeight;
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.drawImage($video, 0, 0);

    capturedPhoto = tempCanvas.toDataURL("image/jpeg", 0.9);
    $photo.src = capturedPhoto;
    $result.hidden = false;

    if (topDetection) {
      const cat  = topDetection.categories[0];
      const name = cat.categoryName;
      $resLabel.textContent = (LABEL_ZH[name] || name);
      $resConf.textContent  = (cat.score * 100).toFixed(1) + "%";
    } else {
      $resLabel.textContent = "未识别到物体";
      $resConf.textContent  = "";
    }

    stopCamera();
  }

  /* ====================================================================
   * 7. Search Actions
   * ==================================================================== */
  function searchText() {
    let query = "";
    if (topDetection) {
      const name = topDetection.categories[0].categoryName;
      query = LABEL_ZH[name] || name;
    } else if ($resLabel.textContent && $resLabel.textContent !== "未识别到物体") {
      query = $resLabel.textContent;
    }
    if (!query) {return;}
    window.open("https://www.google.com/search?q=" + encodeURIComponent(query), "_blank");
  }

  function searchLens() {
    if (!capturedPhoto) {return;}
    /* Convert data URL to Blob and copy to clipboard so user can paste into Lens */
    try {
      const base64 = capturedPhoto.split(",")[1];
      const byteChars = atob(base64);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteArray[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([byteArray], { type: "image/jpeg" });
      if (navigator.clipboard && navigator.clipboard.write) {
        const item = new ClipboardItem({ "image/jpeg": blob });
        navigator.clipboard.write([item]).then(function () {
          window.open("https://lens.google.com/", "_blank");
        }, function () {
          window.open("https://lens.google.com/", "_blank");
        });
      } else {
        window.open("https://lens.google.com/", "_blank");
      }
    } catch (e) {
      window.open("https://lens.google.com/", "_blank");
    }
  }

  /* ====================================================================
   * 8. UI Helpers
   * ==================================================================== */
  function setStatus(type, text) {
    $status.textContent = text;
    $status.className = "gesture-badge" + (type === "running" ? " is-active" : "");
  }

  function setLabel(text) {
    $label.textContent = text;
  }

  /* ====================================================================
   * 9. Event Bindings
   * ==================================================================== */
  $start.addEventListener("click", startCamera);
  $stop.addEventListener("click", stopCamera);
  $capture.addEventListener("click", capturePhoto);
  $searchText.addEventListener("click", searchText);
  $searchLens.addEventListener("click", searchLens);
  $recapture.addEventListener("click", function () {
    $result.hidden = true;
    startCamera();
  });

  /* Responsive canvas resize */
  window.addEventListener("resize", function () {
    if (running) {resizeCanvas();}
  });

  /* Stop camera when navigating away */
  window.addEventListener("beforeunload", stopCamera);

  /* Tab-switch detection: release camera when panel is hidden */
  const observer = new MutationObserver(function () {
    const panel = document.querySelector('[data-tool-panel="objectsearch"]');
    if (panel && panel.hidden && running) {
      stopCamera();
    }
  });
  const objectPanel = document.querySelector('[data-tool-panel="objectsearch"]');
  if (objectPanel) {
    observer.observe(objectPanel, { attributes: true, attributeFilter: ["hidden"] });
  }

})();
