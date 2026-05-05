"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  KeyboardEvent,
} from "react";
import { Send, Loader2, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConversationSidebar } from "@/components/copilot/conversation-sidebar";
import { MessageBubble } from "@/components/copilot/message-bubble";
import { TypingIndicator } from "@/components/copilot/typing-indicator";
import { StarterPrompts } from "@/components/copilot/starter-prompts";
import type { ChatMessage } from "@/components/copilot/message-bubble";
import type { SessionSummary } from "@/components/copilot/conversation-sidebar";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProjectSummary {
  id: string;
  name: string;
  brandName: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CopilotPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectSummary | null>(null);

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [input, setInput] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Load projects ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/projects/list")
      .then((r) => r.json())
      .then((list: ProjectSummary[]) => {
        setProjects(list);
        if (list.length > 0) setSelectedProject(list[0]);
      })
      .catch(() => {});
  }, []);

  // ── Load sessions when project changes ───────────────────────────────────
  const loadSessions = useCallback(async (projectId: string) => {
    setSessionsLoading(true);
    try {
      const res = await fetch(`/api/copilot/sessions?projectId=${projectId}`);
      if (!res.ok) return;
      const list = (await res.json()) as SessionSummary[];
      setSessions(list);
    } catch {
      /* silently fail */
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedProject) return;
    loadSessions(selectedProject.id);
    setMessages([]);
    setActiveSessionId(null);
  }, [selectedProject, loadSessions]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  // ── Auto-resize textarea ──────────────────────────────────────────────────
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  }

  // ── New conversation ──────────────────────────────────────────────────────
  function handleNewConversation() {
    abortRef.current?.abort();
    setMessages([]);
    setActiveSessionId(null);
    setStreaming(false);
    setInput("");
    textareaRef.current?.focus();
  }

  // ── Select past session ───────────────────────────────────────────────────
  async function handleSelectSession(sessionId: string) {
    abortRef.current?.abort();
    setStreaming(false);
    setActiveSessionId(sessionId);
    try {
      const res = await fetch(`/api/copilot/sessions/${sessionId}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        messages: { id: string; role: string; content: string; createdAt: string }[];
      };
      setMessages(
        data.messages.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          createdAt: m.createdAt,
        }))
      );
    } catch {
      /* silently fail */
    }
  }

  // ── Delete session ────────────────────────────────────────────────────────
  async function handleDeleteSession(sessionId: string) {
    try {
      await fetch(`/api/copilot/sessions/${sessionId}`, { method: "DELETE" });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) handleNewConversation();
    } catch {
      /* silently fail */
    }
  }

  // ── Send ──────────────────────────────────────────────────────────────────
  async function handleSend(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text || streaming || !selectedProject) return;

    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const userMsgId = `user-${Date.now()}`;
    const asstMsgId = `asst-${Date.now() + 1}`;
    const userMsg: ChatMessage = { id: userMsgId, role: "user", content: text };
    const asstMsg: ChatMessage = { id: asstMsgId, role: "assistant", content: "" };

    // Snapshot history before adding new messages
    const historyForApi = messages
      .filter((m) => m.content)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg]);
    setStreaming(true);

    let sessionId = activeSessionId;

    try {
      // Create session on first message of a new conversation
      if (!sessionId) {
        const res = await fetch("/api/copilot/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: selectedProject.id,
            title: truncate(text, 60),
          }),
        });
        if (res.ok) {
          const s = (await res.json()) as { id: string; title: string; createdAt: string };
          sessionId = s.id;
          setActiveSessionId(s.id);
          const newSession: SessionSummary = {
            id: s.id,
            title: s.title,
            createdAt: s.createdAt,
            updatedAt: s.createdAt,
            messageCount: 0,
            lastMessage: null,
          };
          setSessions((prev) => [newSession, ...prev]);
        }
      }

      // Add assistant placeholder (after creating session so UI doesn't flash)
      setMessages((prev) => [...prev, asstMsg]);

      // Stream
      const abort = new AbortController();
      abortRef.current = abort;

      const streamRes = await fetch("/api/copilot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...historyForApi, { role: "user", content: text }],
          projectId: selectedProject.id,
        }),
        signal: abort.signal,
      });

      if (!streamRes.ok || !streamRes.body) throw new Error("Stream failed");

      const reader = streamRes.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullContent += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) => (m.id === asstMsgId ? { ...m, content: fullContent } : m))
        );
      }

      // Persist messages (fire-and-forget)
      if (sessionId) {
        fetch(`/api/copilot/sessions/${sessionId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              { role: "user", content: text },
              { role: "assistant", content: fullContent },
            ],
          }),
        }).catch(() => {});

        // Update sidebar
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  messageCount: s.messageCount + 2,
                  updatedAt: new Date().toISOString(),
                  lastMessage: {
                    snippet: fullContent.slice(0, 80),
                    role: "assistant",
                    createdAt: new Date().toISOString(),
                  },
                }
              : s
          )
        );
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === asstMsgId
            ? {
                ...m,
                content:
                  "Sorry, I encountered an error. Please check your connection and try again.",
              }
            : m
        )
      );
    } finally {
      setStreaming(false);
    }
  }

  const streamingMsgId = streaming ? messages.at(-1)?.id : undefined;
  const showTyping =
    streaming && messages.length > 0 && messages.at(-1)?.content === "";

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* Conversation history sidebar */}
      <ConversationSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        loading={sessionsLoading}
        onNewConversation={handleNewConversation}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
      />

      {/* Main chat column */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 border-b border-slate-200 bg-white flex items-center px-5 gap-3 shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-800">AI Visibility Copilot</span>
            <span className="flex items-center gap-1 ml-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-[11px] text-slate-400">Online</span>
            </span>
          </div>

          {projects.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger>
                <div className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer">
                  {selectedProject?.name ?? "Select project"}
                  <ChevronDown className="h-3 w-3 text-slate-400" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {projects.map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    onSelect={() => setSelectedProject(p)}
                    className={selectedProject?.id === p.id ? "text-indigo-600 font-medium" : ""}
                  >
                    {p.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </header>

        {/* Messages / Empty state */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <StarterPrompts onSelect={(text) => handleSend(text)} />
          ) : (
            <div className="max-w-3xl mx-auto px-5 py-6 space-y-5">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isStreaming={streaming && msg.id === streamingMsgId}
                />
              ))}
              {showTyping && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-slate-200 bg-white px-5 py-4 shrink-0">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-3 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 focus-within:border-indigo-400 focus-within:bg-white transition-all shadow-sm">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={
                  selectedProject
                    ? `Ask about ${selectedProject.brandName}'s AEO performance…`
                    : "Ask about your AEO performance…"
                }
                rows={1}
                disabled={streaming}
                className="flex-1 resize-none bg-transparent text-sm text-slate-800 placeholder:text-slate-400 outline-none min-h-[24px] max-h-40 leading-6 disabled:opacity-50"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || streaming || !selectedProject}
                className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:cursor-not-allowed flex items-center justify-center transition-colors shrink-0"
              >
                {streaming ? (
                  <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 text-white" />
                )}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 text-center mt-2">
              ⌘ + Enter to send · Responses are grounded in your actual visibility data
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
