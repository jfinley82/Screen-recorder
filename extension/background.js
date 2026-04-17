chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "OPEN_RECORDER") {
    chrome.windows.create({
      url: chrome.runtime.getURL("recorder.html"),
      type: "popup",
      width: 320,
      height: 180,
      focused: true,
    });
  }
  return false;
});
