// Open side panel when extension icon is clicked — eliminates the extra recorder popup window
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
