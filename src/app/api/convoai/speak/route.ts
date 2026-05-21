import { NextResponse } from "next/server";

type SpeakRequestBody = {
  agent_id?: unknown;
  text?: unknown;
};

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as SpeakRequestBody;
  const agentId = asString(body.agent_id).trim();
  const text = asString(body.text).trim();

  if (!agentId) {
    return NextResponse.json({ error: "agent_id is required." }, { status: 400 });
  }
  if (!text) {
    return NextResponse.json({ error: "text is required." }, { status: 400 });
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

  const speakUrl = `${baseUrl}/projects/${appId}/agents/${agentId}/llm/speak`;
  const speakResponse = await fetch(speakUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${customerId}:${customerSecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      priority: "INTERRUPT",
      interruptable: true,
    }),
    cache: "no-store",
  });

  const speakResult = await speakResponse.json().catch(() => ({}));

  if (!speakResponse.ok) {
    return NextResponse.json(
      {
        error: `Agora ConvoAI speak failed with HTTP ${speakResponse.status}.`,
        details: speakResult,
      },
      { status: speakResponse.status },
    );
  }

  return NextResponse.json({
    status: "speaking",
    agentId,
  });
}

