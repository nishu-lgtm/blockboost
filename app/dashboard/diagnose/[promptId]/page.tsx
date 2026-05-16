import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { diagnosePrompt } from "@/lib/prompt-diagnostic";
import Topbar from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  Sparkles,
  Target,
} from "lucide-react";

const VERDICT_STYLE: Record<string, { label: string; tone: string; icon: typeof CheckCircle2; sentence: string }> = {
  winning: {
    label: "Winning",
    tone: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
    sentence: "You consistently appear in AI answers for this query.",
  },
  mixed: {
    label: "Mixed",
    tone: "bg-amber-50 text-amber-700 border-amber-200",
    icon: AlertCircle,
    sentence: "You appear in some AI answers but not reliably — there's room to widen your lead.",
  },
  losing: {
    label: "Losing",
    tone: "bg-red-50 text-red-700 border-red-200",
    icon: XCircle,
    sentence: "You rarely or never appear in AI answers for this query. Competitors are claiming this conversation.",
  },
  untested: {
    label: "Untested",
    tone: "bg-slate-50 text-slate-700 border-slate-200",
    icon: AlertCircle,
    sentence: "No scans have run for this prompt yet.",
  },
};

const IMPACT_STYLE: Record<string, string> = {
  high: "border-red-200 bg-red-50/40",
  medium: "border-amber-200 bg-amber-50/40",
  low: "border-slate-200 bg-slate-50/40",
};

const IMPACT_BADGE: Record<string, string> = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-slate-100 text-slate-700 border-slate-200",
};

export default async function DiagnosePromptPage({
  params,
}: {
  params: Promise<{ promptId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");
  const userId = session.user.id as string;
  const { promptId } = await params;

  // Find the project containing this prompt AND owned by the user
  const prompt = await prisma.prompt.findFirst({
    where: { id: promptId, project: { userId } },
    select: { projectId: true },
  });
  if (!prompt) notFound();

  const diag = await diagnosePrompt(prompt.projectId, promptId);
  if (!diag) notFound();

  const verdict = VERDICT_STYLE[diag.verdict];
  const VerdictIcon = verdict.icon;

  return (
    <div className="flex flex-col flex-1">
      <Topbar title="Diagnose prompt" description="Why am I winning or losing on this query?" />
      <main className="flex-1 p-6 space-y-6 max-w-4xl">
        <Link
          href="/dashboard/ai-visibility"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to AI Visibility
        </Link>

        {/* Header: verdict + prompt */}
        <Card className={verdict.tone + " border"}>
          <CardContent className="p-5 flex items-start gap-4">
            <div className="rounded-lg p-2 bg-white/60 shrink-0">
              <VerdictIcon className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className={verdict.tone}>{verdict.label}</Badge>
                {diag.intent && <Badge variant="outline" className="text-xs">{diag.intent}</Badge>}
              </div>
              <p className="text-base font-semibold text-slate-900 mb-1">&ldquo;{diag.promptText}&rdquo;</p>
              <p className="text-sm">{verdict.sentence}</p>
              {diag.totalScans > 0 && (
                <p className="text-xs mt-2 opacity-80">
                  {diag.mentionCount}/{diag.totalScans} scans mentioned your brand · {diag.mentionRate}% mention rate
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recommended actions — top of fold */}
        {diag.recommendedActions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4 text-indigo-500" />
                What to do about it
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {diag.recommendedActions.map((action, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg border ${IMPACT_STYLE[action.impact]}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <p className="text-sm font-semibold text-slate-800">{action.title}</p>
                    <Badge variant="outline" className={`text-xs ${IMPACT_BADGE[action.impact]} shrink-0`}>
                      {action.impact} impact
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600 mb-2">{action.detail}</p>
                  {action.href && (
                    <Link
                      href={action.href}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
                    >
                      Go there <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* What the AIs actually said */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What AI assistants actually say</CardTitle>
            <p className="text-xs text-slate-500 mt-1">Most recent response per platform</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {diag.perPlatform.length === 0 && (
              <p className="text-sm text-slate-400">No scan data yet for this prompt.</p>
            )}
            {diag.perPlatform.map((r) => (
              <div key={r.platform} className="border border-slate-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-700">{r.platform}</span>
                    <Badge
                      variant="outline"
                      className={
                        r.brandMentioned
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-xs"
                          : "bg-red-50 text-red-700 border-red-200 text-xs"
                      }
                    >
                      {r.brandMentioned ? "Cited" : "Not cited"}
                    </Badge>
                    {r.sentiment !== "NOT_MENTIONED" && (
                      <Badge variant="outline" className="text-xs capitalize">
                        {r.sentiment.toLowerCase()}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-slate-400">
                    {new Date(r.lastSeenAt).toLocaleDateString()}
                  </span>
                </div>
                {r.competitorsMentioned.length > 0 && (
                  <p className="text-xs text-slate-500 mb-2">
                    Competitors in the answer:{" "}
                    {r.competitorsMentioned.map((c) => (
                      <Badge key={c} variant="outline" className="ml-1 text-xs">{c}</Badge>
                    ))}
                  </p>
                )}
                <p className="text-xs text-slate-700 leading-relaxed line-clamp-6">
                  {r.responseText}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Retrieval insights */}
        {diag.retrievabilityScore !== null && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-violet-500" />
                Retrieval simulation
              </CardTitle>
              <p className="text-xs text-slate-500 mt-1">
                How well your indexed content matches this query (Sprint 4).
              </p>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-800 mb-3">
                {diag.retrievabilityScore}<span className="text-base text-slate-400">/100</span>
              </p>
              <div className="space-y-2">
                {diag.topChunks.slice(0, 3).map((c, i) => (
                  <div key={i} className="border border-slate-200 rounded-md p-2 bg-slate-50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-500 truncate">{c.url}</span>
                      <span className="text-xs font-medium text-slate-600 tabular-nums">
                        {Math.max(0, Math.round(c.score * 100))}% match
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 line-clamp-2">{c.text}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Missing entities */}
        {diag.missingEntities.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Topics competitors are known for that you lack</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {diag.missingEntities.map((e) => (
                  <Badge key={e} variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                    {e}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                These appear in competitor responses but aren&apos;t covered in your entity graph.
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
