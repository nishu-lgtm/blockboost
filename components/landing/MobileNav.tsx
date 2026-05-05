"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, Zap } from "lucide-react";

const NAV_LINKS = [
  { label: "Product", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
  { label: "Blog", href: "#" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white md:hidden">
          <div className="flex items-center justify-between px-6 h-16 border-b border-gray-100">
            <div className="flex items-center gap-1.5">
              <Zap className="w-5 h-5 text-amber-500" />
              <span className="text-lg font-bold">
                <span className="text-gray-900">Block</span>
                <span className="text-amber-500">Boost</span>
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 flex flex-col px-6 py-8 gap-2">
            {NAV_LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                onClick={() => setOpen(false)}
                className="text-xl font-semibold text-gray-900 py-3 border-b border-gray-100"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="px-6 pb-10 flex flex-col gap-3">
            <Link
              href="/auth/login"
              onClick={() => setOpen(false)}
              className="w-full text-center py-3 font-semibold text-gray-700 border border-gray-200 rounded-xl"
            >
              Log in
            </Link>
            <Link
              href="/auth/register"
              onClick={() => setOpen(false)}
              className="w-full text-center py-3 font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition-colors"
            >
              Start free trial
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
