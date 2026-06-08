import { NextResponse } from "next/server";

import { getFinalAssessmentById } from "@/src/lib/assessments/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const assessment = await getFinalAssessmentById(id);

  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
  }

  return NextResponse.json(assessment);
}
