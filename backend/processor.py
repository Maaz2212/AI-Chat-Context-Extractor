"""
processor.py — Custom NLP Engine (built from scratch, no AI APIs)

STEP 1: TF-IDF Keyword Extraction + Structured JSON
=====================================================
TF-IDF = Term Frequency × Inverse Document Frequency

Think of it like this:
  - "the", "is", "a" appear everywhere → low IDF → low score (not important)
  - "recursion", "neural", "gradient" appear rarely → high IDF → high score (important)
  - "python" appears a lot IN THIS MESSAGE → high TF → high score (important here)

Final score = TF × IDF → big score = word is important in THIS message but not everywhere
"""

import re
import math
import json
from collections import Counter
from pathlib import Path


# ─────────────────────────────────────────────────────────
# STEP 0:  TEXT CLEANING UTILITIES
# ─────────────────────────────────────────────────────────

# Words that carry no meaning — we ignore them in TF-IDF
STOPWORDS = set("""
a about above after again against all also am an and any are aren't as at
be because been before being below between both but by can can't cannot could
couldn't did didn't do does doesn't doing don't down during each few for from
further get got had hadn't has hasn't have haven't having he he'd he'll he's
her here here's hers herself him himself his how how's i i'd i'll i'm i've
if in into is isn't it it's its itself just know let's like me more most
mustn't my myself no nor not now of off on once only or other ought our ours
ourselves out over own right same shan't she she'd she'll she's should shouldn't
so some such than that that's the their theirs them themselves then there there's
these they they'd they'll they're they've this those through to too under until
up very was wasn't we we'd we'll we're we've were weren't what what's when
when's where where's which while who who's whom why why's will with won't would
wouldn't you you'd you'll you're you've your yours yourself yourselves 
use using used also get can will make want need
""".split())


def clean_text(text: str) -> str:
    """Lowercase, remove punctuation, collapse whitespace."""
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)   # remove punctuation
    text = re.sub(r"\s+", " ", text).strip()     # collapse spaces
    return text


def tokenize(text: str) -> list[str]:
    """Split text into words, remove stopwords and short tokens."""
    tokens = clean_text(text).split()
    return [w for w in tokens if w not in STOPWORDS and len(w) > 2]


# ─────────────────────────────────────────────────────────
# STEP 1A:  TF-IDF VECTORIZER  (built from scratch)
# ─────────────────────────────────────────────────────────

class TFIDFVectorizer:
    """
    Compute TF-IDF scores for a collection of documents (messages).

    How it works:
    1. fit(documents) — scan all docs, count how many contain each word → IDF
    2. tfidf(doc, doc_index) — for one doc, compute TF × IDF for each word
    3. keywords(doc_index, n) — return top-n words by score

    Math:
        TF(word, doc)  = count(word in doc) / len(doc)
        IDF(word)      = log( N / df(word) )   where N = total docs, df = docs containing word
        score          = TF × IDF
    """

    def __init__(self):
        self.idf: dict[str, float] = {}   # word → IDF score
        self.vocab: set[str] = set()
        self.N: int = 0                   # total number of documents

    def fit(self, documents: list[str]):
        """
        Scan all documents and compute IDF for every word.
        Call this ONCE with all messages before computing scores.
        """
        self.N = len(documents)
        # df = document frequency: how many docs contain each word
        df: Counter = Counter()

        for doc in documents:
            tokens = set(tokenize(doc))   # set → count each word once per doc
            df.update(tokens)
            self.vocab.update(tokens)

        # IDF formula: log(N / df)  — rare words get high IDF
        # +1 on df avoids division by 0 for safety
        for word, freq in df.items():
            self.idf[word] = math.log(self.N / (freq + 1)) + 1.0

        return self  # allows chaining: vectorizer.fit(docs).tfidf(...)

    def tfidf_scores(self, doc: str) -> dict[str, float]:
        """
        Compute TF-IDF score for every word in one document.
        Returns dict: { word → score }
        """
        tokens = tokenize(doc)
        if not tokens:
            return {}

        # TF: frequency of each word in THIS document
        tf_counts = Counter(tokens)
        total = len(tokens)

        scores = {}
        for word, count in tf_counts.items():
            tf = count / total                         # normalize by doc length
            idf = self.idf.get(word, 1.0)             # fall back to 1.0 if unseen
            scores[word] = round(tf * idf, 5)

        return scores

    def top_keywords(self, doc: str, n: int = 5) -> list[str]:
        """Return top-n keywords for a document by TF-IDF score."""
        scores = self.tfidf_scores(doc)
        ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        return [word for word, _ in ranked[:n]]

    def top_keywords_with_scores(self, doc: str, n: int = 5) -> list[dict]:
        """Return top-n keywords with their TF-IDF scores (useful for debugging)."""
        scores = self.tfidf_scores(doc)
        ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:n]
        return [{"word": w, "score": s} for w, s in ranked]


# ─────────────────────────────────────────────────────────
# STEP 1B:  STRUCTURED JSON BUILDER
# ─────────────────────────────────────────────────────────

def build_structured_json(raw_data: dict) -> dict:
    """
    Take the raw scraped data from the extension and produce a clean,
    enriched structured JSON with TF-IDF keywords per message.

    Input:  dict with keys: url, platform, title, messages
    Output: clean structured dict ready for saving / download
    """

    messages = raw_data.get("messages", [])

    # ── 1. Clean: drop empty messages and deduplicate ──
    seen_texts = set()
    cleaned_messages = []
    for msg in messages:
        text = msg.get("raw_text", "").strip()
        if not text or len(text) < 5:
            continue                     # skip near-empty messages
        if text in seen_texts:
            continue                     # skip exact duplicates
        seen_texts.add(text)
        cleaned_messages.append(msg)

    # ── 2. Fit TF-IDF on ALL messages at once ──
    all_texts = [m.get("raw_text", "") for m in cleaned_messages]
    vectorizer = TFIDFVectorizer()
    vectorizer.fit(all_texts)

    # ── 3. Enrich each message with keywords and scores ──
    enriched_messages = []
    for msg in cleaned_messages:
        text = msg.get("raw_text", "")
        keywords = vectorizer.top_keywords(text, n=5)
        keyword_scores = vectorizer.top_keywords_with_scores(text, n=5)

        enriched_messages.append({
            "role":           msg.get("role", "unknown"),
            "text":           text,
            "char_length":    len(text),
            "has_code":       msg.get("has_code", False),
            "code_blocks":    msg.get("code_blocks", []),
            "keywords":       keywords,
            "keyword_scores": keyword_scores,   # visible for learning/debugging
        })

    # ── 4. Compute conversation-level keyword summary ──
    all_text_joined = " ".join(all_texts)
    global_vectorizer = TFIDFVectorizer().fit([all_text_joined])
    # For a single doc, IDF collapses so we just rank by term frequency
    global_word_counts = Counter(tokenize(all_text_joined))
    top_global = [w for w, _ in global_word_counts.most_common(10)]

    return {
        "id":              raw_data.get("id", "unknown"),
        "platform":        raw_data.get("platform", "unknown"),
        "url":             raw_data.get("url", ""),
        "title":           raw_data.get("title", ""),
        "timestamp":       raw_data.get("timestamp", ""),
        "message_count":   len(enriched_messages),
        "top_topics":      top_global,         # conversation-level keywords
        "messages":        enriched_messages,
    }


# ─────────────────────────────────────────────────────────
# STEP 2:  TEXTRANK SUMMARIZER  (built from scratch)
# ─────────────────────────────────────────────────────────
#
# Algorithm: TextRank (same idea as Google PageRank, applied to sentences)
#
# Steps:
#   1. Split conversation into sentences
#   2. Represent each sentence as a TF-IDF vector (word → score dict)
#   3. Build a similarity GRAPH:
#        - nodes = sentences
#        - edge weight = cosine similarity between two sentences' TF-IDF vectors
#   4. Run PageRank on this graph:
#        - A sentence "votes" for similar sentences
#        - Sentences voted by many other sentences get higher scores
#   5. Pick top-N sentences sorted by original position → compressed summary
#
# Why this works:
#   Important sentences tend to share vocabulary with many other sentences.
#   They are the "hubs" of the conversation.
# ─────────────────────────────────────────────────────────

def _cosine_similarity(vec_a: dict, vec_b: dict) -> float:
    """
    Cosine similarity between two TF-IDF score dicts.

    Formula:  dot(A, B) / (magnitude(A) * magnitude(B))

    Range: 0.0 (completely different) → 1.0 (identical)
    """
    # dot product: sum of (score_a * score_b) for shared words
    shared_words = set(vec_a.keys()) & set(vec_b.keys())
    dot = sum(vec_a[w] * vec_b[w] for w in shared_words)

    # magnitudes
    mag_a = math.sqrt(sum(v * v for v in vec_a.values()))
    mag_b = math.sqrt(sum(v * v for v in vec_b.values()))

    if mag_a == 0 or mag_b == 0:
        return 0.0

    return dot / (mag_a * mag_b)


def _pagerank(similarity_matrix: list[list[float]],
              damping: float = 0.85,
              iterations: int = 30) -> list[float]:
    """
    PageRank algorithm on a sentence similarity graph.

    damping = 0.85 means: 85% of score comes from neighbours, 15% is base score
    iterations = 30 is enough for convergence in most cases

    Returns: list of scores, one per sentence
    """
    n = len(similarity_matrix)
    if n == 0:
        return []

    # Start: every sentence has equal score
    scores = [1.0 / n] * n

    for _ in range(iterations):
        new_scores = []
        for i in range(n):
            # Sum of weighted votes from all other sentences j → i
            total = 0.0
            for j in range(n):
                if i == j:
                    continue
                # Weight = similarity(j→i) / sum of all outgoing similarities from j
                out_sum = sum(similarity_matrix[j])
                if out_sum > 0:
                    total += similarity_matrix[j][i] / out_sum * scores[j]

            new_score = (1 - damping) / n + damping * total
            new_scores.append(new_score)

        scores = new_scores

    return scores


def textrank_summarize(structured_data: dict, max_sentences: int = 8) -> str:
    """
    Run TextRank over the conversation and return a compressed summary.

    How sentences are selected:
    1. Extract all text sentences from assistant messages (they contain the answers)
    2. Include user questions (short, so they add context without bloat)
    3. Score all sentences with PageRank
    4. Pick top max_sentences, sorted by ORIGINAL POSITION (not score) so it reads naturally

    Input:  structured_data dict (output of build_structured_json)
    Output: plain text summary string
    """
    messages = structured_data.get("messages", [])
    if not messages:
        return "No messages to summarize."

    # ── 1. Collect sentences with source metadata ──
    sentences = []
    for msg_idx, msg in enumerate(messages):
        role = msg.get("role", "unknown")
        text = msg.get("text", "")

        # Split into sentences on . ! ? or newline
        raw_sentences = re.split(r'(?<=[.!?])\s+|\n{2,}', text)

        for sent in raw_sentences:
            sent = sent.strip()
            # Skip very short sentences (less than 20 chars) — likely noise
            if len(sent) < 20:
                continue
            # Skip pure code blocks — they shouldn't go in the summary
            if sent.startswith("#include") or sent.startswith("def ") or sent.startswith("int "):
                continue
            sentences.append({
                "text":     sent,
                "role":     role,
                "msg_idx":  msg_idx,
                "orig_pos": len(sentences),   # remember original position
            })

    if len(sentences) < 2:
        # Not enough sentences — just return the first assistant message
        for msg in messages:
            if msg.get("role") == "assistant":
                return msg.get("text", "")[:500]
        return messages[0].get("text", "")[:500]

    # ── Cap sentences to avoid O(N²) blowup on huge conversations ──
    # 60 sentences → 60×60 = 3600 comparisons (fast)
    # 500 sentences → 500×500 = 250,000 comparisons (very slow)
    MAX_SENTENCES = 60
    if len(sentences) > MAX_SENTENCES:
        # Sample evenly across the conversation to maintain coverage
        step = len(sentences) / MAX_SENTENCES
        sentences = [sentences[int(i * step)] for i in range(MAX_SENTENCES)]

    # ── 2. Build TF-IDF vectors for every sentence ──
    all_sentence_texts = [s["text"] for s in sentences]
    vectorizer = TFIDFVectorizer()
    vectorizer.fit(all_sentence_texts)
    vectors = [vectorizer.tfidf_scores(s["text"]) for s in sentences]

    # ── 3. Build similarity matrix (N×N) ──
    n = len(sentences)
    similarity_matrix = [[0.0] * n for _ in range(n)]

    for i in range(n):
        for j in range(n):
            if i != j:
                similarity_matrix[i][j] = _cosine_similarity(vectors[i], vectors[j])

    # ── 4. Run PageRank ──
    scores = _pagerank(similarity_matrix)

    # ── 5. Pick top sentences ──
    ranked = sorted(enumerate(scores), key=lambda x: x[1], reverse=True)
    top_indices = sorted([idx for idx, _ in ranked[:max_sentences]])  # restore original order

    # ── 6. Format output ──
    lines = []
    last_role = None
    for idx in top_indices:
        s = sentences[idx]
        if s["role"] != last_role:
            role_label = "👤 USER" if s["role"] == "user" else "🤖 ASSISTANT"
            lines.append(f"\n{role_label}:")
            last_role = s["role"]
        lines.append(f"  {s['text']}")

    return "\n".join(lines).strip()


# ─────────────────────────────────────────────────────────
# STEP 3a:  DOWNLOADABLE DOCUMENT  (.md format)
# ─────────────────────────────────────────────────────────

def build_document(structured_data: dict, summary: str) -> str:
    """
    Build a clean Markdown document combining the summary + full conversation.
    This is what the user downloads as a readable file.
    """
    title    = structured_data.get("title", "Chat Conversation")
    platform = structured_data.get("platform", "unknown")
    url      = structured_data.get("url", "")
    ts       = structured_data.get("timestamp", "")
    topics   = structured_data.get("top_topics", [])
    messages = structured_data.get("messages", [])

    lines = [
        f"# {title}",
        f"",
        f"**Platform:** {platform}  ",
        f"**Exported:** {ts}  ",
        f"**URL:** {url}  ",
        f"",
        f"---",
        f"",
        f"## 📋 Summary",
        f"",
        summary,
        f"",
        f"---",
        f"",
        f"## 🏷️ Top Topics",
        f"",
        f"`{'`  `'.join(topics)}`",
        f"",
        f"---",
        f"",
        f"## 💬 Full Conversation",
        f"",
    ]

    for msg in messages:
        role = msg.get("role", "unknown")
        text = msg.get("text", "")
        keywords = msg.get("keywords", [])
        has_code = msg.get("has_code", False)

        icon = "👤" if role == "user" else "🤖"
        lines.append(f"### {icon} {role.upper()}")

        if keywords:
            lines.append(f"*Keywords: {', '.join(keywords)}*")
        lines.append(f"")
        lines.append(text)

        if has_code and msg.get("code_blocks"):
            for code in msg["code_blocks"][:2]:   # max 2 code blocks per message
                if len(code) > 50:
                    lines.append(f"\n```\n{code[:800]}\n```")

        lines.append(f"")
        lines.append(f"---")
        lines.append(f"")

    return "\n".join(lines)


# ─────────────────────────────────────────────────────────
# STEP 3b:  CONTEXT CHUNK  (paste into new AI chat)
# ─────────────────────────────────────────────────────────
#
# Algorithm: Sliding Window Chunker + TF-IDF scoring
#
# How it works:
#   1. Divide conversation into overlapping chunks of ~CHUNK_WORDS words
#   2. Score each chunk by the average TF-IDF weight of its words
#      (chunks with rare, important words score higher)
#   3. Pick the best chunks up to MAX_TOKENS total
#   4. Format as a ready-to-paste prompt
# ─────────────────────────────────────────────────────────

CHUNK_WORDS   = 150   # words per chunk
OVERLAP_WORDS = 30    # overlap between chunks to avoid cutting context
MAX_TOKENS    = 1500  # maximum total words in context output


def build_context_chunks(structured_data: dict, summary: str) -> str:
    """
    Build a context string optimized for pasting into a new AI chat.

    Output format:
      [CONTEXT START]
      <summary>
      <most important chunks of conversation>
      [CONTEXT END]
      Continue this conversation: ...
    """
    messages  = structured_data.get("messages", [])
    title     = structured_data.get("title", "conversation")
    platform  = structured_data.get("platform", "")
    topics    = structured_data.get("top_topics", [])

    # ── 1. Flatten conversation into word tokens with metadata ──
    word_units = []   # list of (word, role)
    for msg in messages:
        role  = msg.get("role", "unknown")
        words = msg.get("text", "").split()
        for w in words:
            word_units.append((w, role))

    if not word_units:
        return "No conversation content found."

    # ── 2. Build TF-IDF on the whole conversation ──
    all_texts = [m.get("text", "") for m in messages]
    vectorizer = TFIDFVectorizer()
    vectorizer.fit(all_texts)

    # Word-level importance: average TF-IDF score across messages
    # (proxy: use the IDF score directly — rare words are important)
    word_importance: dict[str, float] = {}
    for word in vectorizer.vocab:
        word_importance[word.lower()] = vectorizer.idf.get(word, 1.0)

    # ── 3. Sliding window chunking ──
    chunks = []
    total  = len(word_units)
    step   = CHUNK_WORDS - OVERLAP_WORDS

    i = 0
    while i < total:
        window = word_units[i : i + CHUNK_WORDS]
        words_only = [w for w, _ in window]
        role_of_chunk = window[0][1] if window else "unknown"

        # Score = average importance of words in this chunk
        scores = [word_importance.get(clean_text(w), 0.0) for w in words_only]
        avg_score = sum(scores) / len(scores) if scores else 0.0

        chunks.append({
            "text":  " ".join(words_only),
            "score": avg_score,
            "pos":   i,               # original position (for ordering)
            "role":  role_of_chunk,
        })

        i += step

    # ── 4. Select top chunks up to MAX_TOKENS ──
    # Sort by score descending, then re-sort selected by position for natural reading order
    sorted_chunks = sorted(chunks, key=lambda c: c["score"], reverse=True)
    selected = []
    total_words = 0

    for chunk in sorted_chunks:
        chunk_len = len(chunk["text"].split())
        if total_words + chunk_len > MAX_TOKENS:
            break
        selected.append(chunk)
        total_words += chunk_len

    # Restore original conversation order
    selected.sort(key=lambda c: c["pos"])

    # ── 5. Format as ready-to-paste context prompt ──
    lines = [
        "════════════════════════════════════════",
        "CONVERSATION CONTEXT (auto-generated)",
        f"Topic: {title}",
        f"Platform: {platform}",
        f"Key topics: {', '.join(topics[:6])}",
        "════════════════════════════════════════",
        "",
        "## SUMMARY",
        summary,
        "",
        "## KEY PARTS OF CONVERSATION",
        "",
    ]

    for chunk in selected:
        icon = "👤" if chunk["role"] == "user" else "🤖"
        lines.append(f"{icon} ...{chunk['text']}...")
        lines.append("")

    lines += [
        "════════════════════════════════════════",
        "Please continue this conversation with full context of what was discussed above.",
        "════════════════════════════════════════",
    ]

    return "\n".join(lines)

