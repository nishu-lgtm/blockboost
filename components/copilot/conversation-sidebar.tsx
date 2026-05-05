"use client";

import { MessageSquare, Plus, Trash2, Clock } from "lucide-react";

export interface SessionSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessage: {
    snippet: string;
    role: string;
    createdAt: string;
  } | null;
}

interface Props {
  sessions: SessionSummary[];
  activeSessionId: string | null;
  loading: boolean;
  onNewConversation: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

function groupByDate(sessions: SessionSummary[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const lastWeek = new Date(today.getTime() - 7 * 86400000);

  const groups: { label: string; items: SessionSummary[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Last 7 days", items: [] },
    { label: "Older", items: [] },
  ];

  for (const s of sessions) {
    const d = new Date(s.updatedAt);
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (day >= today) groups[0].items.push(s);
    else if (day >= yesterday) groups[1].items.push(s);
    else if (d >= lastWeek) groups[2].items.push(s);
    else groups[3].items.push(s);
  }

  return groups.filter((g) => g.items.length > 0);
}

function SessionItem({
  session,
  active,
  onSelect,
  onDelete,
}: {
  session: SessionSummary;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`group relative rounded-lg cursor-pointer transition-all ${
        active ? "bg-indigo-50 text-indigo-700" : "hover:bg-slate-100"
      }`}
    >
      <button onClick={onSelect} className="w-full text-left px-3 py-2.5 pr-9">
        <p
          className={`text-xs font-medium leading-snug truncate ${
            active ? "text-indigo-700" : "text-slate-700"
          }`}
        >
          {session.title}
        </p>
        {session.lastMessage && (
          <p className="text-[10px] text-slate-400 truncate mt-0.5">
            {session.lastMessage.snippet}
          </p>
        )}
      </button>

      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        title="Delete conversation"
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

export function ConversationSidebar({
  sessions,
  activeSessionId,
  loading,
  onNewConversation,
  onSelectSession,
  onDeleteSession,
}: Props) {
  const groups = groupByDate(sessions);

  return (
    <div className="w-60 border-r border-slate-200 bg-slate-50 flex flex-col shrink-0">
      {/* Header */}
      <div className="px-3 pt-4 pb-3 border-b border-slate-200">
        <button
          onClick={onNewConversation}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4 shrink-0" />
          New conversation
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {loading && (
          <div className="space-y-2 px-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-lg bg-slate-200 h-10" />
            ))}
          </div>
        )}

        {!loading && sessions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
            <MessageSquare className="h-7 w-7 text-slate-300" />
            <p className="text-xs text-slate-400">No conversations yet</p>
          </div>
        )}

        {!loading &&
          groups.map((group) => (
            <div key={group.label}>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-1.5">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((s) => (
                  <SessionItem
                    key={s.id}
                    session={s}
                    active={s.id === activeSessionId}
                    onSelect={() => onSelectSession(s.id)}
                    onDelete={() => onDeleteSession(s.id)}
                  />
                ))}
              </div>
            </div>
          ))}
      </div>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-slate-200">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <Clock className="h-3 w-3" />
          History saved for 30 days
        </div>
      </div>
    </div>
  );
}
