import { isDatabaseConfigured, prisma } from "@/src/lib/db/prisma";
import {
  maxTraineeRolePlayAttempts,
  type RolePlayAttemptStatus,
} from "@/src/lib/roleplays/attempts";

type StoredAttempt = {
  completedAttempts: number;
  lastCompletedAt?: string;
};

function toAttemptStatus(stored: StoredAttempt): RolePlayAttemptStatus {
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

export function canPersistRolePlayAttempts() {
  return isDatabaseConfigured();
}

export async function getServerRolePlayAttemptStatus(
  userId: string,
  rolePlayId: string,
): Promise<RolePlayAttemptStatus> {
  if (!isDatabaseConfigured()) {
    return toAttemptStatus({ completedAttempts: 0 });
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
  });
}

export async function recordServerRolePlayAttemptCompletion(
  userId: string,
  rolePlayId: string,
): Promise<RolePlayAttemptStatus> {
  if (!isDatabaseConfigured()) {
    return toAttemptStatus({
      completedAttempts: 1,
      lastCompletedAt: new Date().toISOString(),
    });
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
    maxTraineeRolePlayAttempts,
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
  });
}
