"use client";

import { useState, useRef } from "react";
import { Check, Copy, Share2, Sparkles } from "lucide-react";
import { MarkdownRenderer } from "./markdown-renderer";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
}

// ---------------------------------------------------------------------------
// Copy button (small)
// ---------------------------------------------------------------------------

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return (
    <button
      onClick={handleCopy}
      title="Copy response"
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
    >
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Share button (html2canvas)
// ---------------------------------------------------------------------------

function ShareBtn({ content }: { content: string }) {
  const [sharing, setSharing] = useState(false);

  async function handleShare() {
    setSharing(true);
    try {
      // Dynamically import html2canvas to avoid SSR issues
      const html2canvas = (await import("html2canvas")).default;

      // Build a styled off-screen element
      const wrapper = document.createElement("div");
      wrapper.style.cssText = `
        position: fixed; left: -9999px; top: 0;
        width: 720px; padding: 40px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%);
        border-radius: 20px;
      `;

      // Header
      const header = document.createElement("div");
      header.style.cssText = "display: flex; align-items: center; gap: 12px; margin-bottom: 24px;";
      header.innerHTML = `
        <div style="width:40px;height:40px;border-radius:12px;background:#4f46e5;display:flex;align-items:center;justify-content:center;">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="white"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
        </div>
        <div>
          <div style="font-size:14px;font-weight:700;color:#1e1b4b;">BlockBoost Copilot</div>
          <div style="font-size:11px;color:#6366f1;">AI Visibility Insight</div>
        </div>
      `;
      wrapper.appendChild(header);

      // Content
      const contentEl = document.createElement("div");
      contentEl.style.cssText = `
        background: white; border-radius: 14px; padding: 24px;
        font-size: 13px; line-height: 1.7; color: #334155;
        box-shadow: 0 4px 24px rgba(79,70,229,0.08);
        white-space: pre-wrap; word-wrap: break-word;
      `;
      // Strip markdown symbols for cleaner image
      contentEl.textContent = content
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        .replace(/^#{1,3}\s+/gm, "")
        .replace(/^[-*]\s+/gm, "• ");
      wrapper.appendChild(contentEl);

      // Footer
      const footer = document.createElement("div");
      footer.style.cssText =
        "margin-top: 20px; font-size: 11px; color: #94a3b8; text-align: right;";
      footer.textContent = `blockboost.co • ${new Date().toLocaleDateString()}`;
      wrapper.appendChild(footer);

      document.body.appendChild(wrapper);
      const canvas = await html2canvas(wrapper, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        logging: false,
      });
      document.body.removeChild(wrapper);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.download = `visibility-insight-${Date.now()}.png`;
        a.href = url;
        a.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    } catch {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(content).catch(() => {});
    } finally {
      setSharing(false);
    }
  }

  return (
    <button
      onClick={handleShare}
      disabled={sharing}
      title="Share as image"
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
    >
      <Share2 className="h-3 w-3" />
      {sharing ? "…" : "Share"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main message bubble
// ---------------------------------------------------------------------------

interface Props {
  message: ChatMessage;
  isStreaming?: boolean;
}

export function MessageBubble({ message, isStreaming }: Props) {
  const bubbleRef = useRef<HTMLDivElement>(null);

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-lg">
          <div className="bg-indigo-600 text-white px-4 py-3 rounded-2xl rounded-tr-sm text-sm leading-relaxed shadow-sm">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  // Assistant
  return (
    <div className="flex items-end gap-3">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
        <Sparkles className="h-4 w-4 text-white" />
      </div>

      <div className="flex-1 min-w-0">
        <div
          ref={bubbleRef}
          className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm max-w-2xl"
        >
          <MarkdownRenderer content={message.content} />
          {isStreaming && (
            <span className="inline-block w-1.5 h-4 bg-indigo-500 rounded-sm ml-0.5 animate-pulse align-text-bottom" />
          )}
        </div>

        {/* Action row — only shown when not streaming */}
        {!isStreaming && message.content && (
          <div className="flex items-center gap-0.5 mt-1 pl-1">
            <CopyBtn text={message.content} />
            <ShareBtn content={message.content} />
          </div>
        )}
      </div>
    </div>
  );
}
