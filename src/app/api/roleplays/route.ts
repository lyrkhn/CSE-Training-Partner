import { NextResponse } from "next/server";

import { getAuthSession } from "@/src/lib/auth/session";
import { listAuthUsers } from "@/src/lib/auth/userStore";
import { canUserAccessRolePlay, canUserManageRolePlay } from "@/src/lib/roleplays/access";
import {
  getRolePlayConfigById,
  listRolePlayConfigs,
  saveRolePlayConfig,
} from "@/src/lib/roleplays/serverStorage";
import type { RolePlayConfig } from "@/src/lib/roleplays/types";

function isAdmin(role: string) {
  return role === "root_admin" || role === "course_admin";
}

export async function GET() {
  const session = await getAuthSession();

  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const roleplays = await listRolePlayConfigs();
  return NextResponse.json({
    roleplays: isAdmin(session.role)
      ? roleplays
      : roleplays.filter((roleplay) => canUserAccessRolePlay(session, roleplay)),
  });
}

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session || !isAdmin(session.role)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const config = (await request.json().catch(() => null)) as RolePlayConfig | null;

  if (!config?.id || !config.settings?.meetingTitle) {
    return NextResponse.json({ error: "Valid roleplay config is required." }, { status: 400 });
  }

  const existing = await getRolePlayConfigById(config.id);
  if (existing && !canUserManageRolePlay(session, existing)) {
    return NextResponse.json(
      { error: "Only the course owner or root admin can edit this roleplay." },
      { status: 403 },
    );
  }

  const actor = {
    id: session.id,
    email: session.email,
    name: session.name,
    role: session.role,
  };
  const assignableUsers = await listAuthUsers();
  const activeAssignableUserIds = new Set(
    assignableUsers
      .filter((user) => user.isActive && (user.role === "trainee" || user.role === "course_admin"))
      .map((user) => user.id),
  );
  const assignedTraineeIds = (config.settings.assignedTraineeIds ?? []).filter((userId) =>
    activeAssignableUserIds.has(userId),
  );
  const saved = await saveRolePlayConfig({
    ...config,
    settings: {
      ...config.settings,
      assignedTraineeIds,
    },
    createdAt: existing?.createdAt ?? config.createdAt,
    createdBy: existing?.createdBy ?? actor,
    updatedBy: actor,
  });
  return NextResponse.json({ roleplay: saved });
}
