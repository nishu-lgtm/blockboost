"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Loader2, Users2 } from "lucide-react";
import type { CompetitorInfo } from "@/lib/competitor-types";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  competitors: CompetitorInfo[];
  planLimit: number;
  onSaved: (updated: CompetitorInfo[]) => void;
}

function normaliseUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

export function ManageCompetitorsModal({
  open,
  onClose,
  projectId,
  competitors,
  planLimit,
  onSaved,
}: Props) {
  const [rows, setRows] = useState<Array<{ key: string; brandName: string; websiteUrl: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync from props when modal opens
  useEffect(() => {
    if (open) {
      setRows(
        competitors.length > 0
          ? competitors.map((c) => ({ key: c.id, brandName: c.brandName, websiteUrl: c.websiteUrl ?? "" }))
          : [{ key: crypto.randomUUID(), brandName: "", websiteUrl: "" }]
      );
      setError(null);
    }
  }, [open, competitors]);

  function addRow() {
    if (rows.length >= planLimit) return;
    setRows((prev) => [...prev, { key: crypto.randomUUID(), brandName: "", websiteUrl: "" }]);
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function updateRow(key: string, field: "brandName" | "websiteUrl", value: string) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  }

  function blurUrl(key: string, value: string) {
    const normalised = normaliseUrl(value);
    updateRow(key, "websiteUrl", normalised);
  }

  async function handleSave() {
    const valid = rows.filter((r) => r.brandName.trim());
    if (valid.length === 0) {
      // Allow empty list (removes all competitors)
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/competitors`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitors: valid.map((r) => ({
            brandName: r.brandName.trim(),
            websiteUrl: normaliseUrl(r.websiteUrl),
          })),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? "Failed to save");
      }
      const { competitors: updated } = await res.json() as { competitors: CompetitorInfo[] };
      onSaved(updated);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const filledCount = rows.filter((r) => r.brandName.trim()).length;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users2 className="h-5 w-5 text-indigo-600" />
            Manage Competitors
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Plan usage */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              <span className="font-semibold">{filledCount}</span> of{" "}
              <span className="font-semibold">{planLimit}</span> competitors on your plan
            </p>
            {filledCount >= planLimit && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                Plan limit reached
              </Badge>
            )}
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[1fr_1fr_36px] gap-2 px-1">
            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Brand name <span className="text-red-400">*</span>
            </Label>
            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Website URL <span className="text-slate-400">(opt.)</span>
            </Label>
            <div />
          </div>

          {/* Competitor rows */}
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {rows.map((row, idx) => (
              <div key={row.key} className="grid grid-cols-[1fr_1fr_36px] gap-2 items-start">
                <Input
                  placeholder={`Competitor ${idx + 1}`}
                  value={row.brandName}
                  onChange={(e) => updateRow(row.key, "brandName", e.target.value)}
                  className="h-9 border-slate-300 text-sm"
                />
                <Input
                  placeholder="https://rival.com"
                  value={row.websiteUrl}
                  onChange={(e) => updateRow(row.key, "websiteUrl", e.target.value)}
                  onBlur={(e) => blurUrl(row.key, e.target.value)}
                  className="h-9 border-slate-300 text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRow(row.key)}
                  className="h-9 w-9 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Add row */}
          {rows.length < planLimit && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRow}
              className="h-9 w-full border-dashed border-slate-300 text-slate-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add competitor
            </Button>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving} className="border-slate-300 text-slate-600">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {saving ? "Saving…" : "Save competitors"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
