import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Prisma } from "@prisma/client";
import { isDatabaseConfigured, prisma } from "@/src/lib/db/prisma";
import type { SavedFinalAssessment } from "@/src/lib/assessments/types";

const assessmentsDir = path.join(process.cwd(), "data", "assessments");

function assessmentFilePath(assessmentId: string) {
  return path.join(assessmentsDir, `${assessmentId}.json`);
}

async function ensureAssessmentsDir() {
  await mkdir(assessmentsDir, { recursive: true });
}

export async function saveFinalAssessment(assessment: SavedFinalAssessment) {
  if (isDatabaseConfigured()) {
    await prisma.finalAssessment.create({
      data: {
        id: assessment.id,
        transcriptSessionId: assessment.transcriptSessionId,
        scenarioId: assessment.scenarioId,
        scenarioTitle: assessment.scenarioTitle,
        learnerId: assessment.learnerId,
        learnerName: assessment.learnerName,
        learnerEmail: assessment.learnerEmail,
        learnerRole: assessment.learnerRole,
        overallScore: assessment.overallScore,
        outcome: assessment.outcome,
        summary: assessment.summary,
        strengths: assessment.strengths as unknown as Prisma.InputJsonValue,
        improvements: assessment.improvements as unknown as Prisma.InputJsonValue,
        completedObjectives: assessment.completedObjectives as unknown as Prisma.InputJsonValue,
        missedObjectives: assessment.missedObjectives as unknown as Prisma.InputJsonValue,
        dimensions: assessment.dimensions as unknown as Prisma.InputJsonValue,
        transcript: assessment.transcript as unknown as Prisma.InputJsonValue,
        createdAt: new Date(assessment.createdAt),
      },
    });

    return assessment;
  }

  await ensureAssessmentsDir();

  await writeFile(assessmentFilePath(assessment.id), JSON.stringify(assessment, null, 2), "utf8");
  return assessment;
}

export async function getFinalAssessmentById(assessmentId: string) {
  if (isDatabaseConfigured()) {
    const assessment = await prisma.finalAssessment.findUnique({
      where: { id: assessmentId },
    });

    if (!assessment) {
      return null;
    }

    return {
      id: assessment.id,
      transcriptSessionId: assessment.transcriptSessionId,
      scenarioId: assessment.scenarioId,
      scenarioTitle: assessment.scenarioTitle,
      learnerId: assessment.learnerId ?? undefined,
      learnerName: assessment.learnerName ?? undefined,
      learnerEmail: assessment.learnerEmail ?? undefined,
      learnerRole: assessment.learnerRole ?? undefined,
      createdAt: assessment.createdAt.toISOString(),
      overallScore: assessment.overallScore,
      outcome: assessment.outcome as SavedFinalAssessment["outcome"],
      summary: assessment.summary,
      strengths: assessment.strengths as SavedFinalAssessment["strengths"],
      improvements: assessment.improvements as SavedFinalAssessment["improvements"],
      completedObjectives:
        assessment.completedObjectives as SavedFinalAssessment["completedObjectives"],
      missedObjectives: assessment.missedObjectives as SavedFinalAssessment["missedObjectives"],
      dimensions: assessment.dimensions as SavedFinalAssessment["dimensions"],
      transcript: assessment.transcript as SavedFinalAssessment["transcript"],
    };
  }

  try {
    const payload = await readFile(assessmentFilePath(assessmentId), "utf8");
    return JSON.parse(payload) as SavedFinalAssessment;
  } catch {
    return null;
  }
}

export async function listFinalAssessments() {
  if (isDatabaseConfigured()) {
    const assessments = await prisma.finalAssessment.findMany({
      orderBy: { createdAt: "desc" },
    });

    return assessments.map((assessment) => ({
      id: assessment.id,
      transcriptSessionId: assessment.transcriptSessionId,
      scenarioId: assessment.scenarioId,
      scenarioTitle: assessment.scenarioTitle,
      learnerId: assessment.learnerId ?? undefined,
      learnerName: assessment.learnerName ?? undefined,
      learnerEmail: assessment.learnerEmail ?? undefined,
      learnerRole: assessment.learnerRole ?? undefined,
      createdAt: assessment.createdAt.toISOString(),
      overallScore: assessment.overallScore,
      outcome: assessment.outcome as SavedFinalAssessment["outcome"],
      summary: assessment.summary,
      strengths: assessment.strengths as SavedFinalAssessment["strengths"],
      improvements: assessment.improvements as SavedFinalAssessment["improvements"],
      completedObjectives:
        assessment.completedObjectives as SavedFinalAssessment["completedObjectives"],
      missedObjectives: assessment.missedObjectives as SavedFinalAssessment["missedObjectives"],
      dimensions: assessment.dimensions as SavedFinalAssessment["dimensions"],
      transcript: assessment.transcript as SavedFinalAssessment["transcript"],
    }));
  }

  await ensureAssessmentsDir();
  const files = await readdir(assessmentsDir);

  const assessments = (
    await Promise.all(
      files
        .filter((file) => file.endsWith(".json"))
        .map(async (file) => {
          try {
            const payload = await readFile(path.join(assessmentsDir, file), "utf8");
            return JSON.parse(payload) as SavedFinalAssessment;
          } catch {
            return null;
          }
        }),
    )
  ).filter((assessment): assessment is SavedFinalAssessment => Boolean(assessment));

  // TODO: Filter by the logged-in trainee once real authentication is available.
  return assessments.sort((first, second) => second.createdAt.localeCompare(first.createdAt));
}
