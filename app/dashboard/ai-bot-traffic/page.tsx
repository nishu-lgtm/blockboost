import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Activity, Code2, AlertTriangle, Server } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Topbar from "@/components/dashboard/topbar";
import { CopySnippet } from "@/components/dashboard/copy-snippet";
import { BotTrafficActions } from "@/components/dashboard/bot-traffic-actions";

const TRACKING_ORIGIN = "https://visibilityiq.vercel.app";

// Synthetic visit URL inserted by "Test snippet". Excluded from counts and
// marked with a [test] badge in the table so it doesn't mislead analytics.
const TEST_URL = "https://blockboost-snippet-test.local/verify";

const BOT_COLORS: Record<string, string> = {
  GPTBot:            "bg-green-100 text-green-800 border-green-200",
  "OAI-SearchBot":   "bg-teal-100 text-teal-800 border-teal-200",
  "ChatGPT-User":    "bg-emerald-100 text-emerald-800 border-emerald-200",
  ClaudeBot:         "bg-amber-100 text-amber-800 border-amber-200",
  PerplexityBot:     "bg-purple-100 text-purple-800 border-purple-200",
  Bytespider:        "bg-orange-100 text-orange-800 border-orange-200",
  CCBot:             "bg-blue-100 text-blue-800 border-blue-200",
  "Google-Extended": "bg-red-100 text-red-800 border-red-200",
  OTHER:             "bg-slate-200 text-slate-700 border-slate-300",
};
const DEFAULT_BOT_COLOR = "bg-slate-100 text-slate-700 border-slate-200";

function botBadgeClass(name: string) {
  return BOT_COLORS[name] ?? DEFAULT_BOT_COLOR;
}

function formatDate(d: Date) {
  return d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

function buildJsSnippet(projectId: string) {
  return `<script src="${TRACKING_ORIGIN}/track.js" data-project="${projectId}" async></script>`;
}

function buildServerSnippet(projectId: string) {
  return [
    "// middleware.ts — add to your Next.js site root",
    "// Captures all AI crawlers, including those that don't run JavaScript.",
    "import { NextResponse } from 'next/server'",
    "import type { NextRequest } from 'next/server'",
    "",
    "export function middleware(request: NextRequest) {",
    "  const ua = request.headers.get('user-agent') ?? ''",
    "  const url = request.nextUrl.href",
    "  fetch(",
    `    '${TRACKING_ORIGIN}/api/track/visit?p=${projectId}&u=' + encodeURIComponent(url),`,
    "    { headers: { 'user-agent': ua } }",
    "  ).catch(() => {})",
    "  return NextResponse.next()",
    "}",
    "",
    "export const config = { matcher: '/((?!_next|favicon\\.ico).*)' }",
  ].join("\n");
}

export default async function AiBotTrafficPage() {
  const session = await auth();
  if (!session) redirect("/auth/login");

  const userId = session.user!.id!;

  const projects = await prisma.project.findMany({
    where: { userId },
    select: { id: true, brandName: true },
    orderBy: { createdAt: "asc" },
  });

  if (projects.length === 0) redirect("/onboarding");

  const projectIds = projects.map((p) => p.id);
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.brandName]));

  // Exclude the synthetic test row from all counts so the dashboard
  // reflects real bot traffic only.
  const realVisitsWhere = { projectId: { in: projectIds }, url: { not: TEST_URL } };

  const [botCounts, recentVisits, uniqueUrls] = await Promise.all([
    prisma.aiBotVisit.groupBy({
      by: ["botName"],
      where: realVisitsWhere,
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
    // Include test rows in the table (they get a badge) but put them last.
    prisma.aiBotVisit.findMany({
      where: { projectId: { in: projectIds } },
      orderBy: { visitedAt: "desc" },
      take: 50,
      select: { id: true, botName: true, url: true, visitedAt: true, projectId: true },
    }),
    prisma.aiBotVisit.findMany({
      where: realVisitsWhere,
      select: { url: true },
      distinct: ["url"],
    }),
  ]);

  const totalVisits = botCounts.reduce((s, b) => s + b._count.id, 0);

  return (
    <div className="flex flex-col min-h-full">
      <Topbar
        title="AI Bot Traffic"
        description="Track which AI crawlers are visiting your site"
      />

      <main className="flex-1 p-8 space-y-6">

        {/* Actions row — sits flush inside main, same padding */}
        <div className="flex justify-end">
          <BotTrafficActions />
        </div>

        {/* ── Setup snippet ── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-indigo-500" />
              <CardTitle className="text-base font-semibold text-slate-900">
                Install tracking
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* Warning banner */}
            <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <span className="font-semibold">Most AI crawlers don&apos;t run JavaScript.</span>
                {" "}GPTBot, ClaudeBot, CCBot, and Bytespider fetch raw HTML only — they won&apos;t trigger
                the JS snippet. Use <span className="font-semibold">Option 2</span> (server-side) to capture all bots.
              </div>
            </div>

            {/* Option 1 — JS snippet */}
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">Option 1 — JavaScript snippet</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Works for JS-rendering bots (ChatGPT browsing, Perplexity live search). Paste into{" "}
                  <code className="bg-slate-100 px-1 rounded">&lt;head&gt;</code>.
                </p>
              </div>
              {projects.map((project) => (
                <div key={project.id}>
                  {projects.length > 1 && (
                    <p className="text-xs font-medium text-slate-500 mb-1.5">{project.brandName}</p>
                  )}
                  <CopySnippet snippet={buildJsSnippet(project.id)} />
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 border-t border-slate-200" />
              <span className="text-xs text-slate-400 font-medium">recommended</span>
              <div className="flex-1 border-t border-slate-200" />
            </div>

            {/* Option 2 — server-side */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Server className="h-3.5 w-3.5 text-indigo-500" />
                <p className="text-sm font-semibold text-slate-700">Option 2 — Server-side middleware</p>
              </div>
              <p className="text-xs text-slate-500">
                Add to your Next.js <code className="bg-slate-100 px-1 rounded">middleware.ts</code>. Forwards the
                real User-Agent server-side — captures every AI crawler regardless of JS support.
                Works with Express, Remix, and other frameworks too (same fetch call pattern).
              </p>
              {projects.map((project) => (
                <div key={project.id}>
                  {projects.length > 1 && (
                    <p className="text-xs font-medium text-slate-500 mb-1.5">{project.brandName}</p>
                  )}
                  <CopySnippet snippet={buildServerSnippet(project.id)} />
                </div>
              ))}
            </div>

          </CardContent>
        </Card>

        {/* ── Summary cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Total Bot Visits</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-slate-900">{totalVisits}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Unique Bots</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-slate-900">{botCounts.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Unique URLs Crawled</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-slate-900">{uniqueUrls.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Bot breakdown ── */}
        {botCounts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold text-slate-900">Detected Bots</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {botCounts.map((b) => (
                  <div
                    key={b.botName}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-white shadow-sm"
                  >
                    <Badge variant="outline" className={botBadgeClass(b.botName)}>
                      {b.botName}
                    </Badge>
                    <span className="text-sm font-semibold text-slate-700">
                      {b._count.id} visit{b._count.id !== 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Recent visits table ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-900">Recent Bot Visits</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentVisits.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                <Activity className="h-8 w-8 opacity-40" />
                <p className="text-sm font-medium">No bot visits recorded yet</p>
                <p className="text-xs max-w-xs text-center">
                  Install the server-side middleware above to start capturing AI crawler traffic.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Bot</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">URL</th>
                      {projects.length > 1 && (
                        <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Project</th>
                      )}
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Visited</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentVisits.map((visit) => {
                      const isTest = visit.url === TEST_URL;
                      return (
                        <tr
                          key={visit.id}
                          className={`hover:bg-slate-50 transition-colors ${isTest ? "opacity-60" : ""}`}
                        >
                          <td className="px-6 py-3">
                            <Badge variant="outline" className={botBadgeClass(visit.botName)}>
                              {visit.botName}
                            </Badge>
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2">
                              <span
                                className="text-slate-700 font-mono text-xs max-w-xs block truncate"
                                title={visit.url}
                              >
                                {visit.url}
                              </span>
                              {isTest && (
                                <span className="shrink-0 text-xs font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                                  test
                                </span>
                              )}
                            </div>
                          </td>
                          {projects.length > 1 && (
                            <td className="px-6 py-3 text-slate-500 text-xs">
                              {projectMap[visit.projectId] ?? visit.projectId}
                            </td>
                          )}
                          <td className="px-6 py-3 text-slate-400 text-xs whitespace-nowrap">
                            {formatDate(visit.visitedAt)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
