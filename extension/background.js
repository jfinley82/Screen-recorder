const APP_URL = "https://screen-recorder-production-a0f1.up.railway.app";
const OFFSCREEN_URL = chrome.runtime.getURL("offscreen.html");

async function ensureOffscreen() {
  const existing = await chrome.offscreen.hasDocument();
  if (!existing) {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: ["USER_MEDIA"],
      justification: "Capture and record screen stream",
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
  // 1. Get Mux upload URL
  const { uploadId, uploadUrl } = await trpcMutation("upload.createMuxUpload", null, token);

  // 2. PUT blob to Mux with progress
  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        chrome.runtime.sendMessage({ type: "UPLOAD_PROGRESS", percent });
      }
    };
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Mux upload failed: ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(blob);
  });

  // 3. Create recording record in DB
  const title = `Recording ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  await trpcMutation("recordings.create", { title, muxUploadId: uploadId }, token);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "START_RECORDING") {
    ensureOffscreen().then(() => {
      chrome.runtime.sendMessage({ type: "OFFSCREEN_START", streamId: msg.streamId });
    });
  }

  if (msg.type === "STOP_RECORDING") {
    chrome.runtime.sendMessage({ type: "OFFSCREEN_STOP" });
  }

  if (msg.type === "RECORDING_DATA") {
    (async () => {
      try {
        const { token } = await chrome.storage.local.get("token");
        if (!token) throw new Error("Not logged in");

        const blob = new Blob([msg.buffer], { type: msg.mimeType });
        await uploadRecording(blob, token);

        await chrome.storage.local.set({ recordingState: "done" });
        chrome.runtime.sendMessage({ type: "UPLOAD_DONE" });
        chrome.notifications.create({
          type: "basic",
          iconUrl: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>",
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
