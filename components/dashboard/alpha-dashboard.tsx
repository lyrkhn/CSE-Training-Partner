"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { AuthSessionUser } from "@/src/lib/auth/session";
import type { SavedFinalAssessment } from "@/src/lib/assessments/types";
import type { RolePlayConfig } from "@/src/lib/roleplays/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type DashboardData = {
  user: AuthSessionUser | null;
  roleplays: RolePlayConfig[];
  assessments: SavedFinalAssessment[];
};

function formatDate(value?: string) {
  if (!value) {
    return "Not yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function AlphaDashboard() {
  const [data, setData] = useState<DashboardData>({
    user: null,
    roleplays: [],
    assessments: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [sessionResponse, roleplaysResponse, assessmentsResponse] = await Promise.all([
          fetch("/api/auth/session", { cache: "no-store" }),
          fetch("/api/roleplays", { cache: "no-store" }),
          fetch("/api/assessments", { cache: "no-store" }),
        ]);

        if (!sessionResponse.ok) {
          throw new Error("Unable to load your alpha session.");
        }

        const sessionPayload = (await sessionResponse.json()) as { user?: AuthSessionUser };
        const roleplaysPayload = roleplaysResponse.ok
          ? ((await roleplaysResponse.json()) as { roleplays?: RolePlayConfig[] })
          : { roleplays: [] };
        const assessmentsPayload = assessmentsResponse.ok
          ? ((await assessmentsResponse.json()) as { assessments?: SavedFinalAssessment[] })
          : { assessments: [] };

        setData({
          user: sessionPayload.user ?? null,
          roleplays: Array.isArray(roleplaysPayload.roleplays) ? roleplaysPayload.roleplays : [],
          assessments: Array.isArray(assessmentsPayload.assessments)
            ? assessmentsPayload.assessments
            : [],
        });
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to load alpha dashboard.",
        );
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const latestAssessment = data.assessments[0];
  const averageScore = useMemo(() => {
    if (data.assessments.length === 0) {
      return null;
    }

    const total = data.assessments.reduce((sum, assessment) => sum + assessment.overallScore, 0);
    return Math.round(total / data.assessments.length);
  }, [data.assessments]);
  const passedCount = data.assessments.filter((assessment) => assessment.outcome === "passed").length;

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-blue-100 bg-white p-8 text-sm text-slate-500 shadow-soft">
        Loading alpha dashboard...
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-sm text-amber-900 shadow-soft">
        {errorMessage}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
        <Card className="overflow-hidden border-none bg-hero-grid shadow-soft">
          <CardContent className="p-8">
            <Badge>Alpha testing workspace</Badge>
            <h1 className="mt-5 max-w-2xl text-4xl font-semibold tracking-tight text-slate-950">
              Welcome back{data.user?.name ? `, ${data.user.name}` : ""}.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              Test assigned roleplay courses, complete simulations, and review AI-generated final
              assessments with turn-level coaching feedback.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/courses"
                className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
              >
                View Assigned Courses
              </Link>
              <Link
                href="/assessment"
                className="rounded-2xl border border-blue-100 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-soft transition hover:bg-blue-50"
              >
                Review Assessments
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-950 text-white">
          <CardHeader>
            <CardDescription className="text-slate-400">Current access</CardDescription>
            <CardTitle className="text-white">Alpha role</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-sm text-slate-400">Signed in as</p>
              <p className="mt-1 font-semibold">{data.user?.email ?? "Unknown user"}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-sm text-slate-400">Role</p>
              <p className="mt-1 font-semibold">
                {data.user?.role === "root_admin"
                  ? "Root Admin"
                  : data.user?.role === "course_admin"
                    ? "Course Admin"
                    : "Trainee"}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Assigned Courses",
            value: data.roleplays.length.toString(),
            helper: "Published roleplays available",
          },
          {
            label: "Completed Assessments",
            value: data.assessments.length.toString(),
            helper: "Generated after ended calls",
          },
          {
            label: "Average Score",
            value: averageScore === null ? "N/A" : `${averageScore}%`,
            helper: "Across saved assessments",
          },
          {
            label: "Passed",
            value: passedCount.toString(),
            helper: "Assessments marked passed",
          },
        ].map((metric) => (
          <Card key={metric.label} className="bg-white/90">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{metric.label}</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                {metric.value}
              </p>
              <p className="mt-2 text-sm text-primary">{metric.helper}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
        <Card className="bg-white/90">
          <CardHeader>
            <CardDescription>Assigned roleplay courses</CardDescription>
            <CardTitle>Ready to test</CardTitle>
          </CardHeader>
          <CardContent>
            {data.roleplays.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/50 p-6 text-sm text-slate-600">
                No courses are assigned yet. Ask a course admin to publish a roleplay and assign
                it to your trainee account.
              </div>
            ) : (
              <div className="grid gap-4">
                {data.roleplays.slice(0, 3).map((roleplay) => (
                  <article
                    key={roleplay.id}
                    className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-950">
                          {roleplay.settings.meetingTitle}
                        </h3>
                        <p className="mt-1 text-sm text-blue-700">
                          {roleplay.character.name} · {roleplay.settings.durationMinutes} min
                        </p>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                          {roleplay.plan.scenario}
                        </p>
                      </div>
                      <Link
                        href={`/admin/roleplays/preview/${roleplay.id}/session`}
                        className="shrink-0 rounded-2xl bg-primary px-4 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
                      >
                        Start
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white/90">
          <CardHeader>
            <CardDescription>Latest final assessment</CardDescription>
            <CardTitle>Recent performance</CardTitle>
          </CardHeader>
          <CardContent>
            {!latestAssessment ? (
              <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/50 p-6 text-sm text-slate-600">
                No assessment generated yet. Complete a roleplay session to create one.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl bg-blue-50/70 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-950">
                        {latestAssessment.scenarioTitle}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDate(latestAssessment.createdAt)}
                      </p>
                    </div>
                    <Badge variant={latestAssessment.outcome === "passed" ? "success" : "warning"}>
                      {latestAssessment.overallScore}%
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {latestAssessment.summary}
                  </p>
                </div>
                <Link
                  href={`/assessment/${latestAssessment.id}`}
                  className="inline-flex w-full justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
                >
                  View Final Assessment
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

