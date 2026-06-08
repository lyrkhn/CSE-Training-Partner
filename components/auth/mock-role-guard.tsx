"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { AuthSessionUser } from "@/src/lib/auth/session";
import type { MockRole } from "@/lib/types";

export function MockRoleGuard({
  allowedRoles,
  children,
}: {
  allowedRoles: MockRole[];
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<AuthSessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
        });
        if (response.ok) {
          const payload = (await response.json()) as { user?: AuthSessionUser };
          setUser(payload.user ?? null);
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  if (isLoading) {
    return <div className="text-sm text-slate-500">Checking access...</div>;
  }

  if (user && allowedRoles.includes(user.role)) {
    return children;
  }

  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 shadow-soft">
      <p className="text-xs uppercase tracking-[0.2em] text-amber-700">Access restricted</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
        This mock role cannot access Course Builder
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-amber-900">
        Sign in with a Course Admin or Root Admin account to build and test roleplay courses.
      </p>
      <Link
        href="/"
        className="mt-5 inline-flex rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
      >
        Return to Dashboard
      </Link>
    </div>
  );
}
