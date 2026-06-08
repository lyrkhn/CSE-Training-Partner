import { NextResponse } from "next/server";

import { alphaUsers } from "@/src/lib/auth/alphaUsers";
import { getAuthSession } from "@/src/lib/auth/session";

export async function GET() {
  const session = await getAuthSession();

  if (!session || (session.role !== "root_admin" && session.role !== "course_admin")) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  return NextResponse.json({
    users: alphaUsers
      .filter((user) => user.role === "trainee")
      .map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      })),
  });
}

