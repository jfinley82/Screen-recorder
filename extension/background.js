// Icon click: open settings (or stop controls if currently recording)
chrome.action.onClicked.addListener(async () => {
  const { isRecording } = await chrome.storage.local.get(["isRecording"]);

  if (isRecording) {
    chrome.windows.create({
      url: chrome.runtime.getURL("stop.html"),
      type: "popup",
      width: 300,
      height: 120,
      top: 40,
      left: 40,
      focused: true,
    });
    return;
  }

  chrome.windows.create({
    url: chrome.runtime.getURL("popup.html"),
    type: "popup",
    width: 320,
    height: 520,
    top: 40,
    left: 40,
  });
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "START_RECORDING") {
    handleStart(msg.settings).catch(console.error);
    sendResponse({ ok: true });
    return false;
  }
  if (msg.type === "RECORDING_LIVE") {
    chrome.storage.local.set({ isRecording: true, recordingStart: Date.now() });
    chrome.action.setBadgeText({ text: "●" });
    chrome.action.setBadgeBackgroundColor({ color: "#e53e3e" });
  }
  if (msg.type === "RECORDING_DONE") {
    chrome.storage.local.set({ isRecording: false });
    chrome.action.setBadgeText({ text: "" });
    chrome.offscreen.closeDocument().catch(() => {});
  }
  if (msg.type === "STOP_RECORDING") {
    // Forward to offscreen document
    chrome.runtime.sendMessage({ type: "OFFSCREEN_STOP" }).catch(() => {});
  }
  return false;
});

async function handleStart(settings) {
  await chrome.storage.local.set({ pendingSettings: settings });

  const existing = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
  if (existing.length > 0) {
    await chrome.offscreen.closeDocument();
  }

  await chrome.offscreen.createDocument({
    url: chrome.runtime.getURL("offscreen.html"),
    reasons: ["DISPLAY_MEDIA", "USER_MEDIA"],
    justification: "Record screen and microphone for ScreenClips",
  });
}
