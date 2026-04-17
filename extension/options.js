const DEFAULT_URL = "https://screenclips.co";

async function load() {
  const { saveCloud = true, saveLocal = false, appUrl = "" } =
    await chrome.storage.local.get(["saveCloud", "saveLocal", "appUrl"]);

  document.getElementById("toggle-cloud").checked = saveCloud;
  document.getElementById("toggle-local").checked = saveLocal;
  document.getElementById("input-url").value = appUrl || DEFAULT_URL;
}

document.getElementById("btn-save").addEventListener("click", async () => {
  const saveCloud = document.getElementById("toggle-cloud").checked;
  const saveLocal = document.getElementById("toggle-local").checked;
  const appUrl    = document.getElementById("input-url").value.trim() || DEFAULT_URL;

  await chrome.storage.local.set({ saveCloud, saveLocal, appUrl });

  const msg = document.getElementById("saved-msg");
  msg.style.display = "inline";
  setTimeout(() => (msg.style.display = "none"), 2000);
});

load();
