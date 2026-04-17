const APP_URL = "https://screenclips.co";

// ── State ─────────────────────────────────────────────────────────────────────
const STATES = ["login", "ready", "recording", "uploading", "done"];
function showState(name) {
  STATES.forEach((s) => {
    const el = document.getElementById(`state-${s}`);
    el.classList.toggle("active", s === name);
  });
}

// ── Timer ─────────────────────────────────────────────────────────────────────
let timerInt = null;
function startTimer() {
  const el = document.getElementById("timer");
  const t0 = Date.now();
  el.textContent = "0:00";
  timerInt = setInterval(() => {
    const s = Math.floor((Date.now() - t0) / 1000);
    el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }, 500);
}
function stopTimer() { clearInterval(timerInt); timerInt = null; }

// ── Devices ───────────────────────────────────────────────────────────────────
async function loadDevices() {
  try {
    const s = await navigator.mediaDevices
      .getUserMedia({ audio: true, video: true })
      .catch(() => navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null));
    if (s) s.getTracks().forEach((t) => t.stop());
  } catch {}

  const devices = await navigator.mediaDevices.enumerateDevices();
  const micSel = document.getElementById("select-mic");
  const camSel = document.getElementById("select-camera");

  while (micSel.options.length > 1) micSel.remove(1);
  while (camSel.options.length > 1) camSel.remove(1);

  devices.filter((d) => d.kind === "audioinput").forEach((d) =>
    micSel.appendChild(new Option(d.label || `Microphone ${micSel.options.length}`, d.deviceId))
  );
  devices.filter((d) => d.kind === "videoinput").forEach((d) =>
    camSel.appendChild(new Option(d.label || `Camera ${camSel.options.length}`, d.deviceId))
  );

  const saved = await chrome.storage.local.get(["micId", "cameraId", "quality", "mode"]);
  if (saved.micId)     micSel.value = saved.micId;
  if (saved.cameraId)  camSel.value = saved.cameraId;
  if (saved.quality)   document.getElementById("select-quality").value = saved.quality;
  if (saved.mode)      setMode(saved.mode);
}

// ── Mode ──────────────────────────────────────────────────────────────────────
let currentMode = "desktop";
function setMode(mode) {
  currentMode = mode;
  document.querySelectorAll(".mode-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.mode === mode)
  );
  const showCam = mode === "camera" || mode === "desktop+camera";
  document.getElementById("camera-row").style.display = showCam ? "" : "none";
}
document.querySelectorAll(".mode-btn").forEach((b) =>
  b.addEventListener("click", () => { setMode(b.dataset.mode); chrome.storage.local.set({ mode: b.dataset.mode }); })
);
document.getElementById("select-mic").addEventListener("change",     (e) => chrome.storage.local.set({ micId: e.target.value }));
document.getElementById("select-camera").addEventListener("change",  (e) => chrome.storage.local.set({ cameraId: e.target.value }));
document.getElementById("select-quality").addEventListener("change", (e) => chrome.storage.local.set({ quality: e.target.value }));

// ── Login ─────────────────────────────────────────────────────────────────────
document.getElementById("btn-login").addEventListener("click", async () => {
  const email    = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const errorEl  = document.getElementById("login-error");
  const btn      = document.getElementById("btn-login");
  errorEl.classList.add("hidden");
  btn.disabled = true; btn.textContent = "Logging in…";
  try {
    const res  = await fetch(`${APP_URL}/trpc/auth.login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: { email, password } }),
    });
    const body = await res.json();
    if (body.error) throw new Error(body.error?.json?.message || "Login failed");
    const data = body.result.data.json;
    if (!data.token) throw new Error("Server not yet updated — please deploy latest version.");
    await chrome.storage.local.set({ token: data.token, user: { name: data.name } });
    await goReady();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove("hidden");
  } finally {
    btn.disabled = false; btn.textContent = "Log In";
  }
});

document.getElementById("btn-logout").addEventListener("click", async () => {
  await chrome.storage.local.clear();
  showState("login");
});

// ── Recording ─────────────────────────────────────────────────────────────────
let recorder   = null;
let chunks     = [];
let animHandle = null;

document.getElementById("btn-start").addEventListener("click", async () => {
  const micId    = document.getElementById("select-mic").value;
  const cameraId = document.getElementById("select-camera").value;
  const quality  = document.getElementById("select-quality").value;
  await chrome.storage.local.set({ mode: currentMode, micId, cameraId, quality });

  try {
    // Screen capture (triggers Chrome's built-in screen picker)
    let screenStream = null;
    if (currentMode !== "camera") {
      screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: quality === "1080" ? 1920 : 1280, height: quality === "1080" ? 1080 : 720, frameRate: 30 },
        audio: false,
      });
    }

    // Microphone (separate getUserMedia so screen picker stays clean)
    let micTrack = null;
    if (micId) {
      try {
        const ms = await navigator.mediaDevices.getUserMedia({
          audio: micId === "default" ? true : { deviceId: { exact: micId } },
        });
        micTrack = ms.getAudioTracks()[0];
      } catch { /* mic unavailable */ }
    }

    // Camera-only
    if (currentMode === "camera") {
      const camStream = await navigator.mediaDevices.getUserMedia({
        video: cameraId ? { deviceId: { exact: cameraId } } : true,
      });
      const tracks = [...camStream.getVideoTracks(), ...(micTrack ? [micTrack] : [])];
      startRecording(new MediaStream(tracks), quality);
      return;
    }

    // Desktop + camera overlay (PiP via canvas)
    if (currentMode === "desktop+camera" && cameraId) {
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: cameraId } } });
        const { stream: compositeStream } = buildComposite(screenStream, camStream);
        const final = new MediaStream([
          ...compositeStream.getVideoTracks(),
          ...(micTrack ? [micTrack] : []),
        ]);
        startRecording(final, quality, () => cancelAnimationFrame(animHandle));
        return;
      } catch { /* fall through to screen-only */ }
    }

    // Screen only (default)
    const finalTracks = [...screenStream.getVideoTracks(), ...(micTrack ? [micTrack] : [])];
    startRecording(new MediaStream(finalTracks), quality);

  } catch (err) {
    if (err.name !== "NotAllowedError") alert(`Could not start recording: ${err.message}`);
  }
});

function buildComposite(screenStream, cameraStream) {
  const canvas = document.createElement("canvas");
  const ctx    = canvas.getContext("2d");
  const sv     = document.createElement("video");
  const cv     = document.createElement("video");
  sv.srcObject = screenStream; cv.srcObject = cameraStream;
  sv.muted = cv.muted = true;
  sv.play(); cv.play();

  const W = 1920, H = 1080;
  canvas.width = W; canvas.height = H;
  const CAM_H = Math.round(H * 0.22), CAM_W = Math.round(CAM_H * 1.33), PAD = 18;

  function draw() {
    ctx.drawImage(sv, 0, 0, W, H);
    const cx = W - CAM_W - PAD, cy = H - CAM_H - PAD, r = 12;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx + r, cy);
    ctx.arcTo(cx + CAM_W, cy,       cx + CAM_W, cy + CAM_H, r);
    ctx.arcTo(cx + CAM_W, cy + CAM_H, cx,       cy + CAM_H, r);
    ctx.arcTo(cx,         cy + CAM_H, cx,        cy,         r);
    ctx.arcTo(cx,         cy,         cx + CAM_W, cy,         r);
    ctx.closePath(); ctx.clip();
    ctx.drawImage(cv, cx, cy, CAM_W, CAM_H);
    ctx.restore();
    animHandle = requestAnimationFrame(draw);
  }
  draw();
  return { stream: canvas.captureStream(30) };
}

function startRecording(stream, quality, onStop) {
  chunks = [];
  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
    ? "video/webm;codecs=vp9,opus" : "video/webm";
  const bitsPerSecond = quality === "1080" ? 5_000_000 : 2_500_000;

  recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitsPerSecond });
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  recorder.onstop = () => {
    stream.getTracks().forEach((t) => t.stop());
    onStop?.();
    uploadRecording(new Blob(chunks, { type: mimeType }));
  };
  recorder.start(1000);

  showState("recording");
  startTimer();

  // Auto-stop when user clicks "Stop sharing" in browser bar
  stream.getVideoTracks()[0]?.addEventListener("ended", () => {
    if (recorder?.state !== "inactive") recorder.stop();
    stopTimer();
  });
}

document.getElementById("btn-stop").addEventListener("click", () => {
  stopTimer();
  if (recorder?.state !== "inactive") recorder.stop();
});

// ── Upload ────────────────────────────────────────────────────────────────────
async function trpcMutation(procedure, input, token) {
  const res = await fetch(`${APP_URL}/trpc/${procedure}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ json: input }),
  });
  const body = await res.json();
  if (body.error) throw new Error(body.error?.json?.message || "Request failed");
  return body.result.data.json;
}

async function uploadRecording(blob) {
  showState("uploading");
  try {
    const { token, saveLocal = false, saveCloud = true } =
      await chrome.storage.local.get(["token", "saveLocal", "saveCloud"]);

    if (saveLocal) {
      const url = URL.createObjectURL(blob);
      await chrome.downloads.download({ url, filename: `recording-${Date.now()}.webm`, saveAs: false });
    }

    if (saveCloud && token) {
      const { uploadId, uploadUrl } = await trpcMutation("upload.createMuxUpload", null, token);

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable)
            document.getElementById("progress-fill").style.width = `${Math.round((e.loaded / e.total) * 100)}%`;
        };
        xhr.onload  = () => (xhr.status < 300 ? resolve() : reject(new Error(`${xhr.status}`)));
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(blob);
      });

      const title = `Recording ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
      await trpcMutation("recordings.create", { title, muxUploadId: uploadId }, token);
    }

    showState("done");
    chrome.notifications.create("", {
      type: "basic",
      iconUrl: "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==",
      title: "Recording saved!",
      message: "Your recording is in your library.",
    });
  } catch (err) {
    alert(`Upload failed: ${err.message}`);
    showState("ready");
  }
}

document.getElementById("btn-again").addEventListener("click", () => showState("ready"));

// ── Init ──────────────────────────────────────────────────────────────────────
async function goReady() {
  document.getElementById("link-lib").href      = `${APP_URL}/library`;
  document.getElementById("link-lib-done").href = `${APP_URL}/library`;
  showState("ready");
  setMode("desktop");
  await loadDevices();
}

async function init() {
  const { token } = await chrome.storage.local.get(["token"]);
  if (!token) { showState("login"); return; }
  await goReady();
}

init();
