import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

import { findAuthUserById } from "@/src/lib/auth/userStore";
import { sessionCookieName } from "@/src/lib/auth/constants";
import type { MockRole } from "@/lib/types";

export type AuthSessionUser = {
  id: string;
  email: string;
  name: string;
  role: MockRole;
};

type SessionPayload = {
  userId: string;
  expiresAt: number;
};

const sessionMaxAgeSeconds = 60 * 60 * 8;

function sessionSecret() {
  // TODO: Require AUTH_SESSION_SECRET in production deployment configuration.
  return process.env.AUTH_SESSION_SECRET || "cse-alpha-session-dev-secret";
}

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

function safeCompare(first: string, second: string) {
  const firstBuffer = Buffer.from(first);
  const secondBuffer = Buffer.from(second);
  return firstBuffer.length === secondBuffer.length && timingSafeEqual(firstBuffer, secondBuffer);
}

export function createSessionToken(userId: string) {
  const payload: SessionPayload = {
    userId,
    expiresAt: Date.now() + sessionMaxAgeSeconds * 1000,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function readSessionToken(token: string | undefined | null): AuthSessionUser | null {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature || !safeCompare(sign(encodedPayload), signature)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<SessionPayload>;
    if (!payload.userId || typeof payload.expiresAt !== "number" || payload.expiresAt < Date.now()) {
      return null;
    }

    const user = findAuthUserById(payload.userId);
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  } catch {
    return null;
  }
}

export async function getAuthSession() {
  const cookieStore = await cookies();
  return readSessionToken(cookieStore.get(sessionCookieName)?.value);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAgeSeconds,
  };
}

export function expiredSessionCookieOptions() {
  return {
    ...sessionCookieOptions(),
    maxAge: 0,
  };
}
