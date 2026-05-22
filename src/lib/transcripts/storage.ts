import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  SaveTranscriptSessionInput,
  SavedTranscriptSession,
} from "@/src/lib/transcripts/types";

const transcriptsDir = path.join(process.cwd(), "data", "transcripts");

function transcriptFilePath(transcriptId: string) {
  return path.join(transcriptsDir, `${transcriptId}.json`);
}

async function ensureTranscriptsDir() {
  await mkdir(transcriptsDir, { recursive: true });
}

function sanitizeId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, "-");
}

function buildTranscriptSessionId(scenarioId: string) {
  const safeScenarioId = sanitizeId(scenarioId);
  const random = Math.random().toString(36).slice(2, 10);
  return `${safeScenarioId}-${Date.now()}-${random}`;
}

export async function saveTranscriptSession(
  input: SaveTranscriptSessionInput,
): Promise<SavedTranscriptSession> {
  await ensureTranscriptsDir();

  const session: SavedTranscriptSession = {
    id: buildTranscriptSessionId(input.scenarioId),
    scenarioId: input.scenarioId,
    scenarioTitle: input.scenarioTitle,
    status: input.status,
    createdAt: new Date().toISOString(),
    completedObjectives: input.completedObjectives,
    transcript: input.transcript,
  };

  // TODO: Replace local JSON file persistence with database storage.
  await writeFile(transcriptFilePath(session.id), JSON.stringify(session, null, 2), "utf8");
  return session;
}

export async function getTranscriptSessionById(
  transcriptSessionId: string,
): Promise<SavedTranscriptSession | null> {
  try {
    const payload = await readFile(transcriptFilePath(transcriptSessionId), "utf8");
    return JSON.parse(payload) as SavedTranscriptSession;
  } catch {
    return null;
  }
}

export async function listTranscriptSessionsByScenario(
  scenarioId: string,
): Promise<SavedTranscriptSession[]> {
  await ensureTranscriptsDir();
  const files = await readdir(transcriptsDir);

  const sessions = (
    await Promise.all(
      files
        .filter((file) => file.endsWith(".json"))
        .map(async (file) => {
          try {
            const payload = await readFile(path.join(transcriptsDir, file), "utf8");
            return JSON.parse(payload) as SavedTranscriptSession;
          } catch {
            return null;
          }
        }),
    )
  ).filter((session): session is SavedTranscriptSession => Boolean(session));

  return sessions
    .filter((session) => session.scenarioId === scenarioId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

