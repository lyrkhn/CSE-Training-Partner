import type { RolePlayConfig, RolePlayStatus } from "@/src/lib/roleplays/types";

export const rolePlayStoragePrefix = "cse-roleplay-config";

function isBrowser() {
  return typeof window !== "undefined";
}

function rolePlayStorageKey(rolePlayId: string) {
  return `${rolePlayStoragePrefix}:${rolePlayId}`;
}

function parseRolePlayConfig(value: string | null): RolePlayConfig | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as RolePlayConfig;
  } catch {
    return null;
  }
}

export function getStoredRolePlayConfig(rolePlayId: string) {
  if (!isBrowser()) {
    return null;
  }

  return parseRolePlayConfig(localStorage.getItem(rolePlayStorageKey(rolePlayId)));
}

export function listStoredRolePlayConfigs() {
  if (!isBrowser()) {
    return [];
  }

  const configs: RolePlayConfig[] = [];

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);

    if (!key?.startsWith(`${rolePlayStoragePrefix}:`) || key === `${rolePlayStoragePrefix}:latest`) {
      continue;
    }

    const config = parseRolePlayConfig(localStorage.getItem(key));

    if (config) {
      configs.push(config);
    }
  }

  return configs.sort((first, second) => {
    const firstDate = first.updatedAt ?? first.createdAt ?? "";
    const secondDate = second.updatedAt ?? second.createdAt ?? "";
    return secondDate.localeCompare(firstDate);
  });
}

export function saveStoredRolePlayConfig(config: RolePlayConfig) {
  if (!isBrowser()) {
    return config;
  }

  // TODO: Replace localStorage with server-side role play persistence.
  localStorage.setItem(rolePlayStorageKey(config.id), JSON.stringify(config));
  localStorage.setItem(`${rolePlayStoragePrefix}:latest`, config.id);
  return config;
}

export function updateStoredRolePlayStatus(rolePlayId: string, status: RolePlayStatus) {
  const current = getStoredRolePlayConfig(rolePlayId);

  if (!current) {
    return null;
  }

  const updated: RolePlayConfig = {
    ...current,
    status,
    updatedAt: new Date().toISOString(),
  };

  saveStoredRolePlayConfig(updated);
  return updated;
}

export function deleteStoredRolePlayConfig(rolePlayId: string) {
  if (!isBrowser()) {
    return;
  }

  localStorage.removeItem(rolePlayStorageKey(rolePlayId));
}

export async function fetchRolePlayConfig(rolePlayId: string) {
  const response = await fetch(`/api/roleplays/${rolePlayId}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    return getStoredRolePlayConfig(rolePlayId);
  }

  const payload = (await response.json()) as { roleplay?: RolePlayConfig };
  return payload.roleplay ?? getStoredRolePlayConfig(rolePlayId);
}

export async function fetchRolePlayConfigs() {
  const response = await fetch("/api/roleplays", {
    cache: "no-store",
  });

  if (!response.ok) {
    return listStoredRolePlayConfigs();
  }

  const payload = (await response.json()) as { roleplays?: RolePlayConfig[] };
  return Array.isArray(payload.roleplays) ? payload.roleplays : listStoredRolePlayConfigs();
}

export async function persistRolePlayConfig(config: RolePlayConfig) {
  saveStoredRolePlayConfig(config);

  const response = await fetch("/api/roleplays", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    throw new Error(`Unable to save roleplay to server. HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as { roleplay?: RolePlayConfig };
  return payload.roleplay ?? config;
}

export async function persistRolePlayStatus(rolePlayId: string, status: RolePlayStatus) {
  const local = updateStoredRolePlayStatus(rolePlayId, status);
  const response = await fetch(`/api/roleplays/${rolePlayId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    throw new Error(`Unable to update roleplay status. HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as { roleplay?: RolePlayConfig };
  return payload.roleplay ?? local;
}

export async function removeRolePlayConfig(rolePlayId: string) {
  deleteStoredRolePlayConfig(rolePlayId);

  const response = await fetch(`/api/roleplays/${rolePlayId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(`Unable to delete roleplay. HTTP ${response.status}.`);
  }
}
