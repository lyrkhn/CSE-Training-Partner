"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import type { AuthSessionUser } from "@/src/lib/auth/session";

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [user, setUser] = useState<AuthSessionUser | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
        });

        if (!response.ok) {
          router.replace("/login");
          return;
        }

        const payload = (await response.json()) as { user?: AuthSessionUser };
        setUser(payload.user ?? null);
      } finally {
        setIsLoadingSession(false);
      }
    })();
  }, [router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  if (isLoadingSession || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-500">
        Loading secure workspace...
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:flex">
      <Sidebar collapsed={isSidebarCollapsed} role={user.role} />
      <div
        className="flex min-h-screen flex-1 flex-col"
        style={
          {
            "--app-sidebar-width": isSidebarCollapsed ? "6rem" : "18rem",
          } as CSSProperties
        }
      >
        <Header
          user={user}
          onLogout={() => void logout()}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed((current) => !current)}
        />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
