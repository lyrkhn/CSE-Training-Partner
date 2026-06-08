import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Prisma } from "@prisma/client";
import { isDatabaseConfigured, prisma } from "@/src/lib/db/prisma";
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
  const session: SavedTranscriptSession = {
    id: buildTranscriptSessionId(input.scenarioId),
    scenarioId: input.scenarioId,
    scenarioTitle: input.scenarioTitle,
    status: input.status,
    createdAt: new Date().toISOString(),
    completedObjectives: input.completedObjectives,
    transcript: input.transcript,
  };

  if (isDatabaseConfigured()) {
    await prisma.transcriptSession.create({
      data: {
        id: session.id,
        scenarioId: session.scenarioId,
        scenarioTitle: session.scenarioTitle,
        status: session.status,
        completedObjectives: session.completedObjectives as unknown as Prisma.InputJsonValue,
        transcript: session.transcript as unknown as Prisma.InputJsonValue,
        createdAt: new Date(session.createdAt),
      },
    });

    return session;
  }

  await ensureTranscriptsDir();
  await writeFile(transcriptFilePath(session.id), JSON.stringify(session, null, 2), "utf8");
  return session;
}

export async function getTranscriptSessionById(
  transcriptSessionId: string,
): Promise<SavedTranscriptSession | null> {
  if (isDatabaseConfigured()) {
    const session = await prisma.transcriptSession.findUnique({
      where: { id: transcriptSessionId },
    });

    if (!session) {
      return null;
    }

    return {
      id: session.id,
      scenarioId: session.scenarioId,
      scenarioTitle: session.scenarioTitle,
      status: session.status as SavedTranscriptSession["status"],
      createdAt: session.createdAt.toISOString(),
      completedObjectives: session.completedObjectives as SavedTranscriptSession["completedObjectives"],
      transcript: session.transcript as SavedTranscriptSession["transcript"],
    };
  }

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
  if (isDatabaseConfigured()) {
    const sessions = await prisma.transcriptSession.findMany({
      where: { scenarioId },
      orderBy: { createdAt: "desc" },
    });

    return sessions.map((session) => ({
      id: session.id,
      scenarioId: session.scenarioId,
      scenarioTitle: session.scenarioTitle,
      status: session.status as SavedTranscriptSession["status"],
      createdAt: session.createdAt.toISOString(),
      completedObjectives: session.completedObjectives as SavedTranscriptSession["completedObjectives"],
      transcript: session.transcript as SavedTranscriptSession["transcript"],
    }));
  }

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
