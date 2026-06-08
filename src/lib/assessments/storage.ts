import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { SavedFinalAssessment } from "@/src/lib/assessments/types";

const assessmentsDir = path.join(process.cwd(), "data", "assessments");

function assessmentFilePath(assessmentId: string) {
  return path.join(assessmentsDir, `${assessmentId}.json`);
}

async function ensureAssessmentsDir() {
  await mkdir(assessmentsDir, { recursive: true });
}

export async function saveFinalAssessment(assessment: SavedFinalAssessment) {
  await ensureAssessmentsDir();

  // TODO: Replace local JSON file persistence with database storage scoped to a trainee user.
  await writeFile(assessmentFilePath(assessment.id), JSON.stringify(assessment, null, 2), "utf8");
  return assessment;
}

export async function getFinalAssessmentById(assessmentId: string) {
  try {
    const payload = await readFile(assessmentFilePath(assessmentId), "utf8");
    return JSON.parse(payload) as SavedFinalAssessment;
  } catch {
    return null;
  }
}

export async function listFinalAssessments() {
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
