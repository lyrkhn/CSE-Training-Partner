import { NextResponse } from "next/server";

import { getAuthSession } from "@/src/lib/auth/session";
import { changeAuthUserPassword, findAuthUserByCredentials } from "@/src/lib/auth/userStore";

type ChangePasswordBody = {
  currentPassword?: unknown;
  newPassword?: unknown;
};

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as ChangePasswordBody;
  const currentPassword = asString(body.currentPassword);
  const newPassword = asString(body.newPassword);

  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "New password must be at least 8 characters." },
      { status: 400 },
    );
  }

  const verifiedUser = await findAuthUserByCredentials(session.email, currentPassword);
  if (!verifiedUser || verifiedUser.id !== session.id) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
  }

  const updatedUser = await changeAuthUserPassword(session.id, newPassword);
  if (!updatedUser) {
    return NextResponse.json({ error: "Unable to update password." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
