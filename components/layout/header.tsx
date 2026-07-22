import Link from "next/link";

import { CogIcon, LogOutIcon, PanelLeftIcon } from "@/components/ui/icons";
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
    <header className="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden rounded-2xl border border-slate-200 bg-white p-3 text-slate-700 shadow-sm transition hover:text-primary lg:inline-flex"
          >
            <PanelLeftIcon
              className={`h-5 w-5 transition-transform duration-300 ${
                isSidebarCollapsed ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xl font-bold text-slate-700 shadow-sm ring-2 ring-white">
            {initial}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-lg font-bold leading-6 text-slate-950">{user.name}</p>
              <Link
                href="/profile/password"
                title="Change password"
                aria-label="Change password"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-4 focus:ring-blue-100"
              >
                <CogIcon className="h-4 w-4" />
              </Link>
            </div>
            <p className="truncate text-sm font-medium text-slate-500">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-3 text-lg font-bold text-slate-900 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
          >
            <LogOutIcon className="h-6 w-6" />
            <span>Logout</span>
          </button>
        </div>
      </div>
      <MobileNav role={user.role} />
    </header>
  );
}
