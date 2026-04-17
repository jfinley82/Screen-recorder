const APP_URL = "https://screenclips.co";

// ── view helpers ────────────────────────────────────────────────────────────
const views = ["login", "main"];
function showView(name) {
  views.forEach((v) => {
    document.getElementById(`view-${v}`).classList.toggle("hidden", v !== name);
  });
}

// ── timer (unused — kept for reference) ──────────────────────────────────────
let timerInterval = null;
function startTimer(startMs) {
  const el = document.getElementById("timer");
  timerInterval = setInterval(() => {
    const s = Math.floor((Date.now() - startMs) / 1000);
    el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }, 500);
}
function stopTimer() { clearInterval(timerInterval); timerInterval = null; }

// ── device enumeration ───────────────────────────────────────────────────────
async function loadDevices() {
  try {
    // Request permission so devices have labels
    const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).catch(() =>
      navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null)
    );
    if (s) s.getTracks().forEach((t) => t.stop());
  } catch {}

  const devices = await navigator.mediaDevices.enumerateDevices();

  const micSel = document.getElementById("select-mic");
  const camSel = document.getElementById("select-camera");

  // Keep the "No X" option, add real devices
  devices.filter((d) => d.kind === "audioinput").forEach((d) => {
    const opt = new Option(d.label || `Microphone ${micSel.options.length}`, d.deviceId);
    micSel.appendChild(opt);
  });

  devices.filter((d) => d.kind === "videoinput").forEach((d) => {
    const opt = new Option(d.label || `Camera ${camSel.options.length}`, d.deviceId);
    camSel.appendChild(opt);
  });

  // Restore saved selections
  const saved = await chrome.storage.local.get(["micId", "cameraId", "quality", "mode"]);
  if (saved.micId) micSel.value = saved.micId;
  if (saved.cameraId) camSel.value = saved.cameraId;
  if (saved.quality) document.getElementById("select-quality").value = saved.quality;
  if (saved.mode) setMode(saved.mode);
}

// ── mode selection ───────────────────────────────────────────────────────────
let currentMode = "desktop";

function setMode(mode) {
  currentMode = mode;
  document.querySelectorAll(".mode-btn").forEach((btn) =>
    btn.classList.toggle("active", btn.dataset.mode === mode)
  );
  // Show camera selector only for camera-using modes
  const showCam = mode === "camera" || mode === "desktop+camera";
  document.getElementById("camera-row").style.display = showCam ? "" : "none";
}

document.querySelectorAll(".mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    setMode(btn.dataset.mode);
    chrome.storage.local.set({ mode: btn.dataset.mode });
  });
});

// Save device selections when changed
document.getElementById("select-mic").addEventListener("change", (e) =>
  chrome.storage.local.set({ micId: e.target.value })
);
document.getElementById("select-camera").addEventListener("change", (e) =>
  chrome.storage.local.set({ cameraId: e.target.value })
);
document.getElementById("select-quality").addEventListener("change", (e) =>
  chrome.storage.local.set({ quality: e.target.value })
);

// ── init ─────────────────────────────────────────────────────────────────────
async function init() {
  const { token, recordingState, recordingStart } = await chrome.storage.local.get([
    "token", "recordingState", "recordingStart",
  ]);

  if (!token) { showView("login"); return; }

  document.getElementById("link-lib-main").href = `${APP_URL}/library`;
  showView("main");
  setMode("desktop"); // default; loadDevices restores saved mode
  await loadDevices();
}

// ── login ────────────────────────────────────────────────────────────────────
document.getElementById("btn-login").addEventListener("click", async () => {
  const email    = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const errorEl  = document.getElementById("login-error");
  const btn      = document.getElementById("btn-login");

  errorEl.classList.add("hidden");
  btn.disabled = true;
  btn.textContent = "Logging in…";

  try {
    const res  = await fetch(`${APP_URL}/trpc/auth.login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: { email, password } }),
    });
    const body = await res.json();
    if (body.error) throw new Error(body.error?.json?.message || "Login failed");

    const data = body.result.data.json;
    if (!data.token) throw new Error("Server not yet updated — please deploy latest version.");

    await chrome.storage.local.set({ token: data.token, user: { name: data.name } });
    showView("main");
    setMode("desktop");
    await loadDevices();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.textContent = "Log In";
  }
});

// ── logout ───────────────────────────────────────────────────────────────────
document.getElementById("btn-logout").addEventListener("click", async () => {
  await chrome.storage.local.clear();
  showView("login");
});

// ── start recording — opens dedicated recorder window ─────────────────────────
document.getElementById("btn-start").addEventListener("click", async () => {
  const micId    = document.getElementById("select-mic").value;
  const cameraId = document.getElementById("select-camera").value;
  const quality  = document.getElementById("select-quality").value;

  await chrome.storage.local.set({ mode: currentMode, micId, cameraId, quality });
  chrome.runtime.sendMessage({ type: "OPEN_RECORDER" });
  window.close();
});


init();
