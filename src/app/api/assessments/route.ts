import { NextResponse } from "next/server";

import { listFinalAssessments } from "@/src/lib/assessments/storage";
import { getAuthSession } from "@/src/lib/auth/session";
import { canUserAccessRolePlay, canUserManageRolePlay } from "@/src/lib/roleplays/access";
import { listRolePlayConfigs } from "@/src/lib/roleplays/serverStorage";

export async function GET() {
  try {
    const session = await getAuthSession();

    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const assessments = await listFinalAssessments();
    if (session.role === "root_admin") {
      return NextResponse.json({ assessments });
    }

    const roleplays = await listRolePlayConfigs();
    const accessibleRoleplays = roleplays.filter((roleplay) =>
      canUserAccessRolePlay(session, roleplay),
    );
    const accessibleScenarioIds = new Set(
      accessibleRoleplays.map((roleplay) => roleplay.id),
    );
    const manageableScenarioIds = new Set(
      roleplays
        .filter((roleplay) => canUserManageRolePlay(session, roleplay))
        .map((roleplay) => roleplay.id),
    );

    return NextResponse.json({
      assessments: assessments.filter(
        (assessment) =>
          accessibleScenarioIds.has(assessment.scenarioId) &&
          (manageableScenarioIds.has(assessment.scenarioId) || assessment.learnerId === session.id),
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
