import { NextResponse } from "next/server";

import { listAuthUsers } from "@/src/lib/auth/userStore";
import { getAuthSession } from "@/src/lib/auth/session";

export async function GET() {
  const session = await getAuthSession();

  if (!session || (session.role !== "root_admin" && session.role !== "course_admin")) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  return NextResponse.json({
    users: listAuthUsers().filter((user) => user.role === "trainee"),
  });
}
