"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckSquare, Square } from "lucide-react";

const GUIDELINES = [
  "I will only post helpful, genuine replies that add real value to the conversation",
  "I will disclose my business affiliation when it is relevant to the discussion",
  "I will not post the same or similar reply on multiple threads",
  "I understand that spam or self-promotion violates platform rules and can get accounts banned",
  "I will use this tool to help people, not just to advertise my business",
];

interface Props {
  onAccept: () => void;
}

export default function GuidelinesModal({ onAccept }: Props) {
  const [checked, setChecked] = useState<boolean[]>(GUIDELINES.map(() => false));

  const allChecked = checked.every(Boolean);

  function toggle(i: number) {
    setChecked((prev) => {
      const next = [...prev];
      next[i] = !next[i];
      return next;
    });
  }

  return (
    <Dialog open>
      <DialogContent className="max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <div className="text-3xl mb-2">🤝</div>
          <DialogTitle className="text-xl">How to use Social Listening responsibly</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            This tool helps you join relevant conversations and build your reputation.
            Used correctly, it generates genuine customers. Used wrongly, it gets you banned.
            Please confirm you understand the rules.
          </p>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {GUIDELINES.map((guideline, i) => (
            <button
              key={i}
              onClick={() => toggle(i)}
              className="flex items-start gap-3 w-full text-left rounded-lg p-3 hover:bg-slate-50 transition-colors"
            >
              {checked[i] ? (
                <CheckSquare className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              ) : (
                <Square className="h-5 w-5 text-slate-300 mt-0.5 shrink-0" />
              )}
              <span className="text-sm text-slate-700">{guideline}</span>
            </button>
          ))}
        </div>

        <div className="mt-4">
          <Button
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 disabled:opacity-40"
            disabled={!allChecked}
            onClick={onAccept}
          >
            I understand — let me start helping people
          </Button>
          {!allChecked && (
            <p className="text-xs text-center text-slate-400 mt-2">
              Please check all boxes to continue
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
