import type { Objective } from "@/src/lib/objectives/types";
import type {
  AssessmentDimension,
  GenerateAssessmentInput,
  SavedFinalAssessment,
} from "@/src/lib/assessments/types";

type OpenAiChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

type AiAssessmentPayload = {
  overallScore?: unknown;
  outcome?: unknown;
  summary?: unknown;
  strengths?: unknown;
  improvements?: unknown;
  dimensions?: unknown;
  objectiveResults?: unknown;
};

type NormalizedAiAssessment = {
  overallScore: number;
  outcome: "passed" | "needs_review";
  summary: string;
  strengths: string[];
  improvements: string[];
  dimensions: AssessmentDimension[];
  objectiveResults: Objective[];
};

const ASSESSMENT_DIMENSION_LABELS = [
  "Objective Coverage",
  "Customer Handling",
  "Action Clarity",
  "Conversation Completeness",
] as const;

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function clampScore(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
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

function normalizeStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const items = value
    .map((item) => asString(item).trim())
    .filter(Boolean)
    .slice(0, 6);

  return items.length > 0 ? items : fallback;
}

function normalizeDimensions(value: unknown): AssessmentDimension[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const label = asString((item as { label?: unknown }).label).trim();
      const summary = asString((item as { summary?: unknown }).summary).trim();

      if (!label || !summary) {
        return null;
      }

      return {
        label,
        score: clampScore((item as { score?: unknown }).score),
        summary,
      };
    })
    .filter((item): item is AssessmentDimension => Boolean(item))
    .slice(0, 6);
}

function normalizeObjectiveResults(value: unknown, objectives: Objective[]): Objective[] {
  if (!Array.isArray(value)) {
    return objectives.map((objective) => ({
      ...objective,
      completed: false,
      completedAt: undefined,
      evidence: undefined,
      confidence: undefined,
    }));
  }

  const objectiveById = new Map(objectives.map((objective) => [objective.id, objective]));
  const normalizedById = new Map<string, Objective>();

  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const id = asString((item as { id?: unknown }).id).trim();
    const objective = objectiveById.get(id);
    if (!objective) {
      continue;
    }

    const completed = Boolean((item as { completed?: unknown }).completed);
    const confidence = (item as { confidence?: unknown }).confidence;
    const evidence = asString((item as { evidence?: unknown }).evidence).trim();

    normalizedById.set(id, {
      ...objective,
      completed,
      completedAt: completed ? new Date().toISOString() : undefined,
      confidence:
        typeof confidence === "number" && !Number.isNaN(confidence)
          ? Math.max(0, Math.min(1, confidence))
          : undefined,
      evidence: completed && evidence ? evidence : undefined,
    });
  }

  return objectives.map(
    (objective) =>
      normalizedById.get(objective.id) ?? {
        ...objective,
        completed: false,
        completedAt: undefined,
        evidence: undefined,
        confidence: undefined,
      },
  );
}

function parseAiAssessment(content: string, objectives: Objective[]): NormalizedAiAssessment {
  const parsed = JSON.parse(stripCodeFence(content)) as AiAssessmentPayload;
  const dimensions = normalizeDimensions(parsed.dimensions);
  const objectiveResults = normalizeObjectiveResults(parsed.objectiveResults, objectives);
  const overallScore = clampScore(parsed.overallScore);
  const outcome = parsed.outcome === "passed" ? "passed" : "needs_review";
  const summary = asString(parsed.summary).trim();
  const strengths = normalizeStringArray(parsed.strengths, [
    "Completed a roleplay attempt for review.",
  ]);
  const improvements = normalizeStringArray(parsed.improvements, [
    "Continue practicing concise summaries and customer confirmation checks.",
  ]);

  if (!summary || dimensions.length === 0) {
    throw new Error("AI assessment response did not include required summary or dimensions.");
  }

  return {
    overallScore,
    outcome,
    summary,
    strengths,
    improvements,
    dimensions,
    objectiveResults,
  };
}

function completedObjectives(objectives: Objective[]) {
  return objectives.filter((objective) => objective.completed);
}

function missedRequiredObjectives(objectives: Objective[]) {
  return objectives.filter((objective) => objective.required && !objective.completed);
}

function assessmentSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "overallScore",
      "outcome",
      "summary",
      "strengths",
      "improvements",
      "dimensions",
      "objectiveResults",
    ],
    properties: {
      overallScore: {
        type: "number",
        minimum: 0,
        maximum: 100,
      },
      outcome: {
        type: "string",
        enum: ["passed", "needs_review"],
      },
      summary: {
        type: "string",
      },
      strengths: {
        type: "array",
        items: { type: "string" },
      },
      improvements: {
        type: "array",
        items: { type: "string" },
      },
      dimensions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["label", "score", "summary"],
          properties: {
            label: {
              type: "string",
              enum: ASSESSMENT_DIMENSION_LABELS,
            },
            score: {
              type: "number",
              minimum: 0,
              maximum: 100,
            },
            summary: { type: "string" },
          },
        },
      },
      objectiveResults: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "completed", "confidence", "evidence"],
          properties: {
            id: { type: "string" },
            completed: { type: "boolean" },
            confidence: {
              type: "number",
              minimum: 0,
              maximum: 1,
            },
            evidence: { type: "string" },
          },
        },
      },
    },
  };
}

export async function generateFinalAssessment(
  input: GenerateAssessmentInput,
): Promise<SavedFinalAssessment> {
  const provider = asString(
    process.env.FINAL_ASSESSMENT_PROVIDER || process.env.OBJECTIVE_EVALUATOR_PROVIDER || "openai",
  )
    .trim()
    .toLowerCase();
  const apiKey = asString(
    process.env.FINAL_ASSESSMENT_API_KEY || process.env.OBJECTIVE_EVALUATOR_API_KEY,
  ).trim();
  const model = asString(
    process.env.FINAL_ASSESSMENT_MODEL ||
      process.env.OBJECTIVE_EVALUATOR_MODEL ||
      "gpt-5.4-mini",
  ).trim();

  if (provider !== "openai") {
    throw new Error("Unsupported FINAL_ASSESSMENT_PROVIDER. Currently supported: openai.");
  }

  if (!apiKey || !model) {
    throw new Error(
      "FINAL_ASSESSMENT_API_KEY/FINAL_ASSESSMENT_MODEL or OBJECTIVE_EVALUATOR_API_KEY/OBJECTIVE_EVALUATOR_MODEL are required for AI-scored final assessments.",
    );
  }

  const assessmentPrompt = [
    "You are a strict but constructive final assessor for a customer-facing roleplay training simulation.",
    "Your job is to evaluate only the trainee's performance using the provided scenario, learner role, objectives, rubric, completed objective tracker results, and transcript.",
    "The trainee may be acting in different customer-facing roles, including but not limited to: technical support engineer, customer success manager, sales representative, onboarding specialist, solutions consultant, account manager, or escalation manager.",
    "Do not assume the scenario is always technical support. Evaluate the trainee based on the configured scenario, learner role, objectives, and transcript evidence.",
    "Customer_ai messages are context only. Do not score, praise, penalize, or give credit for customer_ai messages.",
    "Only evaluate messages where speaker_type is 'engineer' or the configured trainee speaker label.",
    "Use trainee-side evidence from the transcript. If evidence is not present in the trainee's text, do not award credit.",
    "If the trainee explains a required concept across multiple turns, evaluate the combined trainee transcript instead of only one utterance.",
    "Treat live objective tracker results as helpful signals, not absolute truth. You may disagree if the transcript does not support the tracker evidence.",
    "You are the final source of truth for objective completion. Re-evaluate every objective from the full trainee transcript and return objectiveResults for every objective id provided.",
    "For each objectiveResult, completed must be true only when the trainee's own transcript clearly satisfies the objective. Evidence must be an exact trainee-side quote or concise exact excerpt. If not completed, evidence must be an empty string and confidence should be low.",
    "A high score requires strong performance against the configured objectives and roleplay context. Depending on the scenario, this may include required objective coverage, empathy or rapport-building, ownership and accountability, relevant discovery questions, clear explanation or value framing, appropriate handling of objections, concerns, or escalation, concise and professional communication, clear next steps, confirmation of customer needs, expectations, or success criteria, and good conversation control without sounding dismissive or overly scripted.",
    "For product explanation, comparison, or difference scenarios, score whether the trainee explained both sides, contrasted them clearly, and recommended the best fit for the customer's use case.",
    "A low or mid score is appropriate when the trainee is polite but misses required objectives, gives vague or incomplete next steps, fails to take ownership, does not confirm key details, does not ask enough discovery questions, does not address the customer's stated concern, overpromises, sounds defensive or dismissive, focuses on the wrong topic, or fails to adapt to the scenario context.",
    "Do not inflate scores because the conversation ended, all objectives were marked complete by the tracker, the customer_ai appeared satisfied, the trainee used polite language without substance, or the trainee mentioned keywords without meaningfully addressing the objective.",
    "Use specific, actionable coaching language. Strengths and improvements should help the trainee understand what they did well, what they missed, and how to improve in a future simulation.",
    "When giving suggested better answers, write realistic responses the trainee could have said in the scenario. Make them concise, professional, and aligned with the learner role.",
    "Return exactly four rubric dimensions with these exact labels: Objective Coverage, Customer Handling, Action Clarity, Conversation Completeness.",
    "Each rubric dimension summary must explain why that dimension received its score using trainee-side transcript evidence or a specific missing behavior.",
    "Dimension scores should meaningfully influence the overallScore. Do not return dimensions that are disconnected from the final score.",
    "Scoring guidance: 90-100 Excellent. Objectives were covered with strong evidence, communication was clear, and the trainee handled the scenario with confidence and appropriate next steps.",
    "Scoring guidance: 75-89 Good. Most objectives were covered, but there are some gaps in clarity, depth, ownership, discovery, or delivery.",
    "Scoring guidance: 60-74 Mixed. The trainee showed some useful behaviors but missed important objectives or gave incomplete responses.",
    "Scoring guidance: 40-59 Weak. Several required objectives were missed or handled vaguely.",
    "Scoring guidance: 0-39 Poor. The trainee failed to address the scenario effectively or provided little usable response.",
    "Return JSON only that matches the required schema. Do not include markdown, prose outside JSON, comments, or extra fields.",
  ].join("\n");

  const assessmentInput = {
    scenarioId: input.scenarioId,
    scenarioTitle: input.scenarioTitle,
    learnerRole: input.learnerRole ?? "Trainee",
    traineeSpeakerLabel: "engineer",
    objectives: input.objectives.map((objective) => ({
      id: objective.id,
      label: objective.label,
      required: objective.required,
      guideOnly: true,
    })),
    transcript: input.transcript.map((entry) => ({
      speaker_type: entry.speaker_type,
      text: entry.text,
      timestamp: entry.timestamp,
    })),
    rubric: [
      {
        label: "Objective Coverage",
        description:
          "Did the trainee satisfy required goals with explicit trainee-side evidence?",
        scoring:
          "90-100: all required objectives clearly covered. 75-89: most required objectives covered with minor gaps. 60-74: partial coverage or incomplete responses. 40-59: several required objectives missed or vague. 0-39: required objectives mostly missed.",
      },
      {
        label: "Customer Handling",
        description:
          "Empathy, rapport-building, ownership, objection/concern handling, escalation handling, and professional tone appropriate to the learner role.",
        scoring:
          "90-100: confident, role-appropriate customer handling. 75-89: professional with minor gaps. 60-74: useful but inconsistent handling. 40-59: limited empathy, ownership, or adaptation. 0-39: dismissive, confusing, or fails to address concern.",
      },
      {
        label: "Action Clarity",
        description:
          "Clear next steps, timeline, value framing, explanation quality, follow-up expectations, and handoff quality aligned with the learner role.",
        scoring:
          "90-100: specific, relevant, and role-appropriate next steps. 75-89: useful plan with minor ambiguity. 60-74: some action clarity but incomplete. 40-59: generic or incomplete action plan. 0-39: no meaningful next steps.",
      },
      {
        label: "Conversation Completeness",
        description:
          "Professional opening, discovery, adaptation to scenario context, recap, confirmation, and natural closure.",
        scoring:
          "90-100: complete roleplay flow with discovery, confirmation, recap, and closure. 75-89: mostly complete flow. 60-74: mixed flow with missing elements. 40-59: important flow elements missing. 0-39: fragmented or incomplete conversation.",
      },
    ],
    scoringGuidance: {
      passed:
        "Use passed only when the trainee covered all or nearly all required objectives and the overall score is at least 75.",
      needs_review:
        "Use needs_review when required objectives were missed, evidence is weak, the trainee did not adapt to the learner role, or the overall score is below 75.",
      evidenceRule:
        "Base all scoring claims on trainee transcript lines. Do not infer actions that were not said by the trainee.",
      comparisonRule:
        "For difference/comparison objectives, the trainee can satisfy the objective across multiple turns when their own transcript explains both concepts and connects the recommendation to the customer use case.",
    },
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "final_roleplay_assessment",
          strict: true,
          schema: assessmentSchema(),
        },
      },
      messages: [
        { role: "system", content: assessmentPrompt },
        { role: "user", content: JSON.stringify(assessmentInput) },
      ],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`AI final assessment failed with HTTP ${response.status}. ${details}`);
  }

  const payload = (await response.json()) as OpenAiChatResponse;
  const content = asString(payload.choices?.[0]?.message?.content).trim();

  if (!content) {
    throw new Error("AI final assessment returned an empty response.");
  }

  const aiAssessment = parseAiAssessment(content, input.objectives);
  const completed = completedObjectives(aiAssessment.objectiveResults);
  const missed = missedRequiredObjectives(aiAssessment.objectiveResults);

  return {
    id: `assessment-${input.transcriptSessionId}`,
    transcriptSessionId: input.transcriptSessionId,
    scenarioId: input.scenarioId,
    scenarioTitle: input.scenarioTitle,
    learnerRole: input.learnerRole,
    createdAt: new Date().toISOString(),
    overallScore: aiAssessment.overallScore,
    outcome: aiAssessment.outcome,
    summary: aiAssessment.summary,
    strengths: aiAssessment.strengths,
    improvements: aiAssessment.improvements,
    completedObjectives: completed,
    missedObjectives: missed,
    dimensions: aiAssessment.dimensions,
    transcript: input.transcript,
  };
}
