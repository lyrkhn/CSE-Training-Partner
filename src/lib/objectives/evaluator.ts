import type {
  MatchedObjective,
  Objective,
  ObjectiveEvaluationRequest,
  ObjectiveEvaluationResponse,
  TranscriptEntry,
} from "@/src/lib/objectives/types";

type OpenAiChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

const DEFAULT_MIN_OBJECTIVE_CONFIDENCE = 0.4;
const stopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "between",
  "difference",
  "different",
  "explain",
  "for",
  "i",
  "in",
  "is",
  "it",
  "of",
  "or",
  "please",
  "say",
  "the",
  "to",
  "well",
  "with",
]);

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

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function significantTerms(value: string) {
  return normalizeText(value)
    .split(" ")
    .map((term) => term.trim())
    .filter((term) => term.length > 2 && !stopWords.has(term));
}

function evidenceSentence(sourceText: string, terms: string[]) {
  const sentences = sourceText
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  return (
    sentences.find((sentence) => {
      const normalizedSentence = normalizeText(sentence);
      return terms.every((term) => normalizedSentence.includes(term));
    }) ??
    sentences[0] ??
    sourceText.trim()
  ).slice(0, 220);
}

function sourceSentences(sourceText: string) {
  return sourceText
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function hasAnyTerm(source: string, terms: string[]) {
  return terms.some((term) => source.includes(term));
}

function groupedEvidence(sourceText: string, termGroups: string[][]) {
  const matchingSentences = sourceSentences(sourceText).filter((sentence) => {
    const normalizedSentence = normalizeText(sentence);
    return termGroups.some((terms) => hasAnyTerm(normalizedSentence, terms));
  });

  const evidence = matchingSentences.slice(0, 3).join(" ");
  return (evidence || sourceText.trim()).slice(0, 360);
}

function phraseEvidence(sourceText: string, phrase: string) {
  const match = sourceText.match(new RegExp(`\\b${escapeRegExp(phrase)}\\b`, "i"));
  return match?.[0] ?? null;
}

function directivePhrase(label: string) {
  const normalized = normalizeText(label);
  const match = normalized.match(/^(?:say|state|mention|confirm|ask for|request|collect|provide)\s+(.+)$/);
  return match?.[1]?.trim() ?? null;
}

function ownershipEvidence(sourceText: string) {
  const patterns = [
    /\b(?:i will|i'll|let me)\s+take ownership\b/i,
    /\b(?:i will|i'll)\s+own\b/i,
    /\bi(?:'ll| will| am going to)\s+(?:personally\s+)?(?:handle|manage|drive|follow up on)\b/i,
    /\bi(?:'ll| will| am going to)\s+be (?:your )?(?:point of contact|owner)\b/i,
    /\bi(?:'ll| will| am going to)\s+make sure\b/i,
  ];

  for (const pattern of patterns) {
    const match = sourceText.match(pattern);
    if (match?.[0]) {
      return evidenceSentence(sourceText, significantTerms(match[0]));
    }
  }

  return null;
}

function comparisonObjectiveEvidence(label: string, sourceText: string) {
  const normalizedLabel = normalizeText(label);
  const normalizedSource = normalizeText(sourceText);
  const comparisonSignals = [
    "compare",
    "comparison",
    "difference",
    "different",
    "distinguish",
    "versus",
    "vs",
  ];

  if (!hasAnyTerm(normalizedLabel, comparisonSignals)) {
    return null;
  }

  const cloudRecordingSignals = [
    "cloud recording",
    "cloud",
    "rtc",
    "channel",
    "recording task",
    "rest api",
    "individual",
    "composite",
  ];
  const webPageRecordingSignals = [
    "web page recording",
    "webpage recording",
    "web page",
    "webpage",
    "url",
    "whole web page",
    "full web page",
    "capture the web page",
  ];
  const contrastSignals = [
    "better",
    "best fit",
    "but",
    "difference",
    "different",
    "not suitable",
    "on the other hand",
    "suitable",
    "use case",
    "whereas",
    "while",
  ];

  const isCloudVsWebRecordingObjective =
    normalizedLabel.includes("cloud") &&
    normalizedLabel.includes("web") &&
    normalizedLabel.includes("recording");

  if (
    isCloudVsWebRecordingObjective &&
    hasAnyTerm(normalizedSource, cloudRecordingSignals) &&
    hasAnyTerm(normalizedSource, webPageRecordingSignals) &&
    hasAnyTerm(normalizedSource, contrastSignals)
  ) {
    return groupedEvidence(sourceText, [
      cloudRecordingSignals,
      webPageRecordingSignals,
      contrastSignals,
    ]);
  }

  const betweenMatch = normalizedLabel.match(/\bbetween\s+(.+?)\s+and\s+(.+)$/);
  const versusMatch = normalizedLabel.match(/\b(.+?)\s+(?:versus|vs)\s+(.+)$/);
  const match = betweenMatch ?? versusMatch;

  if (!match) {
    return null;
  }

  const firstConceptTerms = significantTerms(match[1] ?? "").slice(0, 4);
  const secondConceptTerms = significantTerms(match[2] ?? "").slice(0, 4);

  if (
    firstConceptTerms.length > 0 &&
    secondConceptTerms.length > 0 &&
    firstConceptTerms.some((term) => normalizedSource.includes(term)) &&
    secondConceptTerms.some((term) => normalizedSource.includes(term))
  ) {
    return groupedEvidence(sourceText, [firstConceptTerms, secondConceptTerms]);
  }

  return null;
}

function recommendationObjectiveEvidence(label: string, sourceText: string) {
  const normalizedLabel = normalizeText(label);
  const normalizedSource = normalizeText(sourceText);
  const recommendationObjectiveSignals = [
    "best",
    "better",
    "recommend",
    "recommendation",
    "should use",
    "suitable",
    "use case",
  ];

  if (!hasAnyTerm(normalizedLabel, recommendationObjectiveSignals)) {
    return null;
  }

  const recommendationSignals = [
    "best fit",
    "best for",
    "better to use",
    "better option",
    "i recommend",
    "i think it's much better",
    "it would be best",
    "should use",
    "suitable",
    "use cloud recording",
    "way to go",
  ];

  if (!hasAnyTerm(normalizedSource, recommendationSignals)) {
    return null;
  }

  return groupedEvidence(sourceText, [recommendationSignals]);
}

function localObjectiveMatches(
  objectives: Objective[],
  latestEngineerMessage: string,
  recentTranscript: TranscriptEntry[],
): MatchedObjective[] {
  const engineerTranscriptText = recentTranscript
    .filter((entry) => entry.speaker_type === "engineer")
    .map((entry) => entry.text)
    .join("\n");
  const sourceText = [latestEngineerMessage, engineerTranscriptText].filter(Boolean).join("\n");
  const normalizedSource = normalizeText(sourceText);
  const matches: MatchedObjective[] = [];

  for (const objective of objectives) {
    const label = objective.label.trim();
    const normalizedLabel = normalizeText(label);
    const phrase = directivePhrase(label);
    const labelTerms = significantTerms(label);

    const directEvidence =
      phrase && phraseEvidence(sourceText, phrase)
        ? phraseEvidence(sourceText, phrase)
        : normalizedLabel && normalizedSource.includes(normalizedLabel)
          ? evidenceSentence(sourceText, labelTerms)
          : null;

    if (directEvidence) {
      matches.push({
        id: objective.id,
        completed: true,
        confidence: 0.96,
        evidence: directEvidence,
      });
      continue;
    }

    if (/\b(?:ownership|own|owner)\b/i.test(label)) {
      const evidence = ownershipEvidence(sourceText);
      if (evidence) {
        matches.push({
          id: objective.id,
          completed: true,
          confidence: 0.9,
          evidence,
        });
        continue;
      }
    }

    const comparisonEvidence = comparisonObjectiveEvidence(label, sourceText);
    if (comparisonEvidence) {
      matches.push({
        id: objective.id,
        completed: true,
        confidence: 0.88,
        evidence: comparisonEvidence,
      });
      continue;
    }

    const recommendationEvidence = recommendationObjectiveEvidence(label, sourceText);
    if (recommendationEvidence) {
      matches.push({
        id: objective.id,
        completed: true,
        confidence: 0.88,
        evidence: recommendationEvidence,
      });
      continue;
    }

    if (
      labelTerms.length > 0 &&
      labelTerms.every((term) => normalizedSource.includes(term))
    ) {
      matches.push({
        id: objective.id,
        completed: true,
        confidence: 0.82,
        evidence: evidenceSentence(sourceText, labelTerms),
      });
    }
  }

  return matches;
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

  const localMatches = localObjectiveMatches(
    incompleteObjectives,
    latestEngineerMessage,
    input.recentTranscript,
  );
  const locallyMatchedIds = new Set(localMatches.map((match) => match.id));
  const remainingObjectives = incompleteObjectives.filter(
    (objective) => !locallyMatchedIds.has(objective.id),
  );

  if (remainingObjectives.length === 0) {
    return { matchedObjectives: localMatches };
  }

  const provider = asString(process.env.OBJECTIVE_EVALUATOR_PROVIDER).trim().toLowerCase();
  const apiKey = asString(process.env.OBJECTIVE_EVALUATOR_API_KEY).trim();
  const model = asString(process.env.OBJECTIVE_EVALUATOR_MODEL).trim();

  if (!provider || !apiKey || !model) {
    if (localMatches.length > 0) {
      return { matchedObjectives: localMatches };
    }

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

  const objectiveSet = new Set(remainingObjectives.map((objective) => objective.id));
  const evaluatorPrompt =
    input.evaluator_prompt.trim() ||
    "You are a hidden objective evaluator. Return strict JSON only.";

  const userPayload = {
    scenarioId: input.scenarioId,
    latestEngineerMessage,
    incompleteObjectives: remainingObjectives.map((objective) => ({
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
          evidence: "exact phrase from latestEngineerMessage or engineerTranscript",
        },
      ],
    },
    rules: [
      "Evaluate only the latestEngineerMessage and engineerTranscript lines.",
      "Do not evaluate any customer_ai messages.",
      "Prefer latestEngineerMessage, but allow engineerTranscript context when the objective is clearly covered across multiple trainee turns.",
      "For comparison or difference objectives, consider the combined trainee transcript and mark complete when the trainee meaningfully explains both concepts, contrasts them, or recommends the better fit for the customer's use case.",
      "Objectives may be satisfied by natural phrasing, questions, confirmations, or clear next-step statements that mean the same thing as the objective label.",
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

  const llmMatches = parseMatchedObjectives(content, objectiveSet);
  return {
    matchedObjectives: [...localMatches, ...llmMatches],
  };
}
