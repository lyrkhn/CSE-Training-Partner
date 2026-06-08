import { NextResponse } from "next/server";

import { listFinalAssessments } from "@/src/lib/assessments/storage";
import { getAuthSession } from "@/src/lib/auth/session";
import { canUserAccessRolePlay } from "@/src/lib/roleplays/access";
import { listRolePlayConfigs } from "@/src/lib/roleplays/serverStorage";

function isAdmin(role: string) {
  return role === "root_admin" || role === "course_admin";
}

export async function GET() {
  try {
    const session = await getAuthSession();

    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const assessments = await listFinalAssessments();
    if (isAdmin(session.role)) {
      return NextResponse.json({ assessments });
    }

    const roleplays = await listRolePlayConfigs();
    const accessibleScenarioIds = new Set(
      roleplays
        .filter((roleplay) => canUserAccessRolePlay(session, roleplay))
        .map((roleplay) => roleplay.id),
    );

    return NextResponse.json({
      assessments: assessments.filter((assessment) =>
        accessibleScenarioIds.has(assessment.scenarioId),
      ),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to load assessment history.",
        details: error instanceof Error ? error.message : "Unknown assessment history error.",
      },
      { status: 500 },
    );
  }
}
