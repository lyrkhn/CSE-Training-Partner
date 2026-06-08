ALTER TABLE "TranscriptSession"
  DROP CONSTRAINT IF EXISTS "TranscriptSession_scenarioId_fkey";

ALTER TABLE "FinalAssessment"
  DROP CONSTRAINT IF EXISTS "FinalAssessment_scenarioId_fkey";
