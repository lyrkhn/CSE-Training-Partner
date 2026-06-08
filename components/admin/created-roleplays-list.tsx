"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  fetchRolePlayConfigs,
  persistRolePlayStatus,
  removeRolePlayConfig,
} from "@/src/lib/roleplays/storage";
import type { RolePlayConfig } from "@/src/lib/roleplays/types";

function formatDate(value?: string) {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function StatusBadge({ status }: { status: RolePlayConfig["status"] }) {
  const isPublished = status === "published";

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        isPublished
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
          : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
      }`}
    >
      {isPublished ? "Published" : "Draft"}
    </span>
  );
}

export function CreatedRoleplaysList() {
  const [roleplays, setRoleplays] = useState<RolePlayConfig[]>([]);

  async function refreshRoleplays() {
    setRoleplays(await fetchRolePlayConfigs());
  }

  useEffect(() => {
    void refreshRoleplays();
  }, []);

  const counts = useMemo(
    () => ({
      total: roleplays.length,
      drafts: roleplays.filter((roleplay) => roleplay.status === "draft").length,
      published: roleplays.filter((roleplay) => roleplay.status === "published").length,
    }),
    [roleplays],
  );

  async function updateStatus(rolePlayId: string, status: RolePlayConfig["status"]) {
    await persistRolePlayStatus(rolePlayId, status);
    await refreshRoleplays();
  }

  async function deleteRolePlay(rolePlayId: string) {
    if (!window.confirm("Delete this saved roleplay course?")) {
      return;
    }

    await removeRolePlayConfig(rolePlayId);
    await refreshRoleplays();
  }

  return (
    <section id="course-builder" className="space-y-6">
      <header className="overflow-hidden rounded-3xl border border-blue-100 bg-hero-grid p-6 shadow-soft">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-primary">Course Admin</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Preview Created Courses
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              Review saved roleplay courses, continue editing drafts, publish learner-ready
              simulations, or launch a preview test call.
            </p>
          </div>
          <Link
            href="/course-builder/new"
            className="inline-flex items-center justify-center rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
          >
            Create Role Play
          </Link>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-blue-100 bg-white/80 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Total</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{counts.total}</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-amber-700">Drafts</p>
            <p className="mt-2 text-2xl font-semibold text-amber-800">{counts.drafts}</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-700">Published</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-800">{counts.published}</p>
          </div>
        </div>
      </header>

      {roleplays.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-blue-200 bg-white/90 p-10 text-center shadow-soft">
          <p className="text-xs uppercase tracking-[0.24em] text-primary">No roleplay courses</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
            No roleplay courses created yet
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-600">
            Start with the Role Play Builder to create a draft, publish it when ready, then preview
            the learner-facing experience from this page.
          </p>
          <Link
            href="/course-builder/new"
            className="mt-6 inline-flex items-center justify-center rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
          >
            Create Role Play
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {roleplays.map((roleplay) => (
            <article
              key={roleplay.id}
              className="rounded-3xl border border-blue-100 bg-white p-5 shadow-soft"
            >
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                      {roleplay.settings.meetingTitle}
                    </h2>
                    <StatusBadge status={roleplay.status} />
                  </div>
                  <p className="mt-2 text-sm font-medium text-blue-700">
                    {roleplay.character.name} · {roleplay.character.role}
                  </p>
                  <p className="mt-3 line-clamp-2 max-w-4xl text-sm leading-6 text-slate-600">
                    {roleplay.plan.scenario}
                  </p>
                  <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <span className="block text-xs uppercase tracking-[0.16em] text-slate-400">
                        Duration
                      </span>
                      <span className="mt-1 block font-semibold text-slate-800">
                        {roleplay.settings.durationMinutes} min
                      </span>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <span className="block text-xs uppercase tracking-[0.16em] text-slate-400">
                        Goals
                      </span>
                      <span className="mt-1 block font-semibold text-slate-800">
                        {roleplay.settings.learnerGoals.length}
                      </span>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <span className="block text-xs uppercase tracking-[0.16em] text-slate-400">
                        Assigned Users
                      </span>
                      <span className="mt-1 block font-semibold text-slate-800">
                        {roleplay.settings.assignedTraineeIds?.length ?? 0}
                      </span>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <span className="block text-xs uppercase tracking-[0.16em] text-slate-400">
                        Created
                      </span>
                      <span className="mt-1 block font-semibold text-slate-800">
                        {formatDate(roleplay.createdAt)}
                      </span>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3 sm:col-span-2 xl:col-span-1">
                      <span className="block text-xs uppercase tracking-[0.16em] text-slate-400">
                        Updated
                      </span>
                      <span className="mt-1 block font-semibold text-slate-800">
                        {formatDate(roleplay.updatedAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2 xl:max-w-xs xl:justify-end">
                  <Link
                    href={`/course-builder?preview=${roleplay.id}`}
                    className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
                  >
                    Preview/Test
                  </Link>
                  <Link
                    href={`/course-builder/${roleplay.id}/edit`}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50"
                  >
                    Edit
                  </Link>
                  {roleplay.status === "draft" ? (
                    <button
                      type="button"
                      onClick={() => void updateStatus(roleplay.id, "published")}
                      className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-600"
                    >
                      Publish
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void updateStatus(roleplay.id, "draft")}
                      className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
                    >
                      Unpublish
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void deleteRolePlay(roleplay.id)}
                    className="rounded-2xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
