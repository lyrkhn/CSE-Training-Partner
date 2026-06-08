import { NextResponse } from "next/server";

import { getAuthSession } from "@/src/lib/auth/session";

export async function GET() {
  const user = await getAuthSession();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  return NextResponse.json({ user });
}

