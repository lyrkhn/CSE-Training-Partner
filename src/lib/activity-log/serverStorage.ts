import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ActivityLogEntry } from "@/src/lib/activity-log/types";
import { dataPath } from "@/src/lib/storage/dataDir";

const activityLogDir = dataPath("activity-log");
const activityLogPath = path.join(activityLogDir, "events.json");
const maxStoredEntries = 500;

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `activity-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function ensureActivityLogDir() {
  await mkdir(activityLogDir, { recursive: true });
}

async function readEntries() {
  try {
    const payload = await readFile(activityLogPath, "utf8");
    const entries = JSON.parse(payload) as ActivityLogEntry[];
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

async function writeEntries(entries: ActivityLogEntry[]) {
  await ensureActivityLogDir();
  await writeFile(activityLogPath, JSON.stringify(entries.slice(0, maxStoredEntries), null, 2), "utf8");
}

export async function appendActivityLogEntry(
  entry: Omit<ActivityLogEntry, "id" | "createdAt"> & { id?: string; createdAt?: string },
) {
  const nextEntry: ActivityLogEntry = {
    ...entry,
    id: entry.id ?? createId(),
    createdAt: entry.createdAt ?? new Date().toISOString(),
  };

  const entries = await readEntries();
  await writeEntries([nextEntry, ...entries]);
  return nextEntry;
}

export async function listActivityLogEntries(limit = 100) {
  const entries = await readEntries();
  return entries
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
    .slice(0, Math.max(1, Math.min(250, limit)));
}
