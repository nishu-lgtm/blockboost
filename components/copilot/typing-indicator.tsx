"use client";

export function TypingIndicator() {
  return (
    <div className="flex items-end gap-3">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
        </svg>
      </div>
      {/* Bubble */}
      <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full bg-indigo-400"
            style={{ animation: "bounce 1.2s ease-in-out infinite", animationDelay: "0ms" }}
          />
          <span
            className="w-2 h-2 rounded-full bg-indigo-400"
            style={{ animation: "bounce 1.2s ease-in-out infinite", animationDelay: "200ms" }}
          />
          <span
            className="w-2 h-2 rounded-full bg-indigo-400"
            style={{ animation: "bounce 1.2s ease-in-out infinite", animationDelay: "400ms" }}
          />
        </div>
      </div>
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.6; }
          30%           { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
