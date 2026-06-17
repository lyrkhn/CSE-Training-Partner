import type { CoachTurnFeedback, SavedFinalAssessment, TranscriptTurn } from "@/src/lib/assessments/types";
import {
  generateJsonCompletion,
  getFinalAssessmentLlmConfig,
} from "@/src/lib/llm/jsonCompletion";

type CoachTurnPayload = {
  whatWorked?: unknown;
  whatToImprove?: unknown;
  suggestedBetterResponse?: unknown;
};

type GenerateCoachTurnFeedbackInput = {
  assessment: SavedFinalAssessment;
  selectedTurn: TranscriptTurn;
  previousCustomerTurn?: TranscriptTurn;
  nextCustomerTurn?: TranscriptTurn;
};

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function stripCodeFence(value: string) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  const firstLineBreak = trimmed.indexOf("\n");
  const lastFence = trimmed.lastIndexOf("```");
  if (firstLineBreak < 0 || lastFence <= firstLineBreak) {
    return trimmed;
  }
  return trimmed.slice(firstLineBreak + 1, lastFence).trim();
}

function coachFeedbackSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["whatWorked", "whatToImprove", "suggestedBetterResponse"],
    properties: {
      whatWorked: { type: "string" },
      whatToImprove: { type: "string" },
      suggestedBetterResponse: { type: "string" },
    },
  };
}

function parseCoachFeedback(content: string, turnId: string): CoachTurnFeedback {
  const parsed = JSON.parse(stripCodeFence(content)) as CoachTurnPayload;
  const whatWorked = asString(parsed.whatWorked).trim();
  const whatToImprove = asString(parsed.whatToImprove).trim();
  const suggestedBetterResponse = asString(parsed.suggestedBetterResponse).trim();

  if (!whatWorked || !whatToImprove || !suggestedBetterResponse) {
    throw new Error("AI coach feedback response did not include all required fields.");
  }

  return {
    turnId,
    whatWorked,
    whatToImprove,
    suggestedBetterResponse,
  };
}

export async function generateCoachTurnFeedback({
  assessment,
  selectedTurn,
  previousCustomerTurn,
  nextCustomerTurn,
}: GenerateCoachTurnFeedbackInput): Promise<CoachTurnFeedback> {
  const llmConfig = getFinalAssessmentLlmConfig();

  const prompt = [
    "You are a concise but helpful roleplay coach for a customer-facing training simulation.",
    "Coach only the selected trainee turn. The previous and next customer turns are context only.",
    "Do not score the trainee here. Give actionable turn-level feedback.",
    "If the trainee turn is fragmented by transcription, treat it as one combined turn.",
    "Use the configured learner role, scenario, objectives, and final assessment context.",
    "The suggested better response should be realistic, concise, professional, and written as something the trainee could have said in that moment.",
    "Return JSON only that matches the required schema. Do not include markdown, comments, or extra fields.",
  ].join("\n");

  const userPayload = {
    scenarioId: assessment.scenarioId,
    scenarioTitle: assessment.scenarioTitle,
    learnerRole: assessment.learnerRole ?? "Trainee",
    finalAssessmentSummary: assessment.summary,
    objectives: [...assessment.completedObjectives, ...assessment.missedObjectives].map(
      (objective) => ({
        id: objective.id,
        label: objective.label,
        required: objective.required,
        completedInFinalAssessment: objective.completed,
        evidence: objective.evidence,
      }),
    ),
    previousCustomerTurn: previousCustomerTurn
      ? {
          text: previousCustomerTurn.text,
          startedAt: previousCustomerTurn.startedAt,
        }
      : null,
    selectedTraineeTurn: {
      id: selectedTurn.id,
      text: selectedTurn.text,
      startedAt: selectedTurn.startedAt,
      endedAt: selectedTurn.endedAt,
    },
    nextCustomerTurn: nextCustomerTurn
      ? {
          text: nextCustomerTurn.text,
          startedAt: nextCustomerTurn.startedAt,
        }
      : null,
    outputContract: {
      whatWorked: "One concise observation about what the trainee did well in this turn.",
      whatToImprove: "One concise coaching point about what was missing or unclear.",
      suggestedBetterResponse: "A realistic improved response the trainee could have said.",
    },
  };

  const content = await generateJsonCompletion({
    config: llmConfig,
    systemPrompt: prompt,
    userPayload,
    temperature: 0.2,
    responseFormat: {
      type: "json_schema",
      name: "turn_coach_feedback",
      strict: true,
      schema: coachFeedbackSchema(),
    },
    errorLabel: "AI coach feedback",
  });

  return parseCoachFeedback(content, selectedTurn.id);
}
