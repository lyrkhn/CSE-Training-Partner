import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { alphaUsers, type AlphaUser } from "@/src/lib/auth/alphaUsers";
import { isDatabaseConfigured, prisma } from "@/src/lib/db/prisma";
import { dataPath } from "@/src/lib/storage/dataDir";
import type { MockRole } from "@/lib/types";

export type SafeAuthUser = {
  id: string;
  email: string;
  name: string;
  position?: string;
  role: MockRole;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  source: "seed" | "managed";
};

type ManagedUserRecord = {
  id: string;
  email: string;
  name: string;
  position?: string;
  role: MockRole;
  isActive?: boolean;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
};

type UserStoreFile = {
  managedUsers: ManagedUserRecord[];
  disabledSeedUserIds: string[];
  seedPasswordOverrides: Record<string, string>;
  seedRoleOverrides: Record<string, MockRole>;
  seedProfileOverrides: Record<string, { email?: string; name?: string; position?: string }>;
  inactiveUserIds: string[];
};

type AuthUserRecord = {
  id: string;
  email: string;
  name: string;
  position?: string | null;
  role: MockRole | string;
  isActive?: boolean | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

const usersDir = dataPath();
const usersFilePath = path.join(usersDir, "users.json");

const emptyStore: UserStoreFile = {
  managedUsers: [],
  disabledSeedUserIds: [],
  seedPasswordOverrides: {},
  seedRoleOverrides: {},
  seedProfileOverrides: {},
  inactiveUserIds: [],
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function readStore(): UserStoreFile {
  if (!existsSync(usersFilePath)) {
    return { ...emptyStore };
  }

  try {
    const parsed = JSON.parse(readFileSync(usersFilePath, "utf8")) as Partial<UserStoreFile>;
    return {
      managedUsers: Array.isArray(parsed.managedUsers) ? parsed.managedUsers : [],
      disabledSeedUserIds: Array.isArray(parsed.disabledSeedUserIds)
        ? parsed.disabledSeedUserIds
        : [],
      seedPasswordOverrides:
        parsed.seedPasswordOverrides && typeof parsed.seedPasswordOverrides === "object"
          ? parsed.seedPasswordOverrides
          : {},
      seedRoleOverrides:
        parsed.seedRoleOverrides && typeof parsed.seedRoleOverrides === "object"
          ? parsed.seedRoleOverrides
          : {},
      seedProfileOverrides:
        parsed.seedProfileOverrides && typeof parsed.seedProfileOverrides === "object"
          ? parsed.seedProfileOverrides
          : {},
      inactiveUserIds: Array.isArray(parsed.inactiveUserIds) ? parsed.inactiveUserIds : [],
    };
  } catch {
    return { ...emptyStore };
  }
}

function writeStore(store: UserStoreFile) {
  mkdirSync(usersDir, { recursive: true });
  writeFileSync(usersFilePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function createPasswordHash(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, 64).toString("base64url");
  return `scrypt:${salt}:${hash}`;
}

function verifyPasswordHash(password: string, storedHash: string) {
  const [algorithm, salt, hash] = storedHash.split(":");
  if (algorithm !== "scrypt" || !salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, "base64url");
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function activeSeedUsers(store = readStore()) {
  const disabled = new Set(store.disabledSeedUserIds);
  const inactive = new Set(store.inactiveUserIds);
  return alphaUsers
    .filter((user) => !disabled.has(user.id))
    .map((user) => ({
      ...user,
      email: store.seedProfileOverrides[user.id]?.email ?? user.email,
      name: store.seedProfileOverrides[user.id]?.name ?? user.name,
      position: store.seedProfileOverrides[user.id]?.position ?? user.position,
      role: store.seedRoleOverrides[user.id] ?? user.role,
      isActive: !inactive.has(user.id),
    }));
}

function toIsoString(value: string | Date | undefined) {
  if (!value) {
    return undefined;
  }

  return typeof value === "string" ? value : value.toISOString();
}

function toSafeUser(user: AuthUserRecord, source: SafeAuthUser["source"]): SafeAuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    position: user.position ?? undefined,
    role: isMockRole(user.role) ? user.role : "trainee",
    isActive: user.isActive !== false,
    createdAt: toIsoString(user.createdAt),
    updatedAt: toIsoString(user.updatedAt),
    source,
  };
}

function isMockRole(value: unknown): value is MockRole {
  return value === "root_admin" || value === "course_admin" || value === "trainee";
}

export async function listAuthUsers() {
  const store = readStore();
  const managedUsers = isDatabaseConfigured()
    ? await prisma.appUser.findMany({ orderBy: { name: "asc" } })
    : store.managedUsers;

  return [
    ...activeSeedUsers(store).map((user) => toSafeUser(user, "seed")),
    ...managedUsers.map((user) => toSafeUser(user, "managed")),
  ].sort((first, second) => first.name.localeCompare(second.name));
}

export async function findAuthUserById(userId: string) {
  const store = readStore();
  if (isDatabaseConfigured()) {
    const managedUser = await prisma.appUser.findUnique({ where: { id: userId } });
    if (managedUser) {
      return toSafeUser(managedUser, "managed");
    }
  }

  const managedUser = store.managedUsers.find((user) => user.id === userId);
  if (managedUser) {
    return toSafeUser(managedUser, "managed");
  }

  const seedUser = activeSeedUsers(store).find((user) => user.id === userId);
  return seedUser ? toSafeUser(seedUser, "seed") : null;
}

export async function findAuthUserByCredentials(email: string, password: string) {
  const normalizedEmail = normalizeEmail(email);
  const store = readStore();
  const seedUser = activeSeedUsers(store).find((user) => user.email === normalizedEmail);

  if (seedUser) {
    const overrideHash = store.seedPasswordOverrides[seedUser.id];
    const passwordMatches = overrideHash
      ? verifyPasswordHash(password, overrideHash)
      : Boolean(seedUser.password) && seedUser.password === password;

    if (passwordMatches) {
      return toSafeUser(seedUser, "seed");
    }
  }

  if (isDatabaseConfigured()) {
    const managedUser = await prisma.appUser.findUnique({ where: { email: normalizedEmail } });
    if (managedUser && verifyPasswordHash(password, managedUser.passwordHash)) {
      return toSafeUser(managedUser, "managed");
    }
  }

  const managedUser = store.managedUsers.find((user) => user.email === normalizedEmail);
  if (managedUser && verifyPasswordHash(password, managedUser.passwordHash)) {
    return toSafeUser(managedUser, "managed");
  }

  return null;
}

export async function createAuthUser(input: {
  email: string;
  name: string;
  position?: string;
  role: MockRole;
  password: string;
}) {
  const email = normalizeEmail(input.email);
  const name = input.name.trim();
  const position = input.position?.trim() || "";
  const password = input.password;

  if (!email || !name || !isMockRole(input.role) || password.length < 8) {
    throw new Error("Name, valid email, role, and an 8+ character password are required.");
  }

  const store = readStore();
  const seedOrFileEmailExists = [...activeSeedUsers(store), ...store.managedUsers].some(
    (user) => user.email === email,
  );
  const dbEmailExists = isDatabaseConfigured()
    ? Boolean(await prisma.appUser.findUnique({ where: { email } }))
    : false;

  if (seedOrFileEmailExists || dbEmailExists) {
    throw new Error("A user with that email already exists.");
  }

  const now = new Date().toISOString();
  const userId = `user-${Date.now()}-${randomBytes(4).toString("hex")}`;
  const passwordHash = createPasswordHash(password);

  if (isDatabaseConfigured()) {
    const user = await prisma.appUser.create({
      data: {
        id: userId,
        email,
        name,
        position,
        role: input.role,
        isActive: true,
        passwordHash,
      },
    });

    return toSafeUser(user, "managed");
  }

  const user: ManagedUserRecord = {
    id: userId,
    email,
    name,
    position,
    role: input.role,
    isActive: true,
    passwordHash,
    createdAt: now,
    updatedAt: now,
  };

  writeStore({ ...store, managedUsers: [...store.managedUsers, user] });
  return toSafeUser(user, "managed");
}

export async function changeAuthUserPassword(userId: string, password: string) {
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const store = readStore();
  if (isDatabaseConfigured()) {
    const managedUser = await prisma.appUser.findUnique({ where: { id: userId } });
    if (managedUser) {
      const user = await prisma.appUser.update({
        where: { id: userId },
        data: { passwordHash: createPasswordHash(password) },
      });
      return toSafeUser(user, "managed");
    }
  }

  const managedUsers = store.managedUsers.map((user) =>
    user.id === userId
      ? { ...user, passwordHash: createPasswordHash(password), updatedAt: new Date().toISOString() }
      : user,
  );

  if (managedUsers.some((user, index) => user !== store.managedUsers[index])) {
    writeStore({ ...store, managedUsers });
    return findAuthUserById(userId);
  }

  const seedUser = activeSeedUsers(store).find((user) => user.id === userId);
  if (!seedUser) {
    return null;
  }

  writeStore({
    ...store,
    seedPasswordOverrides: {
      ...store.seedPasswordOverrides,
      [userId]: createPasswordHash(password),
    },
  });
  return findAuthUserById(userId);
}

export async function changeAuthUserRole(userId: string, role: MockRole) {
  if (!isMockRole(role)) {
    throw new Error("Valid role is required.");
  }

  const store = readStore();
  if (isDatabaseConfigured()) {
    const managedUser = await prisma.appUser.findUnique({ where: { id: userId } });
    if (managedUser) {
      const user = await prisma.appUser.update({
        where: { id: userId },
        data: { role },
      });
      return toSafeUser(user, "managed");
    }
  }

  const managedUsers = store.managedUsers.map((user) =>
    user.id === userId ? { ...user, role, updatedAt: new Date().toISOString() } : user,
  );

  if (managedUsers.some((user, index) => user !== store.managedUsers[index])) {
    writeStore({ ...store, managedUsers });
    return findAuthUserById(userId);
  }

  const seedUser = activeSeedUsers(store).find((user) => user.id === userId);
  if (!seedUser) {
    return null;
  }

  writeStore({
    ...store,
    seedRoleOverrides: {
      ...store.seedRoleOverrides,
      [userId]: role,
    },
  });
  return findAuthUserById(userId);
}

export async function updateAuthUserDetails(
  userId: string,
  input: {
    email: string;
    name: string;
    position?: string;
    role: MockRole;
    isActive?: boolean;
  },
) {
  const email = normalizeEmail(input.email);
  const name = input.name.trim();
  const position = input.position?.trim() || "";
  const isActive = input.isActive !== false;

  if (!email || !name || !isMockRole(input.role)) {
    throw new Error("Name, valid email, and role are required.");
  }

  const store = readStore();
  const allFileUsers = [...activeSeedUsers(store), ...store.managedUsers];
  const fileEmailExists = allFileUsers.some((user) => user.id !== userId && user.email === email);
  const dbEmailExists = isDatabaseConfigured()
    ? Boolean(
        await prisma.appUser.findFirst({
          where: {
            email,
            NOT: { id: userId },
          },
        }),
      )
    : false;
  if (fileEmailExists || dbEmailExists) {
    throw new Error("A user with that email already exists.");
  }

  if (isDatabaseConfigured()) {
    const managedUser = await prisma.appUser.findUnique({ where: { id: userId } });
    if (managedUser) {
      const user = await prisma.appUser.update({
        where: { id: userId },
        data: {
          email,
          name,
          position,
          role: input.role,
          isActive,
        },
      });

      return toSafeUser(user, "managed");
    }
  }

  const managedUsers = store.managedUsers.map((user) =>
    user.id === userId
      ? {
          ...user,
          email,
          name,
          position,
          role: input.role,
          isActive,
          updatedAt: new Date().toISOString(),
        }
      : user,
  );

  if (managedUsers.some((user, index) => user !== store.managedUsers[index])) {
    writeStore({ ...store, managedUsers });
    return findAuthUserById(userId);
  }

  const seedUser = activeSeedUsers(store).find((user) => user.id === userId);
  if (!seedUser) {
    return null;
  }

  const inactiveUserIds = new Set(store.inactiveUserIds);
  if (isActive) {
    inactiveUserIds.delete(userId);
  } else {
    inactiveUserIds.add(userId);
  }

  writeStore({
    ...store,
    inactiveUserIds: [...inactiveUserIds],
    seedRoleOverrides: {
      ...store.seedRoleOverrides,
      [userId]: input.role,
    },
    seedProfileOverrides: {
      ...store.seedProfileOverrides,
      [userId]: { email, name, position },
    },
  });
  return findAuthUserById(userId);
}

export async function deleteAuthUser(userId: string) {
  const store = readStore();
  if (isDatabaseConfigured()) {
    try {
      await prisma.appUser.delete({ where: { id: userId } });
      return true;
    } catch {
      // Continue to seed/file fallback if this was not a managed database user.
    }
  }

  const managedUsers = store.managedUsers.filter((user) => user.id !== userId);

  if (managedUsers.length !== store.managedUsers.length) {
    writeStore({ ...store, managedUsers });
    return true;
  }

  const seedUser = activeSeedUsers(store).find((user) => user.id === userId);
  if (!seedUser || seedUser.role === "root_admin") {
    return false;
  }

  writeStore({
    ...store,
    disabledSeedUserIds: [...new Set([...store.disabledSeedUserIds, userId])],
  });
  return true;
}
