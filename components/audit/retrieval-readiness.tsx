"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Globe, ChevronDown, ChevronUp } from "lucide-react";

interface ChunkScore {
  chunkId: string;
  text: string;
  chunkIndex: number;
  score: number;
}

interface QueryResult {
  query: string;
  topChunks: ChunkScore[];
  retrievabilityScore: number;
}

interface RetrievalResult {
  chunksStored: number;
  retrievabilityScore: number;
  scores: QueryResult[];
}

function scoreColor(score: number): string {
  if (score >= 70) return "text-emerald-600";
  if (score >= 40) return "text-amber-600";
  return "text-red-500";
}

function scoreBg(score: number): string {
  if (score >= 70) return "bg-emerald-50 border-emerald-200";
  if (score >= 40) return "bg-amber-50 border-amber-200";
  return "bg-red-50 border-red-200";
}

export function RetrievalReadiness({ projectId }: { projectId: string }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RetrievalResult | null>(null);
  const [error, setError] = useState("");
  const [expandedQuery, setExpandedQuery] = useState<number | null>(null);

  async function analyze() {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/retrieval/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, url: url.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      setResult(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="h-4 w-4 text-indigo-500" />
          Retrieval Readiness
        </CardTitle>
        <p className="text-sm text-slate-500 mt-1">
          Analyze a page to see which sections an AI would retrieve for your tracked queries.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-site.com/page"
            onKeyDown={(e) => e.key === "Enter" && analyze()}
          />
          <Button onClick={analyze} disabled={loading || !url.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Analyze"}
          </Button>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        {result && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="outline">
                {result.chunksStored} chunk{result.chunksStored !== 1 ? "s" : ""} indexed
              </Badge>
              <span className={`text-sm font-semibold ${scoreColor(result.retrievabilityScore)}`}>
                Avg retrievability: {result.retrievabilityScore}/100
              </span>
            </div>

            {result.scores.length === 0 && (
              <p className="text-sm text-slate-500">
                Add tracked queries in Settings to see per-query scores.
              </p>
            )}

            {result.scores.map((q, i) => (
              <div key={i} className={`border rounded-lg p-3 ${scoreBg(q.retrievabilityScore)}`}>
                <button
                  className="w-full flex items-center justify-between text-left"
                  onClick={() => setExpandedQuery(expandedQuery === i ? null : i)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-sm font-semibold tabular-nums shrink-0 ${scoreColor(q.retrievabilityScore)}`}>
                      {q.retrievabilityScore}
                    </span>
                    <span className="text-sm text-slate-700 truncate">{q.query}</span>
                  </div>
                  {expandedQuery === i ? (
                    <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                  )}
                </button>

                {expandedQuery === i && q.topChunks.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {q.topChunks.map((chunk, ci) => (
                      <div key={ci} className="bg-white rounded p-2 border border-slate-200">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-slate-400">Chunk #{chunk.chunkIndex}</span>
                          <span className="text-xs font-medium text-slate-600">
                            {Math.round(chunk.score * 100)}% match
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 line-clamp-3">{chunk.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
