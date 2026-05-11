import { NextResponse } from "next/server";

type EndRequestBody = {
  agent_id?: unknown;
};

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as EndRequestBody;
  const agentId = asString(body.agent_id).trim();

  if (!agentId) {
    return NextResponse.json({
      status: "ended",
    });
  }

  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID ?? "";
  const customerId = process.env.AGORA_CUSTOMER_ID ?? "";
  const customerSecret = process.env.AGORA_CUSTOMER_SECRET ?? "";
  const baseUrl = (
    process.env.CONVOAI_BASE_URL ??
    "https://api.agora.io/api/conversational-ai-agent/v2"
  ).replace(/\/$/, "");

  if (!appId || !customerId || !customerSecret) {
    return NextResponse.json(
      {
        error:
          "NEXT_PUBLIC_AGORA_APP_ID, AGORA_CUSTOMER_ID, and AGORA_CUSTOMER_SECRET are required on the server.",
      },
      { status: 500 },
    );
  }

  const leaveUrl = `${baseUrl}/projects/${appId}/agents/${agentId}/leave`;
  const leaveResponse = await fetch(leaveUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${customerId}:${customerSecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const leaveResult = await leaveResponse.json().catch(() => ({}));

  if (!leaveResponse.ok) {
    return NextResponse.json(
      {
        error: `Agora ConvoAI leave failed with HTTP ${leaveResponse.status}.`,
        details: leaveResult,
      },
      { status: leaveResponse.status },
    );
  }

  return NextResponse.json({
    status: "ended",
    agentId,
  });
}
