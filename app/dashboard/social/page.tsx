"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  RefreshCw, ExternalLink, CheckCircle, Clock,
  Radio, Lock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import OpportunityCard from "@/components/social/opportunity-card";
import ReplyStudio from "@/components/social/reply-studio";
import GuidelinesModal from "@/components/social/guidelines-modal";
import SocialSettingsTab from "@/components/social/settings-tab";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Opportunity {
  id: string;
  platform: "REDDIT" | "QUORA" | "LINKEDIN";
  url: string;
  title: string;
  body: string;
  author: string;
  subreddit?: string | null;
  upvotes: number;
  commentCount: number;
  aiCitationProbability: number;
  relevanceScore: number;
  status: string;
  foundAt: string;
  replies: Array<{
    id: string;
    tone: string;
    approved: boolean;
    postedAt: string | null;
    aiCited: boolean;
  }>;
}

interface PostedReply {
  id: string;
  postedAt: string;
  aiCited: boolean;
  aiCitedBy: string[];
  upvotesReceived?: number;
  opportunity: {
    title: string;
    platform: string;
    url: string;
    subreddit?: string | null;
  };
}

interface SocialSettings {
  redditEnabled: boolean;
  quoraEnabled: boolean;
  linkedinEnabled: boolean;
  monitorKeywords: string[];
  excludeKeywords: string[];
  targetSubreddits: string[];
  minimumUpvotes: number;
  minimumAICitationScore: number;
  notifyOnNew: boolean;
  guidelinesAcceptedAt?: string | null;
}

// ─── Upgrade wall ─────────────────────────────────────────────────────────────

function UpgradeWall() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-lg w-full text-center space-y-6">
        {/* Blurred preview placeholder */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 h-48">
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-slate-500">
              <Lock className="h-5 w-5" />
              <span className="font-semibold text-sm">Growth plan required</span>
            </div>
          </div>
          <div className="p-4 space-y-3 opacity-30 pointer-events-none select-none">
            <div className="h-4 bg-slate-300 rounded w-3/4" />
            <div className="h-3 bg-slate-200 rounded w-full" />
            <div className="h-3 bg-slate-200 rounded w-5/6" />
            <div className="flex gap-2 mt-4">
              <div className="h-8 w-24 bg-amber-200 rounded-lg" />
              <div className="h-8 w-20 bg-slate-200 rounded-lg" />
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Discover AI citation opportunities on Reddit and Quora
          </h2>
          <p className="text-slate-500 text-sm leading-relaxed">
            See exactly which social threads AI platforms are citing — and get AI-drafted
            replies to join those conversations. When your reply gets upvoted, the thread
            gets cited by ChatGPT and Perplexity — boosting your AI visibility score.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Button
            className="bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 text-base"
            onClick={() => (window.location.href = "/dashboard/settings?tab=billing")}
          >
            Upgrade to Growth →
          </Button>
          <p className="text-xs text-slate-400">$299/month · No contracts · Cancel anytime</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SocialPage() {
  const [plan, setPlan] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [brandName, setBrandName] = useState("your business");
  const [city, setCity] = useState("");

  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [totalOpps, setTotalOpps] = useState(0);
  const [postedReplies, setPostedReplies] = useState<PostedReply[]>([]);
  const [settings, setSettings] = useState<SocialSettings | null>(null);
  const [suggestedSubreddits, setSuggestedSubreddits] = useState<string[]>([]);
  const [autoKeywords, setAutoKeywords] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [activeTab, setActiveTab] = useState("opportunities");
  const [platformFilter, setPlatformFilter] = useState<"ALL" | "REDDIT" | "QUORA" | "LINKEDIN">("ALL");
  const [sortBy, setSortBy] = useState<"score" | "newest" | "active">("score");
  const [statusFilter, setStatusFilter] = useState<string>("NEW");
  const [minScore, setMinScore] = useState(0);

  const [studioOppId, setStudioOppId] = useState<string | null>(null);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [pendingStudioOppId, setPendingStudioOppId] = useState<string | null>(null);

  // ── Bootstrap: get user plan + first project ──────────────────────────────
  useEffect(() => {
    fetch("/api/projects/list")
      .then((r) => r.json())
      .then((data: { projects?: Array<{ id: string; brandName: string; userPlan?: string }> }) => {
        const first = data.projects?.[0];
        if (first) {
          setProjectId(first.id);
          setBrandName(first.brandName);
          setPlan(first.userPlan ?? "FREE");
        }
      })
      .catch(() => {});
  }, []);

  // ── Load data when projectId is available ─────────────────────────────────
  const loadOpportunities = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        projectId,
        sort: sortBy,
        status: statusFilter,
        ...(platformFilter !== "ALL" ? { platform: platformFilter } : {}),
        ...(minScore > 0 ? { minScore: String(minScore) } : {}),
      });
      const res = await fetch(`/api/social/opportunities?${params}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { opportunities: Opportunity[]; total: number };
      setOpportunities(data.opportunities);
      setTotalOpps(data.total);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [projectId, sortBy, statusFilter, platformFilter, minScore]);

  const loadReplies = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/social/replies?projectId=${projectId}`);
      if (!res.ok) return;
      const data = (await res.json()) as { replies: PostedReply[] };
      setPostedReplies(data.replies);
    } catch {}
  }, [projectId]);

  const loadSettings = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/social/settings?projectId=${projectId}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        settings: SocialSettings | null;
        suggestedSubreddits: string[];
        autoKeywords: string[];
      };
      setSettings(data.settings);
      setSuggestedSubreddits(data.suggestedSubreddits);
      setAutoKeywords(data.autoKeywords);
    } catch {}
  }, [projectId]);

  useEffect(() => {
    if (projectId && plan && (plan === "GROWTH" || plan === "ENTERPRISE")) {
      loadOpportunities();
      loadReplies();
      loadSettings();
    } else if (projectId) {
      setLoading(false);
    }
  }, [projectId, plan, loadOpportunities, loadReplies, loadSettings]);

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleScan() {
    if (!projectId) return;
    setScanning(true);
    try {
      const res = await fetch("/api/social/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = (await res.json()) as { saved?: number };
      toast.success(
        data.saved
          ? `Found ${data.saved} new opportunities!`
          : "Scan complete — no new opportunities found"
      );
      await loadOpportunities();
    } catch {
      toast.error("Scan failed. Please try again.");
    } finally {
      setScanning(false);
    }
  }

  async function handleStatusChange(id: string, status: string) {
    await fetch(`/api/social/opportunities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setOpportunities((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status } : o))
    );
  }

  async function handleSnooze(id: string) {
    await fetch(`/api/social/opportunities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snoozeDays: 7 }),
    });
    setOpportunities((prev) => prev.filter((o) => o.id !== id));
    toast.success("Snoozed for 7 days");
  }

  function openReplyStudio(oppId: string) {
    // Check if guidelines have been accepted
    if (!settings?.guidelinesAcceptedAt) {
      setPendingStudioOppId(oppId);
      setShowGuidelines(true);
      return;
    }
    setStudioOppId(oppId);
  }

  async function acceptGuidelines() {
    if (!projectId) return;
    const now = new Date().toISOString();
    await fetch("/api/social/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, guidelinesAcceptedAt: now }),
    });
    setSettings((s) => (s ? { ...s, guidelinesAcceptedAt: now } : s));
    setShowGuidelines(false);
    if (pendingStudioOppId) {
      setStudioOppId(pendingStudioOppId);
      setPendingStudioOppId(null);
    }
  }

  const studioOpp = opportunities.find((o) => o.id === studioOppId);
  const newCount = opportunities.filter((o) => o.status === "NEW").length;

  // ── Plan gate ─────────────────────────────────────────────────────────────
  if (plan && plan !== "GROWTH" && plan !== "ENTERPRISE") {
    return (
      <div className="flex flex-col flex-1">
        <div className="px-6 py-4 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <Radio className="h-5 w-5 text-amber-500" />
            <h1 className="text-xl font-bold text-slate-900">Social Listening</h1>
            <Lock className="h-4 w-4 text-slate-400" />
          </div>
        </div>
        <UpgradeWall />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 bg-white flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Radio className="h-5 w-5 text-amber-500" />
            <h1 className="text-xl font-bold text-slate-900">Social Listening</h1>
            {newCount > 0 && (
              <Badge className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5">
                {newCount} new
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Threads where your reply could get cited by AI — and bring in customers
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleScan}
          disabled={scanning}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${scanning ? "animate-spin" : ""}`} />
          {scanning ? "Scanning…" : "Scan now"}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 pt-4 bg-white border-b border-slate-100">
          <TabsList className="bg-slate-100">
            <TabsTrigger value="opportunities" className="text-sm">
              Opportunities {totalOpps > 0 && <span className="ml-1 text-xs text-slate-400">({totalOpps})</span>}
            </TabsTrigger>
            <TabsTrigger value="replies" className="text-sm">My replies</TabsTrigger>
            <TabsTrigger value="settings" className="text-sm">Settings</TabsTrigger>
          </TabsList>
        </div>

        {/* ── Opportunities tab ── */}
        <TabsContent value="opportunities" className="flex-1 overflow-y-auto p-6">
          {/* Filter bar */}
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            {/* Platform filter */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              {(["ALL", "REDDIT", "QUORA", "LINKEDIN"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPlatformFilter(p)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    platformFilter === p
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {p === "ALL" ? "All" : p.charAt(0) + p.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="score">AI Citation Score</option>
              <option value="newest">Newest</option>
              <option value="active">Most active</option>
            </select>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="NEW">New</option>
              <option value="VIEWED">Viewed</option>
              <option value="REPLIED">Replied</option>
              <option value="DISMISSED">Dismissed</option>
              <option value="SNOOZED">Snoozed</option>
            </select>
          </div>

          {/* Cards */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 bg-slate-100 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : opportunities.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-4xl mb-4">🔍</div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">No opportunities found</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                We scan Reddit, Quora and LinkedIn daily for posts relevant to your business.
                Run a scan now or check back tomorrow.
              </p>
              <Button
                className="mt-6 bg-amber-500 hover:bg-amber-600 text-white"
                onClick={handleScan}
                disabled={scanning}
              >
                {scanning ? "Scanning…" : "Run first scan"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {opportunities.map((opp) => (
                <OpportunityCard
                  key={opp.id}
                  opportunity={opp}
                  onDraftReply={(id) => openReplyStudio(id)}
                  onDismiss={(id) => handleStatusChange(id, "DISMISSED")}
                  onSnooze={handleSnooze}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── My replies tab ── */}
        <TabsContent value="replies" className="flex-1 overflow-y-auto p-6">
          {postedReplies.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-4xl mb-4">✍️</div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">No posted replies yet</h3>
              <p className="text-sm text-slate-500">
                Once you post a reply and mark it as posted in the Reply Studio,
                it will appear here with AI citation tracking.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase tracking-wide">Post</th>
                    <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase tracking-wide">Platform</th>
                    <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase tracking-wide">Posted</th>
                    <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase tracking-wide">Upvotes</th>
                    <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase tracking-wide">AI cited?</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {postedReplies.map((reply) => (
                    <tr key={reply.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <a
                          href={reply.opportunity.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-800 hover:text-amber-600 font-medium line-clamp-1 flex items-center gap-1.5 group"
                        >
                          <span className="line-clamp-1">{reply.opportunity.title}</span>
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 shrink-0" />
                        </a>
                        {reply.opportunity.subreddit && (
                          <span className="text-xs text-slate-400">r/{reply.opportunity.subreddit}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          reply.opportunity.platform === "REDDIT" ? "bg-orange-100 text-orange-700"
                          : reply.opportunity.platform === "QUORA" ? "bg-red-100 text-red-700"
                          : "bg-blue-100 text-blue-700"
                        }`}>
                          {reply.opportunity.platform}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {formatDistanceToNow(new Date(reply.postedAt), { addSuffix: true })}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {reply.upvotesReceived != null ? `👍 ${reply.upvotesReceived}` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {reply.aiCited ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-600">
                            <CheckCircle className="h-3.5 w-3.5" />
                            Cited by {reply.aiCitedBy.join(", ") || "AI"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-300 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-300" />
                            </span>
                            Monitoring…
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── Settings tab ── */}
        <TabsContent value="settings" className="flex-1 overflow-y-auto p-6">
          {projectId && (
            <SocialSettingsTab
              projectId={projectId}
              initialSettings={settings}
              suggestedSubreddits={suggestedSubreddits}
              autoKeywords={autoKeywords}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Guidelines modal */}
      {showGuidelines && (
        <GuidelinesModal onAccept={acceptGuidelines} />
      )}

      {/* Reply Studio overlay */}
      {studioOpp && (
        <ReplyStudio
          opportunity={studioOpp}
          projectId={projectId!}
          brandName={brandName}
          city={city}
          onClose={() => setStudioOppId(null)}
          onPosted={(oppId) => {
            setOpportunities((prev) =>
              prev.map((o) => o.id === oppId ? { ...o, status: "REPLIED" } : o)
            );
            setStudioOppId(null);
            loadReplies();
          }}
        />
      )}
    </div>
  );
}
