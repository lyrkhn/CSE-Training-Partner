import { NextResponse } from "next/server";

import { getAuthSession } from "@/src/lib/auth/session";
import { generateRolePlayDraftFromTranscript } from "@/src/lib/roleplays/generation/transcriptDraft";

function isAdmin(role: string) {
  return role === "root_admin" || role === "course_admin";
}

async function extractTranscript(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");
    const pastedTranscript = formData.get("transcript");

    if (file instanceof File) {
      return file.text();
    }

    return typeof pastedTranscript === "string" ? pastedTranscript : "";
  }

  const body = (await request.json().catch(() => ({}))) as { transcript?: unknown };
  return typeof body.transcript === "string" ? body.transcript : "";
}

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session || !isAdmin(session.role)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const transcript = await extractTranscript(request);

  if (!transcript.trim()) {
    return NextResponse.json({ error: "Transcript text or file is required." }, { status: 400 });
  }

  try {
    const draft = await generateRolePlayDraftFromTranscript(transcript);
    return NextResponse.json({ draft });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate a role play from this transcript.",
      },
      { status: 400 },
    );
  }
}
