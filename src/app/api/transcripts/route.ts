import { NextResponse } from "next/server";

import { listTranscriptSessionsByScenario } from "@/src/lib/transcripts/storage";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scenarioId = searchParams.get("scenarioId")?.trim() ?? "";

  if (!scenarioId) {
    return NextResponse.json({ error: "scenarioId is required." }, { status: 400 });
  }

  const sessions = await listTranscriptSessionsByScenario(scenarioId);
  return NextResponse.json({ sessions });
}

