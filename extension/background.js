chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "OPEN_RECORDER") {
    chrome.windows.create({
      url: chrome.runtime.getURL("recorder.html"),
      type: "popup",
      width: 320,
      height: 180,
      top: 20,
      left: 20,
      focused: false, // don't steal focus so screen picker can stay in front
    });
  }
  return false;
});
