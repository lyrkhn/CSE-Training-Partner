"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { SavedFinalAssessment } from "@/src/lib/assessments/types";
import type { AuthSessionUser } from "@/src/lib/auth/session";
import type { SafeAuthUser } from "@/src/lib/auth/userStore";
import { canUserManageRolePlay } from "@/src/lib/roleplays/access";
import {
  analyticsForCourse,
  learnerName,
} from "@/src/lib/roleplays/courseAnalytics";
import { fetchRolePlayConfig } from "@/src/lib/roleplays/storage";
import type { RolePlayConfig } from "@/src/lib/roleplays/types";

function formatPercent(value: number | null) {
  return value === null ? "N/A" : `${value}%`;
}

function formatDuration(minutes: number | null) {
  if (minutes === null) return "N/A";
  if (minutes < 1) return "<1 min";
  return `${minutes} min`;
}

function formatDate(value?: string) {
  if (!value) return "Not set";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(value));
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-4 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
    </div>
  );
}

export function CourseAnalyticsPage({ rolePlayId }: { rolePlayId: string }) {
  const [roleplay, setRoleplay] = useState<RolePlayConfig | null>(null);
  const [assessments, setAssessments] = useState<SavedFinalAssessment[]>([]);
  const [users, setUsers] = useState<SafeAuthUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      setErrorMessage(null);
      setAccessDenied(false);

      try {
        const [sessionResponse, config, assessmentsResponse, usersResponse] = await Promise.all([
          fetch("/api/auth/session", { cache: "no-store" }),
          fetchRolePlayConfig(rolePlayId),
          fetch("/api/assessments", { cache: "no-store" }),
          fetch("/api/users/trainees", { cache: "no-store" }),
        ]);

        const sessionPayload = sessionResponse.ok
          ? ((await sessionResponse.json()) as { user?: AuthSessionUser })
          : {};
        const currentUser = sessionPayload.user ?? null;

        if (!config) {
          setErrorMessage("Course not found.");
          setRoleplay(null);
          return;
        }

        if (!currentUser || !canUserManageRolePlay(currentUser, config)) {
          setAccessDenied(true);
          setRoleplay(null);
          return;
        }

        setRoleplay(config);

        if (assessmentsResponse.ok) {
          const payload = (await assessmentsResponse.json()) as { assessments?: SavedFinalAssessment[] };
          setAssessments(Array.isArray(payload.assessments) ? payload.assessments : []);
        }

        if (usersResponse.ok) {
          const payload = (await usersResponse.json()) as { users?: SafeAuthUser[] };
          setUsers(Array.isArray(payload.users) ? payload.users : []);
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to load course analytics.");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [rolePlayId]);

  const courseAssessments = useMemo(
    () => assessments.filter((assessment) => assessment.scenarioId === rolePlayId),
    [assessments, rolePlayId],
  );
  const analytics = useMemo(() => analyticsForCourse(courseAssessments), [courseAssessments]);

  if (isLoading) {
    return <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Loading analytics...</div>;
  }

  if (accessDenied) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-700">Owner-only access</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Analytics are available only to the course owner or root admin.</h1>
        <Link href="/course-builder" className="mt-5 inline-flex rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white">Back to Managed Courses</Link>
      </div>
    );
  }

  if (errorMessage || !roleplay) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-sm font-semibold text-rose-700">
        {errorMessage ?? "Unable to load course analytics."}
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 px-1 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-slate-500">Course Analytics</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">{roleplay.settings.meetingTitle}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Performance summary for attempts completed against this roleplay course.
          </p>
          <p className="mt-2 text-xs font-semibold text-slate-500">Deadline: {formatDate(roleplay.settings.deadlineAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/course-builder/${rolePlayId}/attempts`} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50">View Attempts</Link>
          <Link href="/course-builder" className="rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700">Back to Courses</Link>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Total Attempts" value={analytics.totalAttempts} />
        <MetricCard label="Pass Rate" value={formatPercent(analytics.passRate)} />
        <MetricCard label="Average Score" value={formatPercent(analytics.averageScore)} />
        <MetricCard label="Avg Completion" value={formatDuration(analytics.averageCompletionTime)} />
        <MetricCard label="Top Score" value={analytics.topPerformers[0] ? `${analytics.topPerformers[0].overallScore}%` : "N/A"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Score Summary</p>
          <div className="mt-5 space-y-4">
            {analytics.scoreRanges.map((range) => (
              <div key={range.label} className="flex items-center gap-3 text-sm">
                <span className="w-20 font-bold text-slate-700">{range.label}</span>
                <div className="h-2 flex-1 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{
                      width:
                        analytics.totalAttempts === 0
                          ? "0%"
                          : `${Math.round((range.count / analytics.totalAttempts) * 100)}%`,
                    }}
                  />
                </div>
                <span className="w-8 text-right font-bold text-slate-600">{range.count}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Top Performers</p>
          <div className="mt-5 space-y-3">
            {analytics.topPerformers.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">No completed attempts yet.</p>
            ) : (
              analytics.topPerformers.map((assessment, index) => (
                <div key={assessment.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                  <div>
                    <p className="font-bold text-slate-950">#{index + 1} {learnerName(assessment, users)}</p>
                    <p className="text-xs text-slate-500">{assessment.learnerEmail ?? "No email recorded"}</p>
                  </div>
                  <span className="font-bold text-primary">{assessment.overallScore}%</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
