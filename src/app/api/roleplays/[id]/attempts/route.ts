import { NextResponse } from "next/server";

import { getAuthSession } from "@/src/lib/auth/session";
import { canUserAccessRolePlay, canUserTakeRolePlay } from "@/src/lib/roleplays/access";
import {
  canPersistRolePlayAttempts,
  getServerRolePlayAttemptStatus,
  recordServerRolePlayAttemptCompletion,
} from "@/src/lib/roleplays/serverAttempts";
import { getRolePlayConfigById } from "@/src/lib/roleplays/serverStorage";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await getAuthSession();
  const { id } = await context.params;

  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canPersistRolePlayAttempts()) {
    return NextResponse.json(
      { error: "Database is not configured for shared attempt tracking." },
      { status: 503 },
    );
  }

  const roleplay = await getRolePlayConfigById(id);
  if (!roleplay) {
    return NextResponse.json({ error: "Roleplay not found." }, { status: 404 });
  }

  if (!canUserAccessRolePlay(session, roleplay)) {
    return NextResponse.json({ error: "Roleplay access denied." }, { status: 403 });
  }

  if (!canUserTakeRolePlay(session, roleplay)) {
    return NextResponse.json({ attemptStatus: null, unlimited: true });
  }

  const attemptStatus = await getServerRolePlayAttemptStatus(session.id, id);
  return NextResponse.json({ attemptStatus });
}

export async function POST(_request: Request, context: RouteContext) {
  const session = await getAuthSession();
  const { id } = await context.params;

  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canPersistRolePlayAttempts()) {
    return NextResponse.json(
      { error: "Database is not configured for shared attempt tracking." },
      { status: 503 },
    );
  }

  const roleplay = await getRolePlayConfigById(id);
  if (!roleplay) {
    return NextResponse.json({ error: "Roleplay not found." }, { status: 404 });
  }

  if (!canUserAccessRolePlay(session, roleplay)) {
    return NextResponse.json({ error: "Roleplay access denied." }, { status: 403 });
  }

  if (!canUserTakeRolePlay(session, roleplay)) {
    return NextResponse.json(
      { error: "Only assigned learner attempts are tracked." },
      { status: 400 },
    );
  }

  const currentStatus = await getServerRolePlayAttemptStatus(session.id, id);
  if (currentStatus.locked) {
    return NextResponse.json({ attemptStatus: currentStatus });
  }

  const attemptStatus = await recordServerRolePlayAttemptCompletion(session.id, id);
  return NextResponse.json({ attemptStatus });
}
