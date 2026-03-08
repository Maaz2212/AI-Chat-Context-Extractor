"""
app.py — FastAPI Backend for Chat Context Extractor

Endpoints:
  POST /extract          — receive scraped chat, process, save, return outputs
  GET  /conversations    — list all saved conversations
  GET  /download/{file}  — download any saved file (JSON, .md, .txt)
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import json
import uuid
from datetime import datetime
from pathlib import Path

from processor import (
    build_structured_json,   # Step 1: TF-IDF keywords + clean structure
    textrank_summarize,      # Step 2: TextRank compressed summary
    build_document,          # Step 3a: Markdown document
    build_context_chunks,    # Step 3b: Context chunks for new AI chat
    build_code_snapshot,     # Step 4: Code state snapshot for debugging
)

# ─── Storage ─────────────────────────────────────────────────────────────────
STORAGE_DIR = Path(__file__).parent / "data" / "conversations"
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Chat Context Extractor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────────────────────
# MAIN ENDPOINT: receive chat → process → generate all 3 download files
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "running"}


@app.post("/extract")
def extract(data: dict):
    """
    Full pipeline:
      1. Clean + TF-IDF enrich messages             (build_structured_json)
      2. TextRank compressed summary                 (textrank_summarize)
      3. Generate 3 output files and save to disk:
           • {id}_structured.json   — clean JSON with keywords
           • {id}_document.md       — readable Markdown export
           • {id}_context.txt       — context chunk for new AI chat
      4. Return download URLs to caller (extension popup)
    """
    print(f"\n[EXTRACT] {data.get('platform')} | {data.get('url')}")

    # ── Generate ID ──
    conv_id   = str(uuid.uuid4())[:8]
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    data["id"]        = conv_id
    data["timestamp"] = timestamp

    # ── Step 1: Structured JSON ──
    structured = build_structured_json(data)
    print(f"[STEP1] {structured['message_count']} messages | topics: {structured['top_topics'][:4]}")

    # ── Step 2: TextRank Summary ──
    summary = textrank_summarize(structured, max_sentences=8)
    print(f"[STEP2] Summary: {len(summary)} chars")

    # ── Step 3a: Markdown Document ──
    document = build_document(structured, summary)

    # ── Step 3b: Context Chunks ──
    context = build_context_chunks(structured, summary)

    # ── Step 4: Code State Snapshot ──
    code_state = build_code_snapshot(structured)

    # ── Save all 4 files ──
    base = f"{timestamp}_{conv_id}"
    files = {
        "json":       STORAGE_DIR / f"{base}_structured.json",
        "document":   STORAGE_DIR / f"{base}_document.md",
        "context":    STORAGE_DIR / f"{base}_context.txt",
        "code_state": STORAGE_DIR / f"{base}_code_state.txt",
    }

    files["json"].write_text(json.dumps(structured, indent=2, ensure_ascii=False))
    files["document"].write_text(document)
    files["context"].write_text(context)
    files["code_state"].write_text(code_state)

    print(f"[SAVED] {base}_*.json/.md/.txt (4 files)")

    # ── Return response with download URLs ──
    return {
        "status":        "SUCCESS",
        "id":            conv_id,
        "platform":      structured["platform"],
        "message_count": structured["message_count"],
        "top_topics":    structured["top_topics"],
        "summary":       summary[:300],   # short preview in popup
        "downloads": {
            "json":       f"/download/{files['json'].name}",
            "document":   f"/download/{files['document'].name}",
            "context":    f"/download/{files['context'].name}",
            "code_state": f"/download/{files['code_state'].name}",
        }
    }


# ─────────────────────────────────────────────────────────────────────────────
# DOWNLOAD ENDPOINT
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/download/{filename}")
def download_file(filename: str):
    """Serve any saved file as a download."""
    file_path = STORAGE_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    # Set correct content type
    if filename.endswith(".json"):
        media_type = "application/json"
    elif filename.endswith(".md"):
        media_type = "text/markdown"
    else:
        media_type = "text/plain"

    return FileResponse(
        path=file_path,
        filename=filename,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ─────────────────────────────────────────────────────────────────────────────
# LIST CONVERSATIONS
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/conversations")
def list_conversations():
    """List all saved structured JSON conversations."""
    files = sorted(STORAGE_DIR.glob("*_structured.json"), reverse=True)
    result = []
    for f in files:
        try:
            d = json.loads(f.read_text())
            base = f.stem.replace("_structured", "")
            result.append({
                "id":            d.get("id"),
                "timestamp":     d.get("timestamp"),
                "platform":      d.get("platform"),
                "title":         d.get("title"),
                "message_count": d.get("message_count"),
                "top_topics":    d.get("top_topics", [])[:5],
                "downloads": {
                    "json":       f"/download/{base}_structured.json",
                    "document":   f"/download/{base}_document.md",
                    "context":    f"/download/{base}_context.txt",
                    "code_state": f"/download/{base}_code_state.txt",
                }
            })
        except Exception:
            continue
    return result
