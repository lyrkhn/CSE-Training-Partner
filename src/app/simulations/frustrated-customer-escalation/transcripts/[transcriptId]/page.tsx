"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import type { SavedTranscriptSession } from "@/src/lib/transcripts/types";

export default function SavedTranscriptDetailPage() {
  const params = useParams<{ transcriptId: string }>();
  const transcriptId = params.transcriptId;

  const [session, setSession] = useState<SavedTranscriptSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!transcriptId) {
      setLoading(false);
      setErrorMessage("Transcript id is required.");
      return;
    }

    void (async () => {
      try {
        const response = await fetch(`/api/transcripts/${transcriptId}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`Unable to load transcript session. HTTP ${response.status}.`);
        }
        const payload = (await response.json()) as SavedTranscriptSession;
        setSession(payload);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to load transcript.");
      } finally {
        setLoading(false);
      }
    })();
  }, [transcriptId]);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Transcript Detail</p>
          <h1 className="mt-3 text-3xl font-semibold">
            {session?.scenarioTitle ?? "Simulation Transcript"}
          </h1>
          <p className="mt-3 text-sm text-slate-300">
            Saved conversation with objective completion evidence.
          </p>
          <Link
            href="/simulations/frustrated-customer-escalation/transcripts"
            className="mt-4 inline-block text-sm font-medium text-cyan-300 hover:text-cyan-200"
          >
            Back to saved transcripts
          </Link>
        </div>

        {loading && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            Loading transcript...
          </div>
        )}

        {errorMessage && (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
            {errorMessage}
          </div>
        )}

        {!loading && session && (
          <>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
              <p>Created: {new Date(session.createdAt).toLocaleString()}</p>
              <p className="mt-2">Status: {session.status}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Completed Objectives
              </p>
              <div className="mt-4 space-y-3">
                {session.completedObjectives.length === 0 ? (
                  <p className="text-sm text-slate-300">No completed objectives recorded.</p>
                ) : (
                  session.completedObjectives.map((objective) => (
                    <div
                      key={objective.id}
                      className="rounded-xl border border-white/10 bg-slate-900/40 p-4"
                    >
                      <p className="text-sm font-semibold text-white">{objective.label}</p>
                      <p className="mt-2 text-xs text-slate-400">
                        evidence: {objective.evidence ?? "--"}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        confidence:{" "}
                        {typeof objective.confidence === "number"
                          ? objective.confidence.toFixed(2)
                          : "--"}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Conversation</p>
              <div className="mt-4 space-y-3">
                {session.transcript.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-xl border border-white/10 bg-slate-900/40 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white">{entry.speaker_type}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">speaker_id: {entry.speaker_id}</p>
                    <p className="mt-2 text-sm text-slate-300">{entry.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

