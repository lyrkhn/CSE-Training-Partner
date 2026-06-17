import { NextResponse } from "next/server";

import { getAuthSession } from "@/src/lib/auth/session";
import { createAuthUser, listAuthUsers } from "@/src/lib/auth/userStore";
import type { MockRole } from "@/lib/types";

type CreateUserBody = {
  email?: unknown;
  name?: unknown;
  role?: unknown;
  password?: unknown;
};

function isAdmin(role: string) {
  return role === "root_admin" || role === "course_admin";
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asRole(value: unknown): MockRole | null {
  return value === "root_admin" || value === "course_admin" || value === "trainee"
    ? value
    : null;
}

export async function GET() {
  const session = await getAuthSession();

  if (!session || !isAdmin(session.role)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  return NextResponse.json({ users: listAuthUsers() });
}

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session || !isAdmin(session.role)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as CreateUserBody;
  const role = asRole(body.role);

  if (!role) {
    return NextResponse.json({ error: "Valid role is required." }, { status: 400 });
  }

  if (session.role !== "root_admin" && role !== "trainee") {
    return NextResponse.json(
      { error: "Only root admins can create admin users." },
      { status: 403 },
    );
  }

  try {
    const user = createAuthUser({
      email: asString(body.email),
      name: asString(body.name),
      role,
      password: asString(body.password),
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create user." },
      { status: 400 },
    );
  }
}
