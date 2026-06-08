const rolePlayAttemptStoragePrefix = "cse-roleplay-attempts";

export const maxTraineeRolePlayAttempts = 2;

export type RolePlayAttemptStatus = {
  completedAttempts: number;
  remainingAttempts: number;
  maxAttempts: number;
  locked: boolean;
  lastCompletedAt?: string;
};

type StoredRolePlayAttempt = {
  completedAttempts: number;
  lastCompletedAt?: string;
};

function attemptStorageKey(userId: string, rolePlayId: string) {
  return `${rolePlayAttemptStoragePrefix}:${userId}:${rolePlayId}`;
}

function safeParseAttempt(rawValue: string | null): StoredRolePlayAttempt {
  if (!rawValue) {
    return { completedAttempts: 0 };
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<StoredRolePlayAttempt>;
    return {
      completedAttempts:
        typeof parsed.completedAttempts === "number" && parsed.completedAttempts > 0
          ? Math.floor(parsed.completedAttempts)
          : 0,
      lastCompletedAt:
        typeof parsed.lastCompletedAt === "string" ? parsed.lastCompletedAt : undefined,
    };
  } catch {
    return { completedAttempts: 0 };
  }
}

function toAttemptStatus(stored: StoredRolePlayAttempt): RolePlayAttemptStatus {
  const completedAttempts = Math.min(maxTraineeRolePlayAttempts, stored.completedAttempts);
  const remainingAttempts = Math.max(0, maxTraineeRolePlayAttempts - completedAttempts);

  return {
    completedAttempts,
    remainingAttempts,
    maxAttempts: maxTraineeRolePlayAttempts,
    locked: remainingAttempts <= 0,
    lastCompletedAt: stored.lastCompletedAt,
  };
}

function saveLocalAttemptStatus(userId: string, rolePlayId: string, status: RolePlayAttemptStatus) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    attemptStorageKey(userId, rolePlayId),
    JSON.stringify({
      completedAttempts: status.completedAttempts,
      lastCompletedAt: status.lastCompletedAt,
    }),
  );
}

export function getRolePlayAttemptStatus(userId: string, rolePlayId: string): RolePlayAttemptStatus {
  if (typeof window === "undefined") {
    return toAttemptStatus({ completedAttempts: 0 });
  }

  return toAttemptStatus(
    safeParseAttempt(window.localStorage.getItem(attemptStorageKey(userId, rolePlayId))),
  );
}

export function recordRolePlayAttemptCompletion(
  userId: string,
  rolePlayId: string,
): RolePlayAttemptStatus {
  if (typeof window === "undefined") {
    return toAttemptStatus({ completedAttempts: 1, lastCompletedAt: new Date().toISOString() });
  }

  const current = safeParseAttempt(window.localStorage.getItem(attemptStorageKey(userId, rolePlayId)));
  const next: StoredRolePlayAttempt = {
    completedAttempts: Math.min(maxTraineeRolePlayAttempts, current.completedAttempts + 1),
    lastCompletedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(attemptStorageKey(userId, rolePlayId), JSON.stringify(next));
  return toAttemptStatus(next);
}

export async function fetchRolePlayAttemptStatus(userId: string, rolePlayId: string) {
  try {
    const response = await fetch(`/api/roleplays/${rolePlayId}/attempts`, {
      cache: "no-store",
    });

    if (response.ok) {
      const payload = (await response.json()) as { attemptStatus?: RolePlayAttemptStatus | null };
      if (payload.attemptStatus) {
        saveLocalAttemptStatus(userId, rolePlayId, payload.attemptStatus);
        return payload.attemptStatus;
      }
    }
  } catch {
    // Local fallback keeps the alpha test usable before DATABASE_URL is configured.
  }

  return getRolePlayAttemptStatus(userId, rolePlayId);
}

export async function completeRolePlayAttempt(userId: string, rolePlayId: string) {
  try {
    const response = await fetch(`/api/roleplays/${rolePlayId}/attempts`, {
      method: "POST",
    });

    if (response.ok) {
      const payload = (await response.json()) as { attemptStatus?: RolePlayAttemptStatus | null };
      if (payload.attemptStatus) {
        saveLocalAttemptStatus(userId, rolePlayId, payload.attemptStatus);
        return payload.attemptStatus;
      }
    }
  } catch {
    // Local fallback keeps the alpha test usable before DATABASE_URL is configured.
  }

  return recordRolePlayAttemptCompletion(userId, rolePlayId);
}
