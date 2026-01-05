chrome.runtime.onMessageExternal.addListener(
  async (request, sender, sendResponse) => {
    if (request.type !== "START_EXTRACTION") return;

    const { chatUrl } = request;

    const tabs = await chrome.tabs.query({});
    const targetTab = tabs.find((t) => t.url === chatUrl);

    if (!targetTab) {
      sendResponse({
        status: "ERROR",
        message: "Tab not open. Please open the chat link."
      });
      return;
    }

    const response = await chrome.tabs.sendMessage(
      targetTab.id,
      { type: "SCRAPE_CHAT" }
    );

    sendResponse({
      status: "SUCCESS",
      data: response
    });
  }
);
