import type { Objective } from "@/src/lib/objectives/types";

export type TranscriptEntry = {
  id: string;
  speaker_type: "engineer" | "customer_ai";
  speaker_id: string;
  text: string;
  timestamp: string;
};

export type TranscriptSessionStatus = "completed";

export type SavedTranscriptSession = {
  id: string;
  scenarioId: string;
  scenarioTitle: string;
  status: TranscriptSessionStatus;
  createdAt: string;
  completedObjectives: Objective[];
  transcript: TranscriptEntry[];
};

export type SaveTranscriptSessionInput = {
  scenarioId: string;
  scenarioTitle: string;
  status: TranscriptSessionStatus;
  completedObjectives: Objective[];
  transcript: TranscriptEntry[];
};

