// Open settings window on icon click (or do nothing if already recording)
chrome.action.onClicked.addListener(async () => {
  const { isRecording } = await chrome.storage.local.get(["isRecording"]);
  if (isRecording) return; // recording toolbar window is already open

  chrome.windows.create({
    url: chrome.runtime.getURL("popup.html"),
    type: "popup",
    width: 320,
    height: 520,
    top: 40,
    left: 40,
  });
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "RECORDING_LIVE") {
    chrome.storage.local.set({ isRecording: true, recordingStart: Date.now() });
    chrome.action.setBadgeText({ text: "●" });
    chrome.action.setBadgeBackgroundColor({ color: "#e53e3e" });
  }
  if (msg.type === "RECORDING_DONE") {
    chrome.storage.local.set({ isRecording: false });
    chrome.action.setBadgeText({ text: "" });
  }
  return false;
});
