import { NextResponse } from "next/server";

import { getAuthSession } from "@/src/lib/auth/session";
import {
  changeAuthUserPassword,
  changeAuthUserRole,
  deleteAuthUser,
  findAuthUserById,
  updateAuthUserDetails,
} from "@/src/lib/auth/userStore";
import type { MockRole } from "@/lib/types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type UpdateUserBody = {
  email?: unknown;
  name?: unknown;
  password?: unknown;
  role?: unknown;
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

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getAuthSession();
  const { id } = await context.params;

  if (!session || !isAdmin(session.role)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const targetUser = findAuthUserById(id);
  if (!targetUser) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as UpdateUserBody;
  const nextRole = asRole(body.role);
  const nextName = asString(body.name);
  const nextEmail = asString(body.email);

  if (nextName || nextEmail) {
    const role = nextRole ?? targetUser.role;
    const roleChanged = role !== targetUser.role;

    if (roleChanged && session.role !== "root_admin") {
      return NextResponse.json(
        { error: "Only root admins can change user roles." },
        { status: 403 },
      );
    }

    if (roleChanged && session.id === id) {
      return NextResponse.json({ error: "You cannot change your own role." }, { status: 400 });
    }

    if (session.role !== "root_admin" && targetUser.role !== "trainee") {
      return NextResponse.json(
        { error: "Only root admins can edit admin users." },
        { status: 403 },
      );
    }

    try {
      const user = updateAuthUserDetails(id, {
        email: nextEmail,
        name: nextName,
        role,
      });
      if (!user) {
        return NextResponse.json({ error: "User not found." }, { status: 404 });
      }

      return NextResponse.json({ user });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unable to update user." },
        { status: 400 },
      );
    }
  }

  if (nextRole) {
    if (session.role !== "root_admin") {
      return NextResponse.json(
        { error: "Only root admins can change user roles." },
        { status: 403 },
      );
    }

    if (session.id === id) {
      return NextResponse.json({ error: "You cannot change your own role." }, { status: 400 });
    }

    const user = changeAuthUserRole(id, nextRole);
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json({ user });
  }

  if (session.role !== "root_admin" && targetUser.role !== "trainee") {
    return NextResponse.json(
      { error: "Only root admins can change admin passwords." },
      { status: 403 },
    );
  }

  try {
    const user = changeAuthUserPassword(id, asString(body.password));
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update user." },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getAuthSession();
  const { id } = await context.params;

  if (!session || !isAdmin(session.role)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  if (session.id === id) {
    return NextResponse.json({ error: "You cannot delete your own signed-in user." }, { status: 400 });
  }

  const targetUser = findAuthUserById(id);
  if (!targetUser) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  if (session.role !== "root_admin" && targetUser.role !== "trainee") {
    return NextResponse.json(
      { error: "Only root admins can delete admin users." },
      { status: 403 },
    );
  }

  const deleted = deleteAuthUser(id);
  if (!deleted) {
    return NextResponse.json(
      { error: "User could not be deleted. The root admin seed user is protected." },
      { status: 400 },
    );
  }

  return NextResponse.json({ deleted: true });
}
