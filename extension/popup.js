document.getElementById("extract").onclick = async () => {
  console.log("[POPUP] Clicked");

  const res = await chrome.runtime.sendMessage({
    type: "START_EXTRACTION"
  });

  console.log("[POPUP] Response:", res);
};
