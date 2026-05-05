import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Topbar from "@/components/dashboard/topbar";
import {
  BarChart3,
  Brain,
  Quote,
  Users2,
  TrendingUp,
  Plus,
  ArrowRight,
  Zap,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id as string;

  const project = await prisma.project.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      mentions: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { prompt: true },
      },
      competitors: { select: { id: true } },
      _count: { select: { mentions: true } },
    },
  });

  const hasProjects = !!project;

  // Compute real stats
  const totalMentions = project?._count.mentions ?? 0;
  const citedMentions = project?.mentions.filter((m) => m.brandMentioned).length ?? 0;
  const visibilityScore =
    totalMentions > 0 ? Math.round((citedMentions / totalMentions) * 100) : 0;
  const competitorCount = project?.competitors.length ?? 0;

  return (
    <div className="flex flex-col flex-1">
      <Topbar title="Overview" description="Your AI visibility dashboard" />
      <main className="flex-1 p-6">
        {hasProjects ? (
          <DashboardWithData
            visibilityScore={visibilityScore}
            totalMentions={totalMentions}
            competitorCount={competitorCount}
            recentMentions={project!.mentions}
          />
        ) : (
          <EmptyState userName={session?.user?.name ?? undefined} />
        )}
      </main>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ userName }: { userName?: string }) {
  const firstName = userName?.split(" ")[0] ?? "there";

  return (
    <div className="flex flex-col items-center justify-center flex-1 py-20">
      <div className="max-w-lg text-center">
        <div className="relative mx-auto mb-8 w-32 h-32">
          <div className="absolute inset-0 bg-indigo-100 rounded-3xl" />
          <div className="absolute inset-3 bg-indigo-50 rounded-2xl flex items-center justify-center">
            <BarChart3 className="h-12 w-12 text-indigo-600" />
          </div>
          <div className="absolute -top-2 -right-2 w-8 h-8 bg-green-400 rounded-full flex items-center justify-center">
            <Brain className="h-4 w-4 text-white" />
          </div>
          <div className="absolute -bottom-2 -left-2 w-8 h-8 bg-purple-400 rounded-full flex items-center justify-center">
            <Globe className="h-4 w-4 text-white" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-slate-900 mb-3">
          Welcome, {firstName}! 👋
        </h2>
        <p className="text-slate-500 mb-2 text-lg">
          You&apos;re all set — now let&apos;s track your AI visibility.
        </p>
        <p className="text-slate-400 mb-8 text-sm leading-relaxed">
          Add your first project to start monitoring how often your brand appears
          in AI responses across ChatGPT, Claude, Gemini, and more.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
          <Link href="/onboarding">
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white h-11 px-6">
              <Plus className="mr-2 h-4 w-4" />
              Add your first project
            </Button>
          </Link>
          <Button variant="outline" className="h-11 px-6 border-slate-300">
            Watch 2-min tutorial
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-left">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">
            Quick setup (3 steps)
          </h3>
          <div className="space-y-4">
            {[
              { step: "1", title: "Add your project", desc: "Enter your brand name and domain to start tracking", icon: Globe },
              { step: "2", title: "Choose AI models to monitor", desc: "Select ChatGPT, Claude, Gemini, and more", icon: Brain },
              { step: "3", title: "Add competitors", desc: "Track how you compare against key rivals", icon: Users2 },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-4">
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-500 text-xs font-bold shrink-0 mt-0.5">
                  {item.step}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{item.title}</p>
                  <p className="text-xs text-slate-400">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard with real data ─────────────────────────────────────────────────

interface Mention {
  id: string;
  brandMentioned: boolean;
  platform: string;
  createdAt: Date;
  prompt: { text: string } | null;
}

function DashboardWithData({
  visibilityScore,
  totalMentions,
  competitorCount,
  recentMentions,
}: {
  visibilityScore: number;
  totalMentions: number;
  competitorCount: number;
  recentMentions: Mention[];
}) {
  const stats = [
    {
      label: "AI Visibility Score",
      value: `${visibilityScore}%`,
      change: null as string | null,
      icon: BarChart3,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
    },
    {
      label: "Total Scans",
      value: totalMentions.toLocaleString(),
      change: null,
      icon: Quote,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "AI Models Tracked",
      value: "3",
      change: null,
      icon: Brain,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Competitors",
      value: competitorCount.toString(),
      change: null,
      icon: Users2,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-slate-200">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${stat.bg}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
                {stat.change && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                    <TrendingUp className="mr-1 h-3 w-3" />
                    {stat.change}
                  </Badge>
                )}
              </div>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-slate-500 mt-1">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent scans */}
        <Card className="border-slate-200 lg:col-span-2">
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-800">
              Recent Scans
            </CardTitle>
            <Link href="/dashboard/citations">
              <Button variant="ghost" size="sm" className="text-indigo-600 h-8 text-xs">
                View all
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentMentions.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">
                No scans yet — run your first scan from the AI Visibility page.
              </div>
            ) : (
              <div className="space-y-0">
                {recentMentions.map((mention) => (
                  <div
                    key={mention.id}
                    className="flex items-center gap-3 py-3 border-b border-slate-50 last:border-0"
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <Brain className="h-4 w-4 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800 truncate">
                        {mention.prompt?.text ?? "Unknown prompt"}
                      </p>
                      <p className="text-xs text-slate-400">{mention.platform}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant="outline"
                        className={
                          mention.brandMentioned
                            ? "bg-green-50 text-green-700 border-green-200 text-xs"
                            : "bg-red-50 text-red-600 border-red-200 text-xs"
                        }
                      >
                        {mention.brandMentioned ? "Cited" : "Not cited"}
                      </Badge>
                      <span className="text-xs text-slate-400">
                        {formatDistanceToNow(new Date(mention.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-800">
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: "Run AI audit", icon: Zap, href: "/dashboard/audit", color: "text-indigo-600 bg-indigo-50" },
              { label: "Generate content brief", icon: Brain, href: "/dashboard/content-briefs", color: "text-purple-600 bg-purple-50" },
              { label: "Add competitor", icon: Users2, href: "/dashboard/competitors", color: "text-blue-600 bg-blue-50" },
              { label: "View full report", icon: BarChart3, href: "/dashboard/ai-visibility", color: "text-green-600 bg-green-50" },
            ].map((action) => (
              <Link key={action.label} href={action.href}>
                <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer group">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${action.color}`}>
                    <action.icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">
                    {action.label}
                  </span>
                  <ArrowRight className="ml-auto h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500" />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
