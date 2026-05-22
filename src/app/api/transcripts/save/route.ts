import { NextResponse } from "next/server";

import type { Objective } from "@/src/lib/objectives/types";
import { saveTranscriptSession } from "@/src/lib/transcripts/storage";
import type { TranscriptEntry } from "@/src/lib/transcripts/types";

type SaveBody = {
  scenarioId?: unknown;
  scenarioTitle?: unknown;
  status?: unknown;
  completedObjectives?: unknown;
  transcript?: unknown;
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asObjectives(value: unknown): Objective[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const id = asString((item as { id?: unknown }).id);
      const label = asString((item as { label?: unknown }).label);
      if (!id || !label) {
        return null;
      }
      return {
        id,
        label,
        required: Boolean((item as { required?: unknown }).required),
        completed: Boolean((item as { completed?: unknown }).completed),
        completedAt: asString((item as { completedAt?: unknown }).completedAt) || undefined,
        evidence: asString((item as { evidence?: unknown }).evidence) || undefined,
        confidence:
          typeof (item as { confidence?: unknown }).confidence === "number"
            ? (item as { confidence?: number }).confidence
            : undefined,
      } as Objective;
    })
    .filter((item): item is Objective => Boolean(item));
}

function asTranscriptEntries(value: unknown): TranscriptEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const id = asString((item as { id?: unknown }).id);
      const speakerType = asString((item as { speaker_type?: unknown }).speaker_type);
      const speakerId = asString((item as { speaker_id?: unknown }).speaker_id);
      const text = asString((item as { text?: unknown }).text);
      const timestamp = asString((item as { timestamp?: unknown }).timestamp);

      if (
        !id ||
        (speakerType !== "engineer" && speakerType !== "customer_ai") ||
        !speakerId ||
        !text ||
        !timestamp
      ) {
        return null;
      }

      return {
        id,
        speaker_type: speakerType,
        speaker_id: speakerId,
        text,
        timestamp,
      } as TranscriptEntry;
    })
    .filter((item): item is TranscriptEntry => Boolean(item));
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as SaveBody;
  const scenarioId = asString(body.scenarioId);
  const scenarioTitle = asString(body.scenarioTitle);
  const status = asString(body.status);
  const completedObjectives = asObjectives(body.completedObjectives);
  const transcript = asTranscriptEntries(body.transcript);

  if (!scenarioId || !scenarioTitle) {
    return NextResponse.json(
      { error: "scenarioId and scenarioTitle are required." },
      { status: 400 },
    );
  }

  if (status !== "completed") {
    return NextResponse.json({ error: "status must be completed." }, { status: 400 });
  }

  const session = await saveTranscriptSession({
    scenarioId,
    scenarioTitle,
    status: "completed",
    completedObjectives,
    transcript,
  });

  return NextResponse.json({
    transcriptSessionId: session.id,
    savedAt: session.createdAt,
  });
}

