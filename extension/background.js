const APP_URL = "https://screenclips.co";
const OFFSCREEN_URL = chrome.runtime.getURL("offscreen.html");

async function ensureOffscreen() {
  const existing = await chrome.offscreen.hasDocument();
  if (!existing) {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: ["USER_MEDIA", "DISPLAY_MEDIA"],
      justification: "Capture and record screen/camera stream",
    });
  }
}

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

async function uploadRecording(blob, token) {
  const { uploadId, uploadUrl } = await trpcMutation("upload.createMuxUpload", null, token);

  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        chrome.runtime.sendMessage({ type: "UPLOAD_PROGRESS", percent: Math.round((e.loaded / e.total) * 100) });
      }
    };
    xhr.onload  = () => (xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(blob);
  });

  const title = `Recording ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  await trpcMutation("recordings.create", { title, muxUploadId: uploadId }, token);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "START_RECORDING") {
    ensureOffscreen().then(() => {
      chrome.runtime.sendMessage({
        type: "OFFSCREEN_START",
        streamId: msg.streamId,
        mode:     msg.mode,
        micId:    msg.micId,
        cameraId: msg.cameraId,
        quality:  msg.quality,
      });
      chrome.action.setBadgeText({ text: "REC" });
      chrome.action.setBadgeBackgroundColor({ color: "#e53e3e" });
    });
  }

  if (msg.type === "STOP_RECORDING") {
    chrome.runtime.sendMessage({ type: "OFFSCREEN_STOP" });
    chrome.action.setBadgeText({ text: "" });
  }

  if (msg.type === "RECORDING_DATA") {
    (async () => {
      try {
        const { token, saveCloud = true, saveLocal = false } =
          await chrome.storage.local.get(["token", "saveCloud", "saveLocal"]);

        const blob = new Blob([msg.buffer], { type: msg.mimeType });
        chrome.action.setBadgeText({ text: "UPL" });
        chrome.action.setBadgeBackgroundColor({ color: "#2563eb" });

        // Local save
        if (saveLocal) {
          const url = URL.createObjectURL(blob);
          const filename = `recording-${Date.now()}.webm`;
          await chrome.downloads.download({ url, filename, saveAs: false });
        }

        // Cloud upload
        if (saveCloud) {
          if (!token) throw new Error("Not logged in");
          await uploadRecording(blob, token);
        }

        chrome.action.setBadgeText({ text: "" });
        chrome.runtime.sendMessage({ type: "UPLOAD_DONE" });
        chrome.notifications.create("", {
          type: "basic",
          iconUrl: "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==",
          title: "Recording saved!",
          message: "Your recording has been uploaded to your library.",
        });
      } catch (err) {
        await chrome.storage.local.remove(["recordingState", "recordingStart"]);
        chrome.runtime.sendMessage({ type: "UPLOAD_ERROR", error: err.message });
      }
    })();
  }

  return false;
});
