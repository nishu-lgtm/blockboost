"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
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
  ChevronDown,
  Radio,
  BookOpen,
  Activity,
  Network,
  Package,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSession } from "next-auth/react";
import { useEffect, useState, useRef } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { FEATURES } from "@/lib/feature-flags";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const navItems = [
  { label: "Overview",        href: "/dashboard",                icon: LayoutDashboard, exact: true },
  { label: "AI Visibility",   href: "/dashboard/ai-visibility",  icon: Eye },
  { label: "AI Bot Traffic",  href: "/dashboard/ai-bot-traffic", icon: Activity },
  { label: "Citations",       href: "/dashboard/citations",      icon: Quote },
  { label: "Competitors",     href: "/dashboard/competitors",    icon: Users2 },
  { label: "Content Briefs",  href: "/dashboard/content-briefs", icon: BookOpen },
  { label: "Audit Tool",      href: "/dashboard/audit",          icon: Wrench },
  // Renamed 2026-05-16 from "Entity Graph" — too jargony. "Brand Knowledge"
  // tells marketers what's there without leaking the underlying graph data
  // structure. Route /dashboard/entities intentionally unchanged.
  { label: "Brand Knowledge", href: "/dashboard/entities",       icon: Network },
  // Renamed from "AI Delivery" → "AI Brand Files" makes the deliverables
  // (llm.md, facts.json, entities.json) obvious to marketers.
  { label: "AI Brand Files",  href: "/dashboard/ai-delivery",    icon: Package },
  { label: "AI Copilot",      href: "/dashboard/copilot",        icon: Bot },
  ...(FEATURES.socialListening
    ? [{ label: "Social Listening", href: "/dashboard/social", icon: Radio, badge: "Growth+" }]
    : []),
  { label: "Alerts",  href: "/dashboard/alerts",  icon: Bell },
  { label: "Reports", href: "/dashboard/reports", icon: FileText },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

interface Project {
  id: string;
  name: string;
  brandName: string;
}

/**
 * SidebarBody — the actual nav contents. Shared between the desktop
 * `<aside>` and the mobile Sheet drawer so we have a single source of
 * truth for navigation. `onNavigate` lets the mobile variant close the
 * drawer on link click.
 */
function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/projects/list")
      .then((r) => r.json())
      .then((data) => {
        const list: Project[] = data.projects ?? [];
        setProjects(list);
        if (list.length > 0) setActiveProject(list[0]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function isActive(item: { href: string; exact?: boolean }) {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  const initials = session?.user?.name
    ? session.user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  const projectInitial = activeProject?.brandName?.[0]?.toUpperCase() ?? "P";

  return (
    <>
      {/* Logo */}
      <div className="flex items-center px-6 h-16 border-b border-slate-100 shrink-0">
        <BrandLogo size="md" />
      </div>

      {/* Project selector */}
      <div className="px-4 py-3 border-b border-slate-100 shrink-0" ref={dropdownRef}>
        <button
          onClick={() => projects.length > 1 && setDropdownOpen((o) => !o)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors text-left"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-md bg-indigo-100 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-indigo-600">{projectInitial}</span>
            </div>
            <span className="text-sm font-medium text-slate-700 truncate">
              {activeProject?.brandName ?? "Loading…"}
            </span>
          </div>
          {projects.length > 1 && (
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform",
                dropdownOpen && "rotate-180",
              )}
            />
          )}
        </button>

        {dropdownOpen && projects.length > 1 && (
          <div className="mt-1 bg-white border border-slate-200 rounded-lg shadow-md overflow-hidden">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setActiveProject(p);
                  setDropdownOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-50 transition-colors",
                  activeProject?.id === p.id && "bg-indigo-50 text-indigo-700 font-medium",
                )}
              >
                <div className="w-5 h-5 rounded bg-indigo-100 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-indigo-600">
                    {p.brandName[0]?.toUpperCase()}
                  </span>
                </div>
                {p.brandName}
              </button>
            ))}
            <Link
              href="/onboarding"
              onClick={() => {
                setDropdownOpen(false);
                onNavigate?.();
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 border-t border-slate-100 font-medium"
            >
              + Add project
            </Link>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                active
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              <item.icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  active ? "text-indigo-600" : "text-slate-400",
                )}
              />
              {item.label}
              {item.label === "AI Copilot" && (
                <span className="ml-auto text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">
                  New
                </span>
              )}
              {"badge" in item && item.badge && item.label !== "AI Copilot" && (
                <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                  {item.badge as string}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-slate-100 p-4 shrink-0">
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
    </>
  );
}

/**
 * Desktop sidebar — fixed left rail, hidden below md. Mobile users get
 * the same nav via `MobileSidebarTrigger` rendered from the topbar.
 */
export default function Sidebar() {
  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-screen w-64 bg-white border-r border-slate-200 flex-col z-40">
      <SidebarBody />
    </aside>
  );
}

/**
 * Mobile sidebar trigger — a hamburger button that opens the same nav in
 * a left-side Sheet. Only rendered below md by the topbar.
 */
export function MobileSidebarTrigger() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-72 max-w-[85vw] flex flex-col">
        {/* a11y: SheetTitle is required by base-ui's Dialog primitive. We
           hide it visually because BrandLogo serves as the visual label. */}
        <SheetTitle className="sr-only">Navigation menu</SheetTitle>
        <SidebarBody onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
