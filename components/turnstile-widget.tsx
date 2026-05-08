"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

interface Props {
  sitekey: string;
  onToken: (token: string) => void;
  className?: string;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
        }
      ) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

/**
 * Cloudflare Turnstile widget. Renders nothing if no sitekey is supplied,
 * so the form still works in dev without keys (server-side verifyTurnstile
 * also short-circuits to OK in that case).
 */
export function TurnstileWidget({ sitekey, onToken, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    if (!scriptReady || !sitekey || !containerRef.current) return;
    if (!window.turnstile) return;

    if (widgetIdRef.current) return; // already rendered

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey,
      callback: onToken,
      "expired-callback": () => onToken(""),
      "error-callback": () => onToken(""),
      theme: "light",
    });
  }, [scriptReady, sitekey, onToken]);

  if (!sitekey) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="lazyOnload"
        onReady={() => setScriptReady(true)}
      />
      <div ref={containerRef} className={className} />
    </>
  );
}
