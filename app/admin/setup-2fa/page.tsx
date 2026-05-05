"use client";

import { useState, useEffect } from "react";
import { Shield, CheckCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function Setup2FAPage() {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/admin/2fa/setup")
      .then((r) => r.json())
      .then((d) => {
        setQrUrl(d.qrUrl);
        setSecret(d.secret);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleVerify() {
    if (code.length !== 6) return;
    setVerifying(true);
    setError("");
    const res = await fetch("/api/admin/2fa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    if (res.ok) {
      setDone(true);
      setTimeout(() => router.push("/admin"), 1500);
    } else {
      setError(data.error ?? "Invalid code. Try again.");
      setVerifying(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-red-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-7 h-7 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Set up Two-Factor Auth</h1>
          <p className="text-gray-400 text-sm">
            Admin access requires 2FA. Scan the QR code with your authenticator app (Google Authenticator, 1Password, etc.)
          </p>
        </div>

        {done ? (
          <div className="text-center py-6">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <p className="text-white font-semibold">2FA enabled! Redirecting…</p>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 text-gray-500 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {qrUrl && (
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrUrl} alt="2FA QR Code" className="w-48 h-48 rounded-xl bg-white p-2" />
              </div>
            )}

            {secret && (
              <div className="bg-gray-800 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">Manual entry key</p>
                <p className="font-mono text-sm text-gray-200 select-all">{secret}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Enter the 6-digit code from your app
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                placeholder="000000"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
            </div>

            <button
              onClick={handleVerify}
              disabled={code.length !== 6 || verifying}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Verify & Enable 2FA
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
