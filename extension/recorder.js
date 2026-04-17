const APP_URL = "https://screenclips.co";

let recorder   = null;
let chunks     = [];
let timerInt   = null;
let animHandle = null;
let startMs    = 0;

const states = ["ready", "recording", "uploading", "done"];
function show(state) {
  states.forEach((s) => document.getElementById(`s-${s}`).classList.toggle("hidden", s !== state));
}

function startTimer() {
  const el = document.getElementById("timer");
  startMs = Date.now();
  timerInt = setInterval(() => {
    const s = Math.floor((Date.now() - startMs) / 1000);
    el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }, 500);
}
function stopTimer() { clearInterval(timerInt); }

// ── Start ─────────────────────────────────────────────────────────────────────
document.getElementById("btn-start").addEventListener("click", async () => {
  // Minimize this window so the screen picker is fully visible
  chrome.windows?.getCurrent?.({}, (win) => {
    if (win?.id) chrome.windows.update(win.id, { state: "minimized" });
  });
  const { mode = "desktop", micId = "", cameraId = "", quality = "1080" } =
    await chrome.storage.local.get(["mode", "micId", "cameraId", "quality"]);

  try {
    const tracks = [];

    // ── Screen / tab capture ───────────────────────────────────────────────
    let screenStream = null;
    if (mode !== "camera") {
      screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width:  quality === "1080" ? 1920 : 1280,
          height: quality === "1080" ? 1080 : 720,
          frameRate: 30,
        },
        audio: false, // mic handled separately
      });
    }

    // ── Microphone ─────────────────────────────────────────────────────────
    let micTrack = null;
    if (micId) {
      try {
        const ms = await navigator.mediaDevices.getUserMedia({
          audio: micId === "default" ? true : { deviceId: { exact: micId } },
        });
        micTrack = ms.getAudioTracks()[0];
      } catch { /* no mic */ }
    }

    // ── Camera-only mode ───────────────────────────────────────────────────
    if (mode === "camera") {
      const camStream = await navigator.mediaDevices.getUserMedia({
        video: cameraId ? { deviceId: { exact: cameraId } } : true,
      });
      camStream.getVideoTracks().forEach((t) => tracks.push(t));
      if (micTrack) tracks.push(micTrack);
      startRecording(new MediaStream(tracks), quality);
      return;
    }

    // ── Desktop + camera overlay ───────────────────────────────────────────
    if ((mode === "desktop+camera") && cameraId) {
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: cameraId } },
        });
        const composite = buildComposite(screenStream, camStream);
        const final = new MediaStream([
          ...composite.stream.getVideoTracks(),
          ...(micTrack ? [micTrack] : []),
        ]);
        startRecording(final, quality, () => { cancelAnimationFrame(animHandle); });
        return;
      } catch { /* fall through to screen-only */ }
    }

    // ── Screen only (default) ──────────────────────────────────────────────
    const finalTracks = [...screenStream.getVideoTracks()];
    if (micTrack) finalTracks.push(micTrack);
    startRecording(new MediaStream(finalTracks), quality);

  } catch (err) {
    if (err.name !== "NotAllowedError") alert(`Could not start recording: ${err.message}`);
    window.close();
  }
});

function buildComposite(screenStream, cameraStream) {
  const canvas  = document.createElement("canvas");
  const ctx     = canvas.getContext("2d");
  const screenV = document.createElement("video");
  const camV    = document.createElement("video");

  screenV.srcObject = screenStream;
  camV.srcObject    = cameraStream;
  screenV.muted = camV.muted = true;
  screenV.play(); camV.play();

  const W = 1920, H = 1080;
  canvas.width = W; canvas.height = H;

  const CAM_H = Math.round(H * 0.22);
  const CAM_W = Math.round(CAM_H * 1.33);
  const PAD   = 18;

  function draw() {
    ctx.drawImage(screenV, 0, 0, W, H);
    const cx = W - CAM_W - PAD, cy = H - CAM_H - PAD, r = 12;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx + r, cy);
    ctx.arcTo(cx + CAM_W, cy, cx + CAM_W, cy + CAM_H, r);
    ctx.arcTo(cx + CAM_W, cy + CAM_H, cx, cy + CAM_H, r);
    ctx.arcTo(cx, cy + CAM_H, cx, cy, r);
    ctx.arcTo(cx, cy, cx + CAM_W, cy, r);
    ctx.closePath(); ctx.clip();
    ctx.drawImage(camV, cx, cy, CAM_W, CAM_H);
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

  show("recording");
  startTimer();
  // Restore window now that picker is done
  chrome.windows?.getCurrent?.({}, (win) => {
    if (win?.id) chrome.windows.update(win.id, { state: "normal" });
  });

  // Auto-stop if screen share ends (user clicks "Stop sharing" in browser bar)
  stream.getVideoTracks()[0]?.addEventListener("ended", () => {
    if (recorder?.state !== "inactive") recorder.stop();
  });
}

// ── Stop ──────────────────────────────────────────────────────────────────────
document.getElementById("btn-stop").addEventListener("click", () => {
  stopTimer();
  if (recorder?.state !== "inactive") recorder.stop();
});

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
  show("uploading");
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
          if (e.lengthComputable) {
            document.getElementById("progress-fill").style.width =
              `${Math.round((e.loaded / e.total) * 100)}%`;
          }
        };
        xhr.onload  = () => xhr.status < 300 ? resolve() : reject(new Error(`${xhr.status}`));
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(blob);
      });

      const title = `Recording ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
      await trpcMutation("recordings.create", { title, muxUploadId: uploadId }, token);
    }

    show("done");
    chrome.notifications.create("", {
      type: "basic",
      iconUrl: "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==",
      title: "Recording saved!",
      message: "Your recording is in your library.",
    });
    setTimeout(() => window.close(), 2000);
  } catch (err) {
    alert(`Upload failed: ${err.message}`);
    window.close();
  }
}
