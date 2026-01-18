(() => {
  const state = {
    mode: "",
    filter: "orig",
    photoboothPhotos: [],
    currentStripUrl: "",
    finalDownloadUrl: "",
    isCapturing: false,
    canvasFilterSupported: true
  };

  const els = {
    homeView: document.getElementById("homeView"),
    cameraView: document.getElementById("cameraView"),
    printView: document.getElementById("printView"),
    editView: document.getElementById("editView"),

    boothHotspot: document.getElementById("boothHotspot"),
    boothHotspotImg: document.getElementById("boothHotspotImg"),
    modePopup: document.getElementById("modePopup"),
    closeModePopup: document.getElementById("closeModePopup"),
    modeChoiceBtns: Array.from(document.querySelectorAll(".mode_choice_btn")),

    video: document.getElementById("video"),
    captureCanvas: document.getElementById("captureCanvas"),

    liveFilterOverlay: document.getElementById("liveFilterOverlay"),
    countdownOverlay: document.getElementById("countdownOverlay"),
    flashOverlay: document.getElementById("flashOverlay"),
    hintText: document.getElementById("hintText"),

    filterOrigBtn: document.getElementById("filterOrigBtn"),
    filterBwBtn: document.getElementById("filterBwBtn"),
    filterRioBtn: document.getElementById("filterRioBtn"),

    captureBtn: document.getElementById("captureBtn"),
    backBtn: document.getElementById("backBtn"),

    photoboothPreview: document.getElementById("photoboothPreview"),
    continueBtn: document.getElementById("continueBtn"),

    stripDropImg: document.getElementById("stripDropImg"),

    downloadBtn: document.getElementById("downloadBtn"),
    retakeBtn: document.getElementById("retakeBtn"),
    printHomeBtn: document.getElementById("printHomeBtn"),

    resultTitle: document.getElementById("resultTitle"),
    resultImage: document.getElementById("resultImage"),
    editDownloadBtn: document.getElementById("editDownloadBtn"),
    editRetakeBtn: document.getElementById("editRetakeBtn"),
    editHomeBtn: document.getElementById("editHomeBtn")
  };

  let mediaStream = null;

  function showView(name) {
    els.homeView.style.display = name === "home" ? "block" : "none";
    els.cameraView.style.display = name === "camera" ? "flex" : "none";
    els.printView.style.display = name === "print" ? "flex" : "none";
    els.editView.style.display = name === "edit" ? "flex" : "none";
  }

  function openModePopup() {
    els.modePopup.classList.add("open");
    els.modePopup.setAttribute("aria-hidden", "false");
  }

  function closeModePopup() {
    els.modePopup.classList.remove("open");
    els.modePopup.setAttribute("aria-hidden", "true");
  }

  async function startCamera() {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      els.video.srcObject = mediaStream;

      await new Promise((resolve) => {
        if (els.video.readyState >= 2) return resolve();
        els.video.onloadedmetadata = () => resolve();
      });
    } catch (e) {
      console.error("Camera error:", e);
      alert("Camera access denied. Please allow camera permissions.");
    }
  }

  function stopCamera() {
    if (!mediaStream) return;
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
    els.video.srcObject = null;
  }

  function setFilter(filterName) {
    state.filter = filterName;

    els.filterOrigBtn.classList.toggle("active", filterName === "orig");
    els.filterBwBtn.classList.toggle("active", filterName === "bw");
    els.filterRioBtn.classList.toggle("active", filterName === "rio");

    els.liveFilterOverlay.classList.remove("filter_orig", "filter_bw", "filter_rio");
    if (filterName === "orig") els.liveFilterOverlay.classList.add("filter_orig");
    if (filterName === "bw") els.liveFilterOverlay.classList.add("filter_bw");
    if (filterName === "rio") els.liveFilterOverlay.classList.add("filter_rio");
  }

  function detectCanvasFilterSupport() {
    try {
      const src = document.createElement("canvas");
      src.width = 2;
      src.height = 2;
      const sctx = src.getContext("2d");
      sctx.fillStyle = "rgb(255,0,0)";
      sctx.fillRect(0, 0, 2, 2);

      const dst = document.createElement("canvas");
      dst.width = 2;
      dst.height = 2;
      const dctx = dst.getContext("2d");
      dctx.filter = "grayscale(1)";
      dctx.drawImage(src, 0, 0);

      const px = dctx.getImageData(0, 0, 1, 1).data;
      const r = px[0], g = px[1], b = px[2];

      return (r === g && g === b);
    } catch (e) {
      return false;
    }
  }

  function clamp255(x) {
    return x < 0 ? 0 : x > 255 ? 255 : x;
  }

  function applyBWManual(ctx, w, h) {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;

    const contrast = 1.45;
    const brightness = 3;

    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];

      let v = 0.299 * r + 0.587 * g + 0.114 * b;

      v = (v - 128) * contrast + 128 + brightness;
      v = clamp255(v);

      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
    }

    ctx.putImageData(img, 0, 0);
  }

  function applyRioManual(ctx, w, h) {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;

    const saturation = 1.55;
    const contrast = 1.18;
    const brightness = 6;

    for (let i = 0; i < d.length; i += 4) {
      let r = d[i];
      let g = d[i + 1];
      let b = d[i + 2];

      const gray = 0.299 * r + 0.587 * g + 0.114 * b;

      r = gray + (r - gray) * saturation;
      g = gray + (g - gray) * saturation;
      b = gray + (b - gray) * saturation;

      r = (r - 128) * contrast + 128 + brightness;
      g = (g - 128) * contrast + 128 + brightness;
      b = (b - 128) * contrast + 128 + brightness;

      r += 6;
      b -= 4;

      d[i] = clamp255(r);
      d[i + 1] = clamp255(g);
      d[i + 2] = clamp255(b);
    }

    ctx.putImageData(img, 0, 0);
  }

  function applyRioOverlay(ctx, w, h) {
    ctx.save();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "rgba(84, 65, 165, 0.40)");
    grad.addColorStop(0.45, "rgba(190, 60, 162, 0.26)");
    grad.addColorStop(1, "rgba(255, 150, 60, 0.32)");
    ctx.globalCompositeOperation = "soft-light";
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
  }

  function applyVignette(ctx, w, h, strength) {
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    const inner = Math.min(w, h) * 0.30;
    const outer = Math.max(w, h) * 0.95;
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.45, inner, w * 0.5, h * 0.45, outer);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, `rgba(0,0,0,${strength})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  function applyGrain(ctx, w, h, alpha) {
    const size = 120;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const cctx = c.getContext("2d");
    const imgData = cctx.createImageData(size, size);

    for (let i = 0; i < imgData.data.length; i += 4) {
      const v = Math.floor(Math.random() * 255);
      imgData.data[i] = v;
      imgData.data[i + 1] = v;
      imgData.data[i + 2] = v;
      imgData.data[i + 3] = 22;
    }
    cctx.putImageData(imgData, 0, 0);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(c, 0, 0, w, h);
    ctx.restore();
  }

  function computeCrop(srcW, srcH, dstW, dstH) {
    const srcAspect = srcW / srcH;
    const dstAspect = dstW / dstH;

    let sx = 0;
    let sy = 0;
    let sw = srcW;
    let sh = srcH;

    if (srcAspect > dstAspect) {
      sw = srcH * dstAspect;
      sx = (srcW - sw) / 2;
    } else {
      sh = srcW / dstAspect;
      sy = (srcH - sh) / 2;
    }

    return { sx, sy, sw, sh };
  }

  async function captureFilteredFramePortrait() {
    const video = els.video;
    const canvas = els.captureCanvas;
    const ctx = canvas.getContext("2d");

    const srcW = video.videoWidth;
    const srcH = video.videoHeight;

    const outW = 900;
    const outH = 1200;

    canvas.width = outW;
    canvas.height = outH;

    const crop = computeCrop(srcW, srcH, 3, 4);

    ctx.save();
    ctx.translate(outW, 0);
    ctx.scale(-1, 1);

    ctx.drawImage(
      video,
      crop.sx,
      crop.sy,
      crop.sw,
      crop.sh,
      0,
      0,
      outW,
      outH
    );
    ctx.restore();

    if (state.filter === "bw") {
      if (state.canvasFilterSupported) {
        ctx.clearRect(0, 0, outW, outH);

        ctx.save();
        ctx.translate(outW, 0);
        ctx.scale(-1, 1);

        ctx.filter = "grayscale(1) contrast(1.45) brightness(1.03)";
        ctx.drawImage(
          video,
          crop.sx,
          crop.sy,
          crop.sw,
          crop.sh,
          0,
          0,
          outW,
          outH
        );
        ctx.filter = "none";
        ctx.restore();
      } else {
        applyBWManual(ctx, outW, outH);
      }

      applyVignette(ctx, outW, outH, 0.28);
    }

    if (state.filter === "rio") {
      if (state.canvasFilterSupported) {
        ctx.clearRect(0, 0, outW, outH);

        ctx.save();
        ctx.translate(outW, 0);
        ctx.scale(-1, 1);

        ctx.filter = "saturate(1.7) contrast(1.18) brightness(1.1)";
        ctx.drawImage(
          video,
          crop.sx,
          crop.sy,
          crop.sw,
          crop.sh,
          0,
          0,
          outW,
          outH
        );
        ctx.filter = "none";
        ctx.restore();
      } else {
        applyRioManual(ctx, outW, outH);
      }

      applyRioOverlay(ctx, outW, outH);
      applyVignette(ctx, outW, outH, 0.22);
      applyGrain(ctx, outW, outH, 0.05);
    }

    return canvas.toDataURL("image/png");
  }

  async function captureWithCountdown() {
    els.countdownOverlay.style.display = "flex";
    for (let n = 3; n >= 1; n -= 1) {
      els.countdownOverlay.textContent = String(n);
      await sleep(1000);
    }
    els.countdownOverlay.textContent = "";
    els.countdownOverlay.style.display = "none";

    if (state.mode === "photobooth") {
      await triggerFlash();
    }

    return captureFilteredFramePortrait();
  }

  function resetPhotoboothUI() {
    els.photoboothPreview.innerHTML = "";
    els.continueBtn.style.display = "none";
    els.photoboothPreview.style.display = "none";
  }

  function renderPhotoboothThumbs() {
    els.photoboothPreview.innerHTML = "";
    state.photoboothPhotos.forEach((src, idx) => {
      const wrap = document.createElement("div");
      wrap.className = "photo_thumb_wrap";

      const img = document.createElement("img");
      img.className = "photo_thumb";
      img.src = src;
      img.alt = `Photo ${idx + 1}`;

      const retakeBtn = document.createElement("button");
      retakeBtn.className = "retake_small_btn";
      retakeBtn.textContent = "x";
      retakeBtn.title = "Retake";
      retakeBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await retakePhotoboothAtIndex(idx);
      });

      wrap.appendChild(img);
      wrap.appendChild(retakeBtn);
      els.photoboothPreview.appendChild(wrap);
    });
  }

  async function retakePhotoboothAtIndex(index) {
    if (state.isCapturing) return;
    state.isCapturing = true;

    try {
      const photoUrl = await captureWithCountdown();
      state.photoboothPhotos[index] = photoUrl;
      renderPhotoboothThumbs();
      state.currentStripUrl = await buildPhotoboothStripBlack(state.photoboothPhotos);
      state.finalDownloadUrl = state.currentStripUrl;
    } finally {
      state.isCapturing = false;
    }
  }

  async function buildPhotoboothStripBlack(photos) {
    const imgs = await Promise.all(photos.map(loadImage));

    const stripW = 780;
    const outer = 18;
    const divider = 26;

    const tileW = stripW - outer * 2;
    const tileH = Math.round(tileW * (4 / 3));

    const stripH = outer * 2 + tileH * 4 + divider * 3;

    const canvas = document.createElement("canvas");
    canvas.width = stripW;
    canvas.height = stripH;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#0b0b0b";
    ctx.fillRect(0, 0, stripW, stripH);

    imgs.forEach((im, i) => {
      const x = outer;
      const y = outer + i * (tileH + divider);

      ctx.fillStyle = "#0b0b0b";
      ctx.fillRect(x, y, tileW, tileH);

      const crop = computeCrop(im.width, im.height, 3, 4);

      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(x + 4, y + 4, tileW - 8, tileH - 8);
      ctx.restore();

      ctx.drawImage(im, crop.sx, crop.sy, crop.sw, crop.sh, x + 8, y + 8, tileW - 16, tileH - 16);

      ctx.strokeStyle = "rgba(0,0,0,0.9)";
      ctx.lineWidth = 10;
      ctx.strokeRect(x + 3, y + 3, tileW - 6, tileH - 6);

      if (i < 3) {
        ctx.fillStyle = "#0b0b0b";
        ctx.fillRect(outer, y + tileH, tileW, divider);
      }
    });

    ctx.strokeStyle = "rgba(0,0,0,1)";
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, stripW - 14, stripH - 14);

    return canvas.toDataURL("image/png");
  }

  function playStripDropAnimation(stripUrl) {
    els.stripDropImg.classList.remove("drop_active");
    els.stripDropImg.src = stripUrl;
    void els.stripDropImg.offsetWidth;
    els.stripDropImg.classList.add("drop_active");
  }

  async function takePhotobooth() {
    if (state.isCapturing) return;
    state.isCapturing = true;

    try {
      state.photoboothPhotos = [];
      state.currentStripUrl = "";
      state.finalDownloadUrl = "";

      resetPhotoboothUI();
      els.photoboothPreview.style.display = "flex";
      els.hintText.textContent = "Photobooth will take 4 photos";

      for (let i = 0; i < 4; i += 1) {
        const photoUrl = await captureWithCountdown();
        state.photoboothPhotos.push(photoUrl);
        renderPhotoboothThumbs();
        await sleep(220);
      }

      state.currentStripUrl = await buildPhotoboothStripBlack(state.photoboothPhotos);
      state.finalDownloadUrl = state.currentStripUrl;

      els.hintText.textContent = "Tap continue";
      els.continueBtn.style.display = "inline-block";
    } finally {
      state.isCapturing = false;
    }
  }

  function openPhotoboothPrintPage() {
    if (!state.currentStripUrl) return;

    stopCamera();
    showView("print");

    playStripDropAnimation(state.currentStripUrl);
  }

  async function takePolaroid() {
    if (state.isCapturing) return;
    state.isCapturing = true;

    try {
      els.hintText.textContent = "Choose a filter, then tap take picture";
      const photoUrl = await captureWithCountdown();

      stopCamera();
      showView("edit");

      els.resultTitle.textContent = "Developing...";
      els.resultImage.src = "";

      const previewUrl = await animatePolaroidDevelop(photoUrl, { width: 600, height: 750, durationMs: 2200 });
      els.resultImage.src = previewUrl;

      const finalUrl = await buildPolaroidFinal(photoUrl, { width: 900, height: 1125 });
      state.finalDownloadUrl = finalUrl;

      els.resultTitle.textContent = "Your polaroid";
    } finally {
      state.isCapturing = false;
    }
  }

  async function buildPolaroidFinal(photoUrl, size) {
    const srcImg = await loadImage(photoUrl);

    const polaroidW = size.width;
    const polaroidH = size.height;
    const photoAreaW = polaroidW - 72;
    const photoAreaH = polaroidH - 210;

    const canvas = document.createElement("canvas");
    canvas.width = polaroidW;
    canvas.height = polaroidH;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#f8f8f8";
    ctx.fillRect(0, 0, polaroidW, polaroidH);

    const crop = computeCrop(srcImg.width, srcImg.height, photoAreaW, photoAreaH);

    ctx.drawImage(srcImg, crop.sx, crop.sy, crop.sw, crop.sh, 36, 28, photoAreaW, photoAreaH);

    ctx.fillStyle = "#f8f8f8";
    ctx.fillRect(0, polaroidH - 160, polaroidW, 160);

    ctx.strokeStyle = "#e0e0e0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(60, polaroidH - 122);
    ctx.lineTo(polaroidW - 60, polaroidH - 122);
    ctx.stroke();

    ctx.fillStyle = "#888";
    ctx.font = "italic 26px Helvetica";
    ctx.textAlign = "left";
    ctx.fillText("POLAROID", 72, polaroidH - 78);

    const date = new Date();
    ctx.font = "22px Helvetica";
    ctx.fillText(date.toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase(), 72, polaroidH - 40);

    return canvas.toDataURL("image/png");
  }

  async function animatePolaroidDevelop(photoUrl, opts) {
    const srcImg = await loadImage(photoUrl);

    const polaroidW = opts.width;
    const polaroidH = opts.height;
    const photoAreaW = polaroidW - 48;
    const photoAreaH = polaroidH - 140;

    const canvas = document.createElement("canvas");
    canvas.width = polaroidW;
    canvas.height = polaroidH;
    const ctx = canvas.getContext("2d");

    const crop = computeCrop(srcImg.width, srcImg.height, photoAreaW, photoAreaH);

    const start = performance.now();
    const duration = opts.durationMs;

    return await new Promise((resolve) => {
      const tick = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = easeInOutCubic(t);

        ctx.clearRect(0, 0, polaroidW, polaroidH);

        ctx.fillStyle = "#f8f8f8";
        ctx.fillRect(0, 0, polaroidW, polaroidH);

        ctx.save();
        ctx.globalAlpha = Math.max(0.05, eased);
        ctx.drawImage(srcImg, crop.sx, crop.sy, crop.sw, crop.sh, 24, 18, photoAreaW, photoAreaH);
        ctx.restore();

        ctx.fillStyle = "#f8f8f8";
        ctx.fillRect(0, polaroidH - 110, polaroidW, 110);

        ctx.strokeStyle = "#e0e0e0";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(40, polaroidH - 86);
        ctx.lineTo(polaroidW - 40, polaroidH - 86);
        ctx.stroke();

        ctx.fillStyle = "#888";
        ctx.font = "italic 18px Helvetica";
        ctx.textAlign = "left";
        ctx.fillText("POLAROID", 46, polaroidH - 55);

        const date = new Date();
        ctx.font = "15px Helvetica";
        ctx.fillText(date.toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase(), 46, polaroidH - 30);

        els.resultImage.src = canvas.toDataURL("image/png");

        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          resolve(canvas.toDataURL("image/png"));
        }
      };

      requestAnimationFrame(tick);
    });
  }

  function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }

  function downloadCurrent() {
    if (!state.finalDownloadUrl) return;
    const a = document.createElement("a");
    a.href = state.finalDownloadUrl;
    a.download = state.mode === "photobooth" ? "photobooth_strip.png" : "polaroid.png";
    a.click();
  }

  async function goToMode(modeName) {
    state.mode = modeName;

    showView("camera");
    resetPhotoboothUI();

    stopCamera();
    await startCamera();

    setFilter(state.filter);

    if (modeName === "photobooth") {
      els.photoboothPreview.style.display = "flex";
      els.hintText.textContent = "Photobooth will take 4 photos";
    } else {
      els.photoboothPreview.style.display = "none";
      els.hintText.textContent = "Choose a filter, then tap take picture";
    }
  }

  function goHome() {
    stopCamera();
    showView("home");
    closeModePopup();

    state.mode = "";
    state.photoboothPhotos = [];
    state.currentStripUrl = "";
    state.finalDownloadUrl = "";
    state.isCapturing = false;

    resetPhotoboothUI();
    els.resultImage.src = "";
  }

  function retake() {
    if (state.mode === "photobooth") {
      showView("camera");
      resetPhotoboothUI();
      state.photoboothPhotos = [];
      state.currentStripUrl = "";
      state.finalDownloadUrl = "";
      state.isCapturing = false;

      startCamera();
      setFilter(state.filter);

      els.photoboothPreview.style.display = "flex";
      els.hintText.textContent = "Photobooth will take 4 photos";
      return;
    }

    showView("camera");
    state.finalDownloadUrl = "";
    state.isCapturing = false;

    startCamera();
    setFilter(state.filter);

    els.hintText.textContent = "Choose a filter, then tap take picture";
  }

  function handleCaptureClick() {
    if (!state.mode) return;
    if (state.mode === "photobooth") return takePhotobooth();
    if (state.mode === "polaroid") return takePolaroid();
  }

  function loadImage(src) {
    return new Promise((resolve) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.src = src;
    });
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function triggerFlash() {
    if (!els.flashOverlay) return;

    els.flashOverlay.classList.remove("flash_active");
    void els.flashOverlay.offsetWidth;
    els.flashOverlay.classList.add("flash_active");

    await sleep(170);
    els.flashOverlay.classList.remove("flash_active");
  }

  function init() {
    showView("home");
    setFilter("orig");

    state.canvasFilterSupported = detectCanvasFilterSupport();
    console.log("Canvas filter supported:", state.canvasFilterSupported);

    els.boothHotspot.addEventListener("click", () => openModePopup());

    els.boothHotspot.addEventListener("mouseenter", () => {
      if (els.boothHotspotImg) {
        els.boothHotspotImg.src = "images/home2.png";
      }
    });

    els.boothHotspot.addEventListener("mouseleave", () => {
      if (els.boothHotspotImg) {
        els.boothHotspotImg.src = "images/home.png";
      }
    });

    els.closeModePopup.addEventListener("click", () => closeModePopup());
    els.modePopup.addEventListener("click", (e) => {
      if (e.target === els.modePopup) closeModePopup();
    });

    els.modeChoiceBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.getAttribute("data-mode");
        closeModePopup();
        goToMode(mode);
      });
    });

    els.filterOrigBtn.addEventListener("click", () => setFilter("orig"));
    els.filterBwBtn.addEventListener("click", () => setFilter("bw"));
    els.filterRioBtn.addEventListener("click", () => setFilter("rio"));

    els.captureBtn.addEventListener("click", handleCaptureClick);
    els.backBtn.addEventListener("click", goHome);

    els.continueBtn.addEventListener("click", openPhotoboothPrintPage);

    els.downloadBtn.addEventListener("click", () => {
      state.mode = "photobooth";
      downloadCurrent();
    });
    els.retakeBtn.addEventListener("click", retake);
    els.printHomeBtn.addEventListener("click", goHome);

    els.editDownloadBtn.addEventListener("click", () => {
      state.mode = "polaroid";
      downloadCurrent();
    });
    els.editRetakeBtn.addEventListener("click", retake);
    els.editHomeBtn.addEventListener("click", goHome);
  }

  init();
})();
