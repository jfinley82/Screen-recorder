const APP_URL = "https://screenclips.co";

let recorder   = null;
let chunks     = [];
let animHandle = null;

// Start as soon as the document loads — settings are waiting in storage
chrome.storage.local.get(["pendingSettings"]).then(async ({ pendingSettings }) => {
  if (!pendingSettings) return;
  await chrome.storage.local.remove(["pendingSettings"]);
  startCapture(pendingSettings);
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "OFFSCREEN_STOP") {
    if (recorder?.state !== "inactive") recorder.stop();
  }
});

// ── Capture ───────────────────────────────────────────────────────────────────
async function startCapture({ mode = "desktop", micId = "", cameraId = "", quality = "1080" }) {
  try {
    let screenStream = null;
    if (mode !== "camera") {
      screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width:     quality === "1080" ? 1920 : 1280,
          height:    quality === "1080" ? 1080 : 720,
          frameRate: 30,
        },
        audio: false,
      });
    }

    let micTrack = null;
    if (micId) {
      try {
        const ms = await navigator.mediaDevices.getUserMedia({
          audio: micId === "default" ? true : { deviceId: { exact: micId } },
        });
        micTrack = ms.getAudioTracks()[0];
      } catch { /* mic unavailable */ }
    }

    if (mode === "camera") {
      const camStream = await navigator.mediaDevices.getUserMedia({
        video: cameraId ? { deviceId: { exact: cameraId } } : true,
      });
      const tracks = [...camStream.getVideoTracks(), ...(micTrack ? [micTrack] : [])];
      startRecording(new MediaStream(tracks), quality);
      return;
    }

    if (mode === "desktop+camera" && cameraId) {
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: cameraId } } });
        const { stream } = buildComposite(screenStream, camStream);
        const final = new MediaStream([...stream.getVideoTracks(), ...(micTrack ? [micTrack] : [])]);
        startRecording(final, quality, () => cancelAnimationFrame(animHandle));
        return;
      } catch { /* fall through to screen-only */ }
    }

    const tracks = [...screenStream.getVideoTracks(), ...(micTrack ? [micTrack] : [])];
    startRecording(new MediaStream(tracks), quality);

  } catch (err) {
    // Picker was cancelled or permission denied — signal done so badge clears
    chrome.runtime.sendMessage({ type: "RECORDING_DONE" });
  }
}

// ── Canvas composite (desktop + camera PiP) ───────────────────────────────────
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
    ctx.arcTo(cx + CAM_W, cy,         cx + CAM_W, cy + CAM_H, r);
    ctx.arcTo(cx + CAM_W, cy + CAM_H, cx,         cy + CAM_H, r);
    ctx.arcTo(cx,         cy + CAM_H, cx,         cy,         r);
    ctx.arcTo(cx,         cy,         cx + CAM_W, cy,         r);
    ctx.closePath(); ctx.clip();
    ctx.drawImage(cv, cx, cy, CAM_W, CAM_H);
    ctx.restore();
    animHandle = requestAnimationFrame(draw);
  }
  draw();
  return { stream: canvas.captureStream(30) };
}

// ── MediaRecorder ─────────────────────────────────────────────────────────────
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

  chrome.runtime.sendMessage({ type: "RECORDING_LIVE" });

  // Auto-stop when user clicks "Stop sharing" in browser bar
  stream.getVideoTracks()[0]?.addEventListener("ended", () => {
    if (recorder?.state !== "inactive") recorder.stop();
  });
}

// ── Upload ────────────────────────────────────────────────────────────────────
async function trpcMutation(procedure, input, token) {
  const res = await fetch(`${APP_URL}/trpc/${procedure}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ json: input }),
  });
  const body = await res.json();
  if (body.error) throw new Error(body.error?.json?.message || "Request failed");
  return body.result.data.json;
}

async function uploadRecording(blob) {
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
        xhr.onload  = () => xhr.status < 300 ? resolve() : reject(new Error(`${xhr.status}`));
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(blob);
      });

      const title = `Recording ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
      await trpcMutation("recordings.create", { title, muxUploadId: uploadId }, token);
    }

    chrome.notifications.create("", {
      type: "basic",
      iconUrl: "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==",
      title: "Recording saved!",
      message: "Your recording is in your library.",
    });
  } catch (err) {
    chrome.notifications.create("", {
      type: "basic",
      iconUrl: "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==",
      title: "Upload failed",
      message: err.message,
    });
  }

  chrome.runtime.sendMessage({ type: "RECORDING_DONE" });
}
