const btn = document.getElementById("btn-extract");
const status = document.getElementById("status");
const result = document.getElementById("result");

const FRONTEND = "http://localhost:3000";

// ── Restore last result when popup opens ──────────────────────────────────
chrome.storage.local.get("lastResult", ({ lastResult }) => {
  if (lastResult) {
    status.textContent = "↩ Last extraction complete.";
    status.className = "ok";
    showDashboardButton(lastResult.id);
  }
});

// ── Button click ──────────────────────────────────────────────────────────
btn.onclick = async () => {
  btn.disabled = true;
  btn.textContent = "⏳ Extracting...";
  status.textContent = "Scrolling chat to load full history (~15s max)...";
  status.className = "";

  // hide old dashboard button if it exists
  const oldDashBtn = document.getElementById("dash-btn");
  if (oldDashBtn) oldDashBtn.style.display = "none";

  try {
    const res = await chrome.runtime.sendMessage({ type: "START_EXTRACTION" });

    if (!res || res.status === "ERROR") {
      throw new Error(res?.message || "Unknown error from background");
    }

    // Save result so it survives tab switches
    chrome.storage.local.set({ lastResult: res });

    status.textContent = "✅ Done! Redirecting to dashboard...";
    status.className = "ok";
    btn.textContent = "Extract Saved!";

    // Automatically open the new Dashboard tab!
    const dashboardUrl = `${FRONTEND}/chat/${res.id}`;
    chrome.tabs.create({ url: dashboardUrl });

    showDashboardButton(res.id);

  } catch (err) {
    status.textContent = "❌ Error: " + err.message;
    status.className = "error";
    btn.disabled = false;
    btn.textContent = "⬆ Extract This Chat";
    console.error("[POPUP] Error:", err);
  }
};

// ── Shared display function ──────────────────────────────────────────────
function showDashboardButton(id) {
  let dashBtn = document.getElementById("dash-btn");
  if (!dashBtn) {
    dashBtn = document.createElement("a");
    dashBtn.id = "dash-btn";
    dashBtn.className = "dl-btn";
    dashBtn.style.textAlign = "center";
    dashBtn.style.marginTop = "15px";
    dashBtn.style.fontWeight = "bold";
    dashBtn.style.borderColor = "#4ade80";
    dashBtn.style.color = "#4ade80";
    dashBtn.innerHTML = "🔗 Open Dashboard";
    dashBtn.target = "_blank";
    document.body.appendChild(dashBtn);
  }
  dashBtn.href = `${FRONTEND}/chat/${id}`;
  dashBtn.style.display = "block";
}
