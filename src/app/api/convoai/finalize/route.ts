import { NextResponse } from "next/server";

type FinalizeBody = {
  agent_id?: unknown;
};

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as FinalizeBody;
  const agentId = asString(body.agent_id).trim();

  if (!agentId) {
    return NextResponse.json({ error: "agent_id is required." }, { status: 400 });
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

  const finalizeInstruction =
    "The support engineer has completed all required objectives for this simulation. Acknowledge the engineer's actions and clear next steps in short, professional, meeting-like closing remarks. Do not ask another follow-up question. Do not continue the conversation after this closing response.";

  const thinkUrl = `${baseUrl}/projects/${appId}/agents/${agentId}/llm/think`;
  const thinkResponse = await fetch(thinkUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${customerId}:${customerSecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: finalizeInstruction,
      on_listening_action: "interrupt",
      on_thinking_action: "interrupt",
      on_speaking_action: "ignore",
      interruptable: false,
    }),
    cache: "no-store",
  });

  const thinkResult = await thinkResponse.json().catch(() => ({}));

  if (!thinkResponse.ok) {
    return NextResponse.json(
      {
        error: `Agora ConvoAI think failed with HTTP ${thinkResponse.status}.`,
        details: thinkResult,
      },
      { status: thinkResponse.status },
    );
  }

  return NextResponse.json({
    status: "finalizing",
    agentId,
  });
}

