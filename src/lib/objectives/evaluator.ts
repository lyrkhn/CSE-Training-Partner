import type {
  MatchedObjective,
  ObjectiveEvaluationRequest,
  ObjectiveEvaluationResponse,
} from "@/src/lib/objectives/types";

type OpenAiChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

const DEFAULT_MIN_OBJECTIVE_CONFIDENCE = 0.4;

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

function clampConfidence(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0.7;
  }
  return Math.min(1, Math.max(0, value));
}

function getMinObjectiveConfidence() {
  const raw = Number(process.env.OBJECTIVE_EVALUATOR_MIN_CONFIDENCE);
  if (Number.isNaN(raw)) {
    return DEFAULT_MIN_OBJECTIVE_CONFIDENCE;
  }
  return Math.min(1, Math.max(0, raw));
}

function parseMatchedObjectives(
  payloadText: string,
  allowedObjectiveIds: Set<string>,
): MatchedObjective[] {
  const normalized = stripCodeFence(payloadText);
  const parsed = JSON.parse(normalized) as { matchedObjectives?: unknown };
  if (!Array.isArray(parsed.matchedObjectives)) {
    return [];
  }

  const dedupe = new Map<string, MatchedObjective>();

  const minConfidence = getMinObjectiveConfidence();

  for (const rawItem of parsed.matchedObjectives) {
    if (!rawItem || typeof rawItem !== "object") {
      continue;
    }

    const id = asString((rawItem as { id?: unknown }).id).trim();
    const evidence = asString((rawItem as { evidence?: unknown }).evidence).trim();
    const completed = Boolean((rawItem as { completed?: unknown }).completed);
    const confidence = clampConfidence((rawItem as { confidence?: unknown }).confidence);

    if (
      !id ||
      !allowedObjectiveIds.has(id) ||
      !completed ||
      !evidence ||
      confidence < minConfidence
    ) {
      continue;
    }

    dedupe.set(id, {
      id,
      completed: true,
      confidence,
      evidence,
    });
  }

  return [...dedupe.values()];
}

export async function evaluateObjectives(
  input: ObjectiveEvaluationRequest,
): Promise<ObjectiveEvaluationResponse> {
  const incompleteObjectives = input.incompleteObjectives.filter(
    (objective) => !objective.completed && objective.label.trim(),
  );
  if (incompleteObjectives.length === 0) {
    return { matchedObjectives: [] };
  }

  const latestEngineerMessage = input.latestEngineerMessage.trim();
  if (!latestEngineerMessage) {
    return { matchedObjectives: [] };
  }

  const provider = asString(process.env.OBJECTIVE_EVALUATOR_PROVIDER).trim().toLowerCase();
  const apiKey = asString(process.env.OBJECTIVE_EVALUATOR_API_KEY).trim();
  const model = asString(process.env.OBJECTIVE_EVALUATOR_MODEL).trim();

  if (!provider || !apiKey || !model) {
    throw new Error(
      "OBJECTIVE_EVALUATOR_PROVIDER, OBJECTIVE_EVALUATOR_API_KEY, and OBJECTIVE_EVALUATOR_MODEL are required.",
    );
  }

  if (provider !== "openai") {
    throw new Error("Unsupported OBJECTIVE_EVALUATOR_PROVIDER. Currently supported: openai.");
  }

  const engineerTranscript = input.recentTranscript
    .filter((entry) => entry.speaker_type === "engineer")
    .slice(-10)
    .map((entry) => ({
      id: entry.id,
      text: entry.text,
      timestamp: entry.timestamp,
    }));

  const objectiveSet = new Set(incompleteObjectives.map((objective) => objective.id));
  const evaluatorPrompt =
    input.evaluator_prompt.trim() ||
    "You are a hidden objective evaluator. Return strict JSON only.";

  const userPayload = {
    scenarioId: input.scenarioId,
    latestEngineerMessage,
    incompleteObjectives: incompleteObjectives.map((objective) => ({
      id: objective.id,
      label: objective.label,
      required: objective.required,
    })),
    engineerTranscript,
    outputContract: {
      matchedObjectives: [
        {
          id: "string",
          completed: true,
          confidence: 0.0,
          evidence: "exact phrase from latestEngineerMessage",
        },
      ],
    },
    rules: [
      "Evaluate only the latestEngineerMessage and engineer transcript lines.",
      "Do not evaluate any customer_ai messages.",
      "Only include objectives clearly satisfied by latestEngineerMessage.",
      "If no objective is satisfied, return {\"matchedObjectives\":[]}.",
      "Return strict JSON only with no markdown.",
    ],
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: evaluatorPrompt },
        { role: "user", content: JSON.stringify(userPayload) },
      ],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Objective evaluator failed with HTTP ${response.status}. ${details}`);
  }

  const payload = (await response.json()) as OpenAiChatResponse;
  const content = asString(payload.choices?.[0]?.message?.content).trim();
  if (!content) {
    return { matchedObjectives: [] };
  }

  return {
    matchedObjectives: parseMatchedObjectives(content, objectiveSet),
  };
}
