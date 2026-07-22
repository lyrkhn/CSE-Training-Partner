"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { SavedFinalAssessment } from "@/src/lib/assessments/types";
import { Badge } from "@/components/ui/badge";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function outcomeClass(outcome: SavedFinalAssessment["outcome"]) {
  return outcome === "passed"
    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
    : "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
}

export function FinalAssessmentsList() {
  const [assessments, setAssessments] = useState<SavedFinalAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/assessments", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Unable to load final assessments. HTTP ${response.status}.`);
        }

        const payload = (await response.json()) as {
          assessments?: SavedFinalAssessment[];
        };
        setAssessments(Array.isArray(payload.assessments) ? payload.assessments : []);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to load final assessments.",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const stats = useMemo(() => {
    const completed = assessments.length;
    const passed = assessments.filter((assessment) => assessment.outcome === "passed").length;
    const needsReview = completed - passed;
    const averageScore =
      completed === 0
        ? null
        : Math.round(
            assessments.reduce((total, assessment) => total + assessment.overallScore, 0) /
              completed,
          );

    return { averageScore, completed, needsReview, passed };
  }, [assessments]);

  const latestAssessment = assessments[0];

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.8fr]">
        <div className="overflow-hidden rounded-3xl border border-blue-100 bg-hero-grid p-7 shadow-soft">
          <Badge>AI-scored final assessments</Badge>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
            Assessment Results
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
            Review generated roleplay assessments, objective coverage, rubric dimensions,
            transcripts, and turn-level coaching feedback. This page now uses saved assessment
            data from completed simulations instead of mock results.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/courses"
              className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
            >
              Start Assigned Course
            </Link>
            <Link
              href="/"
              className="rounded-2xl border border-blue-100 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-soft transition hover:bg-blue-50"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 text-white shadow-soft">
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Latest Result</p>
          {latestAssessment ? (
            <div className="mt-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">{latestAssessment.scenarioTitle}</h2>
                  <p className="mt-2 text-sm text-slate-400">
                    {formatDate(latestAssessment.createdAt)}
                  </p>
                </div>
                <span className="rounded-2xl bg-white px-4 py-3 text-2xl font-semibold text-slate-950">
                  {latestAssessment.overallScore}%
                </span>
              </div>
              <p className="mt-5 text-sm leading-7 text-slate-300">
                {latestAssessment.summary}
              </p>
              <Link
                href={`/assessment/${latestAssessment.id}`}
                className="mt-5 inline-flex rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-blue-50"
              >
                Open Review
              </Link>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm leading-7 text-slate-300">
              No final assessment yet. Complete a roleplay session to generate your first scored
              review.
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Completed Reviews",
            value: stats.completed.toString(),
            helper: "Saved final assessments",
          },
          {
            label: "Average Score",
            value: stats.averageScore === null ? "N/A" : `${stats.averageScore}%`,
            helper: "Across generated reviews",
          },
          {
            label: "Passed",
            value: stats.passed.toString(),
            helper: "Marked ready",
          },
          {
            label: "Needs Review",
            value: stats.needsReview.toString(),
            helper: "Coaching recommended",
          },
        ].map((stat) => (
          <div key={stat.label} className="rounded-3xl border border-blue-100 bg-white p-5 shadow-soft">
            <p className="text-sm text-slate-500">{stat.label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              {stat.value}
            </p>
            <p className="mt-2 text-sm text-primary">{stat.helper}</p>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-blue-100 bg-white p-6 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-primary">
              Generated Reviews
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Roleplay assessment history
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
              Trainees see assessments only for roleplay courses assigned to them. Admins can view
              all generated roleplay reviews.
            </p>
          </div>
          <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            {assessments.length} saved
          </span>
        </div>

        {loading && (
          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/50 p-5 text-sm text-slate-500">
            Loading final assessments...
          </div>
        )}

        {errorMessage && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {errorMessage}
          </div>
        )}

        {!loading && !errorMessage && assessments.length === 0 && (
          <div className="mt-5 rounded-3xl border border-dashed border-blue-200 bg-blue-50/50 p-8 text-center">
            <p className="text-xs uppercase tracking-[0.24em] text-primary">No reviews yet</p>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
              Complete a roleplay to generate an assessment
            </h3>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              Once a trainee ends a roleplay session, the app saves the transcript and generates an
              AI-scored final assessment here.
            </p>
            <Link
              href="/courses"
              className="mt-6 inline-flex rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
            >
              View Assigned Courses
            </Link>
          </div>
        )}

        {assessments.length > 0 && (
          <div className="mt-5 grid gap-4">
            {assessments.map((assessment) => (
              <article
                key={assessment.id}
                className="rounded-3xl border border-blue-100 bg-blue-50/40 p-5 transition hover:border-blue-200 hover:bg-blue-50/70"
              >
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-semibold tracking-tight text-slate-950">
                        {assessment.scenarioTitle}
                      </h3>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${outcomeClass(
                          assessment.outcome,
                        )}`}
                      >
                        {assessment.outcome === "passed" ? "Passed" : "Needs Review"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                      Generated {formatDate(assessment.createdAt)}
                    </p>
                    <p className="mt-3 line-clamp-3 max-w-4xl text-sm leading-7 text-slate-600">
                      {assessment.summary}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                      <span className="rounded-full bg-white px-3 py-1 ring-1 ring-blue-100">
                        {assessment.completedObjectives.length} completed objectives
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 ring-1 ring-blue-100">
                        {assessment.missedObjectives.length} missed objectives
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 ring-1 ring-blue-100">
                        {assessment.transcript.length} transcript lines
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <div className="rounded-3xl bg-white px-5 py-4 text-center shadow-sm">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Score</p>
                      <p className="mt-1 text-3xl font-semibold text-slate-950">
                        {assessment.overallScore}%
                      </p>
                    </div>
                    <Link
                      href={`/assessment/${assessment.id}`}
                      className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
                    >
                      View Review
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

