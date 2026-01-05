function scrapeConversation() {
  const messages = [];
  const nodes = document.querySelectorAll("article, div");

  let index = 0;

  nodes.forEach((node) => {
    const text = node.innerText?.trim();
    if (!text || text.length < 10) return;

    let role = "unknown";
    const explicitRole = node.getAttribute("data-message-author-role");
    if (explicitRole) role = explicitRole;

    messages.push({
      index,
      role,
      raw_text: text,
      has_code: node.querySelector("pre, code") !== null,
      char_length: text.length
    });

    index++;
  });

  return messages;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "SCRAPE_CHAT") {
    sendResponse({
      messages: scrapeConversation(),
      url: window.location.href
    });
  }
});
