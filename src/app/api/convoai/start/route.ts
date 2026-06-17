import { NextResponse } from "next/server";

const { RtcTokenBuilder } = require("agora-token/src/RtcTokenBuilder2");

type StartRequestBody = {
  system_message?: unknown;
  greeting_message?: unknown;
  greeting_message_switch?: unknown;
  delay_ms?: unknown;
};

type ConvoAiJoinResult = {
  agent_id?: unknown;
  create_ts?: unknown;
  status?: unknown;
  message?: unknown;
};

type ConvoAiJoinPayload = {
  name: string;
  preset?: string;
  properties: {
    channel: string;
    token: string;
    agent_rtc_uid: string;
    remote_rtc_uids: string[];
    enable_string_uid: boolean;
    idle_timeout: number;
    llm: {
      system_messages: Array<{
        role: "system";
        content: string;
      }>;
      max_history: number;
      greeting_message: string;
      failure_message: string;
      greeting_configs: {
        mode: string;
        delay_ms: number;
      };
    };
    asr: {
      vendor: string;
      language: string;
    };
    tts: {
      params: {
        voice_setting: {
          voice_id: string;
        };
      };
    };
  };
};

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function withDefault(value: unknown, fallback: string) {
  const normalized = asString(value).trim();
  return normalized || fallback;
}

function buildRtcAccessToken2(params: {
  appId: string;
  appCertificate: string;
  channelName: string;
  uid: string;
  expireSeconds?: number;
}) {
  const expireSeconds = params.expireSeconds ?? 3600;

  return RtcTokenBuilder.buildTokenWithUidAndPrivilege(
    params.appId,
    params.appCertificate,
    params.channelName,
    params.uid,
    expireSeconds,
    expireSeconds,
    expireSeconds,
    expireSeconds,
    expireSeconds,
  ) as string;
}

export async function POST(request: Request) {
  const body = (await request.json()) as StartRequestBody;

  const systemMessage = asString(body.system_message).trim();
  const greetingMessage = asString(body.greeting_message).trim();
  const greetingMessageSwitch = asString(body.greeting_message_switch).trim();
  const delayMs = typeof body.delay_ms === "number" ? body.delay_ms : Number.NaN;

  if (!systemMessage) {
    return NextResponse.json(
      { error: "system_message is required." },
      { status: 400 },
    );
  }

  if (greetingMessageSwitch !== "single_first") {
    return NextResponse.json(
      { error: "greeting_message_switch must be single_first." },
      { status: 400 },
    );
  }

  if (![800, 1200].includes(delayMs)) {
    return NextResponse.json({ error: "delay_ms must be 800 or 1200." }, { status: 400 });
  }

  const channelName = `mock-frustrated-customer-${Date.now()}`;
  const traineeUid = "7001001";
  const agentUid = "9001001";
  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID ?? "";
  const appCertificate = process.env.AGORA_APP_CERTIFICATE ?? "";
  const customerId = process.env.AGORA_CUSTOMER_ID ?? "";
  const customerSecret = process.env.AGORA_CUSTOMER_SECRET ?? "";
  const llmPreset = "openai_gpt_4o_mini";
  const ttsPreset = "minimax_speech_2_8_turbo";
  const ttsVoiceId = asString(process.env.CONVOAI_TTS_VOICE).trim();

  const baseUrl = withDefault(
    process.env.CONVOAI_BASE_URL,
    "https://api.agora.io/api/conversational-ai-agent/v2",
  ).replace(/\/$/, "");

  if (!appId) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_AGORA_APP_ID is required on the server." },
      { status: 500 },
    );
  }

  if (!appCertificate) {
    return NextResponse.json(
      { error: "AGORA_APP_CERTIFICATE is required on the server." },
      { status: 500 },
    );
  }

  if (!customerId || !customerSecret) {
    return NextResponse.json(
      {
        error:
          "AGORA_CUSTOMER_ID and AGORA_CUSTOMER_SECRET are required on the server.",
      },
      { status: 500 },
    );
  }

  if (!ttsVoiceId) {
    return NextResponse.json(
      {
        error:
          "CONVOAI_TTS_VOICE is required for MiniMax preset (properties.tts.params.voice_setting.voice_id).",
      },
      { status: 500 },
    );
  }

  const agentRtcToken = buildRtcAccessToken2({
    appId,
    appCertificate,
    channelName,
    uid: agentUid,
  });

  const traineeRtcToken = buildRtcAccessToken2({
    appId,
    appCertificate,
    channelName,
    uid: traineeUid,
  });

  const joinPayload: ConvoAiJoinPayload = {
    name: `frustrated-customer-escalation-${Date.now()}`,
    preset: `${llmPreset},${ttsPreset}`,
    properties: {
      channel: channelName,
      token: agentRtcToken,
      agent_rtc_uid: agentUid,
      remote_rtc_uids: [traineeUid],
      enable_string_uid: false,
      idle_timeout: 120,
      llm: {
        system_messages: [
          {
            role: "system",
            content: systemMessage,
          },
        ],
        max_history: 32,
        greeting_message: greetingMessage,
        failure_message: "Please hold on a second.",
        greeting_configs: {
          mode: greetingMessageSwitch,
          delay_ms: delayMs,
        },
      },
      asr: {
        vendor: "ares",
        language: "en-US",
      },
      tts: {
        params: {
          voice_setting: {
            voice_id: ttsVoiceId,
          },
        },
      },
    },
  };

  // TODO: Expand ASR language selection beyond en-US when the session UI exposes language choice.
  const joinUrl = `${baseUrl}/projects/${appId}/join`;
  const authHeader = `Basic ${Buffer.from(`${customerId}:${customerSecret}`).toString("base64")}`;

  const joinResponse = await fetch(joinUrl, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(joinPayload),
    cache: "no-store",
  });

  const joinResult = (await joinResponse.json().catch(() => null)) as
    | ConvoAiJoinResult
    | null;

  if (!joinResponse.ok) {
    const providerMessage = asString(joinResult?.message).trim();

    return NextResponse.json(
      {
        error:
          providerMessage ||
          `Agora ConvoAI join failed with HTTP ${joinResponse.status}.`,
        details: joinResult,
      },
      { status: joinResponse.status },
    );
  }

  const agentId = asString(joinResult?.agent_id).trim();

  if (!agentId) {
    return NextResponse.json(
      {
        error:
          "Agora ConvoAI join succeeded but did not return an agent_id.",
        details: joinResult,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    status: asString(joinResult?.status).trim() || "RUNNING",
    agentId,
    createTs:
      typeof joinResult?.create_ts === "number" ? joinResult.create_ts : null,
    channelName,
    traineeUid,
    agentUid,
    engineerRtc: {
      appId,
      channelName,
      uid: traineeUid,
      token: traineeRtcToken,
    },
    configSummary: {
      greeting_message_switch: greetingMessageSwitch,
      delay_ms: delayMs,
      llmProvider: "preset",
      llmPreset,
      llmModel: llmPreset,
      asrProvider: "ares",
      asrLanguage: "en-US",
      ttsProvider: "preset",
      ttsModel: ttsPreset,
      appIdConfigured: Boolean(appId),
      rtcTokenGenerated: Boolean(agentRtcToken),
      tokenVersion: "AccessToken2",
      baseUrl,
    },
  });
}
