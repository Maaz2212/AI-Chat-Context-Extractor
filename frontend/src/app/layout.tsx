import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { Suspense } from "react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Chat Extractor Dashboard",
  description: "Manage your extracted AI chats",
  icons: {
    icon: "/logo.svg",
  },
};

// Next.js Server Component to fetch the sidebar list
async function getConversations() {
  try {
    // Revalidates extremely often so the dashboard is snappy
    const res = await fetch("http://127.0.0.1:8000/conversations", { next: { revalidate: 1 } });
    if (!res.ok) return [];
    return res.json();
  } catch (err) {
    console.error("Failed to fetch conversations", err);
    return [];
  }
}

async function SidebarList() {
  const convos = await getConversations();

  if (convos.length === 0) {
    return <div className="text-gray-500 text-sm p-4">No conversations yet.</div>;
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      {convos.map((conv: any) => (
        <Link
          key={conv.id}
          href={`/chat/${conv.id}`}
          className="border border-[#2a2a36] hover:border-[#4f6ef7] bg-[#1a1a22] hover:bg-[#2a2a38] transition-all p-3 rounded-xl block"
        >
          <div className="text-xs text-gray-400 font-mono mb-1">{conv.platform}</div>
          <div className="text-sm text-gray-200 truncate font-semibold mb-2">
            {conv.title || "Untitled Chat"}
          </div>
          <div className="flex gap-1 flex-wrap">
            {conv.top_topics?.slice(0, 3).map((topic: string) => (
              <span key={topic} className="bg-[#2a2a40] border border-[#4f6ef7] text-[#9db0ff] px-2 py-0.5 rounded-full text-[10px]">
                {topic}
              </span>
            ))}
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-[#0d0d12] text-white flex h-screen overflow-hidden`}>

        {/* Sidebar */}
        <div className="w-80 border-r border-[#1f1f2e] bg-[#0d0d12] flex flex-col h-full shrink-0">
          <div className="p-5 border-b border-[#1f1f2e]">
            <h1 className="text-lg font-bold bg-gradient-to-r from-[#4f6ef7] to-[#a05ff7] bg-clip-text text-transparent">
              Context Extractor
            </h1>
            <p className="text-xs text-gray-500 mt-1">Chat Management</p>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <Suspense fallback={<div className="p-4 text-gray-500 text-sm">Loading chats...</div>}>
              <SidebarList />
            </Suspense>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 h-full overflow-y-auto custom-scrollbar relative">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#19214d] via-[#0d0d12] to-[#0d0d12] pointer-events-none opacity-40"></div>
          <div className="relative z-10 w-full max-w-5xl mx-auto p-10">
            {children}
          </div>
        </div>

      </body>
    </html>
  );
}
