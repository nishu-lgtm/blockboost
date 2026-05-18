"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { CheckCircle2, Link2, Loader2, Unlink, ExternalLink, AlertTriangle } from "lucide-react";

interface Props {
  gscConnected: boolean;
  gscProperty: string | null;
}

// Minimal Google logo SVG
function GoogleLogo({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export function IntegrationsTab({ gscConnected: initialConnected, gscProperty: initialProperty }: Props) {
  const [gscConnected, setGscConnected] = useState(initialConnected);
  const [gscProperty, setGscProperty] = useState(initialProperty);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");

  async function handleDisconnect() {
    setDisconnecting(true);
    setError("");
    try {
      const res = await fetch("/api/gsc/disconnect", { method: "POST" });
      if (!res.ok) throw new Error("Failed to disconnect");
      setGscConnected(false);
      setGscProperty(null);
      setShowConfirm(false);
    } catch {
      setError("Failed to disconnect. Please try again.");
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-slate-200">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center">
              <GoogleLogo />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base">Google Search Console</CardTitle>
              <CardDescription className="text-slate-500 text-xs mt-0.5">
                Import real search queries as AEO tracking prompts
              </CardDescription>
            </div>
            {gscConnected ? (
              <Badge className="bg-green-50 text-green-700 border-green-200 gap-1.5">
                <CheckCircle2 className="h-3 w-3" />
                Connected
              </Badge>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {!gscConnected ? (
            <>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-2">
                <p className="text-sm font-medium text-slate-800">What you get</p>
                <ul className="space-y-1.5 text-xs text-slate-600">
                  {[
                    "Import your top organic search queries as AEO tracking prompts",
                    "See which high-traffic queries your brand is invisible on in AI",
                    "Prioritize content creation by actual search volume",
                    "Auto-sync new queries weekly",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="text-green-500 shrink-0">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* OAuth start endpoint — full-page redirect required, not a Next page. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/api/auth/gsc/connect?source=settings">
                <Button className="gap-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm">
                  <GoogleLogo className="w-4 h-4" />
                  Connect Google Search Console
                </Button>
              </a>

              <p className="text-[11px] text-slate-400">
                You&apos;ll be redirected to Google to authorize read-only access to your Search Console data.
                We never modify your GSC data.
              </p>
            </>
          ) : (
            <div className="space-y-4">
              {/* Connected property */}
              {gscProperty && (
                <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
                  <Link2 className="h-4 w-4 text-green-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-green-800">Connected property</p>
                    <p className="text-xs text-green-700 truncate">{gscProperty}</p>
                  </div>
                  <a
                    href={gscProperty}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-600 hover:text-green-700"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a href="/api/auth/gsc/connect?source=settings">
                  <Button variant="outline" size="sm" className="h-9 border-slate-300 text-slate-700 gap-1.5">
                    <GoogleLogo className="w-3.5 h-3.5" />
                    Re-authenticate
                  </Button>
                </a>

                {!showConfirm ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowConfirm(true)}
                    className="h-9 border-red-200 text-red-600 hover:bg-red-50 gap-1.5"
                  >
                    <Unlink className="h-3.5 w-3.5" />
                    Disconnect
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                    <p className="text-xs text-red-700">Remove GSC integration?</p>
                    <Button
                      size="sm"
                      onClick={handleDisconnect}
                      disabled={disconnecting}
                      className="h-7 text-xs bg-red-600 hover:bg-red-700 text-white gap-1"
                    >
                      {disconnecting && <Loader2 className="h-3 w-3 animate-spin" />}
                      Yes, disconnect
                    </Button>
                    <button
                      onClick={() => setShowConfirm(false)}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {error && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> {error}
                </p>
              )}

              {/* Auto-sync note */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-600">
                  <span className="font-medium">Auto-sync:</span> New queries are automatically
                  imported each week. You can also manually sync from any project&apos;s prompt settings.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
