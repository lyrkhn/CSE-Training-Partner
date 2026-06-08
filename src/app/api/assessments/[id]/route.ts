import { NextResponse } from "next/server";

import { getFinalAssessmentById } from "@/src/lib/assessments/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const assessment = await getFinalAssessmentById(id);

    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
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
