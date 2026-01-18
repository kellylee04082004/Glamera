// script.js
(() => {
    const state = {
      mode: "",
      filter: "orig",
      photoboothPhotos: [],
      currentStripUrl: "",
      finalDownloadUrl: "",
      isCapturing: false,
  
      aiEffect: "none" // "none" | "dog" | "spotty"
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
  
      // USE YOUR EXISTING HTML EFFECT BUTTONS (NO MORE INJECTED PANEL)
      effectNoneBtn: document.getElementById("effectNoneBtn"),
      effectDogBtn: document.getElementById("effectDogBtn"),
      effectSpottyBtn: document.getElementById("effectSpottyBtn"),
      effectPanel: document.querySelector(".effect_panel"),
  
      // USE YOUR EXISTING HTML CANVAS
      fxCanvas: document.getElementById("fxCanvas"),
  
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
  
    /* =======================
       SOUND EFFECTS
    ======================= */
    const sfx = {
      camera: new Audio("sounds/camera.mp3"),
      slide: new Audio("sounds/slide.mp3")
    };
  
    sfx.camera.preload = "auto";
    sfx.slide.preload = "auto";
    sfx.camera.volume = 0.8;
    sfx.slide.volume = 0.9;
  
    let audioUnlocked = false;
  
    function unlockAudioOnce() {
      if (audioUnlocked) return;
      audioUnlocked = true;
  
      [sfx.camera, sfx.slide].forEach((a) => {
        try {
          a.muted = true;
          const p = a.play();
          if (p) {
            p.then(() => {
              a.pause();
              a.currentTime = 0;
              a.muted = false;
            }).catch(() => {
              a.muted = false;
            });
          } else {
            a.muted = false;
          }
        } catch (e) {
          a.muted = false;
        }
      });
    }
  
    function playSfx(audioObj) {
      if (!audioObj) return;
      try {
        audioObj.pause();
        audioObj.currentTime = 0;
        const p = audioObj.play();
        if (p) p.catch(() => {});
      } catch (e) {}
    }
  
    /* =======================
       VIEW CONTROL
    ======================= */
    function showView(name) {
      els.homeView.style.display = name === "home" ? "block" : "none";
      els.cameraView.style.display = name === "camera" ? "flex" : "none";
      els.printView.style.display = name === "print" ? "flex" : "none";
      els.editView.style.display = name === "edit" ? "flex" : "none";
    }
  
    function openModePopup() {
      els.modePopup.classList.add("open");
    }
  
    function closeModePopup() {
      els.modePopup.classList.remove("open");
    }
  
    /* =======================
       CAMERA START STOP
    ======================= */
    async function startCamera() {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" }
        });
  
        els.video.srcObject = mediaStream;
  
        await new Promise((resolve) => {
          if (els.video.readyState >= 2) return resolve();
          els.video.onloadedmetadata = () => resolve();
        });
  
        await waitForVideoDims();
        ensureCountdownAboveEverything();
  
        await ensureAiSystemReady();
        startAiLoop();
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
  
      stopAiLoop();
    }
  
    async function waitForVideoDims() {
      const start = Date.now();
      while ((!els.video.videoWidth || !els.video.videoHeight) && Date.now() - start < 2000) {
        await new Promise((r) => requestAnimationFrame(r));
      }
    }
  
    function ensureCountdownAboveEverything() {
      if (els.countdownOverlay) {
        els.countdownOverlay.style.zIndex = "80";
        els.countdownOverlay.style.position = "absolute";
      }
      if (els.flashOverlay) {
        els.flashOverlay.style.zIndex = "90";
        els.flashOverlay.style.position = "absolute";
      }
    }
  
    /* =======================
       FILTER UI
    ======================= */
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
  
    /* =======================
       EFFECT UI (NO DUPLICATES)
    ======================= */
    function setAiEffect(effectName) {
      state.aiEffect = effectName;
      updateEffectButtons();
    }
  
    function updateEffectButtons() {
      if (!els.effectNoneBtn) return;
      els.effectNoneBtn.classList.toggle("active", state.aiEffect === "none");
      els.effectDogBtn.classList.toggle("active", state.aiEffect === "dog");
      els.effectSpottyBtn.classList.toggle("active", state.aiEffect === "spotty");
    }
  
    function setEffectPanelEnabled(enabled) {
      if (!els.effectPanel) return;
      els.effectPanel.classList.toggle("disabled", !enabled);
    }
  
    /* =======================
       PIXEL FILTERS
    ======================= */
    function clamp255(x) {
      return x < 0 ? 0 : x > 255 ? 255 : x;
    }
  
    function applyBWManual(ctx, w, h) {
      const img = ctx.getImageData(0, 0, w, h);
      const d = img.data;
  
      const contrast = 1.62;
      const brightness = 5;
  
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
  
    // STRONGER so the capture matches the preview better (white wall becomes obvious)
    function applyRioManual(ctx, w, h) {
      const img = ctx.getImageData(0, 0, w, h);
      const d = img.data;
  
      const saturation = 1.95;
      const contrast = 1.22;
      const brightness = 14;
  
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
  
        // warm shift similar to preview
        r += 10;
        b -= 8;
  
        d[i] = clamp255(r);
        d[i + 1] = clamp255(g);
        d[i + 2] = clamp255(b);
      }
  
      ctx.putImageData(img, 0, 0);
    }
  
    // Stronger overlay to match preview
    function applyRioOverlay(ctx, w, h) {
      ctx.save();
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "rgba(83, 64, 164, 0.50)");
      grad.addColorStop(0.45, "rgba(191, 58, 162, 0.34)");
      grad.addColorStop(1, "rgba(255, 151, 55, 0.40)");
      ctx.globalCompositeOperation = "soft-light";
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";
      ctx.restore();
    }
  
    function applyVignette(ctx, w, h, strength) {
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      const inner = Math.min(w, h) * 0.32;
      const outer = Math.max(w, h) * 0.98;
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
  
    /* =======================
       CROPPING HELPERS
    ======================= */
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
  
    function mapLandmarksToCrop(lm, srcW, srcH, crop) {
      return lm.map((p) => {
        const px = p.x * srcW;
        const py = p.y * srcH;
  
        const nx = (px - crop.sx) / crop.sw;
        const ny = (py - crop.sy) / crop.sh;
  
        return {
          x: nx < 0 ? 0 : nx > 1 ? 1 : nx,
          y: ny < 0 ? 0 : ny > 1 ? 1 : ny,
          z: p.z || 0
        };
      });
    }
  
    /* =======================
       SAFE IMAGE LOADING
    ======================= */
    async function blobToDataURL(blob) {
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("FileReader failed"));
        reader.readAsDataURL(blob);
      });
    }
  
    async function loadImageSafe(path) {
      try {
        const res = await fetch(path, { cache: "no-store" });
        if (!res.ok) throw new Error("Fetch failed");
        const blob = await res.blob();
        const dataUrl = await blobToDataURL(blob);
        return await loadImage(dataUrl);
      } catch (e) {
        return await loadImage(path);
      }
    }
  
    function loadImage(src) {
      return new Promise((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = () => reject(new Error("Image failed to load: " + src));
        im.src = src;
      });
    }
  
    /* =======================
       AI EFFECT SYSTEM
    ======================= */
    const aiSystem = {
      ready: false,
      faceMesh: null,
  
      fxCanvas: null,
      fxCtx: null,
  
      dogImg: null,
      spottyImg: null,
  
      lastLandmarks: null,
  
      loopOn: false,
      faceBusy: false,
      lastFaceTs: 0
    };
  
    function loadScript(url) {
      return new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = url;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("Script failed: " + url));
        document.head.appendChild(s);
      });
    }
  
    function dist2(a, b) {
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      return Math.sqrt(dx * dx + dy * dy);
    }
  
    function mouthOpenScore(lm) {
      const upper = lm[13];
      const lower = lm[14];
      const left = lm[78];
      const right = lm[308];
  
      const open = dist2(upper, lower);
      const width = dist2(left, right);
      if (width < 1e-6) return 0;
      return open / width;
    }
  
    function getRollAngle(lm) {
      const leftEye = lm[33];
      const rightEye = lm[263];
      return Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
    }
  
    function chooseEffectImage(effectName) {
      if (effectName === "dog") return aiSystem.dogImg;
      if (effectName === "spotty") return aiSystem.spottyImg;
      return null;
    }
  
    function drawDogOverlayFromImage(ctx, img, lm, cw, ch) {
      if (!img || !lm) return;
  
      const angle = getRollAngle(lm);
  
      const leftCheek = lm[234];
      const rightCheek = lm[454];
      const forehead = lm[10];
      const chin = lm[152];
      const noseTip = lm[1];
  
      const faceW = dist2(leftCheek, rightCheek) * cw;
      const faceH = dist2(forehead, chin) * ch;
  
      const overlayW = faceW * 1.75;
      const overlayH = faceH * 2.05;
  
      const anchorX = 0.50;
      const anchorY = 0.52;
  
      const dx = noseTip.x * cw - overlayW * anchorX;
      const dy = noseTip.y * ch - overlayH * anchorY;
  
      const earTop = 0.0;
      const earBottom = 0.42;
  
      const noseTop = 0.36;
      const noseBottom = 0.58;
  
      const tongueTop = 0.58;
      const tongueBottom = 1.0;
  
      const openScore = mouthOpenScore(lm);
      const showTongue = openScore > 0.18;
  
      ctx.save();
  
      const cx = noseTip.x * cw;
      const cy = noseTip.y * ch;
  
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.translate(-cx, -cy);
  
      const sx = 0;
      const sw = img.width;
  
      const earSY = img.height * earTop;
      const earSH = img.height * (earBottom - earTop);
  
      const noseSY = img.height * noseTop;
      const noseSH = img.height * (noseBottom - noseTop);
  
      const tongueSY = img.height * tongueTop;
      const tongueSH = img.height * (tongueBottom - tongueTop);
  
      const earDY = dy + overlayH * earTop;
      const earDH = overlayH * (earBottom - earTop);
  
      const noseDY = dy + overlayH * noseTop;
      const noseDH = overlayH * (noseBottom - noseTop);
  
      const tongueDY = dy + overlayH * tongueTop;
      const tongueDH = overlayH * (tongueBottom - tongueTop);
  
      ctx.drawImage(img, sx, earSY, sw, earSH, dx, earDY, overlayW, earDH);
      ctx.drawImage(img, sx, noseSY, sw, noseSH, dx, noseDY, overlayW, noseDH);
  
      if (showTongue) {
        ctx.drawImage(img, sx, tongueSY, sw, tongueSH, dx, tongueDY, overlayW, tongueDH);
      }
  
      ctx.restore();
    }
  
    function resizeFxCanvasToWrapper() {
      if (!aiSystem.fxCanvas) return;
  
      const dpr = window.devicePixelRatio || 1;
      const w = aiSystem.fxCanvas.clientWidth;
      const h = aiSystem.fxCanvas.clientHeight;
  
      const cw = Math.round(w * dpr);
      const ch = Math.round(h * dpr);
  
      if (aiSystem.fxCanvas.width !== cw || aiSystem.fxCanvas.height !== ch) {
        aiSystem.fxCanvas.width = cw;
        aiSystem.fxCanvas.height = ch;
      }
    }
  
    async function ensureAiSystemReady() {
      if (aiSystem.ready) return;
  
      // YOUR FILES
      aiSystem.dogImg = await loadImageSafe("images/effects/dog.png");
      aiSystem.spottyImg = await loadImageSafe("images/effects/spotty_pup.png");
  
      await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js");
  
      // USE EXISTING CANVAS FROM HTML
      aiSystem.fxCanvas = els.fxCanvas;
      aiSystem.fxCtx = els.fxCanvas.getContext("2d");
  
      aiSystem.faceMesh = new FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
      });
  
      aiSystem.faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
  
      aiSystem.faceMesh.onResults((res) => {
        const list = res.multiFaceLandmarks || [];
        aiSystem.lastLandmarks = list.length ? list[0] : null;
      });
  
      aiSystem.ready = true;
    }
  
    function startAiLoop() {
      if (!aiSystem.ready) return;
      if (aiSystem.loopOn) return;
  
      aiSystem.loopOn = true;
      requestAnimationFrame(aiLoopTick);
    }
  
    function stopAiLoop() {
      aiSystem.loopOn = false;
  
      if (aiSystem.fxCtx && aiSystem.fxCanvas) {
        aiSystem.fxCtx.clearRect(0, 0, aiSystem.fxCanvas.width, aiSystem.fxCanvas.height);
      }
    }
  
    function aiLoopTick(ts) {
      if (!aiSystem.loopOn) return;
  
      resizeFxCanvasToWrapper();
  
      if (!aiSystem.faceBusy && ts - aiSystem.lastFaceTs > 90) {
        aiSystem.faceBusy = true;
        aiSystem.lastFaceTs = ts;
  
        aiSystem.faceMesh
          .send({ image: els.video })
          .catch(() => {})
          .finally(() => {
            aiSystem.faceBusy = false;
          });
      }
  
      const ctx = aiSystem.fxCtx;
      const cw = aiSystem.fxCanvas.width;
      const ch = aiSystem.fxCanvas.height;
  
      ctx.clearRect(0, 0, cw, ch);
  
      if (state.aiEffect !== "none" && aiSystem.lastLandmarks) {
        const srcW = els.video.videoWidth;
        const srcH = els.video.videoHeight;
  
        if (srcW > 0 && srcH > 0) {
          const crop = computeCrop(srcW, srcH, 3, 4);
          const croppedLm = mapLandmarksToCrop(aiSystem.lastLandmarks, srcW, srcH, crop);
          const img = chooseEffectImage(state.aiEffect);
  
          // IMPORTANT: do NOT mirror ctx here, canvas is mirrored in CSS already
          drawDogOverlayFromImage(ctx, img, croppedLm, cw, ch);
        }
      }
  
      requestAnimationFrame(aiLoopTick);
    }
  
    /* =======================
       CAPTURE
    ======================= */
    async function captureFilteredFramePortrait(captureFilter, captureAiEffect) {
      await waitForVideoDims();
  
      const video = els.video;
      const canvas = els.captureCanvas;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
  
      const srcW = video.videoWidth;
      const srcH = video.videoHeight;
  
      const outW = 720;
      const outH = 960;
  
      canvas.width = outW;
      canvas.height = outH;
  
      const crop = computeCrop(srcW, srcH, 3, 4);
  
      // 1) mirror selfie into capture canvas
      ctx.save();
      ctx.translate(outW, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, outW, outH);
      ctx.restore();
  
      // 2) apply pixel filter
      try {
        if (captureFilter === "bw") {
          applyBWManual(ctx, outW, outH);
          applyVignette(ctx, outW, outH, 0.30);
          applyGrain(ctx, outW, outH, 0.075); // NEW: BW grain
        }
  
        if (captureFilter === "rio") {
          applyRioManual(ctx, outW, outH);
          applyRioOverlay(ctx, outW, outH);
          applyVignette(ctx, outW, outH, 0.24);
          applyGrain(ctx, outW, outH, 0.06);
        }
      } catch (err) {
        console.warn("Pixel filter failed:", err);
      }
  
      // 3) draw AI overlay AFTER filter
      try {
        if (captureAiEffect !== "none" && aiSystem.ready && aiSystem.lastLandmarks) {
          const img = chooseEffectImage(captureAiEffect);
          const croppedLm = mapLandmarksToCrop(aiSystem.lastLandmarks, srcW, srcH, crop);
  
          ctx.save();
          ctx.translate(outW, 0);
          ctx.scale(-1, 1);
          drawDogOverlayFromImage(ctx, img, croppedLm, outW, outH);
          ctx.restore();
        }
      } catch (err) {
        console.warn("AI overlay failed:", err);
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
  
      await triggerFlash();
  
      const freezeFilter = state.filter;
      const freezeAi = state.aiEffect;
  
      return await captureFilteredFramePortrait(freezeFilter, freezeAi);
    }
  
    /* =======================
       PHOTOBOOTH
    ======================= */
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
  
        wrap.appendChild(img);
        els.photoboothPreview.appendChild(wrap);
      });
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
      playSfx(sfx.slide);
  
      els.stripDropImg.classList.remove("drop_active");
      els.stripDropImg.src = stripUrl;
      void els.stripDropImg.offsetWidth;
      els.stripDropImg.classList.add("drop_active");
    }
  
    async function takePhotobooth() {
      if (state.isCapturing) return;
      state.isCapturing = true;
      setEffectPanelEnabled(false);
  
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
      } catch (e) {
        console.error(e);
        alert("Photobooth capture failed. Open using localhost server and try again.");
      } finally {
        state.isCapturing = false;
        setEffectPanelEnabled(true);
      }
    }
  
    function openPhotoboothPrintPage() {
      if (!state.currentStripUrl) return;
  
      stopCamera();
      showView("print");
  
      playStripDropAnimation(state.currentStripUrl);
    }
  
    /* =======================
       POLAROID
    ======================= */
    async function takePolaroid() {
      if (state.isCapturing) return;
      state.isCapturing = true;
      setEffectPanelEnabled(false);
  
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
      } catch (e) {
        console.error(e);
        alert("Capture failed. Open using localhost server and try again.");
      } finally {
        state.isCapturing = false;
        setEffectPanelEnabled(true);
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
  
    /* =======================
       DOWNLOAD
    ======================= */
    function downloadCurrent() {
      if (!state.finalDownloadUrl) return;
      const a = document.createElement("a");
      a.href = state.finalDownloadUrl;
      a.download = state.mode === "photobooth" ? "photobooth_strip.png" : "polaroid.png";
      a.click();
    }
  
    /* =======================
       MODE FLOW
    ======================= */
    async function goToMode(modeName) {
      state.mode = modeName;
  
      showView("camera");
      resetPhotoboothUI();
  
      stopCamera();
      await startCamera();
  
      setFilter(state.filter);
      updateEffectButtons();
  
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
      showView("camera");
      state.finalDownloadUrl = "";
      state.isCapturing = false;
  
      startCamera();
      setFilter(state.filter);
      updateEffectButtons();
  
      if (state.mode === "photobooth") {
        resetPhotoboothUI();
        els.photoboothPreview.style.display = "flex";
        els.hintText.textContent = "Photobooth will take 4 photos";
      } else {
        els.photoboothPreview.style.display = "none";
        els.hintText.textContent = "Choose a filter, then tap take picture";
      }
    }
  
    function handleCaptureClick() {
      if (!state.mode) return;
      if (state.mode === "photobooth") return takePhotobooth();
      if (state.mode === "polaroid") return takePolaroid();
    }
  
    function sleep(ms) {
      return new Promise((r) => setTimeout(r, ms));
    }
  
    async function triggerFlash() {
      if (!els.flashOverlay) return;
  
      playSfx(sfx.camera);
  
      els.flashOverlay.classList.remove("flash_active");
      void els.flashOverlay.offsetWidth;
      els.flashOverlay.classList.add("flash_active");
  
      await sleep(170);
      els.flashOverlay.classList.remove("flash_active");
    }
  
    /* =======================
       INIT
    ======================= */
    function init() {
      showView("home");
      setFilter("orig");
      updateEffectButtons();
  
      els.boothHotspot.addEventListener("click", () => openModePopup());
  
      els.boothHotspot.addEventListener("mouseenter", () => {
        if (els.boothHotspotImg) els.boothHotspotImg.src = "images/home2.png";
      });
  
      els.boothHotspot.addEventListener("mouseleave", () => {
        if (els.boothHotspotImg) els.boothHotspotImg.src = "images/home.png";
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
  
      // EFFECT BUTTONS (NO DUPLICATES)
      if (els.effectNoneBtn) {
        els.effectNoneBtn.addEventListener("click", () => setAiEffect("none"));
        els.effectDogBtn.addEventListener("click", () => setAiEffect("dog"));
        els.effectSpottyBtn.addEventListener("click", () => setAiEffect("spotty"));
      }
  
      els.captureBtn.addEventListener("click", () => {
        unlockAudioOnce();
        handleCaptureClick();
      });
  
      els.backBtn.addEventListener("click", goHome);
  
      els.continueBtn.addEventListener("click", () => {
        unlockAudioOnce();
        openPhotoboothPrintPage();
      });
  
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
  
