import { NextResponse } from "next/server";

import { getFinalAssessmentById } from "@/src/lib/assessments/storage";
import { getAuthSession } from "@/src/lib/auth/session";
import { canUserAccessRolePlay, canUserManageRolePlay } from "@/src/lib/roleplays/access";
import { getRolePlayConfigById } from "@/src/lib/roleplays/serverStorage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getAuthSession();
    const { id } = await params;

    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const assessment = await getFinalAssessmentById(id);

    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
    }

    const roleplay = await getRolePlayConfigById(assessment.scenarioId);
    const canAccess =
      session.role === "root_admin" ||
      (session.role === "course_admin" && roleplay && canUserManageRolePlay(session, roleplay)) ||
      (assessment.learnerId === session.id && (!roleplay || canUserAccessRolePlay(session, roleplay)));

    if (!canAccess) {
      return NextResponse.json({ error: "Assessment access denied." }, { status: 403 });
    }

    return NextResponse.json(assessment);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to load assessment.",
        details: error instanceof Error ? error.message : "Unknown assessment error.",
      },
      { status: 500 },
    );
  }
}
