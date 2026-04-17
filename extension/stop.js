async function init() {
  const { recordingStart } = await chrome.storage.local.get(["recordingStart"]);
  if (!recordingStart) return;

  const el = document.getElementById("timer");
  setInterval(() => {
    const s = Math.floor((Date.now() - recordingStart) / 1000);
    el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }, 500);
}

document.getElementById("btn-stop").addEventListener("click", () => {
  const btn = document.getElementById("btn-stop");
  btn.disabled = true;
  btn.textContent = "Saving…";
  chrome.runtime.sendMessage({ type: "STOP_RECORDING" });
  setTimeout(() => window.close(), 1500);
});

init();
