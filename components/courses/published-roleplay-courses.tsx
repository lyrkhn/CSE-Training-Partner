"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { AuthSessionUser } from "@/src/lib/auth/session";
import { visibleRoleplaysForUser } from "@/src/lib/roleplays/access";
import {
  fetchRolePlayAttemptStatus,
  type RolePlayAttemptStatus,
} from "@/src/lib/roleplays/attempts";
import { fetchRolePlayConfigs } from "@/src/lib/roleplays/storage";
import type { RolePlayConfig } from "@/src/lib/roleplays/types";

export function PublishedRoleplayCourses({
  emptyState = false,
}: {
  emptyState?: boolean;
}) {
  const [roleplays, setRoleplays] = useState<RolePlayConfig[]>([]);
  const [user, setUser] = useState<AuthSessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [attemptsByRolePlayId, setAttemptsByRolePlayId] = useState<
    Record<string, RolePlayAttemptStatus>
  >({});

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
        });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { user?: AuthSessionUser };
        const nextUser = payload.user ?? null;
        setUser(nextUser);

        if (nextUser) {
          const visibleRoleplays = visibleRoleplaysForUser(
            nextUser,
            (await fetchRolePlayConfigs()).filter((roleplay) => roleplay.status === "published"),
          );
          setRoleplays(visibleRoleplays);

          if (nextUser.role === "trainee" || nextUser.role === "course_admin") {
            const attemptEntries = await Promise.all(
              visibleRoleplays.map(async (roleplay) => [
                roleplay.id,
                await fetchRolePlayAttemptStatus(nextUser.id, roleplay.id),
              ] as const),
            );
            setAttemptsByRolePlayId(Object.fromEntries(attemptEntries));
          }
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  if (isLoading) {
    return (
      <section className="rounded-3xl border border-blue-100 bg-white p-6 text-sm text-slate-500 shadow-soft">
        Loading assigned roleplay courses...
      </section>
    );
  }

  if (roleplays.length === 0) {
    if (!emptyState) {
      return null;
    }

    return (
      <section className="rounded-3xl border border-dashed border-blue-200 bg-white/90 p-8 text-center shadow-soft">
        <p className="text-xs uppercase tracking-[0.24em] text-primary">Assigned Roleplays</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
          No assigned courses yet
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-600">
          {user?.role === "trainee"
            ? "Ask a course admin to assign published roleplay courses to your learner account."
            : user?.role === "course_admin"
              ? "Ask another course admin to assign published roleplay courses to your account."
              : "Publish a roleplay and assign learner users from the Role Play Builder."}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-primary">Assigned Roleplays</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
          AI Roleplay Courses You Can Access
        </h2>
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        {roleplays.map((roleplay) => {
            const attemptStatus =
              user?.role === "trainee" || user?.role === "course_admin"
                ? attemptsByRolePlayId[roleplay.id]
                : null;
            const actionLabel =
              attemptStatus?.locked
                ? "Attempts Used"
                : attemptStatus && attemptStatus.completedAttempts > 0
                  ? "Retake Role Play"
                  : "Start Role Play";

            return (
              <article
                key={roleplay.id}
                className="rounded-3xl border border-blue-100 bg-white p-5 shadow-soft"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-950">
                      {roleplay.settings.meetingTitle}
                    </h3>
                    <p className="mt-1 text-sm font-medium text-blue-700">
                      {roleplay.character.name} · {roleplay.character.role}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                      attemptStatus?.locked
                        ? "bg-slate-100 text-slate-600 ring-slate-200"
                        : "bg-emerald-50 text-emerald-700 ring-emerald-200"
                    }`}
                  >
                    {attemptStatus?.locked ? "Locked" : "Published"}
                  </span>
                </div>
                <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">
                  {roleplay.plan.scenario}
                </p>
                <div className="mt-5 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <span>{roleplay.settings.durationMinutes} min</span>
                  <span>{roleplay.settings.learnerGoals.length} goals</span>
                </div>
                {attemptStatus && (
                  <p className="mt-3 rounded-2xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
                    {attemptStatus.locked
                      ? "Both attempts completed"
                      : `${attemptStatus.remainingAttempts} of ${attemptStatus.maxAttempts} attempts remaining`}
                  </p>
                )}
                {attemptStatus?.locked ? (
                  <button
                    type="button"
                    disabled
                    className="mt-5 inline-flex w-full cursor-not-allowed items-center justify-center rounded-2xl bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-500"
                  >
                    {actionLabel}
                  </button>
                ) : (
                  <Link
                    href={`/admin/roleplays/preview/${roleplay.id}/session`}
                    className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
                  >
                    {actionLabel}
                  </Link>
                )}
              </article>
            );
          })}
      </div>
    </section>
  );
}
