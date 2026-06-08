import { NextResponse } from "next/server";

import { generateCoachTurnFeedback } from "@/src/lib/assessments/coachTurn";
import { getFinalAssessmentById } from "@/src/lib/assessments/storage";
import { groupTranscriptTurns } from "@/src/lib/assessments/transcriptTurns";

type CoachTurnBody = {
  assessmentId?: unknown;
  turnId?: unknown;
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as CoachTurnBody;
  const assessmentId = asString(body.assessmentId);
  const turnId = asString(body.turnId);

  if (!assessmentId || !turnId) {
    return NextResponse.json(
      { error: "assessmentId and turnId are required." },
      { status: 400 },
    );
  }

  const assessment = await getFinalAssessmentById(assessmentId);
  if (!assessment) {
    return NextResponse.json({ error: "Final assessment not found." }, { status: 404 });
  }

  const turns = groupTranscriptTurns(assessment.transcript);
  const selectedTurnIndex = turns.findIndex((turn) => turn.id === turnId);
  const selectedTurn = turns[selectedTurnIndex];

  if (!selectedTurn) {
    return NextResponse.json({ error: "Transcript turn not found." }, { status: 404 });
  }

  if (selectedTurn.speaker_type !== "engineer") {
    return NextResponse.json(
      { error: "Coach feedback is only available for trainee turns." },
      { status: 400 },
    );
  }

  const previousCustomerTurn = [...turns]
    .slice(0, selectedTurnIndex)
    .reverse()
    .find((turn) => turn.speaker_type === "customer_ai");
  const nextCustomerTurn = turns
    .slice(selectedTurnIndex + 1)
    .find((turn) => turn.speaker_type === "customer_ai");

  const feedback = await generateCoachTurnFeedback({
    assessment,
    selectedTurn,
    previousCustomerTurn,
    nextCustomerTurn,
  });

  return NextResponse.json(feedback);
}

