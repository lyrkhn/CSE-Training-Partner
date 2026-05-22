import { NextResponse } from "next/server";

import { getTranscriptSessionById } from "@/src/lib/transcripts/storage";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(_: Request, context: RouteContext) {
  const { id } = context.params;
  const transcriptSession = await getTranscriptSessionById(id);

  if (!transcriptSession) {
    return NextResponse.json({ error: "Transcript session not found." }, { status: 404 });
  }

  return NextResponse.json(transcriptSession);
}
