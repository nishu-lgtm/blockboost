"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Download,
  Eye,
  Loader2,
  ExternalLink,
  BarChart3,
  Copy,
  CheckCircle,
} from "lucide-react";
import { ReportGeneratorInline } from "@/components/dashboard/report-generator-inline";
import { format } from "date-fns";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReportRow {
  id: string;
  reportType: string;
  periodStart: string;
  periodEnd: string;
  pdfUrl: string | null;
  shareToken: string;
  viewCount: number;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
  brandName: string;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ReportsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch projects
  useEffect(() => {
    fetch("/api/projects/list")
      .then((r) => r.json())
      .then((data) => {
        const list: Project[] = data.projects ?? [];
        setProjects(list);
        if (list.length > 0) setSelectedProject(list[0]);
      })
      .catch(() => toast.error("Failed to load projects"));
  }, []);

  // Fetch reports for selected project
  const fetchReports = useCallback(async () => {
    if (!selectedProject) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/${selectedProject.id}`);
      const data = await res.json();
      setReports(data.reports ?? []);
    } catch {
      toast.error("Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  function handleCopy(shareToken: string) {
    const url = `${window.location.origin}/report/${shareToken}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(shareToken);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  function formatPeriod(start: string, end: string) {
    return `${format(new Date(start), "MMM d")} – ${format(new Date(end), "MMM d, yyyy")}`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
          <p className="text-slate-500 text-sm mt-1">
            Generate and share AI visibility reports for your projects
          </p>
        </div>
        {selectedProject && (
          <ReportGeneratorInline
            projectId={selectedProject.id}
            brandName={selectedProject.brandName}
            onGenerated={fetchReports}
          />
        )}
      </div>

      {/* Project selector */}
      {projects.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedProject(p)}
              className={`text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                selectedProject?.id === p.id
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {p.brandName}
            </button>
          ))}
        </div>
      )}

      {/* Reports table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
        </div>
      ) : reports.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">
              {reports.length} report{reports.length !== 1 ? "s" : ""} generated
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {reports.map((r) => (
              <div
                key={r.id}
                className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {formatPeriod(r.periodStart, r.periodEnd)}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-slate-400">
                        Generated {format(new Date(r.createdAt), "MMM d, yyyy")}
                      </span>
                      <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">
                        {r.reportType}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Views */}
                <div className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
                  <Eye className="w-3.5 h-3.5" />
                  {r.viewCount} view{r.viewCount !== 1 ? "s" : ""}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Copy share link */}
                  <button
                    onClick={() => handleCopy(r.shareToken)}
                    className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-slate-100"
                    title="Copy share link"
                  >
                    {copiedId === r.shareToken ? (
                      <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    {copiedId === r.shareToken ? "Copied!" : "Share"}
                  </button>

                  {/* View */}
                  <a
                    href={`/report/${r.shareToken}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-slate-100"
                    title="View public report"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    View
                  </a>

                  {/* Download PDF */}
                  {r.pdfUrl ? (
                    <a
                      href={r.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 transition-colors px-3 py-1.5 rounded-lg"
                      title="Download PDF"
                    >
                      <Download className="w-3.5 h-3.5" />
                      PDF
                    </a>
                  ) : (
                    <span className="text-xs text-slate-300 px-3 py-1.5">No PDF</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 py-16 flex flex-col items-center text-center px-6">
      <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
        <BarChart3 className="w-6 h-6 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">No reports yet</h3>
      <p className="text-slate-500 text-sm max-w-xs">
        Pick a period above and click Generate. Each report takes ~30 seconds and produces a
        shareable PDF.
      </p>
    </div>
  );
}
