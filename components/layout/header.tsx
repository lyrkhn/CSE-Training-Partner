import Link from "next/link";

import { AiRolePlayIcon, CogIcon, LogOutIcon, PanelLeftIcon } from "@/components/ui/icons";
import { MobileNav } from "@/components/layout/mobile-nav";
import type { AuthSessionUser } from "@/src/lib/auth/session";

export function Header({
  user,
  onLogout,
  isSidebarCollapsed,
  onToggleSidebar,
}: {
  user: AuthSessionUser;
  onLogout: () => void;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}) {
  const initial = user.name.trim().charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase();

  return (
    <header className="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-700 shadow-sm transition hover:text-primary lg:inline-flex"
          >
            <PanelLeftIcon
              className={`h-5 w-5 transition-transform duration-300 ${
                isSidebarCollapsed ? "rotate-180" : ""
              }`}
            />
          </button>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#e0f2fe,#38bdf8)] text-white shadow-sm shadow-sky-500/20">
            <AiRolePlayIcon className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">
              Training & Assessment Workspace
            </p>
            <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-950 sm:text-xl">
              AI RolePlay Academy
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-3 md:justify-end">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-slate-700 shadow-sm ring-2 ring-white">
            {initial}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-bold leading-5 text-slate-950">{user.name}</p>
              <Link
                href="/profile/password"
                title="Change password"
                aria-label="Change password"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-4 focus:ring-blue-100"
              >
                <CogIcon className="h-3.5 w-3.5" />
              </Link>
            </div>
            <p className="truncate text-xs font-medium text-slate-500">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
          >
            <LogOutIcon className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>
      <MobileNav role={user.role} />
    </header>
  );
}
