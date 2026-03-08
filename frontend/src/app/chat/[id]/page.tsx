import Link from "next/link";

export const revalidate = 0; // Always fetch fresh data

async function getChatData(id: string) {
    try {
        const res = await fetch(`http://127.0.0.1:8000/conversation/${id}`, { cache: "no-store" });
        if (!res.ok) return null;
        return res.json();
    } catch (err) {
        console.error(err);
        return null;
    }
}

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = await params;
    const data = await getChatData(resolvedParams.id);

    if (!data) {
        return (
            <div className="flex flex-col items-center justify-center h-full">
                <h2 className="text-xl font-bold text-red-400">Chat not found</h2>
                <p className="text-gray-500 mt-2">Make sure your FastAPI server is running.</p>
            </div>
        );
    }

    const BACKEND = "http://127.0.0.1:8000";

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">

            {/* ── Header ── */}
            <div className="flex items-start justify-between mb-8 border-b border-[#1f1f2e] pb-6">
                <div>
                    <div className="text-[#4f6ef7] font-mono text-xs font-bold uppercase tracking-wider mb-2">
                        {data.platform} • {data.message_count} messages
                    </div>
                    <h1 className="text-3xl font-extrabold text-white mb-3">
                        {data.title || "Extracted Conversation"}
                    </h1>
                    <div className="flex gap-2 flex-wrap">
                        {data.top_topics?.map((topic: string) => (
                            <span key={topic} className="bg-[#2a2a40] border border-[#4f6ef7] text-[#9db0ff] px-2.5 py-1 rounded-full text-xs font-medium shadow-sm">
                                {topic}
                            </span>
                        ))}
                    </div>
                </div>
                <div className="text-gray-500 text-sm bg-[#1a1a22] px-3 py-1.5 rounded-lg border border-[#2a2a36]">
                    ID: <span className="font-mono text-gray-300">{data.id}</span>
                </div>
            </div>

            {/* ── Summary Card ── */}
            <div className="bg-[#13131c]/80 border border-[#2a2a36] rounded-2xl p-6 mb-8 backdrop-blur-md shadow-xl">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <span className="bg-[#4f6ef7]/20 text-[#4f6ef7] p-1.5 rounded-lg">✨</span>
                    AI Compressed Summary
                </h2>
                <div className="text-gray-300 leading-relaxed space-y-4 text-sm whitespace-pre-wrap">
                    {data.summary || "Summary generation pending..."}
                </div>
            </div>

            {/* ── Download Formats ── */}
            <h2 className="text-xl font-bold text-white mb-4 mt-10">Select Output Format</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Format 1: Code Snapshot */}
                <a
                    href={`${BACKEND}${data.downloads.code_state}`}
                    target="_blank"
                    className="group relative flex flex-col p-6 bg-gradient-to-br from-[#1a1a22] to-[#121219] border border-[#333] hover:border-[#4ade80] rounded-2xl transition-all shadow-lg hover:shadow-[#4ade80]/10 overflow-hidden"
                >
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#4ade80] to-[#2ecc71] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="text-3xl mb-3">💻</div>
                    <h3 className="text-lg font-bold text-white mb-2 group-hover:text-[#4ade80] transition-colors">Code State Snapshot</h3>
                    <p className="text-gray-400 text-sm">Best for debugging. Extracts Goal, Latest Code, and Failed Attempts to start a new chat perfectly.</p>
                </a>

                {/* Format 2: Context Chunk */}
                <a
                    href={`${BACKEND}${data.downloads.context}`}
                    target="_blank"
                    className="group relative flex flex-col p-6 bg-gradient-to-br from-[#1a1a22] to-[#121219] border border-[#333] hover:border-[#4f6ef7] rounded-2xl transition-all shadow-lg hover:shadow-[#4f6ef7]/10 overflow-hidden"
                >
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#4f6ef7] to-[#a05ff7] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="text-3xl mb-3">🔗</div>
                    <h3 className="text-lg font-bold text-white mb-2 group-hover:text-[#4f6ef7] transition-colors">Context Prompt</h3>
                    <p className="text-gray-400 text-sm">Best for general answers. Uses sliding-window TF-IDF to find the most important parts of the chat.</p>
                </a>

                {/* Format 3: Document */}
                <a
                    href={`${BACKEND}${data.downloads.document}`}
                    target="_blank"
                    className="group flex flex-col p-6 bg-[#1a1a22] border border-[#2a2a36] hover:border-[#eab308] rounded-2xl transition-all"
                >
                    <div className="text-3xl mb-3">📝</div>
                    <h3 className="text-lg font-bold text-white mb-2 group-hover:text-[#eab308] transition-colors">Markdown Document</h3>
                    <p className="text-gray-400 text-sm">A highly readable, formatted record of the entire conversation for human reading.</p>
                </a>

                {/* Format 4: JSON */}
                <a
                    href={`${BACKEND}${data.downloads.json}`}
                    target="_blank"
                    className="group flex flex-col p-6 bg-[#1a1a22] border border-[#2a2a36] hover:border-[#ec4899] rounded-2xl transition-all"
                >
                    <div className="text-3xl mb-3">📄</div>
                    <h3 className="text-lg font-bold text-white mb-2 group-hover:text-[#ec4899] transition-colors">Structured JSON</h3>
                    <p className="text-gray-400 text-sm">Raw data for developers. Contains TF-IDF keywords, token lengths, and parsed code blocks.</p>
                </a>

            </div>
        </div>
    );
}
