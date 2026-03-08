const btn = document.getElementById("btn-extract");
const status = document.getElementById("status");
const result = document.getElementById("result");

const BACKEND = "http://localhost:8000";

// ── Restore last result when popup opens ──────────────────────────────────
// Chrome closes the popup when you switch tabs. We save the last result
// to chrome.storage.local so we can show it again when the popup reopens.
chrome.storage.local.get("lastResult", ({ lastResult }) => {
  if (lastResult) {
    showResult(lastResult);
    status.textContent = "↩ Last extraction restored.";
    status.className = "ok";
  }
});

// ── Button click ──────────────────────────────────────────────────────────
btn.onclick = async () => {
  btn.disabled = true;
  btn.textContent = "⏳ Extracting...";
  status.textContent = "Scrolling chat to load full history (~15s max)...";
  status.className = "";
  result.style.display = "none";
  document.getElementById("downloads").style.display = "none";

  try {
    const res = await chrome.runtime.sendMessage({ type: "START_EXTRACTION" });

    if (!res || res.status === "ERROR") {
      throw new Error(res?.message || "Unknown error from background");
    }

    // Save result so it survives tab switches
    chrome.storage.local.set({ lastResult: res });

    showResult(res);
    status.textContent = "✅ Done! Click a button below to download.";
    status.className = "ok";

  } catch (err) {
    status.textContent = "❌ Error: " + err.message;
    status.className = "error";
    console.error("[POPUP] Error:", err);
  }

  btn.disabled = false;
  btn.textContent = "⬆ Extract This Chat";
};

// ── Shared display function ──────────────────────────────────────────────
function showResult(res) {
  document.getElementById("r-platform").textContent = res.platform || "unknown";
  document.getElementById("r-count").textContent = (res.message_count || "?") + " messages";

  // Hide file row (not needed with download buttons)
  const fileEl = document.getElementById("r-file");
  if (fileEl) {
    const row = fileEl.closest(".stat-row");
    if (row) row.style.display = "none";
  }

  // Topic tags
  const topicsEl = document.getElementById("topics");
  topicsEl.innerHTML = "";
  (res.top_topics || []).slice(0, 8).forEach(topic => {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = topic;
    topicsEl.appendChild(tag);
  });

  // Download buttons
  if (res.downloads) {
    document.getElementById("dl-json").href = BACKEND + res.downloads.json;
    document.getElementById("dl-doc").href = BACKEND + res.downloads.document;
    document.getElementById("dl-context").href = BACKEND + res.downloads.context;
    document.getElementById("dl-code").href = BACKEND + res.downloads.code_state;
    document.getElementById("downloads").style.display = "flex";
  }

  result.style.display = "block";
}
