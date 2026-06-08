import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import type { RolePlayConfig, RolePlayStatus } from "@/src/lib/roleplays/types";

const roleplaysDir = path.join(process.cwd(), "data", "roleplays");

function roleplayFilePath(rolePlayId: string) {
  return path.join(roleplaysDir, `${rolePlayId}.json`);
}

async function ensureRoleplaysDir() {
  await mkdir(roleplaysDir, { recursive: true });
}

export async function saveRolePlayConfig(config: RolePlayConfig) {
  await ensureRoleplaysDir();
  // TODO: Replace local JSON file persistence with database storage for deployed production.
  await writeFile(roleplayFilePath(config.id), JSON.stringify(config, null, 2), "utf8");
  return config;
}

export async function getRolePlayConfigById(rolePlayId: string) {
  try {
    const payload = await readFile(roleplayFilePath(rolePlayId), "utf8");
    return JSON.parse(payload) as RolePlayConfig;
  } catch {
    return null;
  }
}

export async function listRolePlayConfigs() {
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
  try {
    await unlink(roleplayFilePath(rolePlayId));
    return true;
  } catch {
    return false;
  }
}

