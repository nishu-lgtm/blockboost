"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Zap, BarChart3, Globe, Network, Package, ChevronRight } from "lucide-react";
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

const IMPACT_STYLE: Record<string, string> = {
  high: "bg-red-50 text-red-600 border-red-200",
  medium: "bg-amber-50 text-amber-600 border-amber-200",
  low: "bg-slate-50 text-slate-600 border-slate-200",
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
    <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50/40 to-white">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="h-4 w-4 text-indigo-500" />
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
          const Icon = CATEGORY_ICON[action.category] ?? Zap;
          const href = CATEGORY_HREF[action.category] ?? "/dashboard";
          return (
            <div
              key={action.priority}
              className="flex items-start gap-3 p-3 bg-white rounded-lg border border-slate-100 hover:border-indigo-100 transition-colors"
            >
              <div className="mt-0.5 h-7 w-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                <Icon className="h-3.5 w-3.5 text-indigo-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="text-sm font-medium text-slate-800">{action.title}</span>
                  <Badge className={`text-xs border ${IMPACT_STYLE[action.impact]}`} variant="outline">
                    {action.impact} impact
                  </Badge>
                </div>
                <p className="text-xs text-slate-500">{action.description}</p>
              </div>
              <Link
                href={href}
                className="shrink-0 flex items-center text-xs font-medium text-indigo-600 hover:text-indigo-700 px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
              >
                Go <ChevronRight className="h-3 w-3 ml-0.5" />
              </Link>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
