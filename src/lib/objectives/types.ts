export type Objective = {
  id: string;
  label: string;
  required: boolean;
  completed: boolean;
  completedAt?: string;
  evidence?: string;
  confidence?: number;
};

export type TranscriptEntry = {
  id: string;
  speaker_type: "engineer" | "customer_ai";
  speaker_id: string;
  text: string;
  timestamp: string;
};

export type ObjectiveEvaluationRequest = {
  scenarioId: string;
  evaluator_prompt: string;
  latestEngineerMessage: string;
  incompleteObjectives: Objective[];
  recentTranscript: TranscriptEntry[];
};

export type MatchedObjective = {
  id: string;
  completed: true;
  confidence: number;
  evidence: string;
};

export type ObjectiveEvaluationResponse = {
  matchedObjectives: MatchedObjective[];
};

