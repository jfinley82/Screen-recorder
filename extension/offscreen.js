let recorder = null;
let chunks = [];

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "OFFSCREEN_START") {
    startRecording(msg.streamId);
  }
  if (msg.type === "OFFSCREEN_STOP") {
    stopRecording();
  }
});

async function startRecording(streamId) {
  chunks = [];
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        mandatory: {
          chromeMediaSource: "desktop",
          chromeMediaSourceId: streamId,
        },
      },
      audio: {
        mandatory: {
          chromeMediaSource: "desktop",
          chromeMediaSourceId: streamId,
        },
      },
    });

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";

    recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: recorder.mimeType });
      const buffer = await blob.arrayBuffer();
      chrome.runtime.sendMessage({ type: "RECORDING_DATA", buffer, mimeType: recorder.mimeType });
      chunks = [];
      recorder = null;
    };

    recorder.start(1000); // collect chunks every second
  } catch (err) {
    chrome.runtime.sendMessage({ type: "UPLOAD_ERROR", error: err.message });
  }
}

function stopRecording() {
  if (recorder && recorder.state !== "inactive") {
    recorder.stop();
  }
}
