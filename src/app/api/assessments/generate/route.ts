import { NextResponse } from "next/server";

import { generateFinalAssessment } from "@/src/lib/assessments/generator";
import { saveFinalAssessment } from "@/src/lib/assessments/storage";
import type { GenerateAssessmentInput } from "@/src/lib/assessments/types";
import { getAuthSession } from "@/src/lib/auth/session";
import type { Objective } from "@/src/lib/objectives/types";
import type { TranscriptEntry } from "@/src/lib/transcripts/types";

type GenerateAssessmentBody = {
  transcriptSessionId?: unknown;
  scenarioId?: unknown;
  scenarioTitle?: unknown;
  learnerRole?: unknown;
  objectives?: unknown;
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
  try {
    const session = await getAuthSession();
    const body = (await request.json().catch(() => ({}))) as GenerateAssessmentBody;
    const input: GenerateAssessmentInput = {
      transcriptSessionId: asString(body.transcriptSessionId),
      scenarioId: asString(body.scenarioId),
      scenarioTitle: asString(body.scenarioTitle),
      learnerId: session?.id,
      learnerName: session?.name,
      learnerEmail: session?.email,
      learnerRole: asString(body.learnerRole) || undefined,
      objectives: asObjectives(body.objectives),
      transcript: asTranscriptEntries(body.transcript),
    };

    if (!input.transcriptSessionId || !input.scenarioId || !input.scenarioTitle) {
      return NextResponse.json(
        { error: "transcriptSessionId, scenarioId, and scenarioTitle are required." },
        { status: 400 },
      );
    }

    const assessment = await saveFinalAssessment(await generateFinalAssessment(input));

    return NextResponse.json({
      assessmentId: assessment.id,
      createdAt: assessment.createdAt,
      overallScore: assessment.overallScore,
      outcome: assessment.outcome,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to generate final assessment.",
        details: error instanceof Error ? error.message : "Unknown final assessment error.",
      },
      { status: 500 },
    );
  }
}
