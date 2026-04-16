let recorder   = null;
let chunks     = [];
let animHandle = null;

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "OFFSCREEN_START") startRecording(msg);
  if (msg.type === "OFFSCREEN_STOP")  stopRecording();
});

async function startRecording({ streamId, mode, micId, cameraId, quality }) {
  chunks = [];
  try {
    const streams = await buildStreams({ streamId, mode, micId, cameraId, quality });
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm";

    const bitsPerSecond = quality === "1080" ? 5_000_000 : 2_500_000;

    recorder = new MediaRecorder(streams.final, { mimeType, videoBitsPerSecond: bitsPerSecond });
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = async () => {
      cancelAnimationFrame(animHandle);
      streams.cleanup();
      const blob   = new Blob(chunks, { type: recorder.mimeType });
      const buffer = await blob.arrayBuffer();
      chrome.runtime.sendMessage({ type: "RECORDING_DATA", buffer, mimeType: recorder.mimeType });
      chunks = [];
      recorder = null;
    };

    recorder.start(1000);
  } catch (err) {
    chrome.runtime.sendMessage({ type: "UPLOAD_ERROR", error: err.message });
  }
}

function stopRecording() {
  if (recorder && recorder.state !== "inactive") recorder.stop();
}

// ── stream builders ───────────────────────────────────────────────────────────

async function buildStreams({ streamId, mode, micId, cameraId, quality }) {
  const allTracks = [];
  const cleanup = () => allTracks.forEach((t) => t.stop());

  // --- microphone ---
  let micTrack = null;
  if (micId) {
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: micId === "default" ? true : { deviceId: { exact: micId } },
      });
      micTrack = micStream.getAudioTracks()[0];
      if (micTrack) allTracks.push(micTrack);
    } catch { /* no mic — continue */ }
  }

  // --- camera-only mode ---
  if (mode === "camera") {
    const camStream = await navigator.mediaDevices.getUserMedia({
      video: cameraId ? { deviceId: { exact: cameraId } } : true,
    });
    camStream.getTracks().forEach((t) => allTracks.push(t));
    const final = micTrack
      ? new MediaStream([...camStream.getVideoTracks(), micTrack])
      : camStream;
    return { final, cleanup };
  }

  // --- desktop / tab capture ---
  const screenStream = await navigator.mediaDevices.getUserMedia({
    video: {
      mandatory: {
        chromeMediaSource: "desktop",
        chromeMediaSourceId: streamId,
        ...(quality === "1080"
          ? { maxWidth: 1920, maxHeight: 1080 }
          : { maxWidth: 1280, maxHeight: 720 }),
      },
    },
    // No audio here — we get mic separately to avoid "tab capture" errors
  });
  screenStream.getVideoTracks().forEach((t) => allTracks.push(t));

  // --- desktop-only mode ---
  if (mode === "desktop" || mode === "tab") {
    const tracks = [...screenStream.getVideoTracks()];
    if (micTrack) tracks.push(micTrack);
    return { final: new MediaStream(tracks), cleanup };
  }

  // --- desktop + camera overlay (picture-in-picture) ---
  let cameraStream = null;
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: cameraId ? { deviceId: { exact: cameraId } } : true,
    });
    cameraStream.getVideoTracks().forEach((t) => allTracks.push(t));
  } catch { /* no camera — fall back to screen-only */ }

  if (!cameraStream) {
    const tracks = [...screenStream.getVideoTracks()];
    if (micTrack) tracks.push(micTrack);
    return { final: new MediaStream(tracks), cleanup };
  }

  // Composite screen + camera bubble onto a canvas
  const canvas  = document.createElement("canvas");
  const ctx     = canvas.getContext("2d");
  const screenV = document.createElement("video");
  const camV    = document.createElement("video");

  screenV.srcObject = screenStream;
  camV.srcObject    = cameraStream;
  screenV.muted = camV.muted = true;

  await Promise.all([
    new Promise((r) => { screenV.onloadedmetadata = r; screenV.play(); }),
    new Promise((r) => { camV.onloadedmetadata    = r; camV.play(); }),
  ]);

  const W = screenV.videoWidth  || 1920;
  const H = screenV.videoHeight || 1080;
  canvas.width  = W;
  canvas.height = H;

  const CAM_H = Math.round(H * 0.22);
  const CAM_W = Math.round(CAM_H * (camV.videoWidth / camV.videoHeight || 1));
  const PAD   = 16;

  function drawFrame() {
    ctx.drawImage(screenV, 0, 0, W, H);
    // Camera bubble — rounded rectangle + clip
    const cx = W - CAM_W - PAD;
    const cy = H - CAM_H - PAD;
    const r  = 12;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx + r, cy);
    ctx.arcTo(cx + CAM_W, cy, cx + CAM_W, cy + CAM_H, r);
    ctx.arcTo(cx + CAM_W, cy + CAM_H, cx, cy + CAM_H, r);
    ctx.arcTo(cx, cy + CAM_H, cx, cy, r);
    ctx.arcTo(cx, cy, cx + CAM_W, cy, r);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(camV, cx, cy, CAM_W, CAM_H);
    ctx.restore();
    animHandle = requestAnimationFrame(drawFrame);
  }
  drawFrame();

  const canvasStream = canvas.captureStream(30);
  const tracks = [...canvasStream.getVideoTracks()];
  if (micTrack) tracks.push(micTrack);

  return { final: new MediaStream(tracks), cleanup };
}
