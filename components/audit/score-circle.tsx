"use client";

import { useEffect, useState } from "react";

interface ScoreCircleProps {
  score: number;
  size?: "lg" | "sm";
  label?: string;
  animate?: boolean;
}

function scoreColor(s: number): { stroke: string; text: string; bg: string } {
  if (s >= 70) return { stroke: "#16a34a", text: "text-green-600",  bg: "bg-green-50"  };
  if (s >= 40) return { stroke: "#d97706", text: "text-amber-600",  bg: "bg-amber-50"  };
  return          { stroke: "#dc2626", text: "text-red-600",    bg: "bg-red-50"    };
}

function scoreLabel(s: number): string {
  if (s >= 70) return "Good";
  if (s >= 40) return "Needs work";
  return "Poor";
}

export function ScoreCircle({ score, size = "lg", label, animate = true }: ScoreCircleProps) {
  const [displayed, setDisplayed] = useState(animate ? 0 : score);

  useEffect(() => {
    if (!animate) { setDisplayed(score); return; }
    const duration = 1200; // ms
    const steps = 60;
    const increment = score / steps;
    let current = 0;
    const interval = setInterval(() => {
      current += increment;
      if (current >= score) { setDisplayed(score); clearInterval(interval); }
      else setDisplayed(Math.round(current));
    }, duration / steps);
    return () => clearInterval(interval);
  }, [score, animate]);

  const colors = scoreColor(score);

  if (size === "lg") {
    const radius = 52;
    const circumference = 2 * Math.PI * radius;
    const progress = (displayed / 100) * circumference;

    return (
      <div className="flex flex-col items-center gap-2">
        <div className="relative w-36 h-36">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
            {/* Track */}
            <circle cx="64" cy="64" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="10" />
            {/* Progress */}
            <circle
              cx="64" cy="64" r={radius}
              fill="none"
              stroke={colors.stroke}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - progress}
              style={{ transition: "stroke-dashoffset 0.05s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl font-bold ${colors.text}`}>{displayed}</span>
            <span className="text-[10px] text-slate-400 uppercase tracking-wide font-medium mt-0.5">/ 100</span>
          </div>
        </div>
        {label && <p className="text-sm text-slate-600 font-medium text-center">{label}</p>}
        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
          {scoreLabel(score)}
        </span>
      </div>
    );
  }

  // Small variant — used for sub-scores
  const radiusSm = 26;
  const circumferenceSm = 2 * Math.PI * radiusSm;
  const progressSm = (displayed / 100) * circumferenceSm;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-16 h-16">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r={radiusSm} fill="none" stroke="#f1f5f9" strokeWidth="6" />
          <circle
            cx="32" cy="32" r={radiusSm}
            fill="none"
            stroke={colors.stroke}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumferenceSm}
            strokeDashoffset={circumferenceSm - progressSm}
            style={{ transition: "stroke-dashoffset 0.05s linear" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-sm font-bold ${colors.text}`}>{displayed}</span>
        </div>
      </div>
      {label && <p className="text-[11px] text-slate-500 text-center leading-tight max-w-[72px]">{label}</p>}
    </div>
  );
}
