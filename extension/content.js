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

/* ---------- PLATFORM DETECTION ---------- */
function detectPlatform() {
  const h = location.hostname;
  if (h.includes("chatgpt.com") || h.includes("chat.openai.com")) return "chatgpt";
  if (h.includes("claude.ai")) return "claude";
  if (h.includes("gemini.google.com")) return "gemini";
  if (h.includes("perplexity.ai")) return "perplexity";
  if (h.includes("copilot.microsoft.com")) return "copilot";
  return "unknown";
}

/* ---------- ROLE DETECTION (multi-platform) ---------- */
function detectRole(node, platform) {
  // ChatGPT: has data-message-author-role attribute
  const roleAttr =
    node.getAttribute("data-message-author-role") ||
    node.getAttribute("data-author-role");
  if (roleAttr) return roleAttr;

  // Claude: human turn vs assistant turn
  if (platform === "claude") {
    if (node.querySelector(".font-user-message, [data-is-streaming]")) return "user";
    if (node.querySelector(".font-claude-message")) return "assistant";
  }

  // Gemini: user bubbles vs model response
  if (platform === "gemini") {
    if (node.closest("user-query, .user-query-container")) return "user";
    if (node.closest("model-response, .model-response-container")) return "assistant";
  }

  // Perplexity
  if (platform === "perplexity") {
    if (node.querySelector(".whitespace-pre-line")) return "user";
    if (node.querySelector(".prose")) return "assistant";
  }

  // heuristic fallback
  if (node.querySelector("[aria-label*='You said'], h5.sr-only")) return "user";
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
  const MAX_WAIT_MS = 15000;  // never wait more than 15 seconds total
  const startTime = Date.now();

  while (stable < 3) {
    // ── Bail out if we've been scrolling too long ──
    if (Date.now() - startTime > MAX_WAIT_MS) {
      console.warn("[CONTENT] Scroll timeout — extracting what's visible");
      break;
    }

    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 800));

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

function findMessageNodes(platform) {

  // Platform-specific selectors (highest accuracy)
  const platformSelectors = {
    chatgpt: "[data-message-author-role]",
    claude: ".font-user-message, .font-claude-message, [data-testid*='message']",
    gemini: "user-query, model-response, .conversation-container .turn",
    perplexity: "[data-testid='search-answer-item'], .message-bubble, .prose-container",
    copilot: "[class*='ChatTurn'], [data-testid*='message']",
  };

  const selector = platformSelectors[platform];
  if (selector) {
    const nodes = document.querySelectorAll(selector);
    if (nodes.length > 0) return [...nodes];
  }

  // Generic fallback: article tags and role=listitem
  let nodes = document.querySelectorAll("article, [role='listitem']");
  if (nodes.length > 0) return [...nodes];

  // Last-resort heuristic: large divs
  return [...document.querySelectorAll("div")]
    .filter(el => safeText(el).length > 100)
    .slice(-80);
}

/* =======================================================
   MAIN SCRAPER
======================================================= */

function scrapeConversation() {

  const platform = detectPlatform();
  const nodes = findMessageNodes(platform);
  const messages = [];

  nodes.forEach((node, i) => {

    const rawText = safeText(node);
    if (!rawText) return;

    const codeBlocks = extractCodeBlocks(node);
    const textBlocks = extractTextBlocks(node);

    messages.push({
      index: i,

      role: detectRole(node, platform),

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
