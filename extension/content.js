console.log("[CONTENT] Script loaded");

/* =======================================================
   HELPERS
======================================================= */

function unique(arr) {
  return [...new Set(arr)];
}

function safeText(el) {
  return el?.innerText?.trim() || "";
}

/* ---------- ROLE DETECTION (multi-platform) ---------- */
function detectRole(node) {
  const roleAttr =
    node.getAttribute("data-message-author-role") ||
    node.getAttribute("data-author-role");

  if (roleAttr) return roleAttr;

  // ChatGPT / Gemini hints
  if (node.querySelector("[aria-label*='You said'], h5.sr-only"))
    return "user";

  // heuristic fallback
  const txt = safeText(node).toLowerCase();

  if (txt.startsWith("you said")) return "user";
  if (txt.startsWith("assistant")) return "assistant";

  return "unknown";
}

/* ---------- CODE EXTRACTION ---------- */
function extractCodeBlocks(node) {
  const blocks = [];

  node.querySelectorAll("pre, code").forEach((el) => {
    const t = safeText(el);
    if (t.length > 0) blocks.push(t);
  });

  return unique(blocks);
}

/* ---------- TEXT EXTRACTION ---------- */
function extractTextBlocks(node) {
  const blocks = [];

  // IMPORTANT: only leaf nodes (prevents duplicates)
  node.querySelectorAll("p, li, h1, h2, h3, h4, h5").forEach((el) => {
    const txt = safeText(el);
    if (txt) blocks.push(txt);
  });

  // fallback if nothing found
  if (!blocks.length) {
    const txt = safeText(node);
    if (txt) blocks.push(txt);
  }

  return unique(blocks);
}

/* =======================================================
   SCROLL TO LOAD FULL HISTORY
======================================================= */

async function scrollToTop() {
  console.log("[CONTENT] Loading full history...");

  let stable = 0;
  let lastHeight = 0;

  while (stable < 3) {
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 1000));

    const h = document.body.scrollHeight;

    if (h === lastHeight) stable++;
    else {
      stable = 0;
      lastHeight = h;
    }
  }

  console.log("[CONTENT] History loaded");
}

/* =======================================================
   MESSAGE NODE DISCOVERY (multi-platform)
======================================================= */

function findMessageNodes() {

  // ChatGPT / Claude / Gemini / Perplexity common patterns
  let nodes = document.querySelectorAll(
    "[data-message-author-role], article, [role='listitem']"
  );

  if (nodes.length > 0) return [...nodes];

  // fallback heuristic
  return [...document.querySelectorAll("div")]
    .filter(el => safeText(el).length > 100)
    .slice(-80); // avoid grabbing whole page
}

/* =======================================================
   MAIN SCRAPER
======================================================= */

function scrapeConversation() {

  const nodes = findMessageNodes();
  const messages = [];

  nodes.forEach((node, i) => {

    const rawText = safeText(node);
    if (!rawText) return;

    const codeBlocks = extractCodeBlocks(node);
    const textBlocks = extractTextBlocks(node);

    messages.push({
      index: i,

      role: detectRole(node),

      raw_text: rawText,
      text_blocks: textBlocks,
      code_blocks: codeBlocks,

      has_code: codeBlocks.length > 0,
      char_length: rawText.length,

      html_snapshot: node.innerHTML.slice(0, 3000)
    });
  });

  return messages;
}

/* =======================================================
   LISTENER
======================================================= */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  if (msg.type !== "SCRAPE_CHAT") return;

  (async () => {
    try {
      console.log("[CONTENT] Starting extraction");

      await scrollToTop();

      const data = {
        url: location.href,
        title: document.title,
        timestamp: new Date().toISOString(),
        platform: location.hostname,
        messages: scrapeConversation()
      };

      console.log("[CONTENT] Extracted:", data.messages.length);

      sendResponse(data);

    } catch (e) {
      console.error("[CONTENT] ERROR:", e);
      sendResponse({ status: "ERROR", error: e.message });
    }
  })();

  return true;
});
