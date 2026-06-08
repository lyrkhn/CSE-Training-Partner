import { NextResponse } from "next/server";

import { sessionCookieName } from "@/src/lib/auth/constants";
import { expiredSessionCookieOptions } from "@/src/lib/auth/session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName, "", expiredSessionCookieOptions());
  return response;
}
