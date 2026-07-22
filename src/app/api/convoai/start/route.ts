import { NextResponse } from "next/server";
import { getCoachFeedbackLlmConfig } from "@/src/lib/llm/jsonCompletion";
import { defaultRolePlayCharacterPreset } from "@/src/lib/roleplays/characterPresets";

const { RtcTokenBuilder } = require("agora-token/src/RtcTokenBuilder2");

type StartRequestBody = {
  system_message?: unknown;
  greeting_message?: unknown;
  greeting_message_switch?: unknown;
  delay_ms?: unknown;
  voice_id?: unknown;
};

type ConvoAiJoinResult = {
  agent_id?: unknown;
  create_ts?: unknown;
  status?: unknown;
  message?: unknown;
};

type ConvoAiJoinPayload = {
  name: string;
  properties: {
    channel: string;
    token: string;
    agent_rtc_uid: string;
    remote_rtc_uids: string[];
    enable_string_uid: boolean;
    idle_timeout: number;
    llm: {
      credential_mode: "byok";
      vendor: "openai";
      style: "openai";
      url: string;
      api_key: string;
      params: {
        model: string;
        reasoning_effort?: string;
      };
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
      credential_mode: "managed";
      vendor: string;
      params: {
        url: string;
        model: string;
        language: string;
      };
    };
    tts: {
      credential_mode: "managed";
      vendor: "minimax";
      params: {
        url: string;
        model: string;
        voice_setting: {
          voice_id: string;
          speed: number;
        };
        audio_setting: {
          sample_rate: number;
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

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function resolveConvoAiLlmUrl(baseUrl: string) {
  const normalized = trimTrailingSlash(baseUrl);

  if (normalized.endsWith("/chat/completions") || normalized.endsWith("/responses")) {
    return normalized;
  }

  return `${normalized}/chat/completions`;
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
  const requestedVoiceId = asString(body.voice_id).trim();

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
  const asrVendor = "deepgram";
  const asrModel = "nova-3";
  const coachLlmConfig = getCoachFeedbackLlmConfig();
  const llmVendor = "openai";
  const llmModel = coachLlmConfig.model;
  const llmUrl = resolveConvoAiLlmUrl(coachLlmConfig.baseUrl);
  const llmApiKey = coachLlmConfig.apiKey;
  const llmParams = {
    model: llmModel,
    ...(coachLlmConfig.reasoningEffort
      ? { reasoning_effort: coachLlmConfig.reasoningEffort }
      : {}),
  };
  const ttsVendor = "minimax";
  const ttsModel = withDefault(process.env.CONVOAI_MINIMAX_TTS_MODEL, "speech-2.8-turbo");
  const ttsUrl = withDefault(
    process.env.CONVOAI_TTS_URL,
    "wss://api.minimax.io/ws/v1/t2a_v2",
  );
  const ttsVoiceId =
    requestedVoiceId ||
    asString(process.env.CONVOAI_TTS_VOICE).trim() ||
    defaultRolePlayCharacterPreset.voiceId;

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

  if (!llmApiKey || !llmModel || !llmUrl) {
    return NextResponse.json(
      {
        error:
          "Coach feedback LLM credentials are required for ConvoAI LLM BYOK. Configure OSS_API_KEY or FINAL_ASSESSMENT_API_KEY plus the coach feedback model/base URL.",
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
    properties: {
      channel: channelName,
      token: agentRtcToken,
      agent_rtc_uid: agentUid,
      remote_rtc_uids: [traineeUid],
      enable_string_uid: false,
      idle_timeout: 120,
      llm: {
        credential_mode: "byok",
        vendor: llmVendor,
        style: "openai",
        url: llmUrl,
        api_key: llmApiKey,
        params: llmParams,
        system_messages: [
          {
            role: "system",
            content: systemMessage,
          },
        ],
        max_history: 32,
        greeting_message: greetingMessage,
        failure_message: "I'm sorry. I'm having an issue. Please wait a moment.",
        greeting_configs: {
          mode: greetingMessageSwitch,
          delay_ms: delayMs,
        },
      },
      asr: {
        credential_mode: "managed",
        vendor: asrVendor,
        params: {
          url: "wss://api.deepgram.com/v1/listen",
          model: asrModel,
          language: "en-US",
        },
      },
      tts: {
        credential_mode: "managed",
        vendor: ttsVendor,
        params: {
          url: ttsUrl,
          model: ttsModel,
          voice_setting: {
            voice_id: ttsVoiceId,
            speed: 1.0,
          },
          audio_setting: {
            sample_rate: 44100,
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
      llmProvider: `${llmVendor}:byok`,
      llmCredentialMode: "byok",
      llmSource: `coach-feedback:${coachLlmConfig.provider}`,
      llmModel,
      llmUrl,
      asrProvider: `${asrVendor}:managed`,
      asrModel,
      asrLanguage: "en-US",
      ttsProvider: `${ttsVendor}:managed`,
      ttsModel,
      ttsVoiceId,
      appIdConfigured: Boolean(appId),
      rtcTokenGenerated: Boolean(agentRtcToken),
      tokenVersion: "AccessToken2",
      baseUrl,
    },
  });
}
