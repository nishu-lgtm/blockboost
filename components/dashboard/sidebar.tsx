"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  LayoutDashboard,
  Eye,
  Quote,
  Users2,
  FileText,
  Wrench,
  Bot,
  Bell,
  Settings,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSession } from "next-auth/react";

const navItems = [
  {
    label: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    label: "AI Visibility",
    href: "/dashboard/ai-visibility",
    icon: Eye,
  },
  {
    label: "Citations",
    href: "/dashboard/citations",
    icon: Quote,
  },
  {
    label: "Competitors",
    href: "/dashboard/competitors",
    icon: Users2,
  },
  {
    label: "Content Briefs",
    href: "/dashboard/content-briefs",
    icon: FileText,
  },
  {
    label: "Audit Tool",
    href: "/dashboard/audit",
    icon: Wrench,
  },
  {
    label: "AI Copilot",
    href: "/dashboard/copilot",
    icon: Bot,
  },
  {
    label: "Alerts",
    href: "/dashboard/alerts",
    icon: Bell,
  },
  {
    label: "Reports",
    href: "/dashboard/reports",
    icon: FileText,
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  function isActive(item: { href: string; exact?: boolean }) {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  const initials = session?.user?.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-slate-200 flex flex-col z-40">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-6 h-16 border-b border-slate-100">
        <div className="flex items-center justify-center w-8 h-8 bg-indigo-600 rounded-lg shrink-0">
          <BarChart3 className="h-5 w-5 text-white" />
        </div>
        <span className="text-lg font-bold text-slate-900">VisibilityIQ</span>
      </div>

      {/* Project selector */}
      <div className="px-4 py-3 border-b border-slate-100">
        <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors text-left">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-md bg-indigo-100 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-indigo-600">A</span>
            </div>
            <span className="text-sm font-medium text-slate-700 truncate">Acme Corp</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                active
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <item.icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  active ? "text-indigo-600" : "text-slate-400"
                )}
              />
              {item.label}
              {item.label === "AI Copilot" && (
                <span className="ml-auto text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">
                  New
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-slate-100 p-4">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={session?.user?.image ?? undefined} />
            <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">
              {session?.user?.name ?? "User"}
            </p>
            <p className="text-xs text-slate-400 truncate">{session?.user?.email}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-slate-500 hover:text-red-600 hover:bg-red-50 h-8 px-2"
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          <LogOut className="mr-2 h-3.5 w-3.5" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
