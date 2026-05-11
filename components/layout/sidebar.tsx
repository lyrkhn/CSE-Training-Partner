"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/types";

import { navigationItems } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import {
  AssessmentIcon,
  CoursesIcon,
  DashboardIcon,
  LabIcon,
  ProfileIcon,
  SimulationIcon,
} from "@/components/ui/icons";

function iconFor(item: NavItem["icon"], className = "h-5 w-5") {
  const iconProps = { className };

  switch (item) {
    case "dashboard":
      return <DashboardIcon {...iconProps} />;
    case "courses":
      return <CoursesIcon {...iconProps} />;
    case "simulation":
      return <SimulationIcon {...iconProps} />;
    case "assessment":
      return <AssessmentIcon {...iconProps} />;
    case "lab":
      return <LabIcon {...iconProps} />;
    default:
      return <ProfileIcon {...iconProps} />;
  }
}

export function Sidebar({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-white/60 bg-slate-950 py-8 text-slate-100 transition-[width,padding] duration-300 lg:flex",
        collapsed ? "w-24 px-4" : "w-72 px-6",
      )}
    >
      <div
        className={cn(
          "rounded-2xl bg-white/5",
          collapsed ? "flex justify-center p-4" : "p-5",
        )}
      >
        {collapsed ? (
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <span className="text-sm font-semibold">CW</span>
          </div>
        ) : (
          <>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Learning Workspace</p>
            <h1 className="mt-3 text-2xl font-semibold leading-tight">CSE Training Partner</h1>
            <p className="mt-3 text-sm text-slate-400">
              Practice customer conversations, review AI feedback, and track readiness.
            </p>
          </>
        )}
      </div>

      <nav className={cn("mt-8 space-y-2", collapsed && "px-1")}>
        {navigationItems.map((item) => {
          const isActive =
            item.href === "/" ? pathname === item.href : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex rounded-2xl py-3 text-sm font-medium text-slate-300 transition-all",
                collapsed ? "justify-center px-3" : "items-center gap-3 px-4",
                isActive
                  ? "bg-primary text-white shadow-lg shadow-blue-500/20"
                  : "hover:bg-white/10 hover:text-white",
              )}
              title={collapsed ? item.title : undefined}
              aria-label={item.title}
            >
              {iconFor(item.icon, "h-5 w-5 shrink-0")}
              {!collapsed && <span>{item.title}</span>}
            </Link>
          );
        })}
      </nav>

      {collapsed ? (
        <div className="mt-auto flex justify-center">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-xs font-semibold text-slate-300"
            title="74% completion"
          >
            74%
          </div>
        </div>
      ) : (
        <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-sm font-semibold">Current Cohort</p>
          <p className="mt-2 text-sm text-slate-400">Enterprise Voice and RTC Escalations</p>
          <div className="mt-4 h-2 rounded-full bg-white/10">
            <div className="h-2 w-3/4 rounded-full bg-primary" />
          </div>
          <p className="mt-2 text-xs uppercase tracking-[0.22em] text-slate-500">74% completion</p>
        </div>
      )}
    </aside>
  );
}
