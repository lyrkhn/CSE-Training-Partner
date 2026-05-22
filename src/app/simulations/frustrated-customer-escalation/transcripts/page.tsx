"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { SavedTranscriptSession } from "@/src/lib/transcripts/types";

const scenarioId = "frustrated-customer-escalation";

function previewText(session: SavedTranscriptSession) {
  const firstLine = session.transcript[0]?.text ?? "No transcript lines saved.";
  return firstLine.length > 140 ? `${firstLine.slice(0, 140)}...` : firstLine;
}

export default function SavedTranscriptsPage() {
  const [sessions, setSessions] = useState<SavedTranscriptSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch(`/api/transcripts?scenarioId=${scenarioId}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`Unable to load saved transcripts. HTTP ${response.status}.`);
        }
        const payload = (await response.json()) as { sessions?: SavedTranscriptSession[] };
        setSessions(Array.isArray(payload.sessions) ? payload.sessions : []);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to load transcripts.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Saved Transcripts</p>
          <h1 className="mt-3 text-3xl font-semibold">Frustrated Customer Escalation</h1>
          <p className="mt-3 text-sm text-slate-300">
            Review previously saved simulation transcript sessions.
          </p>
        </div>

        {loading && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            Loading saved transcripts...
          </div>
        )}

        {errorMessage && (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
            {errorMessage}
          </div>
        )}

        {!loading && !errorMessage && sessions.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/15 bg-slate-900/40 p-4 text-sm text-slate-300">
            No saved transcripts yet.
          </div>
        )}

        {!loading && !errorMessage && sessions.length > 0 && (
          <div className="space-y-4">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">
                    {new Date(session.createdAt).toLocaleString()}
                  </p>
                  <Link
                    href={`/simulations/frustrated-customer-escalation/transcripts/${session.id}`}
                    className="rounded-xl bg-cyan-400 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300"
                  >
                    View Transcript
                  </Link>
                </div>
                <p className="mt-3 text-sm text-slate-300">{previewText(session)}</p>
                <p className="mt-2 text-xs text-slate-400">
                  {session.completedObjectives.length} completed objectives ·{" "}
                  {session.transcript.length} transcript lines
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

