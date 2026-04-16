const APP_URL = "https://screen-recorder-production-a0f1.up.railway.app";

const views = {
  login: document.getElementById("view-login"),
  idle: document.getElementById("view-idle"),
  recording: document.getElementById("view-recording"),
  uploading: document.getElementById("view-uploading"),
  done: document.getElementById("view-done"),
};

function showView(name) {
  Object.entries(views).forEach(([k, el]) => el.classList.toggle("hidden", k !== name));
}

let timerInterval = null;

function startTimer(startMs) {
  const el = document.getElementById("timer");
  timerInterval = setInterval(() => {
    const s = Math.floor((Date.now() - startMs) / 1000);
    el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }, 500);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

async function init() {
  const { token, user, recordingState, recordingStart } =
    await chrome.storage.local.get(["token", "user", "recordingState", "recordingStart"]);

  if (!token) {
    showView("login");
    return;
  }

  if (recordingState === "recording") {
    showView("recording");
    startTimer(recordingStart || Date.now());
    return;
  }

  if (recordingState === "uploading") {
    showView("uploading");
    return;
  }

  if (recordingState === "done") {
    showView("done");
    document.getElementById("link-library").href = `${APP_URL}/library`;
    return;
  }

  showView("idle");
  document.getElementById("user-name").textContent = `Hi, ${user?.name?.split(" ")[0] ?? "there"}`;
}

// Login
document.getElementById("btn-login").addEventListener("click", async () => {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const errorEl = document.getElementById("login-error");
  const btn = document.getElementById("btn-login");

  errorEl.classList.add("hidden");
  btn.disabled = true;
  btn.textContent = "Logging in…";

  try {
    const res = await fetch(`${APP_URL}/trpc/auth.login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: { email, password } }),
    });
    const body = await res.json();
    if (body.error) throw new Error(body.error?.json?.message || "Login failed");

    const data = body.result.data.json;
    await chrome.storage.local.set({ token: data.token, user: { name: data.name, email: data.email } });

    document.getElementById("user-name").textContent = `Hi, ${data.name.split(" ")[0]}`;
    showView("idle");
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.textContent = "Log In";
  }
});

// Logout
document.getElementById("btn-logout").addEventListener("click", async () => {
  await chrome.storage.local.clear();
  showView("login");
});

// Start recording
document.getElementById("btn-record").addEventListener("click", () => {
  chrome.desktopCapture.chooseDesktopMedia(["screen", "window", "tab"], async (streamId) => {
    if (!streamId) return;
    const now = Date.now();
    await chrome.storage.local.set({ recordingState: "recording", recordingStart: now });
    chrome.runtime.sendMessage({ type: "START_RECORDING", streamId });
    showView("recording");
    startTimer(now);
  });
});

// Stop recording
document.getElementById("btn-stop").addEventListener("click", async () => {
  stopTimer();
  showView("uploading");
  await chrome.storage.local.set({ recordingState: "uploading" });
  chrome.runtime.sendMessage({ type: "STOP_RECORDING" });
});

// Record another
document.getElementById("btn-again").addEventListener("click", async () => {
  await chrome.storage.local.remove(["recordingState", "recordingStart"]);
  const { user } = await chrome.storage.local.get("user");
  document.getElementById("user-name").textContent = `Hi, ${user?.name?.split(" ")[0] ?? "there"}`;
  showView("idle");
});

// Listen for background messages (upload progress / done)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "UPLOAD_PROGRESS") {
    document.getElementById("progress-fill").style.width = `${msg.percent}%`;
  }
  if (msg.type === "UPLOAD_DONE") {
    stopTimer();
    showView("done");
    document.getElementById("link-library").href = `${APP_URL}/library`;
  }
  if (msg.type === "UPLOAD_ERROR") {
    stopTimer();
    showView("idle");
    alert(`Upload failed: ${msg.error}`);
  }
});

init();
