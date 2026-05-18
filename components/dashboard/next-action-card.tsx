"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DotBadge, type DotTone } from "@/components/ui/dot-badge";
import Link from "next/link";
import { BarChart3, Globe, Network, Package, ChevronRight } from "lucide-react";
import type { RetrievalAction } from "@/lib/retrieval-planner";

const CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  visibility: BarChart3,
  retrieval: Globe,
  entities: Network,
  delivery: Package,
};

const CATEGORY_HREF: Record<string, string> = {
  visibility: "/dashboard/ai-visibility",
  retrieval: "/dashboard/audit",
  entities: "/dashboard/entities",
  delivery: "/dashboard/ai-delivery",
};

const IMPACT_TONE: Record<string, DotTone> = {
  high: "critical",
  medium: "high",
  low: "medium",
};

interface Props {
  actions: RetrievalAction[];
  visibilityScore: number;
  retrievabilityScore: number;
  entityCount: number;
}

export function NextActionCard({ actions, visibilityScore, retrievabilityScore, entityCount }: Props) {
  if (actions.length === 0) return null;

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-900">
          Recommended next actions
        </CardTitle>
        <div className="flex gap-3 mt-1 flex-wrap">
          <span className="text-xs text-slate-500">
            Visibility <span className="font-semibold text-slate-700">{visibilityScore}%</span>
          </span>
          {retrievabilityScore > 0 && (
            <span className="text-xs text-slate-500">
              Retrievability <span className="font-semibold text-slate-700">{retrievabilityScore}/100</span>
            </span>
          )}
          <span className="text-xs text-slate-500">
            Entities <span className="font-semibold text-slate-700">{entityCount}</span>
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-2">
        {actions.map((action) => {
          const Icon = CATEGORY_ICON[action.category] ?? BarChart3;
          const href = CATEGORY_HREF[action.category] ?? "/dashboard";
          return (
            <Link
              key={action.priority}
              href={href}
              className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors group"
            >
              <div className="mt-0.5 h-7 w-7 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                <Icon className="h-3.5 w-3.5 text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap mb-0.5">
                  <span className="text-sm font-semibold text-slate-900">{action.title}</span>
                  <DotBadge tone={IMPACT_TONE[action.impact] ?? "medium"}>
                    {action.impact} impact
                  </DotBadge>
                </div>
                <p className="text-xs text-slate-500">{action.description}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 shrink-0 transition-colors mt-1" />
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
