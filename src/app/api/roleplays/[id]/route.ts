import { NextResponse } from "next/server";

import { getAuthSession } from "@/src/lib/auth/session";
import { canUserAccessRolePlay, canUserManageRolePlay } from "@/src/lib/roleplays/access";
import {
  deleteRolePlayConfig,
  getRolePlayConfigById,
  updateRolePlayStatus,
} from "@/src/lib/roleplays/serverStorage";
import type { RolePlayStatus } from "@/src/lib/roleplays/types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function isAdmin(role: string) {
  return role === "root_admin" || role === "course_admin";
}

function isRolePlayStatus(value: unknown): value is RolePlayStatus {
  return value === "draft" || value === "published";
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getAuthSession();
  const { id } = await context.params;

  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const roleplay = await getRolePlayConfigById(id);
  if (!roleplay) {
    return NextResponse.json({ error: "Roleplay not found." }, { status: 404 });
  }

  if (!canUserAccessRolePlay(session, roleplay)) {
    return NextResponse.json({ error: "Roleplay access denied." }, { status: 403 });
  }

  return NextResponse.json({ roleplay });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getAuthSession();
  const { id } = await context.params;

  if (!session || !isAdmin(session.role)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { status?: unknown };
  if (!isRolePlayStatus(body.status)) {
    return NextResponse.json({ error: "Valid status is required." }, { status: 400 });
  }

  const existing = await getRolePlayConfigById(id);
  if (!existing) {
    return NextResponse.json({ error: "Roleplay not found." }, { status: 404 });
  }

  if (!canUserManageRolePlay(session, existing)) {
    return NextResponse.json(
      { error: "Only the course owner or root admin can update this roleplay." },
      { status: 403 },
    );
  }

  const roleplay = await updateRolePlayStatus(id, body.status);
  if (!roleplay) {
    return NextResponse.json({ error: "Roleplay not found." }, { status: 404 });
  }

  return NextResponse.json({ roleplay });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getAuthSession();
  const { id } = await context.params;

  if (!session || !isAdmin(session.role)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const roleplay = await getRolePlayConfigById(id);
  if (!roleplay) {
    return NextResponse.json({ error: "Roleplay not found." }, { status: 404 });
  }

  if (!canUserManageRolePlay(session, roleplay)) {
    return NextResponse.json(
      { error: "Only the course owner or root admin can delete this roleplay." },
      { status: 403 },
    );
  }

  const deleted = await deleteRolePlayConfig(id);
  return NextResponse.json({ deleted });
}
