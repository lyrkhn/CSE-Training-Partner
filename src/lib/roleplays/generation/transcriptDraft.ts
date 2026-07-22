import { createHash } from "node:crypto";

import type { Objective } from "@/src/lib/objectives/types";
import {
  generateJsonCompletion,
  getCoachFeedbackLlmConfig,
} from "@/src/lib/llm/jsonCompletion";

export type TranscriptRolePlayDraft = {
  meetingTitle: string;
  scenario: string;
  aiCustomerKeyPoints: string[];
  originalCallSummary: string;
  aiCustomerBehavior: string;
  learnerRole: string;
  characterName: string;
  characterRole: string;
  personalityBackground: string;
  greetingMessage: string;
  durationMinutes: number;
  learnerGoals: Objective[];
  evaluatorPrompt: string;
  privacyNotes: string[];
};

type TranscriptRolePlayFacts = {
  scenarioType?: unknown;
  customerContext?: unknown;
  originalCallSummary?: unknown;
  learnerMustDo?: unknown;
  aiCustomerMustMention?: unknown;
  aiCustomerBehavior?: unknown;
  customerTone?: unknown;
  unresolvedNeed?: unknown;
  meetingTitle?: unknown;
  learnerRole?: unknown;
  characterName?: unknown;
  characterRole?: unknown;
  personalityBackground?: unknown;
  greetingMessage?: unknown;
  durationMinutes?: unknown;
  learnerGoals?: unknown;
  evaluatorPrompt?: unknown;
  privacyNotes?: unknown;
};

type AiTranscriptDraftPayload = TranscriptRolePlayFacts & {
  scenario?: unknown;
};

type NormalizedTranscriptRolePlayFacts = {
  scenarioType: string;
  customerContext: string[];
  originalCallSummary: string;
  learnerMustDo: string[];
  aiCustomerMustMention: string[];
  aiCustomerBehavior: string;
  customerTone: string;
  unresolvedNeed: string;
};

const fallbackEvaluatorPrompt =
  "You are a hidden objective evaluator for a transcript-derived role play. Evaluate only the learner's responses. Mark goals complete only when the learner clearly demonstrates the behavior with evidence from their response. Return strict JSON only.";

const transcriptDraftSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "scenarioType",
    "customerContext",
    "originalCallSummary",
    "learnerMustDo",
    "aiCustomerMustMention",
    "aiCustomerBehavior",
    "customerTone",
    "unresolvedNeed",
    "meetingTitle",
    "learnerRole",
    "characterName",
    "characterRole",
    "personalityBackground",
    "greetingMessage",
    "durationMinutes",
    "learnerGoals",
    "evaluatorPrompt",
    "privacyNotes",
  ],
  properties: {
    scenarioType: { type: "string" },
    customerContext: { type: "array", minItems: 2, maxItems: 6, items: { type: "string" } },
    originalCallSummary: { type: "string" },
    learnerMustDo: { type: "array", minItems: 3, maxItems: 6, items: { type: "string" } },
    aiCustomerMustMention: { type: "array", minItems: 3, maxItems: 8, items: { type: "string" } },
    aiCustomerBehavior: { type: "string" },
    customerTone: { type: "string" },
    unresolvedNeed: { type: "string" },
    meetingTitle: { type: "string" },
    learnerRole: { type: "string" },
    characterName: { type: "string" },
    characterRole: { type: "string" },
    personalityBackground: { type: "string" },
    greetingMessage: { type: "string" },
    durationMinutes: { type: "number" },
    learnerGoals: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "required"],
        properties: {
          label: { type: "string" },
          required: { type: "boolean" },
        },
      },
    },
    evaluatorPrompt: { type: "string" },
    privacyNotes: { type: "array", items: { type: "string" } },
  },
} satisfies Record<string, unknown>;

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function uniqueItems(items: string[]) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function normalizeStringArray(value: unknown, fallback: string[], limit = 8) {
  if (typeof value === "string") {
    const items = value
      .split(/\r?\n|;/)
      .map((item) => item.replace(/^[-*]\s*/, "").trim())
      .filter(Boolean)
      .slice(0, limit);
    return items.length > 0 ? items : fallback;
  }

  if (!Array.isArray(value)) {
    return fallback;
  }

  const items = uniqueItems(value.map((item) => asString(item))).slice(0, limit);
  return items.length > 0 ? items : fallback;
}

function clampDuration(value: unknown) {
  const duration = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(duration)) {
    return 8;
  }

  const allowed = [5, 8, 10, 15, 20];
  return allowed.reduce((closest, option) =>
    Math.abs(option - duration) < Math.abs(closest - duration) ? option : closest,
  );
}

function createGoalId(index: number) {
  return `transcript-goal-${index + 1}`;
}

function normalizeGoals(value: unknown, fallbackLabels: string[]): Objective[] {
  const items = Array.isArray(value)
    ? value
    : fallbackLabels.map((label) => ({ label, required: true }));
  const goals = items
    .map((item, index): Objective | null => {
      const record = item && typeof item === "object" ? (item as Record<string, unknown>) : null;
      const label = record ? asString(record.label) : asString(item);

      if (!label) {
        return null;
      }

      return {
        id: createGoalId(index),
        label,
        required: record?.required === false ? false : true,
        completed: false,
      };
    })
    .filter((goal): goal is Objective => Boolean(goal))
    .slice(0, 6);

  return goals.length > 0
    ? goals
    : fallbackLabels.slice(0, 3).map((label, index) => ({
        id: createGoalId(index),
        label,
        required: true,
        completed: false,
      }));
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

function extractFirstJsonObject(value: string) {
  let depth = 0;
  let startIndex = -1;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === "\\") {
        escaped = true;
        continue;
      }
      if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character === "{") {
      if (depth === 0) startIndex = index;
      depth += 1;
      continue;
    }

    if (character === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && startIndex >= 0) {
        return value.slice(startIndex, index + 1);
      }
    }
  }

  return "";
}

const markdownDraftHeadings = [
  "title",
  "meeting title",
  "scenario",
  "anonymized scenario",
  "role play scenario",
  "customer context",
  "what happened in the original call",
  "original call summary",
  "what the learner must accomplish",
  "learner must do",
  "key points the ai customer should bring up",
  "ai customer must mention",
  "ai customer behavior",
  "learner role",
  "ai character name",
  "character name",
  "character role",
  "personality and background",
  "personality/background",
  "customer persona",
  "greeting message",
  "duration",
  "duration minutes",
  "learner goals",
  "objectives",
  "evaluator prompt",
  "privacy notes",
];

function normalizeMarkdownLine(line: string) {
  return line.replace(/^[-*#>\s]+/, "").replace(/\*\*/g, "").replace(/_/g, "").trim();
}

function isMarkdownHeading(line: string) {
  const normalized = normalizeMarkdownLine(line).toLowerCase();
  return markdownDraftHeadings.some(
    (heading) => normalized === heading || normalized.startsWith(`${heading}:`),
  );
}

function extractMarkdownField(content: string, labels: string[]) {
  const lines = content.split(/\r?\n/);
  const labelSet = new Set(labels.map((label) => label.toLowerCase()));

  for (let index = 0; index < lines.length; index += 1) {
    const normalized = normalizeMarkdownLine(lines[index]);
    const lower = normalized.toLowerCase();
    const matchedLabel = [...labelSet].find(
      (label) => lower === label || lower.startsWith(`${label}:`),
    );

    if (!matchedLabel) continue;

    const sameLineValue = normalized.slice(matchedLabel.length).replace(/^\s*:\s*/, "").trim();
    const values = sameLineValue ? [sameLineValue] : [];

    for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex += 1) {
      const nextLine = lines[nextIndex];
      if (isMarkdownHeading(nextLine)) break;
      const cleaned = normalizeMarkdownLine(nextLine);
      if (cleaned) values.push(cleaned);
    }

    return values.join("\n").trim();
  }

  return "";
}

function parseMarkdownList(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => normalizeMarkdownLine(line).replace(/^\d+[.)]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 8);
}

function parseTranscriptDraftPayload(content: string) {
  const stripped = stripCodeFence(content);

  try {
    return JSON.parse(stripped) as AiTranscriptDraftPayload;
  } catch {
    const jsonObject = extractFirstJsonObject(stripped);
    if (jsonObject) {
      return JSON.parse(jsonObject) as AiTranscriptDraftPayload;
    }
  }

  const scenario = extractMarkdownField(stripped, [
    "scenario",
    "anonymized scenario",
    "role play scenario",
  ]);
  const customerContext = parseMarkdownList(extractMarkdownField(stripped, ["customer context"]));
  const learnerMustDo = parseMarkdownList(
    extractMarkdownField(stripped, ["what the learner must accomplish", "learner must do"]),
  );
  const aiCustomerMustMention = parseMarkdownList(
    extractMarkdownField(stripped, [
      "key points the ai customer should bring up",
      "ai customer must mention",
    ]),
  );

  if (!scenario && customerContext.length === 0) {
    throw new Error("Transcript roleplay draft response was not valid JSON.");
  }

  return {
    scenario,
    customerContext,
    originalCallSummary: extractMarkdownField(stripped, [
      "what happened in the original call",
      "original call summary",
    ]),
    learnerMustDo,
    aiCustomerMustMention,
    aiCustomerBehavior: extractMarkdownField(stripped, ["ai customer behavior"]),
    meetingTitle: extractMarkdownField(stripped, ["meeting title", "title"]),
    learnerRole: extractMarkdownField(stripped, ["learner role"]),
    characterName: extractMarkdownField(stripped, ["ai character name", "character name"]),
    characterRole: extractMarkdownField(stripped, ["character role"]),
    personalityBackground: extractMarkdownField(stripped, [
      "personality and background",
      "personality/background",
      "customer persona",
    ]),
    greetingMessage: extractMarkdownField(stripped, ["greeting message"]),
    durationMinutes: extractMarkdownField(stripped, ["duration minutes", "duration"]),
    learnerGoals: parseMarkdownList(extractMarkdownField(stripped, ["learner goals", "objectives"])).map(
      (label) => ({ label, required: true }),
    ),
    evaluatorPrompt: extractMarkdownField(stripped, ["evaluator prompt"]),
    privacyNotes: parseMarkdownList(extractMarkdownField(stripped, ["privacy notes"])),
  } satisfies AiTranscriptDraftPayload;
}

export function redactTranscript(input: string) {
  return input
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email redacted]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[phone redacted]")
    .replace(/\b(?:account|acct|ticket|case|org|customer|app)\s*(?:id|number|#)?\s*[:#-]?\s*[A-Z0-9][A-Z0-9_-]{5,}\b/gi, "[id redacted]")
    .slice(0, 30000);
}

function normalizeTranscriptInput(input: string) {
  const lines = input.replace(/\r/g, "").split("\n");
  const output: string[] = [];
  let currentSpeaker = "";

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line === "WEBVTT" || line.startsWith("NOTE")) continue;
    if (/^\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}/.test(line)) continue;
    if (/editable transcript|computer generated|spoken language/i.test(line)) continue;
    if (/^catch-up with/i.test(line)) continue;

    const speakerMatch = line.match(/^(.{1,60}):\s*$/);
    if (speakerMatch) {
      currentSpeaker = speakerMatch[1].replace(/\s*\|\s*Agora/i, "").trim();
      continue;
    }

    const inlineSpeakerMatch = line.match(/^(.{1,60}?):\s+(.+)$/);
    if (inlineSpeakerMatch) {
      currentSpeaker = inlineSpeakerMatch[1].replace(/\s*\|\s*Agora/i, "").trim();
      const text = inlineSpeakerMatch[2].trim();
      if (text) output.push(`${currentSpeaker}: ${text}`);
      continue;
    }

    if (/^(hm+|hmm|okay|ok|right|yeah|yes|hey|uh|um)[.!?]*$/i.test(line)) continue;
    output.push(currentSpeaker ? `${currentSpeaker}: ${line}` : line);
  }

  return output.join("\n");
}

function inferScenarioType(transcript: string) {
  const lower = transcript.toLowerCase();
  if (/\b(invoice|billing|charged|payment|contract|pricing|cost)\b/.test(lower)) return "commercial_billing";
  if (/\b(audio|video|quality|latency|packet|rtc|stream|call drop|dropped call)\b/.test(lower)) return "technical_troubleshooting";
  if (/\b(vr|virtual reality|spatial|automotive|simulation|virtual cockpit)\b/.test(lower)) return "solution_discovery";
  if (/\b(token|authentication|certificate|expire|expiry)\b/.test(lower)) return "product_guidance";
  if (/\b(frustrat|upset|angry|escalat|urgent|production|outage)\b/.test(lower)) return "customer_escalation";
  return "customer_discovery";
}

function extractFallbackFacts(transcript: string): TranscriptRolePlayFacts {
  const lower = transcript.toLowerCase();
  const scenarioType = inferScenarioType(transcript);
  const customerContext: string[] = [];
  const aiCustomerMustMention: string[] = [];

  if (/\b(vr|virtual reality)\b/.test(lower)) customerContext.push("The customer works in VR / virtual reality.");
  if (/\bspatial\b/.test(lower)) customerContext.push("Spatial-computing work is part of the customer context.");
  if (/\bhr\b/.test(lower)) customerContext.push("The customer mentioned HR-related use cases or business context.");
  if (/\bjapan|japanese\b/.test(lower)) customerContext.push("They are working with a Japanese team or customer stakeholder.");
  if (/\bautomotive|car\b/.test(lower)) customerContext.push("The end customer is in the automotive industry.");
  if (/virtual cockpit/.test(lower)) aiCustomerMustMention.push("Existing work includes a virtual cockpit product.");
  if (/car accident|accident simulation/.test(lower)) aiCustomerMustMention.push("Existing work includes car-accident or safety simulation experiences.");
  if (/\bdesign|demo|prototype|poc|proof of concept\b/.test(lower)) aiCustomerMustMention.push("The conversation involves early design, demo, prototype, or proof-of-concept planning.");
  if (/\bintegrat|sdk|api|platform|feature\b/.test(lower)) aiCustomerMustMention.push("The customer needs clarity on integration needs, platform constraints, and relevant SDK/API expectations.");

  const fragments = transcript
    .replace(/\n/g, " ")
    .split(/(?<=[.!?])\s+|\s{2,}/)
    .map((fragment) => fragment.trim())
    .filter((fragment) => fragment.length >= 35)
    .slice(0, 5);

  for (const fragment of fragments) {
    if (customerContext.length < 5) customerContext.push(fragment);
    else aiCustomerMustMention.push(fragment);
  }

  const safeContext = uniqueItems(customerContext).slice(0, 6);
  const safeMention = uniqueItems(aiCustomerMustMention).slice(0, 8);
  const readableType = scenarioType.replace(/_/g, " ");

  return {
    scenarioType,
    customerContext: safeContext.length > 0 ? safeContext : [`The customer is in a ${readableType} conversation.`],
    originalCallSummary: `The transcript describes a ${readableType} conversation. The roleplay should recreate the customer context, current project, constraints, and what they need to clarify with Agora.`,
    learnerMustDo: [
      "Summarize the customer's context before recommending anything",
      "Ask targeted discovery questions about use case, users, platform, constraints, and success criteria",
      "Clarify what outcome the customer needs from the call",
      "Explain practical next steps without inventing product claims",
    ],
    aiCustomerMustMention: safeMention.length > 0
      ? safeMention
      : [
          "The customer has a specific business context from the transcript",
          "The customer expects focused discovery questions",
          "The customer wants a practical path forward after the call",
        ],
    aiCustomerBehavior:
      "Stay in character as the customer from the transcript. Provide details naturally when the learner asks focused questions. If the learner is too generic, ask how their answer applies to this specific situation.",
    customerTone: /\b(frustrat|upset|angry|escalat|urgent)\b/.test(lower)
      ? "direct, urgent, and skeptical"
      : "collaborative, exploratory, and practical",
    unresolvedNeed: "The customer needs the learner to clarify fit, constraints, and next steps.",
  };
}

function factsFromPayload(
  payload: AiTranscriptDraftPayload,
  transcript: string,
): NormalizedTranscriptRolePlayFacts {
  const fallback = extractFallbackFacts(transcript);
  return {
    scenarioType: asString(payload.scenarioType) || asString(fallback.scenarioType),
    customerContext: normalizeStringArray(payload.customerContext, normalizeStringArray(fallback.customerContext, []), 6),
    originalCallSummary: asString(payload.originalCallSummary) || asString(fallback.originalCallSummary),
    learnerMustDo: normalizeStringArray(payload.learnerMustDo, normalizeStringArray(fallback.learnerMustDo, []), 6),
    aiCustomerMustMention: normalizeStringArray(payload.aiCustomerMustMention, normalizeStringArray(fallback.aiCustomerMustMention, []), 8),
    aiCustomerBehavior: asString(payload.aiCustomerBehavior) || asString(fallback.aiCustomerBehavior),
    customerTone: asString(payload.customerTone) || asString(fallback.customerTone),
    unresolvedNeed: asString(payload.unresolvedNeed) || asString(fallback.unresolvedNeed),
  };
}

function buildScenarioFromFacts(facts: ReturnType<typeof factsFromPayload>) {
  return [
    "Customer context:",
    facts.customerContext.join(" "),
  ].join("\n");
}

function normalizeDraft(payload: AiTranscriptDraftPayload, transcript: string): TranscriptRolePlayDraft {
  const facts = factsFromPayload(payload, transcript);
  const scenario = buildScenarioFromFacts(facts);
  const meetingTitle = asString(payload.meetingTitle) || `${titleCase(facts.scenarioType.replace(/_/g, " "))} Roleplay`;
  const characterName = asString(payload.characterName) || "Jordan Reyes";
  const learnerTasks = facts.learnerMustDo.length > 0
    ? facts.learnerMustDo
    : [
        "Acknowledge the customer's situation",
        "Ask focused discovery questions",
        "Explain clear next steps",
      ];

  return {
    meetingTitle: meetingTitle.slice(0, 120),
    scenario,
    aiCustomerKeyPoints: facts.aiCustomerMustMention,
    originalCallSummary: facts.originalCallSummary,
    aiCustomerBehavior: facts.aiCustomerBehavior,
    learnerRole: asString(payload.learnerRole) || "Customer Support Engineer",
    characterName,
    characterRole: asString(payload.characterRole) || "Customer stakeholder from the original call",
    personalityBackground:
      asString(payload.personalityBackground) ||
      `The customer is ${facts.customerTone}. They expect the learner to understand their specific context before giving advice. They become more cooperative when the learner asks targeted questions and explains a practical path forward.`,
    greetingMessage:
      asString(payload.greetingMessage) ||
      `Thanks for meeting with me. I want to walk through our situation and understand what the right next step should be.`,
    durationMinutes: clampDuration(payload.durationMinutes),
    learnerGoals: normalizeGoals(payload.learnerGoals, learnerTasks),
    evaluatorPrompt: asString(payload.evaluatorPrompt) || fallbackEvaluatorPrompt,
    privacyNotes: normalizeStringArray(payload.privacyNotes, [
      "Review the generated scenario for remaining customer-identifying details before publishing.",
      "The original transcript is not stored by this draft generator.",
    ], 6),
  };
}

function generateHeuristicDraft(transcript: string) {
  return normalizeDraft(
    {
      ...extractFallbackFacts(transcript),
      privacyNotes: [
        "Generated with local heuristics because no transcript-generation LLM key is configured.",
        "Review and remove any remaining identifying details before publishing.",
      ],
    },
    transcript,
  );
}

function buildTranscriptSourceContext(transcript: string) {
  const maxChars = 24000;
  const truncated = transcript.length > maxChars ? transcript.slice(0, maxChars) : transcript;
  const sourceHash = createHash("sha256").update(transcript).digest("hex");

  return [
    `TRANSCRIPT_SOURCE_CONTEXT_SHA: ${sourceHash}`,
    "<transcript>",
    truncated,
    "</transcript>",
    transcript.length > maxChars
      ? `NOTE: Transcript was truncated to ${maxChars} cleaned characters for generation.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildTranscriptDraftTaskPrompt() {
  return [
    "TASK: Extract a complete roleplay draft from the transcript source context.",
    "Ground every field strictly in the transcript. Do not invent customer industries, pain points, or products.",
    "If the transcript is a discovery or catch-up call, make the scenario about discovery/solution fit, not billing or troubleshooting.",
    "Return JSON only. Do not include markdown.",
    "The JSON must include:",
    "- scenarioType: one of discovery_call, technical_troubleshooting, customer_escalation, product_guidance, commercial_billing, implementation_planning, renewal_or_expansion, bug_report, customer_discovery, solution_discovery",
    "- customerContext: 2-6 concrete facts from the transcript",
    "- originalCallSummary: concise summary of what happened in the call",
    "- learnerMustDo: 3-6 observable tasks for the learner",
    "- aiCustomerMustMention: 3-8 concrete points the AI customer should bring up",
    "- aiCustomerBehavior: how the AI customer should behave during the roleplay",
    "- customerTone, unresolvedNeed",
    "- meetingTitle, learnerRole, characterName, characterRole, personalityBackground, greetingMessage, durationMinutes, learnerGoals, evaluatorPrompt, privacyNotes",
    "Put learnerMustDo into learnerGoals as observable objectives.",
    "The scenario field is learner-facing. Include only safe customer context and setup.",
    "The scenario field must not include originalCallSummary, learnerMustDo, aiCustomerMustMention, or aiCustomerBehavior. The app stores those as hidden prompt guidance or objectives.",
    "Keep all fields anonymized. Preserve useful context, not raw transcript wording.",
  ].join("\n");
}

export async function generateRolePlayDraftFromTranscript(transcript: string) {
  const cleanedTranscript = normalizeTranscriptInput(transcript).trim();
  const redactedTranscript = redactTranscript(cleanedTranscript);

  if (redactedTranscript.length < 80) {
    throw new Error("Transcript must contain at least 80 characters of call context.");
  }

  const config = getCoachFeedbackLlmConfig();
  if (!config.apiKey) {
    return generateHeuristicDraft(redactedTranscript);
  }

  const sourceContext = buildTranscriptSourceContext(redactedTranscript);
  const taskPrompt = buildTranscriptDraftTaskPrompt();
  const content = await generateJsonCompletion({
    config,
    systemPrompt: [
      "You are an expert roleplay scenario designer for customer-facing training simulations.",
      "You work like an exam generator: first extract grounded facts from the source context, then return normalized JSON for the app to format.",
      "Use only the transcript source context. Never use outside knowledge or generic templates when transcript details are available.",
      "Return valid JSON only.",
    ].join("\n"),
    userPayload: {
      sourceContext,
      taskPrompt,
    },
    temperature: 0.2,
    responseFormat: {
      type: "json_schema",
      name: "transcript_roleplay_draft",
      strict: true,
      schema: transcriptDraftSchema,
    },
    errorLabel: "Transcript roleplay draft",
  });

  let payload: AiTranscriptDraftPayload;
  try {
    payload = parseTranscriptDraftPayload(content);
  } catch {
    return {
      ...generateHeuristicDraft(redactedTranscript),
      privacyNotes: [
        "The AI returned text that was not valid JSON, so the app generated a safe local draft instead.",
        "Review and remove any remaining identifying details before publishing.",
      ],
    };
  }

  return normalizeDraft(payload, redactedTranscript);
}
