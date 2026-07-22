"use client";

import { useEffect, useMemo, useState } from "react";

import type { ActivityLogAction, ActivityLogEntry } from "@/src/lib/activity-log/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function actionLabel(action: ActivityLogAction) {
  const labels: Record<ActivityLogAction, string> = {
    course_created: "Created",
    course_updated: "Edited",
    course_published: "Published",
    course_unpublished: "Unpublished",
    course_deleted: "Deleted",
  };

  return labels[action];
}

function actionClass(action: ActivityLogAction) {
  if (action === "course_deleted") {
    return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
  }

  if (action === "course_created" || action === "course_published") {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  }

  if (action === "course_unpublished") {
    return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  }

  return "bg-blue-50 text-blue-700 ring-1 ring-blue-200";
}

export function ActivityLogPanel() {
  const [activity, setActivity] = useState<ActivityLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function refreshActivity() {
    setErrorMessage(null);
    const response = await fetch("/api/admin/activity-log?limit=150", { cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as {
      activity?: ActivityLogEntry[];
      error?: string;
    };

    if (!response.ok) {
      throw new Error(payload.error ?? `Unable to load activity log. HTTP ${response.status}.`);
    }

    setActivity(Array.isArray(payload.activity) ? payload.activity : []);
  }

  useEffect(() => {
    void (async () => {
      try {
        await refreshActivity();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to load activity log.");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const counts = useMemo(
    () => ({
      total: activity.length,
      created: activity.filter((entry) => entry.action === "course_created").length,
      edited: activity.filter(
        (entry) => entry.action === "course_updated" || entry.action === "course_published" || entry.action === "course_unpublished",
      ).length,
      deleted: activity.filter((entry) => entry.action === "course_deleted").length,
    }),
    [activity],
  );

  if (isLoading) {
    return (
      <section className="rounded-3xl border border-blue-100 bg-white p-6 text-sm text-slate-500 shadow-soft">
        Loading activity log...
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-blue-100 bg-hero-grid p-7 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-primary">Root Admin</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
              Activity Log
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
              See who created, edited, published, unpublished, or deleted roleplay courses. The log
              captures course activity from this point forward.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshActivity()}
            className="inline-flex rounded-2xl border border-blue-100 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
          >
            Refresh Log
          </button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          {[
            { label: "Events", value: counts.total },
            { label: "Created", value: counts.created },
            { label: "Edited", value: counts.edited },
            { label: "Deleted", value: counts.deleted },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-blue-100 bg-white/85 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      {errorMessage && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm font-medium text-amber-900">
          {errorMessage}
        </div>
      )}

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft">
        <div className="border-b border-slate-200 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                Course activity
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Latest activity appears first and is visible only to root admins.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {activity.length} events
            </span>
          </div>
        </div>

        {activity.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-xs uppercase tracking-[0.24em] text-primary">No activity yet</p>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
              Course changes will appear here
            </h3>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-600">
              Create, edit, publish, unpublish, or delete a roleplay course to generate the first
              activity log entry.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-separate border-spacing-0 text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="border-b border-slate-200 px-5 py-3 font-medium">Action</th>
                  <th className="border-b border-slate-200 px-5 py-3 font-medium">Course</th>
                  <th className="border-b border-slate-200 px-5 py-3 font-medium">Actor</th>
                  <th className="border-b border-slate-200 px-5 py-3 font-medium">When</th>
                  <th className="border-b border-slate-200 px-5 py-3 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((entry) => (
                  <tr key={entry.id} className="text-slate-700 transition hover:bg-slate-50">
                    <td className="border-b border-slate-100 px-5 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${actionClass(entry.action)}`}>
                        {actionLabel(entry.action)}
                      </span>
                    </td>
                    <td className="border-b border-slate-100 px-5 py-4">
                      <p className="font-semibold text-slate-950">{entry.target.title}</p>
                      <p className="mt-1 text-xs text-slate-400">{entry.target.id}</p>
                    </td>
                    <td className="border-b border-slate-100 px-5 py-4">
                      <p className="font-semibold text-slate-950">{entry.actor.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{entry.actor.email}</p>
                    </td>
                    <td className="border-b border-slate-100 px-5 py-4 text-slate-600">
                      {formatDate(entry.createdAt)}
                    </td>
                    <td className="border-b border-slate-100 px-5 py-4 text-slate-600">
                      {entry.summary}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
