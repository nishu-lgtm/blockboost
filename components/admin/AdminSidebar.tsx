"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  DollarSign,
  Activity,
  Mail,
  Shield,
  ScrollText,
  ArrowLeft,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard, exact: true },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Revenue", href: "/admin/revenue", icon: DollarSign },
  { label: "Product Health", href: "/admin/health", icon: Activity },
  { label: "Communications", href: "/admin/comms", icon: Mail },
  { label: "Team & Access", href: "/admin/team", icon: Shield },
  { label: "Audit Log", href: "/admin/audit", icon: ScrollText },
];

interface AdminSidebarProps {
  adminName: string;
  adminEmail: string;
  adminRole: string;
}

export function AdminSidebar({ adminName, adminEmail, adminRole }: AdminSidebarProps) {
  const pathname = usePathname();

  function isActive(item: { href: string; exact?: boolean }) {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  const ROLE_COLORS: Record<string, string> = {
    VIEWER: "bg-blue-900 text-blue-300",
    SUPPORT: "bg-purple-900 text-purple-300",
    ADMIN: "bg-red-900 text-red-300",
    SUPERADMIN: "bg-red-600 text-white",
  };

  const initials = adminName
    ? adminName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : adminEmail[0]?.toUpperCase() ?? "A";

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-gray-900 border-r border-gray-800 flex flex-col z-40">
      {/* Header */}
      <div className="px-5 h-16 flex items-center justify-between border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white text-base">BlockBoost</span>
          <span className="text-xs font-bold bg-red-600 text-white px-1.5 py-0.5 rounded tracking-wider">
            ADMIN
          </span>
        </div>
      </div>

      {/* Back to app */}
      <div className="px-3 py-3 border-b border-gray-800">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg text-sm transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to app
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                active
                  ? "bg-gray-700 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-gray-200",
              )}
            >
              <item.icon className={cn("w-4 h-4 shrink-0", active ? "text-white" : "text-gray-500")} />
              {item.label}
              {active && <ChevronRight className="ml-auto w-3.5 h-3.5 text-gray-500" />}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-gray-800 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-gray-200">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-200 truncate">{adminName || adminEmail}</p>
            <span className={cn("text-xs font-semibold px-1.5 py-0.5 rounded", ROLE_COLORS[adminRole] ?? ROLE_COLORS.VIEWER)}>
              {adminRole}
            </span>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
