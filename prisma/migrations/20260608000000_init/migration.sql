CREATE TABLE "RolePlay" (
  "id" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "meetingTitle" TEXT NOT NULL,
  "characterName" TEXT NOT NULL,
  "characterRole" TEXT NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "assignedTraineeIds" JSONB NOT NULL,
  "config" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RolePlay_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TranscriptSession" (
  "id" TEXT NOT NULL,
  "scenarioId" TEXT NOT NULL,
  "scenarioTitle" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "completedObjectives" JSONB NOT NULL,
  "transcript" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TranscriptSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinalAssessment" (
  "id" TEXT NOT NULL,
  "transcriptSessionId" TEXT NOT NULL,
  "scenarioId" TEXT NOT NULL,
  "scenarioTitle" TEXT NOT NULL,
  "learnerRole" TEXT,
  "overallScore" INTEGER NOT NULL,
  "outcome" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "strengths" JSONB NOT NULL,
  "improvements" JSONB NOT NULL,
  "completedObjectives" JSONB NOT NULL,
  "missedObjectives" JSONB NOT NULL,
  "dimensions" JSONB NOT NULL,
  "transcript" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FinalAssessment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RolePlayAttempt" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "rolePlayId" TEXT NOT NULL,
  "completedAttempts" INTEGER NOT NULL DEFAULT 0,
  "lastCompletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RolePlayAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RolePlay_status_idx" ON "RolePlay"("status");
CREATE INDEX "RolePlay_updatedAt_idx" ON "RolePlay"("updatedAt");
CREATE INDEX "TranscriptSession_scenarioId_idx" ON "TranscriptSession"("scenarioId");
CREATE INDEX "TranscriptSession_createdAt_idx" ON "TranscriptSession"("createdAt");
CREATE INDEX "FinalAssessment_transcriptSessionId_idx" ON "FinalAssessment"("transcriptSessionId");
CREATE INDEX "FinalAssessment_scenarioId_idx" ON "FinalAssessment"("scenarioId");
CREATE INDEX "FinalAssessment_createdAt_idx" ON "FinalAssessment"("createdAt");
CREATE INDEX "RolePlayAttempt_userId_idx" ON "RolePlayAttempt"("userId");
CREATE INDEX "RolePlayAttempt_rolePlayId_idx" ON "RolePlayAttempt"("rolePlayId");
CREATE UNIQUE INDEX "RolePlayAttempt_userId_rolePlayId_key" ON "RolePlayAttempt"("userId", "rolePlayId");

ALTER TABLE "TranscriptSession"
  ADD CONSTRAINT "TranscriptSession_scenarioId_fkey"
  FOREIGN KEY ("scenarioId") REFERENCES "RolePlay"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "FinalAssessment"
  ADD CONSTRAINT "FinalAssessment_transcriptSessionId_fkey"
  FOREIGN KEY ("transcriptSessionId") REFERENCES "TranscriptSession"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "FinalAssessment"
  ADD CONSTRAINT "FinalAssessment_scenarioId_fkey"
  FOREIGN KEY ("scenarioId") REFERENCES "RolePlay"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "RolePlayAttempt"
  ADD CONSTRAINT "RolePlayAttempt_rolePlayId_fkey"
  FOREIGN KEY ("rolePlayId") REFERENCES "RolePlay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
