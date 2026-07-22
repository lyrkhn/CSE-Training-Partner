import { isDatabaseConfigured, prisma } from "@/src/lib/db/prisma";
import {
  maxTraineeRolePlayAttempts,
  type RolePlayAttemptStatus,
} from "@/src/lib/roleplays/attempts";
import type { RolePlayConfig } from "@/src/lib/roleplays/types";

type StoredAttempt = {
  completedAttempts: number;
  lastCompletedAt?: string;
};

function effectiveMaxAttempts(userId: string, roleplay?: RolePlayConfig) {
  const override = roleplay?.settings.attemptOverrides?.[userId]?.maxAttempts;
  return Math.max(
    maxTraineeRolePlayAttempts,
    typeof override === "number" && Number.isFinite(override) ? Math.floor(override) : 0,
  );
}

function deadlineIsPassed(roleplay?: RolePlayConfig) {
  const deadlineAt = roleplay?.settings.deadlineAt;
  if (!deadlineAt) return false;

  const timestamp = new Date(deadlineAt).getTime();
  return Number.isFinite(timestamp) && timestamp < Date.now();
}

function toAttemptStatus(
  stored: StoredAttempt,
  options: {
    maxAttempts?: number;
    roleplay?: RolePlayConfig;
  } = {},
): RolePlayAttemptStatus {
  const maxAttempts = Math.max(1, options.maxAttempts ?? maxTraineeRolePlayAttempts);
  const completedAttempts = Math.max(0, stored.completedAttempts);
  const remainingAttempts = Math.max(0, maxAttempts - completedAttempts);
  const deadlinePassed = deadlineIsPassed(options.roleplay);
  const hasAttemptOverride = maxAttempts > maxTraineeRolePlayAttempts;
  const deadlineLocked = deadlinePassed && !(hasAttemptOverride && remainingAttempts > 0);

  return {
    completedAttempts,
    remainingAttempts,
    maxAttempts,
    locked: remainingAttempts <= 0 || deadlineLocked,
    lastCompletedAt: stored.lastCompletedAt,
    deadlineAt: options.roleplay?.settings.deadlineAt,
    deadlineTimezone: options.roleplay?.settings.deadlineTimezone ?? "UTC",
    deadlinePassed,
    deadlineLocked,
  };
}

export function canPersistRolePlayAttempts() {
  return isDatabaseConfigured();
}

export async function getServerRolePlayAttemptStatus(
  userId: string,
  rolePlayId: string,
  roleplay?: RolePlayConfig,
): Promise<RolePlayAttemptStatus> {
  if (!isDatabaseConfigured()) {
    return toAttemptStatus(
      { completedAttempts: 0 },
      { maxAttempts: effectiveMaxAttempts(userId, roleplay), roleplay },
    );
  }

  const attempt = await prisma.rolePlayAttempt.findUnique({
    where: {
      userId_rolePlayId: {
        userId,
        rolePlayId,
      },
    },
  });

  return toAttemptStatus({
    completedAttempts: attempt?.completedAttempts ?? 0,
    lastCompletedAt: attempt?.lastCompletedAt?.toISOString(),
  }, { maxAttempts: effectiveMaxAttempts(userId, roleplay), roleplay });
}

export async function recordServerRolePlayAttemptCompletion(
  userId: string,
  rolePlayId: string,
  roleplay?: RolePlayConfig,
): Promise<RolePlayAttemptStatus> {
  const maxAttempts = effectiveMaxAttempts(userId, roleplay);

  if (!isDatabaseConfigured()) {
    return toAttemptStatus({
      completedAttempts: 1,
      lastCompletedAt: new Date().toISOString(),
    }, { maxAttempts, roleplay });
  }

  const now = new Date();
  const current = await prisma.rolePlayAttempt.findUnique({
    where: {
      userId_rolePlayId: {
        userId,
        rolePlayId,
      },
    },
  });
  const nextCompletedAttempts = Math.min(
    maxAttempts,
    (current?.completedAttempts ?? 0) + 1,
  );

  const attempt = await prisma.rolePlayAttempt.upsert({
    where: {
      userId_rolePlayId: {
        userId,
        rolePlayId,
      },
    },
    create: {
      userId,
      rolePlayId,
      completedAttempts: nextCompletedAttempts,
      lastCompletedAt: now,
    },
    update: {
      completedAttempts: nextCompletedAttempts,
      lastCompletedAt: now,
    },
  });

  return toAttemptStatus({
    completedAttempts: attempt.completedAttempts,
    lastCompletedAt: attempt.lastCompletedAt?.toISOString(),
  }, { maxAttempts, roleplay });
}
