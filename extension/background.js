console.log("[BG] Background loaded");

async function sendToBackend(payload) {
  console.log("[BG] Sending to backend...");

  const res = await fetch("http://localhost:8000/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  console.log("[BG] Backend responded");
  return await res.json();
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("[BG] Message:", msg);

  if (msg.type !== "START_EXTRACTION") return;

  (async () => {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      });

      console.log("[BG] Active tab:", tab.url);

      const scrapeResult = await chrome.tabs.sendMessage(tab.id, {
        type: "SCRAPE_CHAT"
      });

      if (!scrapeResult) {
        throw new Error("No response from content script");
      }

      console.log("[BG] Scraped:", scrapeResult.messages.length);

      const backendRes = await sendToBackend(scrapeResult);
      console.log("[BG] Backend result:", backendRes);
      sendResponse(backendRes);

    } catch (err) {
      console.error("[BG] Error:", err);
      sendResponse({ status: "ERROR", message: err.message });
    }
  })();

  return true; // keeps channel open
});
