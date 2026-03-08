export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center h-[70vh] text-center">
      <div className="mb-8 p-6 bg-[#1a1a22]/50 border border-[#2a2a36] rounded-3xl shadow-2xl backdrop-blur-md">
        <h1 className="text-4xl font-extrabold mb-4 bg-gradient-to-r from-[#4f6ef7] to-[#a05ff7] bg-clip-text text-transparent">
          Code Context Dashboard
        </h1>
        <p className="text-gray-400 max-w-md mx-auto">
          Select a chat from the sidebar to view its summary and download compressed context files for a new AI session.
        </p>
      </div>

      <div className="text-sm text-gray-500 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
        Waiting for new extractions from Chrome Extension...
      </div>
    </div>
  );
}
