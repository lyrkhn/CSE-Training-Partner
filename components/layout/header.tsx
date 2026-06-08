import { BellIcon, PanelLeftIcon, SearchIcon } from "@/components/ui/icons";
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
  const roleLabel =
    user.role === "root_admin"
      ? "Root Admin"
      : user.role === "course_admin"
        ? "Course Admin"
        : "Trainee";

  return (
    <header className="flex flex-col gap-4 border-b border-white/70 bg-white/70 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden rounded-2xl border bg-white p-3 text-slate-700 shadow-soft transition hover:text-primary lg:inline-flex"
          >
            <PanelLeftIcon
              className={`h-5 w-5 transition-transform duration-300 ${
                isSidebarCollapsed ? "rotate-180" : ""
              }`}
            />
          </button>
          <div>
            <p className="text-sm font-medium text-primary">Learning Dashboard</p>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
              Support mastery through simulation and assessment
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 text-sm text-muted-foreground shadow-soft">
            <SearchIcon className="h-4 w-4" />
            <span>Search scenarios, feedback, and progress</span>
          </div>
          <button className="rounded-2xl border bg-white p-3 text-slate-700 shadow-soft transition hover:text-primary">
            <BellIcon className="h-5 w-5" />
          </button>
          <div className="rounded-2xl border bg-white px-4 py-3 shadow-soft">
            <p className="text-sm font-semibold text-slate-950">{user.name}</p>
            <p className="text-xs text-muted-foreground">{roleLabel}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-2xl border bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-soft transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
          >
            Logout
          </button>
        </div>
      </div>
      <MobileNav role={user.role} />
    </header>
  );
}
