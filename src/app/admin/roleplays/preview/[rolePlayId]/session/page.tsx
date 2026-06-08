"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import type {
  IAgoraRTCClient,
  IMicrophoneAudioTrack,
  IRemoteAudioTrack,
} from "agora-rtc-sdk-ng";
import {
  mapToolkitTranscriptItems,
  type NormalizedTranscript,
  type ToolkitTranscriptItem,
  type ToolkitTranscriptMetadata,
} from "@/src/lib/convoai/transcriptMapper";
import type { AuthSessionUser } from "@/src/lib/auth/session";
import type { Objective, TranscriptEntry } from "@/src/lib/objectives/types";
import { canUserAccessRolePlay } from "@/src/lib/roleplays/access";
import {
  completeRolePlayAttempt,
  fetchRolePlayAttemptStatus,
  type RolePlayAttemptStatus,
} from "@/src/lib/roleplays/attempts";
import { fetchRolePlayConfig } from "@/src/lib/roleplays/storage";
import type { RolePlayConfig } from "@/src/lib/roleplays/types";

type CallStatus = "Preparing" | "Connecting" | "In Call" | "Ended";
type SimulationState = "preparing" | "in_call" | "ending" | "finished";

type StartResponse = {
  agentId: string;
  channelName: string;
  traineeUid: string;
  agentUid: string;
  engineerRtc: {
    appId: string;
    channelName: string;
    uid: string;
    token: string;
  };
};

type StreamChunkEnvelope = {
  messageId: string;
  partIndex: number;
  partSum: number;
  content: string;
};

type DataStreamTranscriptMessage = {
  object?: string;
  text?: string;
  stream_id?: number;
  turn_id?: number;
  user_id?: string;
  text_ts?: number;
  final?: boolean;
  turn_status?: number;
};

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function parseStreamChunkEnvelope(rawChunk: string): StreamChunkEnvelope | null {
  const first = rawChunk.indexOf("|");
  const second = rawChunk.indexOf("|", first + 1);
  const third = rawChunk.indexOf("|", second + 1);
  if (first < 0 || second < 0 || third < 0) {
    return null;
  }

  const messageId = rawChunk.slice(0, first);
  const partIndex = Number(rawChunk.slice(first + 1, second));
  const partSumRaw = rawChunk.slice(second + 1, third);
  const content = rawChunk.slice(third + 1);
  const partSum = partSumRaw === "???" ? -1 : Number(partSumRaw);

  if (!messageId || Number.isNaN(partIndex) || Number.isNaN(partSum) || partSum <= 0) {
    return null;
  }

  return {
    messageId,
    partIndex,
    partSum,
    content,
  };
}

function decodeUtf8(bytes: Uint8Array) {
  return new TextDecoder().decode(bytes);
}

function normalizeVolumeLevel(level: unknown) {
  const rawLevel = Number(level);
  if (!Number.isFinite(rawLevel)) {
    return 0;
  }

  const normalized = rawLevel > 1 ? rawLevel / 100 : rawLevel;
  return Math.max(0, Math.min(1, normalized));
}

function scaleVolumeForDisplay(level: number, noiseFloor = 0.22, gain = 1.45) {
  const normalized = normalizeVolumeLevel(level);
  if (normalized <= noiseFloor) {
    return 0;
  }

  return Math.min(1, ((normalized - noiseFloor) / (1 - noiseFloor)) * gain);
}

function withCustomerPersonaGuard(config: RolePlayConfig) {
  return [
    config.generated.system_message,
    "CRITICAL SESSION OVERRIDE:",
    `You are ${config.character.name}, the ${config.character.role}.`,
    `You are the customer/persona in this scenario, not the ${config.plan.learnerRole}.`,
    "Never speak as the engineer, coach, evaluator, instructor, or assistant.",
    "Do not give solutions as support staff. Respond only as the customer/persona reacting to the learner.",
    "Stay in first person and keep every reply consistent with the character background.",
    "AGORA FEATURE CONTEXT GUARDRAIL:",
    "Keep the conversation anchored to the Agora feature, customer issue, and learner goals configured for this scenario.",
    "Do not introduce unrelated Agora products, SDKs, or technical capabilities unless the learner brings them up and they are connected to the customer's issue.",
    "If the learner gives generic advice, ask how it applies to the specific Agora scenario or customer use case.",
    "If the learner drifts away from the configured issue, redirect back to the customer's impact and the Agora feature involved.",
    "Do not invent technical facts, API names, product limits, pricing, or behavior not grounded in the scenario.",
  ].join("\n\n");
}

function fallbackConfig(rolePlayId: string): RolePlayConfig {
  return {
    id: rolePlayId,
    status: "draft",
    plan: {
      scenario: "Test a customer support escalation conversation.",
      learnerRole: "Customer Support Engineer",
    },
    character: {
      name: "Morgan Lee",
      role: "Enterprise customer",
      personalityBackground: "Direct and skeptical, but cooperative when the learner is specific.",
      greetingMessage: "Can we please get this issue moving today?",
    },
    settings: {
      meetingTitle: "Support Escalation Role Play",
      durationMinutes: 8,
      learnerGoals: [
        {
          id: "fallback-session-goal",
          label: "Provide clear next steps",
          required: true,
          completed: false,
        },
      ],
      evaluatorPrompt: "Evaluate learner responses against role play goals.",
    },
    generated: {
      system_message:
        "You are Morgan Lee, an enterprise customer escalation contact. You are the customer/persona in the role play, not the engineer. Stay in character, speak in first person, and do not act as coach, evaluator, assistant, or support engineer. Keep the conversation focused on the configured Agora customer issue and do not invent unrelated product behavior.",
      greeting_message: "Can we please get this issue moving today?",
      greeting_message_switch: "single_first",
      delay_ms: 1200,
    },
  };
}

export default function RolePlayPreviewSessionPage() {
  const router = useRouter();
  const params = useParams<{ rolePlayId: string }>();
  const rolePlayId = params.rolePlayId;
  const [config, setConfig] = useState<RolePlayConfig | null>(null);
  const [sessionUser, setSessionUser] = useState<AuthSessionUser | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [guideOpen, setGuideOpen] = useState(true);
  const [captionsOpen, setCaptionsOpen] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [callStatus, setCallStatus] = useState<CallStatus>("Preparing");
  const [simulationState, setSimulationState] = useState<SimulationState>("preparing");
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [pushToTalkEnabled, setPushToTalkEnabled] = useState(true);
  const [isPushToTalkActive, setIsPushToTalkActive] = useState(false);
  const [aiVolumeLevel, setAiVolumeLevel] = useState(0);
  const [traineeVolumeLevel, setTraineeVolumeLevel] = useState(0);
  const [connectionState, setConnectionState] = useState("DISCONNECTED");
  const [remoteAudioPublished, setRemoteAudioPublished] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [startResponse, setStartResponse] = useState<StartResponse | null>(null);
  const [normalizedTranscript, setNormalizedTranscript] = useState<NormalizedTranscript[]>([]);
  const [learnerGoals, setLearnerGoals] = useState<Objective[]>([]);
  const [showEndCallConfirm, setShowEndCallConfirm] = useState(false);
  const [transcriptSessionId, setTranscriptSessionId] = useState<string | null>(null);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [assessmentStatus, setAssessmentStatus] = useState<"idle" | "saving" | "ready" | "error">(
    "idle",
  );
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [attemptStatus, setAttemptStatus] = useState<RolePlayAttemptStatus | null>(null);
  const startAttemptedRef = useRef(false);
  const attemptRecordedRef = useRef(false);
  const agentIdRef = useRef<string | null>(null);
  const transcriptContextRef = useRef<{ traineeUid?: string; agentUid?: string }>({});
  const rtcClientRef = useRef<IAgoraRTCClient | null>(null);
  const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const remoteAudioTrackRef = useRef<IRemoteAudioTrack | null>(null);
  const aiVolumeTargetRef = useRef(0);
  const traineeVolumeTargetRef = useRef(0);
  const transcriptChunkCacheRef = useRef<
    Map<string, { parts: Map<number, string>; partSum: number }>
  >(new Map());
  const transcriptItemMapRef = useRef<Map<string, ToolkitTranscriptItem>>(new Map());
  const finalizedTranscriptKeysRef = useRef<Set<string>>(new Set());
  const pushToTalkEnabledRef = useRef(true);

  const requiredGoals = learnerGoals.filter((goal) => goal.required);
  const controlsLocked = simulationState === "ending" || simulationState === "finished";
  const visualAiVolume = Math.min(1, aiVolumeLevel * 2.8);
  const traineeFillLevel = isPushToTalkActive
    ? scaleVolumeForDisplay(traineeVolumeLevel, 0.6, 1.9)
    : 0;
  const aiSpeaking = visualAiVolume > 0.04;
  const traineeSpeaking = traineeFillLevel > 0.03;
  const isTrainee = sessionUser?.role === "trainee";

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/auth/session", {
        cache: "no-store",
      });
      if (!response.ok) {
        setAccessDenied(true);
        return;
      }

      const payload = (await response.json()) as { user?: AuthSessionUser };
      setSessionUser(payload.user ?? null);
    })();
  }, []);

  useEffect(() => {
    pushToTalkEnabledRef.current = pushToTalkEnabled;
    if (!localAudioTrackRef.current) {
      setIsPushToTalkActive(false);
      return;
    }

    if (pushToTalkEnabled) {
      void localAudioTrackRef.current.setMuted(true).catch(() => undefined);
      setIsPushToTalkActive(false);
      return;
    }

    void localAudioTrackRef.current.setMuted(false).catch(() => undefined);
    setIsPushToTalkActive(false);
  }, [pushToTalkEnabled]);

  useEffect(() => {
    if (!rolePlayId) return;
    void (async () => {
      const nextConfig = (await fetchRolePlayConfig(rolePlayId)) ?? fallbackConfig(rolePlayId);
      setConfig(nextConfig);
      setLearnerGoals(
        nextConfig.settings.learnerGoals.map((goal) => ({
          ...goal,
          completed: false,
          completedAt: undefined,
          confidence: undefined,
          evidence: undefined,
        })),
      );
    })();
  }, [rolePlayId]);

  useEffect(() => {
    if (!config || !sessionUser) {
      return;
    }

    setAccessDenied(!canUserAccessRolePlay(sessionUser, config));
    if (sessionUser.role === "trainee") {
      let active = true;
      setAttemptStatus(null);
      void fetchRolePlayAttemptStatus(sessionUser.id, config.id).then((nextAttemptStatus) => {
        if (active) {
          setAttemptStatus(nextAttemptStatus);
        }
      });
      return () => {
        active = false;
      };
    }

    setAttemptStatus(null);
    return undefined;
  }, [config, sessionUser]);

  useEffect(() => {
    if (sessionEnded) return;
    const interval = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [sessionEnded]);

  useEffect(() => {
    if (callStatus !== "In Call" || simulationState !== "in_call") {
      aiVolumeTargetRef.current = 0;
      traineeVolumeTargetRef.current = 0;
      setAiVolumeLevel(0);
      setTraineeVolumeLevel(0);
      return;
    }

    const interval = window.setInterval(() => {
      const trackAiVolume = normalizeVolumeLevel(remoteAudioTrackRef.current?.getVolumeLevel() ?? 0);
      const isLocalMicLive = !pushToTalkEnabledRef.current || isPushToTalkActive;
      const trackTraineeVolume = isLocalMicLive
        ? normalizeVolumeLevel(localAudioTrackRef.current?.getVolumeLevel() ?? 0)
        : 0;
      const nextAiVolume = Math.max(trackAiVolume, aiVolumeTargetRef.current);
      const nextTraineeVolume = isLocalMicLive
        ? Math.max(trackTraineeVolume, traineeVolumeTargetRef.current)
        : 0;

      aiVolumeTargetRef.current *= 0.82;
      traineeVolumeTargetRef.current = isLocalMicLive ? traineeVolumeTargetRef.current * 0.78 : 0;

      setAiVolumeLevel((current) => current * 0.72 + nextAiVolume * 0.28);
      setTraineeVolumeLevel((current) => current * 0.68 + nextTraineeVolume * 0.32);
    }, 80);

    return () => window.clearInterval(interval);
  }, [callStatus, isPushToTalkActive, simulationState]);

  function upsertNormalizedTranscript(entry: ToolkitTranscriptItem) {
    const key = `${entry.uid}-${entry.stream_id}-${entry.turn_id}-${entry.metadata?.object ?? "unknown"}`;
    if (finalizedTranscriptKeysRef.current.has(key)) {
      return;
    }

    const existing = transcriptItemMapRef.current.get(key);
    const nextEntry =
      existing && existing.status !== 0
        ? existing
        : {
            ...entry,
            _time: existing?._time ?? entry._time,
          };

    transcriptItemMapRef.current.set(key, nextEntry);
    if (nextEntry.status !== 0) {
      finalizedTranscriptKeysRef.current.add(key);
    }

    const mapped = mapToolkitTranscriptItems([...transcriptItemMapRef.current.values()], {
      traineeUid: transcriptContextRef.current.traineeUid,
      agentUid: transcriptContextRef.current.agentUid,
    });
    setNormalizedTranscript(mapped.sort((a, b) => a.timestamp.localeCompare(b.timestamp)));
  }

  function resetLearnerGoals(activeConfig: RolePlayConfig) {
    setLearnerGoals(
      activeConfig.settings.learnerGoals.map((goal) => ({
        ...goal,
        completed: false,
        completedAt: undefined,
        confidence: undefined,
        evidence: undefined,
      })),
    );
  }

  function handleToolkitStreamMessage(publisherUid: string, payload: Uint8Array) {
    const chunkEnvelope = parseStreamChunkEnvelope(decodeUtf8(payload));
    if (!chunkEnvelope) {
      return;
    }

    const cached = transcriptChunkCacheRef.current.get(chunkEnvelope.messageId) ?? {
      parts: new Map<number, string>(),
      partSum: chunkEnvelope.partSum,
    };
    cached.partSum = chunkEnvelope.partSum;
    cached.parts.set(chunkEnvelope.partIndex, chunkEnvelope.content);
    transcriptChunkCacheRef.current.set(chunkEnvelope.messageId, cached);

    if (cached.parts.size !== cached.partSum) {
      return;
    }

    const assembled = Array.from(cached.parts.entries())
      .sort((a, b) => a[0] - b[0])
      .map((entry) => entry[1])
      .join("");
    transcriptChunkCacheRef.current.delete(chunkEnvelope.messageId);

    let parsed: DataStreamTranscriptMessage;
    try {
      parsed = JSON.parse(atob(assembled)) as DataStreamTranscriptMessage;
    } catch {
      return;
    }

    const isUserTranscript = parsed.object === "user.transcription";
    const isAgentTranscript = parsed.object === "assistant.transcription";
    const text = typeof parsed.text === "string" ? parsed.text.trim() : "";

    if ((!isUserTranscript && !isAgentTranscript) || !text) {
      return;
    }

    const metadata: ToolkitTranscriptMetadata = {
      object: parsed.object,
      user_id: parsed.user_id,
      stream_id: typeof parsed.stream_id === "number" ? parsed.stream_id : undefined,
      turn_id: typeof parsed.turn_id === "number" ? parsed.turn_id : undefined,
    };
    const sourceTimestamp =
      typeof parsed.text_ts === "number" && Number.isFinite(parsed.text_ts)
        ? parsed.text_ts
        : Date.now();

    upsertNormalizedTranscript({
      uid: publisherUid,
      stream_id: typeof parsed.stream_id === "number" ? parsed.stream_id : 0,
      turn_id: typeof parsed.turn_id === "number" ? parsed.turn_id : Date.now(),
      _time: sourceTimestamp,
      text,
      status: typeof parsed.turn_status === "number" ? parsed.turn_status : parsed.final ? 1 : 0,
      metadata,
    });
  }

  async function startVoiceRolePlay(activeConfig: RolePlayConfig) {
    if (isStarting || callStatus === "In Call") return;
    if (isTrainee && !attemptStatus) {
      setErrorMessage("Checking attempt eligibility. Please try again in a moment.");
      return;
    }
    if (isTrainee && attemptStatus?.locked) {
      setErrorMessage("This roleplay is locked because both trainee attempts have been used.");
      return;
    }

    setIsStarting(true);
    setErrorMessage(null);
    setCallStatus("Connecting");
    setSimulationState("preparing");
    setSessionEnded(false);
    setIsPushToTalkActive(false);
    setElapsedSeconds(0);
    setNormalizedTranscript([]);
    setTranscriptSessionId(null);
    setAssessmentId(null);
    setAssessmentStatus("idle");
    setAssessmentError(null);
    attemptRecordedRef.current = false;
    resetLearnerGoals(activeConfig);
    transcriptChunkCacheRef.current.clear();
    transcriptItemMapRef.current.clear();
    finalizedTranscriptKeysRef.current.clear();
    transcriptContextRef.current = {};

    try {
      const response = await fetch("/api/convoai/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          system_message: withCustomerPersonaGuard(activeConfig),
          greeting_message: activeConfig.generated.greeting_message,
          greeting_message_switch: activeConfig.generated.greeting_message_switch,
          delay_ms: activeConfig.generated.delay_ms,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string; details?: unknown }
          | null;
        const detailText =
          typeof payload?.details === "string"
            ? payload.details
            : payload?.details
              ? JSON.stringify(payload.details)
              : "";
        throw new Error(
          [payload?.error ?? `Unable to start role play voice session. HTTP ${response.status}.`, detailText]
            .filter(Boolean)
            .join(" "),
        );
      }

      const data = (await response.json()) as StartResponse;
      setStartResponse(data);
      agentIdRef.current = data.agentId;
      transcriptContextRef.current = {
        traineeUid: data.traineeUid,
        agentUid: data.agentUid,
      };

      const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
      AgoraRTC.onAutoplayFailed = () => {
        setErrorMessage("Browser blocked agent audio autoplay. Click the role play area and try again.");
      };

      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      rtcClientRef.current = client;
      client.enableAudioVolumeIndicator();

      client.on("connection-state-change", (currentState) => {
        setConnectionState(currentState);
      });

      client.on("volume-indicator", (volumes) => {
        volumes.forEach((volume) => {
          const uid = String(volume.uid);
          const normalizedLevel = normalizeVolumeLevel(volume.level);
          if (uid === String(data.agentUid)) {
            aiVolumeTargetRef.current = Math.max(aiVolumeTargetRef.current, normalizedLevel);
          }
          if (uid === String(data.traineeUid)) {
            traineeVolumeTargetRef.current = Math.max(
              traineeVolumeTargetRef.current,
              normalizedLevel,
            );
          }
        });
      });

      client.on("stream-message", (uid, payload) => {
        handleToolkitStreamMessage(String(uid), payload);
      });

      client.on("user-published", async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        if (mediaType === "audio" && user.audioTrack) {
          remoteAudioTrackRef.current = user.audioTrack;
          user.audioTrack.setVolume(100);
          user.audioTrack.play();
          setRemoteAudioPublished(true);
        }
      });

      client.on("user-unpublished", (user, mediaType) => {
        if (mediaType === "audio" && String(user.uid) === String(data.agentUid)) {
          remoteAudioTrackRef.current = null;
          setRemoteAudioPublished(false);
        }
      });

      const [microphoneTrack] = await Promise.all([
        AgoraRTC.createMicrophoneAudioTrack(),
        client.join(
          data.engineerRtc.appId,
          data.engineerRtc.channelName,
          data.engineerRtc.token || null,
          Number(data.engineerRtc.uid),
        ),
      ]);

      localAudioTrackRef.current = microphoneTrack;
      if (pushToTalkEnabledRef.current) {
        await microphoneTrack.setMuted(true);
      }
      await client.publish([microphoneTrack]);
      setCallStatus("In Call");
      setSimulationState("in_call");
    } catch (error) {
      setCallStatus("Preparing");
      setSimulationState("preparing");
      setErrorMessage(error instanceof Error ? error.message : "Unable to start role play.");
      await cleanupVoiceRolePlay(false);
    } finally {
      setIsStarting(false);
    }
  }

  async function cleanupVoiceRolePlay(callEndApi: boolean) {
    setIsPushToTalkActive(false);
    const cleanupTasks: Promise<unknown>[] = [];

    remoteAudioTrackRef.current = null;
    aiVolumeTargetRef.current = 0;
    traineeVolumeTargetRef.current = 0;
    setRemoteAudioPublished(false);
    setAiVolumeLevel(0);
    setTraineeVolumeLevel(0);

    if (localAudioTrackRef.current) {
      const localAudioTrack = localAudioTrackRef.current;
      localAudioTrackRef.current = null;
      cleanupTasks.push(
        Promise.resolve().then(() => {
          localAudioTrack.stop();
          localAudioTrack.close();
        }),
      );
    }

    if (rtcClientRef.current) {
      const rtcClient = rtcClientRef.current;
      rtcClientRef.current = null;
      cleanupTasks.push(
        rtcClient
          .leave()
          .catch(() => undefined)
          .finally(() => {
            rtcClient.removeAllListeners();
          }),
      );
      setConnectionState("DISCONNECTED");
    }

    transcriptChunkCacheRef.current.clear();
    transcriptItemMapRef.current.clear();
    finalizedTranscriptKeysRef.current.clear();

    if (callEndApi && agentIdRef.current) {
      const agentId = agentIdRef.current;
      agentIdRef.current = null;
      cleanupTasks.push(
        fetch("/api/convoai/end", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            agent_id: agentId,
          }),
        }).catch(() => undefined),
      );
    }

    await Promise.allSettled(cleanupTasks);
  }

  async function endVoiceRolePlay() {
    if (isEnding) return;
    setShowEndCallConfirm(false);
    setIsEnding(true);
    setSimulationState("ending");
    setAssessmentStatus("saving");
    setAssessmentError(null);

    const transcriptEntries: TranscriptEntry[] = normalizedTranscript.map((entry) => ({
      id: entry.id,
      speaker_type: entry.speaker_type,
      speaker_id: entry.speaker_id,
      text: entry.text,
      timestamp: entry.timestamp,
    }));
    const completedObjectives: Objective[] = [];

    let savedTranscriptSessionId: string | null = null;

    try {
      if (config && transcriptEntries.length > 0) {
        const transcriptResponse = await fetch("/api/transcripts/save", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            scenarioId: config.id,
            scenarioTitle: config.settings.meetingTitle,
            status: "completed",
            completedObjectives,
            transcript: transcriptEntries,
          }),
        });

        if (!transcriptResponse.ok) {
          throw new Error(`Transcript save failed with HTTP ${transcriptResponse.status}.`);
        }

        const transcriptPayload = (await transcriptResponse.json()) as {
          transcriptSessionId?: string;
        };
        savedTranscriptSessionId = transcriptPayload.transcriptSessionId ?? null;
        setTranscriptSessionId(savedTranscriptSessionId);
      }

      if (config && savedTranscriptSessionId) {
        const assessmentResponse = await fetch("/api/assessments/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            transcriptSessionId: savedTranscriptSessionId,
            scenarioId: config.id,
            scenarioTitle: config.settings.meetingTitle,
            learnerRole: config.plan.learnerRole,
            objectives: learnerGoals,
            transcript: transcriptEntries,
          }),
        });

        if (!assessmentResponse.ok) {
          throw new Error(`Final assessment failed with HTTP ${assessmentResponse.status}.`);
        }

        const assessmentPayload = (await assessmentResponse.json()) as {
          assessmentId?: string;
        };
        setAssessmentId(assessmentPayload.assessmentId ?? null);
        setAssessmentStatus("ready");
      } else {
        setAssessmentStatus("error");
        setAssessmentError("No transcript was captured, so no final assessment was generated.");
      }
    } catch (error) {
      setAssessmentStatus("error");
      setAssessmentError(
        error instanceof Error ? error.message : "Unable to generate final assessment.",
      );
    }

    await cleanupVoiceRolePlay(true);
    if (isTrainee && config && sessionUser && !attemptRecordedRef.current) {
      attemptRecordedRef.current = true;
      setAttemptStatus(await completeRolePlayAttempt(sessionUser.id, config.id));
    }
    setCallStatus("Ended");
    setSimulationState("finished");
    setSessionEnded(true);
    setIsEnding(false);
  }

  async function setPushToTalkActive(active: boolean) {
    if (!pushToTalkEnabledRef.current || callStatus !== "In Call" || simulationState !== "in_call") {
      return;
    }
    if (isPushToTalkActive === active) {
      return;
    }

    const wasActive = isPushToTalkActive;
    setIsPushToTalkActive(active);
    await localAudioTrackRef.current?.setMuted(!active).catch(() => undefined);

    if (wasActive && !active) {
      setIsPushToTalkActive(false);
    }
  }

  useEffect(() => {
    if (!config || !sessionUser || accessDenied || startAttemptedRef.current) return;
    if (sessionUser.role === "trainee") {
      if (!attemptStatus) return;
      if (attemptStatus.locked) return;
    }
    startAttemptedRef.current = true;
    void startVoiceRolePlay(config);
  }, [accessDenied, attemptStatus, config, sessionUser]);

  useEffect(() => {
    return () => {
      void cleanupVoiceRolePlay(true);
    };
  }, []);

  const fallbackCaptions = useMemo(() => {
    if (!config) return [];
    return [
      {
        speaker: config.character.name,
        text: config.generated.greeting_message,
      },
      {
        speaker: "System",
        text: "Live captions will appear here once the conversation starts.",
      },
    ];
  }, [config]);

  if (!config || (!sessionUser && !accessDenied)) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_34%),linear-gradient(180deg,#f8fbff,#f4f7fb)] px-6 py-8 text-slate-950">
        <div className="mx-auto max-w-6xl text-sm text-slate-500">Loading session...</div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_34%),linear-gradient(180deg,#f8fbff,#f4f7fb)] px-6 py-8 text-slate-950">
        <div className="mx-auto max-w-2xl rounded-3xl border border-amber-200 bg-amber-50 p-8 text-amber-900 shadow-soft">
          <p className="text-xs uppercase tracking-[0.24em] text-amber-700">Access restricted</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
            This roleplay is not assigned to your account
          </h1>
          <p className="mt-3 text-sm leading-7">
            Ask a course admin to assign this published course to your trainee account, or sign in
            with an admin account to test the roleplay.
          </p>
          <Link
            href="/courses"
            className="mt-5 inline-flex rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            View Assigned Courses
          </Link>
        </div>
      </div>
    );
  }

  if (isTrainee && attemptStatus?.locked && simulationState !== "finished") {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_34%),linear-gradient(180deg,#f8fbff,#f4f7fb)] px-6 py-8 text-slate-950">
        <div className="mx-auto max-w-2xl rounded-3xl border border-blue-100 bg-white p-8 text-center shadow-soft">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-2xl font-semibold text-slate-500">
            !
          </div>
          <p className="mt-5 text-xs uppercase tracking-[0.28em] text-primary">
            Attempts Used
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            This roleplay is locked
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-600">
            You completed this simulation twice. The retake window is now closed, and your latest
            final assessment is available from Assessment Results.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/assessment"
              className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-600"
            >
              View Assessment Results
            </Link>
            <Link
              href="/courses"
              className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
            >
              Return to Courses
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_34%),linear-gradient(180deg,#f8fbff,#f4f7fb)] text-slate-950">
      {simulationState === "finished" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[2rem] border border-white/80 bg-white/95 p-8 text-center shadow-[0_30px_80px_-35px_rgba(15,23,42,0.55)]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-100 text-2xl font-semibold text-blue-700">
              ✓
            </div>
            <p className="mt-5 text-xs uppercase tracking-[0.28em] text-primary">
              Simulation Ended
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Session Completed
            </h1>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              The roleplay call has ended. The final assessment will validate objective coverage
              from the full transcript instead of relying on live checklist ticks.
            </p>
            <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm text-slate-700">
              <span className="font-semibold text-slate-950">
                {requiredGoals.length}
              </span>{" "}
              required learner goals used for final assessment.{" "}
              <span className="font-semibold text-slate-950">
                {learnerGoals.length}
              </span>{" "}
              total goals reviewed as guidance.
              {isTrainee && attemptStatus && (
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
                  Attempt {attemptStatus.completedAttempts} of {attemptStatus.maxAttempts}
                  {attemptStatus.remainingAttempts > 0
                    ? ` · ${attemptStatus.remainingAttempts} retake remaining`
                    : " · Final attempt used"}
                </p>
              )}
            </div>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              {assessmentStatus === "ready" && assessmentId
                ? "Final assessment generated and ready to review."
                : assessmentStatus === "saving"
                  ? "Saving transcript and generating final assessment..."
                  : assessmentStatus === "error"
                    ? (assessmentError ?? "Final assessment was not generated.")
                    : "Final assessment will be generated when the call ends."}
              {transcriptSessionId && (
                <p className="mt-2 text-xs text-slate-500">
                  Transcript session: {transcriptSessionId}
                </p>
              )}
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {assessmentId && (
                <Link
                  href={`/assessment/${assessmentId}`}
                  className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-600"
                >
                  View Final Assessment
                </Link>
              )}
              {isTrainee ? (
                <>
                  {attemptStatus && attemptStatus.remainingAttempts > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!config) return;
                        setSimulationState("preparing");
                        setCallStatus("Preparing");
                        setSessionEnded(false);
                        setIsEnding(false);
                        startAttemptedRef.current = true;
                        void startVoiceRolePlay(config);
                      }}
                      className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-600"
                    >
                      Retake Role Play
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => router.push("/courses")}
                    className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
                  >
                    Return to Courses
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href={`/course-builder?preview=${config.id}`}
                    className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-blue-50"
                  >
                    Back to Preview
                  </Link>
                  <button
                    type="button"
                    onClick={() => router.push("/course-builder")}
                    className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
                  >
                    Return to Course Builder
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showEndCallConfirm && simulationState !== "finished" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] border border-white/80 bg-white/95 p-7 text-center shadow-[0_30px_80px_-35px_rgba(15,23,42,0.55)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-100 text-2xl font-semibold text-blue-700">
              ?
            </div>
            <p className="mt-5 text-xs uppercase tracking-[0.28em] text-primary">
              End Role Play
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
              Do you want to end the call?
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              If you are happy with the overall conversation, ending now will stop the AI customer
              and leave the RTC channel for the trainee.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowEndCallConfirm(false)}
                disabled={isEnding}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-blue-50 disabled:opacity-50"
              >
                Continue Call
              </button>
              <button
                type="button"
                onClick={() => void endVoiceRolePlay()}
                disabled={isEnding}
                className="rounded-2xl bg-rose-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-500/20 transition hover:bg-rose-600 disabled:opacity-50"
              >
                {isEnding ? "Ending..." : "Yes, End Call"}
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="border-b border-white/70 bg-white/80 px-6 py-4 shadow-soft backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-primary">Role Play Test Session</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
            {config.settings.meetingTitle}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
            {formatTime(elapsedSeconds)}
          </span>
          <span className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
            {simulationState === "finished"
              ? "Completed"
              : simulationState === "ending"
                ? "Ending"
              : callStatus}
          </span>
          <button
            type="button"
            onClick={() => setGuideOpen((current) => !current)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-soft transition hover:border-blue-200 hover:bg-blue-50"
          >
            Guide
          </button>
          <button
            type="button"
            onClick={() => setCaptionsOpen((current) => !current)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-soft transition hover:border-blue-200 hover:bg-blue-50"
          >
            Closed Captions
          </button>
          <button
            type="button"
            onClick={() => setPushToTalkEnabled((current) => !current)}
            disabled={callStatus === "Ended" || controlsLocked}
            className={`rounded-2xl border px-4 py-2 text-sm font-semibold shadow-soft transition disabled:opacity-50 ${
              pushToTalkEnabled
                ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50"
            }`}
          >
            Push to Talk {pushToTalkEnabled ? "On" : "Off"}
          </button>
          <button
            type="button"
            onClick={() => setShowEndCallConfirm(true)}
            disabled={isEnding || callStatus === "Ended" || controlsLocked}
            className="rounded-2xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-rose-500/20 transition hover:bg-rose-600 disabled:opacity-50"
          >
            {isEnding ? "Ending..." : "End Role Play"}
          </button>
        </div>
        </div>
      </header>

      <main
        className={`mx-auto grid min-h-[calc(100vh-73px)] max-w-7xl grid-cols-1 gap-6 p-6 ${
          guideOpen ? "lg:grid-cols-[minmax(0,1fr)_380px]" : "lg:grid-cols-1"
        }`}
      >
        <section className="flex min-h-[calc(100vh-121px)] flex-col gap-5">
          <div className="grid flex-1 place-items-center overflow-hidden rounded-[2rem] border border-blue-100 bg-white shadow-soft">
            <div className="grid place-items-center p-8 text-center">
              <div className="relative mx-auto h-44 w-44">
                <div
                  className={`absolute inset-0 rounded-[2.75rem] border-[3px] transition-all duration-300 ${
                    aiSpeaking ? "border-emerald-400" : "border-blue-200/80"
                  }`}
                  style={{
                    boxShadow: aiSpeaking
                      ? `0 0 0 ${3 + visualAiVolume * 7}px rgba(52,211,153,${
                          0.16 + visualAiVolume * 0.14
                        })`
                      : "none",
                  }}
                />
                <div className="absolute inset-5 rounded-[2.1rem] border border-cyan-100" />
                <div
                  className="absolute inset-6 flex items-center justify-center rounded-[2rem] bg-[linear-gradient(135deg,#dbeafe,#60a5fa)] text-5xl font-semibold text-white shadow-lg shadow-blue-500/20"
                >
                  {config.character.name.slice(0, 1).toUpperCase()}
                </div>
                <div
                  className={`absolute -bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold shadow-soft transition-all duration-300 ${
                    aiSpeaking
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-500"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full transition-colors duration-300 ${
                      aiSpeaking ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                  />
                  {aiSpeaking ? "Speaking" : "Listening"}
                </div>
              </div>
              <h2 className="mt-8 text-3xl font-semibold tracking-tight text-slate-950">
                {config.character.name}
              </h2>
              <p className="mt-2 text-sm font-medium text-primary">{config.character.role}</p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                {aiSpeaking ? "AI customer speaking" : remoteAudioPublished ? "AI customer listening" : "Waiting for AI audio"}
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-xs font-semibold text-slate-500">
                <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-blue-700">
                  RTC: {connectionState}
                </span>
                <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-blue-700">
                  Agent audio: {remoteAudioPublished ? "published" : "waiting"}
                </span>
                <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-blue-700">
                  Mic:{" "}
                  {pushToTalkEnabled
                    ? isPushToTalkActive
                      ? "live"
                      : "muted until held"
                    : "open"}
                </span>
              </div>
              {pushToTalkEnabled && (
                <div className="mx-auto mt-6 max-w-md rounded-3xl border border-blue-100 bg-blue-50/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
                    Push to Talk
                  </p>
                  <button
                    type="button"
                    disabled={callStatus !== "In Call" || controlsLocked}
                    onPointerDown={() => void setPushToTalkActive(true)}
                    onPointerUp={() => void setPushToTalkActive(false)}
                    onPointerLeave={() => void setPushToTalkActive(false)}
                    onPointerCancel={() => void setPushToTalkActive(false)}
                    onKeyDown={(event) => {
                      if (event.code === "Space" || event.key === "Enter") {
                        event.preventDefault();
                        void setPushToTalkActive(true);
                      }
                    }}
                    onKeyUp={(event) => {
                      if (event.code === "Space" || event.key === "Enter") {
                        event.preventDefault();
                        void setPushToTalkActive(false);
                      }
                    }}
                    className={`relative mt-3 w-full overflow-hidden rounded-2xl border px-5 py-5 text-sm font-semibold shadow-lg transition duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
                      isPushToTalkActive
                        ? "border-emerald-300 bg-emerald-50 text-emerald-950 shadow-emerald-500/15"
                        : "border-blue-200 bg-white text-blue-700 shadow-blue-500/10 hover:bg-blue-50"
                    }`}
                    style={{
                      boxShadow:
                        isPushToTalkActive && traineeSpeaking
                          ? `0 0 0 ${2 + traineeFillLevel * 5}px rgba(52,211,153,${
                              0.12 + traineeFillLevel * 0.12
                            }), 0 16px 34px -24px rgba(15,23,42,0.35)`
                          : undefined,
                    }}
                  >
                    <span
                      className="absolute inset-x-0 bottom-0 h-full origin-bottom bg-[linear-gradient(180deg,rgba(110,231,183,0.55),rgba(16,185,129,0.86))] transition-transform duration-200 ease-out will-change-transform"
                      style={{
                        transform: `scaleY(${traineeFillLevel})`,
                      }}
                    />
                    <span className="relative flex items-center justify-center gap-2">
                      <span
                        className={`h-2.5 w-2.5 rounded-full transition-colors duration-200 ${
                          isPushToTalkActive ? "bg-emerald-600" : "bg-blue-300"
                        }`}
                      />
                      <span className="drop-shadow-[0_1px_0_rgba(255,255,255,0.45)]">
                        {isPushToTalkActive ? "Listening... release to mute" : "Hold to Talk"}
                      </span>
                      {isPushToTalkActive && (
                        <span
                          className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-emerald-800"
                        >
                          {traineeSpeaking ? `${Math.round(traineeFillLevel * 100)}%` : "Ready"}
                        </span>
                      )}
                    </span>
                  </button>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Hold the button while speaking. Release when your turn is done so background
                    noise does not interrupt the AI customer.
                  </p>
                </div>
              )}
              {errorMessage && (
                <div className="mx-auto mt-5 max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  {errorMessage}
                </div>
              )}
              {callStatus !== "In Call" && !isStarting && !sessionEnded && (
                <button
                  type="button"
                  onClick={() => startVoiceRolePlay(config)}
                  className="mt-5 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
                >
                  Start Voice Role Play
                </button>
              )}
            </div>
          </div>

          {captionsOpen && (
            <div className="mt-4 rounded-3xl border border-blue-100 bg-white p-4 shadow-soft">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.2em] text-primary">Closed Captions</p>
                <span className="text-xs font-medium text-slate-500">
                  {normalizedTranscript.length > 0 ? "Live transcript" : "Waiting for transcript"}
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {normalizedTranscript.length > 0
                  ? normalizedTranscript.map((caption) => (
                      <p key={caption.id} className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        <span className="font-semibold text-slate-950">
                          {caption.speaker_type === "customer_ai" ? config.character.name : "Engineer"}:
                        </span>{" "}
                        {caption.text}
                      </p>
                    ))
                  : fallbackCaptions.map((caption, index) => (
                      <p key={`${caption.speaker}-${index}`} className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        <span className="font-semibold text-slate-950">{caption.speaker}:</span>{" "}
                        {caption.text}
                      </p>
                    ))}
              </div>
            </div>
          )}

        </section>

        {guideOpen && (
          <aside className="w-full rounded-3xl border border-blue-100 bg-white p-5 shadow-soft lg:w-96">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-950">Role play guide</h2>
              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-500 transition hover:bg-blue-50"
              >
                Close
              </button>
            </div>
            <div className="mt-5 space-y-5">
              <section>
                <p className="text-xs uppercase tracking-[0.2em] text-primary">Scenario</p>
                <p className="mt-2 rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                  {config.plan.scenario}
                </p>
              </section>
              <section>
                <p className="text-xs uppercase tracking-[0.2em] text-primary">AI Character</p>
                <p className="mt-2 text-sm font-semibold text-slate-950">{config.character.name}</p>
                <p className="text-sm font-medium text-blue-700">{config.character.role}</p>
                <p className="mt-2 rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                  {config.character.personalityBackground}
                </p>
              </section>
              <section>
                <p className="text-xs uppercase tracking-[0.2em] text-primary">Learner Goals</p>
                <div className="mt-3 space-y-2">
                  {learnerGoals.map((goal) => (
                    <div key={goal.id} className="rounded-2xl border border-blue-100 bg-blue-50/50 p-3">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-blue-200 bg-white text-xs font-semibold text-blue-700">
                          {goal.required ? "R" : "O"}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-slate-950">{goal.label}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {goal.required ? "Required" : "Optional"} guide item
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 rounded-2xl border border-blue-100 bg-white p-3 text-xs font-medium text-slate-500">
                  These goals are guidance during the call. The final assessment validates
                  objective coverage from the full transcript after the session ends.
                </div>
              </section>
            </div>
          </aside>
        )}
      </main>
    </div>
  );
}
