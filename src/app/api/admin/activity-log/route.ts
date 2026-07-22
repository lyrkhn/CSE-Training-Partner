import { NextResponse } from "next/server";

import { getAuthSession } from "@/src/lib/auth/session";
import { listActivityLogEntries } from "@/src/lib/activity-log/serverStorage";

export async function GET(request: Request) {
  const session = await getAuthSession();

  if (!session || session.role !== "root_admin") {
    return NextResponse.json({ error: "Root admin access required." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? 100);
  const activity = await listActivityLogEntries(Number.isFinite(limit) ? limit : 100);

  return NextResponse.json({ activity });
}
