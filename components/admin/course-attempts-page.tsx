"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { SavedFinalAssessment } from "@/src/lib/assessments/types";
import type { AuthSessionUser } from "@/src/lib/auth/session";
import type { SafeAuthUser } from "@/src/lib/auth/userStore";
import { canUserManageRolePlay } from "@/src/lib/roleplays/access";
import { maxTraineeRolePlayAttempts } from "@/src/lib/roleplays/attempts";
import {
  attemptNumberForAssessment,
  learnerName,
} from "@/src/lib/roleplays/courseAnalytics";
import { fetchRolePlayConfig, persistRolePlayConfig } from "@/src/lib/roleplays/storage";
import type { RolePlayConfig } from "@/src/lib/roleplays/types";

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

function isoToUtcDateTimeInput(value: string | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

function utcDateTimeInputToIso(value: string) {
  if (!value) return undefined;
  const date = new Date(`${value}:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

type DeadlineDraft = {
  deadlineDateTimeUtc: string;
  deadlineTimezone: string;
};

export function CourseAttemptsPage({ rolePlayId }: { rolePlayId: string }) {
  const [roleplay, setRoleplay] = useState<RolePlayConfig | null>(null);
  const [assessments, setAssessments] = useState<SavedFinalAssessment[]>([]);
  const [users, setUsers] = useState<SafeAuthUser[]>([]);
  const [currentUser, setCurrentUser] = useState<AuthSessionUser | null>(null);
  const [deadlineDraft, setDeadlineDraft] = useState<DeadlineDraft>({
    deadlineDateTimeUtc: "",
    deadlineTimezone: "UTC",
  });
  const [attemptOverrideDrafts, setAttemptOverrideDrafts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadData() {
    const [sessionResponse, config, assessmentsResponse, usersResponse] = await Promise.all([
      fetch("/api/auth/session", { cache: "no-store" }),
      fetchRolePlayConfig(rolePlayId),
      fetch("/api/assessments", { cache: "no-store" }),
      fetch("/api/users/trainees", { cache: "no-store" }),
    ]);

    const sessionPayload = sessionResponse.ok
      ? ((await sessionResponse.json()) as { user?: AuthSessionUser })
      : {};
    const sessionUser = sessionPayload.user ?? null;
    setCurrentUser(sessionUser);

    if (!config) {
      setRoleplay(null);
      setErrorMessage("Course not found.");
      return;
    }

    if (!sessionUser || !canUserManageRolePlay(sessionUser, config)) {
      setAccessDenied(true);
      setRoleplay(null);
      return;
    }

    setRoleplay(config);
    setDeadlineDraft({
      deadlineDateTimeUtc: isoToUtcDateTimeInput(config.settings.deadlineAt),
      deadlineTimezone: config.settings.deadlineTimezone ?? "UTC",
    });

    if (assessmentsResponse.ok) {
      const payload = (await assessmentsResponse.json()) as { assessments?: SavedFinalAssessment[] };
      setAssessments(Array.isArray(payload.assessments) ? payload.assessments : []);
    }

    if (usersResponse.ok) {
      const payload = (await usersResponse.json()) as { users?: SafeAuthUser[] };
      setUsers(Array.isArray(payload.users) ? payload.users : []);
    }
  }

  useEffect(() => {
    void loadData()
      .catch((error) => {
        setErrorMessage(error instanceof Error ? error.message : "Unable to load course attempts.");
      })
      .finally(() => setIsLoading(false));
  }, [rolePlayId]);

  const courseAssessments = useMemo(
    () => assessments.filter((assessment) => assessment.scenarioId === rolePlayId),
    [assessments, rolePlayId],
  );

  const assignedUsers = useMemo(() => {
    const assignedIds = roleplay?.settings.assignedTraineeIds ?? [];
    return users.filter((candidate) => assignedIds.includes(candidate.id));
  }, [roleplay, users]);

  async function saveRoleplaySettings(settings: Partial<RolePlayConfig["settings"]>, successMessage: string) {
    if (!roleplay) return;

    setIsSaving(true);
    setMessage(null);
    setErrorMessage(null);
    try {
      const saved = await persistRolePlayConfig({
        ...roleplay,
        settings: {
          ...roleplay.settings,
          ...settings,
        },
      });
      setRoleplay(saved);
      setMessage(successMessage);
      await loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update course settings.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveDeadline() {
    await saveRoleplaySettings(
      {
        deadlineAt: utcDateTimeInputToIso(deadlineDraft.deadlineDateTimeUtc),
        deadlineTimezone: deadlineDraft.deadlineTimezone.trim() || "UTC",
      },
      "Course deadline updated.",
    );
  }

  async function saveAttemptOverride(userId: string) {
    if (!roleplay) return;

    const maxAttempts = Math.max(1, Math.floor(attemptOverrideDrafts[userId] ?? 0));
    const nextOverrides = {
      ...(roleplay.settings.attemptOverrides ?? {}),
      [userId]: {
        maxAttempts,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser
          ? {
              id: currentUser.id,
              name: currentUser.name,
              email: currentUser.email,
              role: currentUser.role,
            }
          : undefined,
      },
    };

    await saveRoleplaySettings(
      { attemptOverrides: nextOverrides },
      "Learner attempt allowance updated.",
    );
  }

  if (isLoading) {
    return <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Loading attempts...</div>;
  }

  if (accessDenied) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-700">Owner-only access</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Attempts are available only to the course owner or root admin.</h1>
        <Link href="/course-builder" className="mt-5 inline-flex rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white">Back to Managed Courses</Link>
      </div>
    );
  }

  if (errorMessage || !roleplay) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-sm font-semibold text-rose-700">
        {errorMessage ?? "Unable to load course attempts."}
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 px-1 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-slate-500">Course Attempts</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">{roleplay.settings.meetingTitle}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Review learner attempt numbers, scores, coach feedback, deadlines, and retake allowances.
          </p>
          <p className="mt-2 text-xs font-semibold text-slate-500">Current deadline: {formatDate(roleplay.settings.deadlineAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/course-builder/${rolePlayId}/analytics`} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50">View Analytics</Link>
          <Link href="/course-builder" className="rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700">Back to Courses</Link>
        </div>
      </header>

      {(message || errorMessage) && (
        <div
          className={`rounded-2xl border p-4 text-sm font-semibold ${
            errorMessage
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {errorMessage ?? message}
        </div>
      )}

      <section className="grid gap-4 rounded-[2rem] border border-blue-100 bg-blue-50/50 p-5 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
        <label className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Deadline date/time (UTC)</span>
          <input
            type="datetime-local"
            value={deadlineDraft.deadlineDateTimeUtc}
            onChange={(event) =>
              setDeadlineDraft((current) => ({ ...current, deadlineDateTimeUtc: event.target.value }))
            }
            className="w-full rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-blue-100"
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Timezone label</span>
          <input
            value={deadlineDraft.deadlineTimezone}
            onChange={(event) =>
              setDeadlineDraft((current) => ({ ...current, deadlineTimezone: event.target.value }))
            }
            className="w-full rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-blue-100"
          />
        </label>
        <button
          type="button"
          onClick={() => void saveDeadline()}
          disabled={isSaving}
          className="rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save Deadline
        </button>
      </section>

      <section className="rounded-[2rem] border border-amber-100 bg-amber-50 p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Attempt Overrides</p>
        <p className="mt-2 text-sm text-amber-900">
          Increase a learner's max attempts if they missed the deadline or need one more retake. Default is {maxTraineeRolePlayAttempts} attempts.
        </p>
        {assignedUsers.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-amber-200 bg-white/70 p-5 text-sm text-amber-900">
            No assigned learners yet. Add learners in Edit Course before setting per-learner attempt overrides.
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {assignedUsers.map((learner) => {
              const override = roleplay.settings.attemptOverrides?.[learner.id];
              const learnerAttempts = courseAssessments.filter(
                (assessment) =>
                  assessment.learnerId === learner.id ||
                  (!assessment.learnerId && assessment.learnerEmail === learner.email),
              ).length;
              return (
                <div key={learner.id} className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="font-bold text-slate-950">{learner.name}</p>
                  <p className="text-xs text-slate-500">{learner.email}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    Attempts used: {learnerAttempts} / {override?.maxAttempts ?? maxTraineeRolePlayAttempts}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={attemptOverrideDrafts[learner.id] ?? override?.maxAttempts ?? maxTraineeRolePlayAttempts}
                      onChange={(event) =>
                        setAttemptOverrideDrafts((current) => ({
                          ...current,
                          [learner.id]: Number(event.target.value),
                        }))
                      }
                      className="w-24 rounded-xl border border-amber-100 px-3 py-2 text-sm outline-none focus:border-amber-300"
                    />
                    <button
                      type="button"
                      onClick={() => void saveAttemptOverride(learner.id)}
                      disabled={isSaving}
                      className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Save max attempts
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Exam Attempts</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Attempt History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-400">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Attempt</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Outcome</th>
                <th className="px-4 py-3">Coach Feedback</th>
                <th className="px-4 py-3">Completed</th>
                <th className="px-4 py-3">Review</th>
              </tr>
            </thead>
            <tbody>
              {courseAssessments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No learners have completed this course exam yet.
                  </td>
                </tr>
              ) : (
                courseAssessments.map((assessment) => (
                  <tr key={assessment.id} className="border-t border-slate-100 text-slate-700">
                    <td className="px-4 py-3 font-bold text-slate-950">{learnerName(assessment, users)}</td>
                    <td className="px-4 py-3 font-bold">#{attemptNumberForAssessment(courseAssessments, assessment)}</td>
                    <td className="px-4 py-3">{assessment.learnerEmail ?? "Not recorded"}</td>
                    <td className="px-4 py-3 font-bold">{assessment.overallScore}%</td>
                    <td className="px-4 py-3">{assessment.outcome === "passed" ? "Passed" : "Needs Review"}</td>
                    <td className="px-4 py-3">
                      <p className="line-clamp-2 max-w-sm text-xs leading-5 text-slate-600">{assessment.summary}</p>
                    </td>
                    <td className="px-4 py-3">{formatDate(assessment.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Link className="font-bold text-primary hover:text-blue-700" href={`/assessment/${assessment.id}`}>Open</Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
