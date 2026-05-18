"use client";

import { Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertBell } from "@/components/dashboard/alert-bell";
import { MobileSidebarTrigger } from "@/components/dashboard/sidebar";

interface TopbarProps {
  title: string;
  description?: string;
}

export default function Topbar({ title, description }: TopbarProps) {
  return (
    <header className="h-16 border-b border-slate-200 bg-white flex items-center px-4 md:px-6 gap-3 md:gap-4 sticky top-0 z-30">
      <MobileSidebarTrigger />

      <div className="flex-1 min-w-0">
        <h1 className="text-base md:text-lg font-semibold text-slate-900 truncate">
          {title}
        </h1>
        {description && (
          <p className="text-xs text-slate-400 truncate hidden sm:block">
            {description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative hidden lg:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search..."
            className="pl-9 h-9 w-56 border-slate-200 bg-slate-50 text-sm"
          />
        </div>

        <AlertBell />

        <Button
          size="sm"
          className="bg-indigo-600 hover:bg-indigo-700 text-white h-9"
        >
          <Plus className="md:mr-1.5 h-4 w-4" />
          <span className="hidden md:inline">Add Project</span>
        </Button>
      </div>
    </header>
  );
}
