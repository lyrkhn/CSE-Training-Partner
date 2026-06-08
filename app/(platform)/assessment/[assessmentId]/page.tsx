"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { groupTranscriptTurns } from "@/src/lib/assessments/transcriptTurns";
import type { CoachTurnFeedback, SavedFinalAssessment } from "@/src/lib/assessments/types";

export default function FinalAssessmentDetailPage() {
  const params = useParams<{ assessmentId: string }>();
  const assessmentId = params.assessmentId;
  const [assessment, setAssessment] = useState<SavedFinalAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [coachFeedbackByTurnId, setCoachFeedbackByTurnId] = useState<
    Record<string, CoachTurnFeedback>
  >({});
  const [coachErrorByTurnId, setCoachErrorByTurnId] = useState<Record<string, string>>({});
  const [coachLoadingTurnId, setCoachLoadingTurnId] = useState<string | null>(null);

  const transcriptTurns = useMemo(
    () => (assessment ? groupTranscriptTurns(assessment.transcript) : []),
    [assessment],
  );

  useEffect(() => {
    if (!assessmentId) {
      setLoading(false);
      setErrorMessage("Assessment id is required.");
      return;
    }

    void (async () => {
      try {
        const response = await fetch(`/api/assessments/${assessmentId}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Unable to load final assessment. HTTP ${response.status}.`);
        }

        setAssessment((await response.json()) as SavedFinalAssessment);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to load final assessment.",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [assessmentId]);

  async function loadCoachFeedback(turnId: string) {
    if (!assessment || coachFeedbackByTurnId[turnId] || coachLoadingTurnId) {
      return;
    }

    setCoachLoadingTurnId(turnId);
    setCoachErrorByTurnId((current) => {
      const next = { ...current };
      delete next[turnId];
      return next;
    });

    try {
      const response = await fetch("/api/assessments/coach-turn", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assessmentId: assessment.id,
          turnId,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? `Coach feedback failed with HTTP ${response.status}.`);
      }

      const feedback = (await response.json()) as CoachTurnFeedback;
      setCoachFeedbackByTurnId((current) => ({
        ...current,
        [turnId]: feedback,
      }));
    } catch (error) {
      setCoachErrorByTurnId((current) => ({
        ...current,
        [turnId]:
          error instanceof Error ? error.message : "Unable to generate coach feedback.",
      }));
    } finally {
      setCoachLoadingTurnId(null);
    }
  }

  if (loading) {
    return <div className="text-sm text-slate-500">Loading final assessment...</div>;
  }

  if (errorMessage || !assessment) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 shadow-soft">
        {errorMessage ?? "Final assessment not found."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-blue-100 bg-hero-grid p-6 shadow-soft">
          <p className="text-xs uppercase tracking-[0.24em] text-primary">Final Assessment</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {assessment.scenarioTitle}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
            {assessment.summary}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
              Trainee-facing review
            </span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                assessment.outcome === "passed"
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  : "bg-amber-50 text-amber-700 ring-amber-200"
              }`}
            >
              {assessment.outcome === "passed" ? "Passed" : "Needs Review"}
            </span>
          </div>
        </div>

        <div className="rounded-3xl border border-blue-100 bg-white p-6 text-center shadow-soft">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Overall Score</p>
          <p className="mt-4 text-6xl font-semibold text-slate-950">
            {assessment.overallScore}%
          </p>
          <p className="mt-3 text-sm text-slate-500">
            Generated from objectives, transcript signals, and conversation completeness.
          </p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-blue-100 bg-white p-6 shadow-soft">
          <h2 className="text-xl font-semibold text-slate-950">Strengths</h2>
          <div className="mt-4 space-y-3">
            {assessment.strengths.map((item) => (
              <div key={item} className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-blue-100 bg-white p-6 shadow-soft">
          <h2 className="text-xl font-semibold text-slate-950">Coaching Focus</h2>
          <div className="mt-4 space-y-3">
            {assessment.improvements.map((item) => (
              <div key={item} className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-blue-100 bg-white p-6 shadow-soft">
        <h2 className="text-xl font-semibold text-slate-950">Rubric Dimensions</h2>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {assessment.dimensions.map((dimension) => (
            <div key={dimension.label} className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-slate-950">{dimension.label}</p>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700">
                  {dimension.score}%
                </span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-white">
                <div
                  className="h-2 rounded-full bg-primary"
                  style={{ width: `${dimension.score}%` }}
                />
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{dimension.summary}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-blue-100 bg-white p-6 shadow-soft">
          <h2 className="text-xl font-semibold text-slate-950">Completed Objectives</h2>
          <div className="mt-4 space-y-3">
            {assessment.completedObjectives.length === 0 ? (
              <p className="text-sm text-slate-500">No completed objectives recorded.</p>
            ) : (
              assessment.completedObjectives.map((objective) => (
                <div key={objective.id} className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">
                  <p className="font-semibold">{objective.label}</p>
                  {objective.evidence && <p className="mt-2">Evidence: {objective.evidence}</p>}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-blue-100 bg-white p-6 shadow-soft">
          <h2 className="text-xl font-semibold text-slate-950">Missed Required Objectives</h2>
          <div className="mt-4 space-y-3">
            {assessment.missedObjectives.length === 0 ? (
              <p className="text-sm text-slate-500">No missed required objectives.</p>
            ) : (
              assessment.missedObjectives.map((objective) => (
                <div key={objective.id} className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-800">
                  {objective.label}
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-blue-100 bg-white p-6 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-950">Transcript Review</h2>
          <Link href="/assessment" className="text-sm font-semibold text-primary hover:text-blue-700">
            Back to assessment results
          </Link>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Consecutive transcript fragments are grouped into conversation turns, so coach feedback
          reviews the full learner reply instead of a broken ASR snippet.
        </p>
        <div className="mt-5 space-y-3">
          {transcriptTurns.map((turn) => {
            const feedback = coachFeedbackByTurnId[turn.id];
            const coachError = coachErrorByTurnId[turn.id];
            const isCoachLoading = coachLoadingTurnId === turn.id;

            return (
              <div key={turn.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-950">
                    {turn.speaker_type === "engineer" ? "engineer turn" : "customer_ai"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(turn.startedAt).toLocaleTimeString()}
                  </p>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-700">{turn.text}</p>

                {turn.speaker_type === "engineer" && (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => void loadCoachFeedback(turn.id)}
                      disabled={Boolean(coachLoadingTurnId) && !isCoachLoading}
                      className="rounded-2xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isCoachLoading
                        ? "Generating feedback..."
                        : feedback
                          ? "Coach Feedback"
                          : "View Coach Feedback"}
                    </button>

                    {coachError && (
                      <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        {coachError}
                      </div>
                    )}

                    {feedback && (
                      <div className="mt-3 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
                        <p className="text-xs uppercase tracking-[0.2em] text-primary">
                          Turn Coach
                        </p>
                        <div className="mt-3 grid gap-3 xl:grid-cols-3">
                          <div className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-800">
                            <p className="font-semibold text-emerald-900">What worked</p>
                            <p className="mt-2 leading-6">{feedback.whatWorked}</p>
                          </div>
                          <div className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
                            <p className="font-semibold">What to improve</p>
                            <p className="mt-2 leading-6">{feedback.whatToImprove}</p>
                          </div>
                          <div className="rounded-2xl bg-blue-50 p-3 text-sm text-blue-900">
                            <p className="font-semibold">Suggested better response</p>
                            <p className="mt-2 leading-6">
                              {feedback.suggestedBetterResponse}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
