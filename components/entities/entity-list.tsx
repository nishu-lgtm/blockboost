"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface EntityNode {
  id: string;
  type: string;
  name: string;
}

interface EntityEdge {
  id: string;
  relation: string;
  from: EntityNode;
  to: EntityNode;
}

interface Graph {
  nodes: EntityNode[];
  edges: EntityEdge[];
}

const TYPE_COLORS: Record<string, string> = {
  brand: "bg-indigo-100 text-indigo-700",
  product: "bg-violet-100 text-violet-700",
  person: "bg-sky-100 text-sky-700",
  feature: "bg-emerald-100 text-emerald-700",
  location: "bg-amber-100 text-amber-700",
  organization: "bg-slate-100 text-slate-700",
};

export function EntityList({ projectId }: { projectId: string }) {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [lastSummary, setLastSummary] = useState<{ nodesCreated: number; edgesCreated: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadGraph = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/entities/${projectId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setGraph(await res.json());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load entity graph");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadGraph();
    // U6 — auto-refresh every 60s; no visible refresh button.
    const id = window.setInterval(loadGraph, 60_000);
    return () => window.clearInterval(id);
  }, [loadGraph]);

  async function extract() {
    if (!text.trim()) return;
    setExtracting(true);
    setError("");
    try {
      const res = await fetch(`/api/entities/${projectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setGraph(data.graph);
      setLastSummary({ nodesCreated: data.nodesCreated, edgesCreated: data.edgesCreated });
      setText("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Extraction failed");
    } finally {
      setExtracting(false);
    }
  }

  const nodesByType = graph
    ? graph.nodes.reduce<Record<string, EntityNode[]>>((acc, n) => {
        (acc[n.type] ??= []).push(n);
        return acc;
      }, {})
    : {};

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-slate-900">
          Brand Knowledge
        </CardTitle>
        <p className="text-sm text-slate-500 mt-1">
          Paste content below to extract entities, or view the current graph.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Extract panel */}
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)}
            placeholder="Paste page content, article, or press release to extract entities…"
            rows={4}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          {lastSummary && (
            <p className="text-xs text-emerald-600">
              +{lastSummary.nodesCreated} entities, +{lastSummary.edgesCreated} relations added
            </p>
          )}
          <Button onClick={extract} disabled={extracting || !text.trim()} size="sm">
            {extracting ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Extracting…</>
            ) : (
              "Extract entities"
            )}
          </Button>
        </div>

        {/* Graph view */}
        {loading && <p className="text-sm text-slate-400">Loading graph…</p>}

        {loadError && (
          <div className="rounded-lg border border-red-200 bg-red-50/40 p-3 flex items-center justify-between">
            <span className="text-sm text-red-700">Couldn&apos;t load entity graph ({loadError})</span>
            <button onClick={loadGraph} className="text-xs text-red-700 underline hover:no-underline">
              Retry
            </button>
          </div>
        )}

        {!loading && graph && graph.nodes.length === 0 && (
          <p className="text-sm text-slate-500">No entities yet. Paste content above to get started.</p>
        )}

        {!loading && graph && graph.nodes.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              {graph.nodes.length} entities · {graph.edges.length} relations
            </p>

            {Object.entries(nodesByType).map(([type, nodes]) => (
              <div key={type}>
                <p className="text-xs text-slate-400 mb-1 capitalize">{type}s</p>
                <div className="flex flex-wrap gap-1.5">
                  {nodes.map((n) => (
                    <Badge
                      key={n.id}
                      className={`text-xs font-normal ${TYPE_COLORS[type] ?? "bg-slate-100 text-slate-700"}`}
                      variant="outline"
                    >
                      {n.name}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}

            {graph.edges.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 mb-1">Relations</p>
                <div className="space-y-1">
                  {graph.edges.slice(0, 10).map((e) => (
                    <p key={e.id} className="text-xs text-slate-600">
                      <span className="font-medium">{e.from.name}</span>
                      <span className="text-slate-400 mx-1">→ {e.relation} →</span>
                      <span className="font-medium">{e.to.name}</span>
                    </p>
                  ))}
                  {graph.edges.length > 10 && (
                    <p className="text-xs text-slate-400">+{graph.edges.length - 10} more relations</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
