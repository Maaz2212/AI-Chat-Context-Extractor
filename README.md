# AI Chat Context Extractor

A full-stack, AI-powered tool designed to help developers compress and transfer long AI chat conversations across platforms when token limits are reached or when a fresh AI session is needed.

This project is built from scratch without relying on external APIs (like OpenAI) for the natural language processing. Instead, it utilizes custom ML algorithms like TF-IDF and TextRank implemented directly in the backend.

---

## 🏗️ Architecture

The system consists of three main components:

### 1. The Chrome Extension (`/extension`)
Acts as an "invisible bridge." It extracts the full conversation from the DOM of an AI platform (ChatGPT, Claude, Gemini, etc.), perfectly parsing user messages, AI responses, and code blocks (`<pre><code>`). Once scraped, it sends the data to the backend and immediately opens the Frontend Dashboard.

### 2. The FastAPI Backend (`/backend`)
The brain of the operation. It receives the raw chat data and runs a custom Natural Language Processing (NLP) pipeline on it. It generates four distinct formats and exposes REST APIS (`/conversations`, `/extract`, `/download`) for the frontend.

### 3. The Next.js Dashboard (`/frontend`)
A premium, dark-mode, animated frontend built with Next.js and TailwindCSS. It fetches data from the backend to display a beautiful UI containing a sidebar of past extractions, a compressed summary of the active chat, and large download buttons for the generated context files.

---

## 🧠 Custom NLP Pipeline
The backend (`processor.py`) implements several algorithms from scratch to process the raw chat:

1.  **TF-IDF Vectorization:** Built from scratch to analyze the importance of words across all messages and extract the "Top Topics" tags for the conversation.
2.  **TextRank Summarization:** An extractive summarization algorithm that builds a similarity graph of sentences, scores them using PageRank logic, and returns the top sentences to create a compressed AI summary.
3.  **Sliding Window Chunking:** Divides the conversation into overlapping chunks of tokens, scores them based on TF-IDF weight, and extracts the most relevant parts to fit within a strict token limit.
4.  **Language-Agnostic Heuristics:** Employs reverse traversal logic on the DOM-scraped `code_blocks` array to accurately pull the *latest* code state without being confused by older, broken drafts in the middle of the chat.

---

## 📦 Output Formats

When you extract a chat, the backend generates four powerful outputs:

*   **💻 Code State Snapshot (`.txt`):** The perfect format for debugging broken code. It extracts your Original Goal, the Latest Code Blocks, runs TextRank on just the middle explanations to summarize "Failed Attempts", and includes your Current Error.
*   **🔗 Context Prompt (`.txt`):** Best for general knowledge transfer. A prompt containing the sliding-window TF-IDF chunks, ready to be pasted into a new AI window.
*   **📝 Markdown Document (`.md`):** A beautiful, human-readable record of the entire conversation.
*   **📄 Structured JSON (`.json`):** The raw data, including token lengths, arrays of code blocks, and metadata, useful for programmatic analysis.

---

## 🚀 How to Run Locally

You must run all three components simultaneously for the system to work.

### 1. Run the Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload
```
*Runs on http://localhost:8000*

### 2. Run the Frontend
```bash
cd frontend
npm install
npm run dev
```
*Runs on http://localhost:3000*

### 3. Load the Extension
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** in the top right.
3. Click **Load unpacked** and select the `/extension` folder from this repository.
4. Go to any AI chat platform (e.g., chatgpt.com) and click the extension icon to extract!

---

## 🌐 Future Deployment
*   **Backend:** Can be deployed to Render.com or Railway.app as a standard FastAPI web service utilizing a Persistent Disk for the `data/conversations/` directory.
*   **Frontend:** Can be deployed effortlessly on Vercel.
*   **Extension:** Update the `FRONTEND` and `BACKEND` URL variables in `popup.js`, zip the folder, and share with users.
