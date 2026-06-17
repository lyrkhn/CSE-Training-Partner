import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Prisma } from "@prisma/client";
import { isDatabaseConfigured, prisma } from "@/src/lib/db/prisma";
import type { RolePlayConfig, RolePlayStatus } from "@/src/lib/roleplays/types";
import { dataPath } from "@/src/lib/storage/dataDir";

const roleplaysDir = dataPath("roleplays");

function roleplayFilePath(rolePlayId: string) {
  return path.join(roleplaysDir, `${rolePlayId}.json`);
}

async function ensureRoleplaysDir() {
  await mkdir(roleplaysDir, { recursive: true });
}

export async function saveRolePlayConfig(config: RolePlayConfig) {
  const now = new Date().toISOString();
  const nextConfig: RolePlayConfig = {
    ...config,
    createdAt: config.createdAt ?? now,
    updatedAt: now,
  };

  if (isDatabaseConfigured()) {
    const assignedTraineeIds = (nextConfig.settings.assignedTraineeIds ??
      []) as Prisma.InputJsonValue;
    const configPayload = nextConfig as unknown as Prisma.InputJsonValue;

    await prisma.rolePlay.upsert({
      where: { id: nextConfig.id },
      create: {
        id: nextConfig.id,
        status: nextConfig.status,
        meetingTitle: nextConfig.settings.meetingTitle,
        characterName: nextConfig.character.name,
        characterRole: nextConfig.character.role,
        durationMinutes: nextConfig.settings.durationMinutes,
        assignedTraineeIds,
        config: configPayload,
        createdAt: new Date(nextConfig.createdAt ?? now),
        updatedAt: new Date(nextConfig.updatedAt ?? now),
      },
      update: {
        status: nextConfig.status,
        meetingTitle: nextConfig.settings.meetingTitle,
        characterName: nextConfig.character.name,
        characterRole: nextConfig.character.role,
        durationMinutes: nextConfig.settings.durationMinutes,
        assignedTraineeIds,
        config: configPayload,
      },
    });

    return nextConfig;
  }

  await ensureRoleplaysDir();
  await writeFile(roleplayFilePath(nextConfig.id), JSON.stringify(nextConfig, null, 2), "utf8");
  return nextConfig;
}

export async function getRolePlayConfigById(rolePlayId: string) {
  if (isDatabaseConfigured()) {
    const roleplay = await prisma.rolePlay.findUnique({
      where: { id: rolePlayId },
    });

    return roleplay?.config as RolePlayConfig | null;
  }

  try {
    const payload = await readFile(roleplayFilePath(rolePlayId), "utf8");
    return JSON.parse(payload) as RolePlayConfig;
  } catch {
    return null;
  }
}

export async function listRolePlayConfigs() {
  if (isDatabaseConfigured()) {
    const roleplays = await prisma.rolePlay.findMany({
      orderBy: { updatedAt: "desc" },
    });

    return roleplays.map((roleplay) => roleplay.config as RolePlayConfig);
  }

  await ensureRoleplaysDir();
  const files = await readdir(roleplaysDir);

  const roleplays = (
    await Promise.all(
      files
        .filter((file) => file.endsWith(".json"))
        .map(async (file) => {
          try {
            const payload = await readFile(path.join(roleplaysDir, file), "utf8");
            return JSON.parse(payload) as RolePlayConfig;
          } catch {
            return null;
          }
        }),
    )
  ).filter((roleplay): roleplay is RolePlayConfig => Boolean(roleplay));

  return roleplays.sort((first, second) => {
    const firstDate = first.updatedAt ?? first.createdAt ?? "";
    const secondDate = second.updatedAt ?? second.createdAt ?? "";
    return secondDate.localeCompare(firstDate);
  });
}

export async function updateRolePlayStatus(rolePlayId: string, status: RolePlayStatus) {
  const current = await getRolePlayConfigById(rolePlayId);

  if (!current) {
    return null;
  }

  return saveRolePlayConfig({
    ...current,
    status,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteRolePlayConfig(rolePlayId: string) {
  if (isDatabaseConfigured()) {
    try {
      await prisma.rolePlay.delete({
        where: { id: rolePlayId },
      });
      return true;
    } catch {
      return false;
    }
  }

  try {
    await unlink(roleplayFilePath(rolePlayId));
    return true;
  } catch {
    return false;
  }
}
