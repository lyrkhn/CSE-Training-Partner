import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { alphaUsers, type AlphaUser } from "@/src/lib/auth/alphaUsers";
import type { MockRole } from "@/lib/types";

export type SafeAuthUser = {
  id: string;
  email: string;
  name: string;
  role: MockRole;
  createdAt?: string;
  updatedAt?: string;
  source: "seed" | "managed";
};

type ManagedUserRecord = {
  id: string;
  email: string;
  name: string;
  role: MockRole;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
};

type UserStoreFile = {
  managedUsers: ManagedUserRecord[];
  disabledSeedUserIds: string[];
  seedPasswordOverrides: Record<string, string>;
  seedRoleOverrides: Record<string, MockRole>;
  seedProfileOverrides: Record<string, { email?: string; name?: string }>;
};

type AuthUserRecord = AlphaUser | ManagedUserRecord;

const usersDir = path.join(process.cwd(), "data");
const usersFilePath = path.join(usersDir, "users.json");

const emptyStore: UserStoreFile = {
  managedUsers: [],
  disabledSeedUserIds: [],
  seedPasswordOverrides: {},
  seedRoleOverrides: {},
  seedProfileOverrides: {},
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
  return alphaUsers
    .filter((user) => !disabled.has(user.id))
    .map((user) => ({
      ...user,
      email: store.seedProfileOverrides[user.id]?.email ?? user.email,
      name: store.seedProfileOverrides[user.id]?.name ?? user.name,
      role: store.seedRoleOverrides[user.id] ?? user.role,
    }));
}

function toSafeUser(user: AuthUserRecord, source: SafeAuthUser["source"]): SafeAuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: "createdAt" in user ? user.createdAt : undefined,
    updatedAt: "updatedAt" in user ? user.updatedAt : undefined,
    source,
  };
}

function isMockRole(value: unknown): value is MockRole {
  return value === "root_admin" || value === "course_admin" || value === "trainee";
}

export function listAuthUsers() {
  const store = readStore();
  return [
    ...activeSeedUsers(store).map((user) => toSafeUser(user, "seed")),
    ...store.managedUsers.map((user) => toSafeUser(user, "managed")),
  ].sort((first, second) => first.name.localeCompare(second.name));
}

export function findAuthUserById(userId: string) {
  const store = readStore();
  const managedUser = store.managedUsers.find((user) => user.id === userId);
  if (managedUser) {
    return toSafeUser(managedUser, "managed");
  }

  const seedUser = activeSeedUsers(store).find((user) => user.id === userId);
  return seedUser ? toSafeUser(seedUser, "seed") : null;
}

export function findAuthUserByCredentials(email: string, password: string) {
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

  const managedUser = store.managedUsers.find((user) => user.email === normalizedEmail);
  if (managedUser && verifyPasswordHash(password, managedUser.passwordHash)) {
    return toSafeUser(managedUser, "managed");
  }

  return null;
}

export function createAuthUser(input: {
  email: string;
  name: string;
  role: MockRole;
  password: string;
}) {
  const email = normalizeEmail(input.email);
  const name = input.name.trim();
  const password = input.password;

  if (!email || !name || !isMockRole(input.role) || password.length < 8) {
    throw new Error("Name, valid email, role, and an 8+ character password are required.");
  }

  const store = readStore();
  const emailExists = [...activeSeedUsers(store), ...store.managedUsers].some(
    (user) => user.email === email,
  );

  if (emailExists) {
    throw new Error("A user with that email already exists.");
  }

  const now = new Date().toISOString();
  const user: ManagedUserRecord = {
    id: `user-${Date.now()}-${randomBytes(4).toString("hex")}`,
    email,
    name,
    role: input.role,
    passwordHash: createPasswordHash(password),
    createdAt: now,
    updatedAt: now,
  };

  writeStore({ ...store, managedUsers: [...store.managedUsers, user] });
  return toSafeUser(user, "managed");
}

export function changeAuthUserPassword(userId: string, password: string) {
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const store = readStore();
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

export function changeAuthUserRole(userId: string, role: MockRole) {
  if (!isMockRole(role)) {
    throw new Error("Valid role is required.");
  }

  const store = readStore();
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

export function updateAuthUserDetails(
  userId: string,
  input: {
    email: string;
    name: string;
    role: MockRole;
  },
) {
  const email = normalizeEmail(input.email);
  const name = input.name.trim();

  if (!email || !name || !isMockRole(input.role)) {
    throw new Error("Name, valid email, and role are required.");
  }

  const store = readStore();
  const allUsers = [...activeSeedUsers(store), ...store.managedUsers];
  const emailExists = allUsers.some((user) => user.id !== userId && user.email === email);
  if (emailExists) {
    throw new Error("A user with that email already exists.");
  }

  const managedUsers = store.managedUsers.map((user) =>
    user.id === userId
      ? { ...user, email, name, role: input.role, updatedAt: new Date().toISOString() }
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
    seedRoleOverrides: {
      ...store.seedRoleOverrides,
      [userId]: input.role,
    },
    seedProfileOverrides: {
      ...store.seedProfileOverrides,
      [userId]: { email, name },
    },
  });
  return findAuthUserById(userId);
}

export function deleteAuthUser(userId: string) {
  const store = readStore();
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
