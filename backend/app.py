from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"status": "backend running"}


@app.post("/extract")
def extract(data: dict):

    print("\n========== EXTRACT RECEIVED ==========")
    print("URL:", data.get("url"))
    print("Total messages:", len(data.get("messages", [])))
    print("======================================")

    # 🔥 PRINT EACH MESSAGE (MAIN PART YOU NEED)
    for i, msg in enumerate(data.get("messages", [])):

        print(f"\n--- Message {i} ---")
        print("Role:", msg.get("role"))
        print("Has Code:", msg.get("has_code"))
        print("Characters:", msg.get("char_length"))

        # text preview (avoid huge terminal spam)
        text_blocks = msg.get("text_blocks", [])
        if text_blocks:
            print("Text Preview:", text_blocks[0][:120])

        # code preview
        code_blocks = msg.get("code_blocks", [])
        if code_blocks:
            print("Code Preview:", code_blocks[0][:120])

    print("\n========== END ==========\n")

    return {
        "status": "SUCCESS",
        "messages": data.get("messages", [])
    }
