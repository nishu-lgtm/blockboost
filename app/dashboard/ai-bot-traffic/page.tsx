import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Activity, Code2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Topbar from "@/components/dashboard/topbar";
import { CopySnippet } from "@/components/dashboard/copy-snippet";
import { BotTrafficActions } from "@/components/dashboard/bot-traffic-actions";

const TRACKING_ORIGIN = "https://visibilityiq.vercel.app";

const BOT_COLORS: Record<string, string> = {
  GPTBot:            "bg-green-100 text-green-800 border-green-200",
  "OAI-SearchBot":   "bg-teal-100 text-teal-800 border-teal-200",
  ClaudeBot:         "bg-amber-100 text-amber-800 border-amber-200",
  PerplexityBot:     "bg-purple-100 text-purple-800 border-purple-200",
  Bytespider:        "bg-orange-100 text-orange-800 border-orange-200",
  CCBot:             "bg-blue-100 text-blue-800 border-blue-200",
  "Google-Extended": "bg-red-100 text-red-800 border-red-200",
};
const DEFAULT_BOT_COLOR = "bg-slate-100 text-slate-700 border-slate-200";

function botBadgeClass(name: string) {
  return BOT_COLORS[name] ?? DEFAULT_BOT_COLOR;
}

function formatDate(d: Date) {
  return d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

function buildSnippet(projectId: string) {
  return `<script src="${TRACKING_ORIGIN}/track.js" data-project="${projectId}" async></script>`;
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

  const [botCounts, recentVisits, uniqueUrls] = await Promise.all([
    prisma.aiBotVisit.groupBy({
      by: ["botName"],
      where: { projectId: { in: projectIds } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
    prisma.aiBotVisit.findMany({
      where: { projectId: { in: projectIds } },
      orderBy: { visitedAt: "desc" },
      take: 50,
      select: { id: true, botName: true, url: true, visitedAt: true, projectId: true },
    }),
    prisma.aiBotVisit.findMany({
      where: { projectId: { in: projectIds } },
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

      <div className="flex items-center justify-end px-8 pt-6">
        <BotTrafficActions />
      </div>

      <main className="flex-1 p-8 space-y-8">

        {/* ── Setup snippet ── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-indigo-500" />
              <CardTitle className="text-base font-semibold text-slate-900">
                Install tracking snippet
              </CardTitle>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Paste this tag into the <code className="bg-slate-100 px-1 rounded text-xs">&lt;head&gt;</code> of every page you want to monitor. Bot visits will appear below automatically — no further setup needed.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {projects.map((project) => (
              <div key={project.id}>
                {projects.length > 1 && (
                  <p className="text-xs font-medium text-slate-500 mb-1.5">{project.brandName}</p>
                )}
                <CopySnippet snippet={buildSnippet(project.id)} />
              </div>
            ))}
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
                  Install the snippet above on your site. AI crawlers like GPTBot and ClaudeBot will appear here as they visit your pages.
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
                    {recentVisits.map((visit) => (
                      <tr key={visit.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-3">
                          <Badge variant="outline" className={botBadgeClass(visit.botName)}>
                            {visit.botName}
                          </Badge>
                        </td>
                        <td className="px-6 py-3">
                          <span
                            className="text-slate-700 font-mono text-xs max-w-xs block truncate"
                            title={visit.url}
                          >
                            {visit.url}
                          </span>
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
                    ))}
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
