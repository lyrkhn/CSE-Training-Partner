import { NextResponse } from "next/server";

import { evaluateObjectives } from "@/src/lib/objectives/evaluator";
import type {
  Objective,
  ObjectiveEvaluationRequest,
  TranscriptEntry,
} from "@/src/lib/objectives/types";

type EvaluationBody = {
  scenarioId?: unknown;
  evaluator_prompt?: unknown;
  latestEngineerMessage?: unknown;
  incompleteObjectives?: unknown;
  recentTranscript?: unknown;
};

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
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
      const id = asString((item as { id?: unknown }).id).trim();
      const label = asString((item as { label?: unknown }).label).trim();
      const required = Boolean((item as { required?: unknown }).required);
      const completed = Boolean((item as { completed?: unknown }).completed);
      if (!id || !label) {
        return null;
      }
      return {
        id,
        label,
        required,
        completed,
      } as Objective;
    })
    .filter((item): item is Objective => Boolean(item));
}

function asTranscript(value: unknown): TranscriptEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const id = asString((item as { id?: unknown }).id).trim();
      const speakerType = asString((item as { speaker_type?: unknown }).speaker_type).trim();
      const speakerId = asString((item as { speaker_id?: unknown }).speaker_id).trim();
      const text = asString((item as { text?: unknown }).text).trim();
      const timestamp = asString((item as { timestamp?: unknown }).timestamp).trim();
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
  const body = (await request.json().catch(() => ({}))) as EvaluationBody;
  const scenarioId = asString(body.scenarioId).trim();
  const evaluatorPrompt = asString(body.evaluator_prompt).trim();
  const latestEngineerMessage = asString(body.latestEngineerMessage).trim();
  const incompleteObjectives = asObjectives(body.incompleteObjectives);
  const recentTranscript = asTranscript(body.recentTranscript);

  if (!scenarioId) {
    return NextResponse.json({ error: "scenarioId is required." }, { status: 400 });
  }
  if (!latestEngineerMessage) {
    return NextResponse.json(
      { error: "latestEngineerMessage is required." },
      { status: 400 },
    );
  }

  const evaluateRequest: ObjectiveEvaluationRequest = {
    scenarioId,
    evaluator_prompt: evaluatorPrompt,
    latestEngineerMessage,
    incompleteObjectives,
    recentTranscript,
  };

  try {
    const result = await evaluateObjectives(evaluateRequest);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Objective evaluation failed.",
        details: error instanceof Error ? error.message : "Unknown evaluator error.",
      },
      { status: 500 },
    );
  }
}

