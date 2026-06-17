import type { Objective } from "@/src/lib/objectives/types";
import type { TranscriptEntry } from "@/src/lib/transcripts/types";

export type AssessmentDimension = {
  label: string;
  score: number;
  summary: string;
};

export type TranscriptTurn = {
  id: string;
  speaker_type: "engineer" | "customer_ai";
  speaker_id: string;
  text: string;
  startedAt: string;
  endedAt: string;
  entryIds: string[];
};

export type CoachTurnFeedback = {
  turnId: string;
  whatWorked: string;
  whatToImprove: string;
  suggestedBetterResponse: string;
};

export type SavedFinalAssessment = {
  id: string;
  transcriptSessionId: string;
  scenarioId: string;
  scenarioTitle: string;
  learnerId?: string;
  learnerName?: string;
  learnerEmail?: string;
  learnerRole?: string;
  createdAt: string;
  overallScore: number;
  outcome: "passed" | "needs_review";
  summary: string;
  strengths: string[];
  improvements: string[];
  completedObjectives: Objective[];
  missedObjectives: Objective[];
  dimensions: AssessmentDimension[];
  transcript: TranscriptEntry[];
};

export type GenerateAssessmentInput = {
  transcriptSessionId: string;
  scenarioId: string;
  scenarioTitle: string;
  learnerId?: string;
  learnerName?: string;
  learnerEmail?: string;
  learnerRole?: string;
  objectives: Objective[];
  transcript: TranscriptEntry[];
};
