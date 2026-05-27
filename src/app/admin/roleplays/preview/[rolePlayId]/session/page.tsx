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
import type { MatchedObjective, Objective, TranscriptEntry } from "@/src/lib/objectives/types";
import type { RolePlayConfig } from "@/src/lib/roleplays/types";

const storagePrefix = "cse-roleplay-config";

type CallStatus = "Preparing" | "Connecting" | "In Call" | "Ended";

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

const objectiveTurnEndDelayMs = 1400;
const sessionEvaluatorGuard =
  "Evaluate only the learner/engineer's responses. Determine whether the latest engineer message satisfies any incomplete learner goals. Use recent engineer transcript only as context for the same learner turn. Do not evaluate customer_ai messages. Only mark a goal complete if the learner clearly covered it, even if the wording is not an exact match. Use exact evidence from the engineer response. Return strict JSON only.";

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

function objectiveEvalEntryKey(entry: NormalizedTranscript) {
  return `${entry.id}::${entry.timestamp}::${entry.text}`;
}

function buildEvaluatorPrompt(prompt: string) {
  return [prompt.trim(), sessionEvaluatorGuard].filter(Boolean).join("\n\n");
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
        "You are Morgan Lee, an enterprise customer escalation contact. You are the customer/persona in the role play, not the engineer. Stay in character, speak in first person, and do not act as coach, evaluator, assistant, or support engineer.",
      greeting_message: "Can we please get this issue moving today?",
      greeting_message_switch: "single_first",
      delay_ms: 800,
    },
  };
}

export default function RolePlayPreviewSessionPage() {
  const router = useRouter();
  const params = useParams<{ rolePlayId: string }>();
  const rolePlayId = params.rolePlayId;
  const [config, setConfig] = useState<RolePlayConfig | null>(null);
  const [guideOpen, setGuideOpen] = useState(true);
  const [captionsOpen, setCaptionsOpen] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [callStatus, setCallStatus] = useState<CallStatus>("Preparing");
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [connectionState, setConnectionState] = useState("DISCONNECTED");
  const [remoteAudioPublished, setRemoteAudioPublished] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [startResponse, setStartResponse] = useState<StartResponse | null>(null);
  const [normalizedTranscript, setNormalizedTranscript] = useState<NormalizedTranscript[]>([]);
  const [learnerGoals, setLearnerGoals] = useState<Objective[]>([]);
  const [isEvaluatingObjectives, setIsEvaluatingObjectives] = useState(false);
  const [objectiveEvalError, setObjectiveEvalError] = useState<string | null>(null);
  const [objectiveEvalTick, setObjectiveEvalTick] = useState(0);
  const startAttemptedRef = useRef(false);
  const agentIdRef = useRef<string | null>(null);
  const transcriptContextRef = useRef<{ traineeUid?: string; agentUid?: string }>({});
  const rtcClientRef = useRef<IAgoraRTCClient | null>(null);
  const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const remoteAudioTrackRef = useRef<IRemoteAudioTrack | null>(null);
  const transcriptChunkCacheRef = useRef<
    Map<string, { parts: Map<number, string>; partSum: number }>
  >(new Map());
  const transcriptItemMapRef = useRef<Map<string, ToolkitTranscriptItem>>(new Map());
  const finalizedTranscriptKeysRef = useRef<Set<string>>(new Set());
  const evaluatedEngineerEntryIdsRef = useRef<Set<string>>(new Set());
  const objectiveEvalTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!rolePlayId) return;
    // TODO: Replace localStorage lookup with persisted role play config fetch.
    const stored = localStorage.getItem(`${storagePrefix}:${rolePlayId}`);
    const nextConfig = stored ? (JSON.parse(stored) as RolePlayConfig) : fallbackConfig(rolePlayId);
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
  }, [rolePlayId]);

  useEffect(() => {
    if (sessionEnded) return;
    const interval = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [sessionEnded]);

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

  function scheduleObjectiveEvalRetry(waitMs: number) {
    if (objectiveEvalTimerRef.current) {
      window.clearTimeout(objectiveEvalTimerRef.current);
      objectiveEvalTimerRef.current = null;
    }
    objectiveEvalTimerRef.current = window.setTimeout(() => {
      setObjectiveEvalTick((current) => current + 1);
    }, Math.max(100, waitMs));
  }

  function clearObjectiveEvalRetry() {
    if (objectiveEvalTimerRef.current) {
      window.clearTimeout(objectiveEvalTimerRef.current);
      objectiveEvalTimerRef.current = null;
    }
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

  function mergeObjectiveMatches(matches: MatchedObjective[]) {
    if (matches.length === 0) {
      return;
    }

    const matchedById = new Map(matches.map((match) => [match.id, match]));
    setLearnerGoals((current) =>
      current.map((goal) => {
        const matched = matchedById.get(goal.id);
        if (!matched) {
          return goal;
        }

        return {
          ...goal,
          completed: true,
          completedAt: goal.completedAt ?? new Date().toISOString(),
          confidence: matched.confidence,
          evidence: matched.evidence,
        };
      }),
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

    setIsStarting(true);
    setErrorMessage(null);
    setCallStatus("Connecting");
    setNormalizedTranscript([]);
    resetLearnerGoals(activeConfig);
    setObjectiveEvalError(null);
    setIsEvaluatingObjectives(false);
    clearObjectiveEvalRetry();
    transcriptChunkCacheRef.current.clear();
    transcriptItemMapRef.current.clear();
    finalizedTranscriptKeysRef.current.clear();
    evaluatedEngineerEntryIdsRef.current.clear();
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

      client.on("connection-state-change", (currentState) => {
        setConnectionState(currentState);
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
      await client.publish([microphoneTrack]);
      setCallStatus("In Call");
    } catch (error) {
      setCallStatus("Preparing");
      setErrorMessage(error instanceof Error ? error.message : "Unable to start role play.");
      await cleanupVoiceRolePlay(false);
    } finally {
      setIsStarting(false);
    }
  }

  async function cleanupVoiceRolePlay(callEndApi: boolean) {
    if (localAudioTrackRef.current) {
      localAudioTrackRef.current.stop();
      localAudioTrackRef.current.close();
      localAudioTrackRef.current = null;
    }

    remoteAudioTrackRef.current = null;
    setRemoteAudioPublished(false);

    if (rtcClientRef.current) {
      await rtcClientRef.current.leave().catch(() => undefined);
      rtcClientRef.current.removeAllListeners();
      rtcClientRef.current = null;
      setConnectionState("DISCONNECTED");
    }

    transcriptChunkCacheRef.current.clear();
    transcriptItemMapRef.current.clear();
    finalizedTranscriptKeysRef.current.clear();
    evaluatedEngineerEntryIdsRef.current.clear();
    clearObjectiveEvalRetry();

    if (callEndApi && agentIdRef.current) {
      await fetch("/api/convoai/end", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agent_id: agentIdRef.current,
        }),
      }).catch(() => undefined);
      agentIdRef.current = null;
    }
  }

  async function endVoiceRolePlay() {
    if (isEnding) return;
    setIsEnding(true);
    await cleanupVoiceRolePlay(true);
    setCallStatus("Ended");
    setSessionEnded(true);
    setIsEnding(false);
  }

  useEffect(() => {
    if (!config || callStatus !== "In Call" || isEvaluatingObjectives) {
      clearObjectiveEvalRetry();
      return;
    }

    const incompleteObjectives = learnerGoals.filter(
      (goal) => !goal.completed && goal.label.trim(),
    );
    if (incompleteObjectives.length === 0) {
      clearObjectiveEvalRetry();
      return;
    }

    const pendingEngineerEntries = normalizedTranscript.filter(
      (entry) =>
        entry.speaker_type === "engineer" &&
        !evaluatedEngineerEntryIdsRef.current.has(objectiveEvalEntryKey(entry)),
    );
    if (pendingEngineerEntries.length === 0) {
      clearObjectiveEvalRetry();
      return;
    }

    const latestEngineerEntry = pendingEngineerEntries[pendingEngineerEntries.length - 1];
    const latestTranscriptEntry = normalizedTranscript[normalizedTranscript.length - 1];
    const engineerTimestampMs = Date.parse(latestEngineerEntry.timestamp);
    const latestTimestampMs = latestTranscriptEntry
      ? Date.parse(latestTranscriptEntry.timestamp)
      : Number.NaN;
    const turnEndedByCustomerAi =
      latestTranscriptEntry?.speaker_type === "customer_ai" &&
      Number.isFinite(engineerTimestampMs) &&
      Number.isFinite(latestTimestampMs) &&
      latestTimestampMs >= engineerTimestampMs;
    const silenceSinceEngineerMs = Number.isFinite(engineerTimestampMs)
      ? Date.now() - engineerTimestampMs
      : 0;
    const turnEndedBySilence = silenceSinceEngineerMs >= objectiveTurnEndDelayMs;
    const toolkitMarkedFinal = latestEngineerEntry.is_final;

    if (!toolkitMarkedFinal && !turnEndedByCustomerAi && !turnEndedBySilence) {
      scheduleObjectiveEvalRetry(objectiveTurnEndDelayMs - silenceSinceEngineerMs);
      return;
    }

    clearObjectiveEvalRetry();
    const latestEngineerEvalKey = objectiveEvalEntryKey(latestEngineerEntry);
    evaluatedEngineerEntryIdsRef.current.add(latestEngineerEvalKey);
    setIsEvaluatingObjectives(true);
    setObjectiveEvalError(null);

    const recentTranscript: TranscriptEntry[] = normalizedTranscript.slice(-16).map((entry) => ({
      id: entry.id,
      speaker_type: entry.speaker_type,
      speaker_id: entry.speaker_id,
      text: entry.text,
      timestamp: entry.timestamp,
    }));

    void fetch("/api/objectives/evaluate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        scenarioId: config.id,
        evaluator_prompt: buildEvaluatorPrompt(config.settings.evaluatorPrompt),
        latestEngineerMessage: latestEngineerEntry.text,
        incompleteObjectives,
        recentTranscript,
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: string; details?: unknown }
            | null;
          const details =
            typeof payload?.details === "string"
              ? payload.details
              : payload?.details
                ? JSON.stringify(payload.details)
                : "";
          throw new Error(
            [payload?.error ?? `Objective evaluator failed with HTTP ${response.status}.`, details]
              .filter(Boolean)
              .join(" "),
          );
        }
        return (await response.json()) as { matchedObjectives?: MatchedObjective[] };
      })
      .then((payload) => {
        const matchedObjectives = Array.isArray(payload.matchedObjectives)
          ? payload.matchedObjectives
          : [];
        mergeObjectiveMatches(matchedObjectives);
      })
      .catch((error) => {
        evaluatedEngineerEntryIdsRef.current.delete(latestEngineerEvalKey);
        setObjectiveEvalError(
          error instanceof Error
            ? error.message
            : "Unable to evaluate learner goal coverage for the latest response.",
        );
      })
      .finally(() => {
        setIsEvaluatingObjectives(false);
      });
  }, [
    callStatus,
    config,
    isEvaluatingObjectives,
    learnerGoals,
    normalizedTranscript,
    objectiveEvalTick,
  ]);

  useEffect(() => {
    if (!config || startAttemptedRef.current) return;
    startAttemptedRef.current = true;
    void startVoiceRolePlay(config);
  }, [config]);

  useEffect(() => {
    return () => {
      clearObjectiveEvalRetry();
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
        text: "TODO: Wire this view to ConvoAI toolkit transcript events for live roleplay captions.",
      },
    ];
  }, [config]);

  if (!config) {
    return (
      <div className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
        <div className="mx-auto max-w-6xl text-sm text-slate-300">Loading session...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-slate-950 px-6 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Role Play Test Session</p>
          <h1 className="mt-1 text-lg font-semibold">{config.settings.meetingTitle}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
            {formatTime(elapsedSeconds)}
          </span>
          <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
            {callStatus}
          </span>
          <button
            type="button"
            onClick={() => setGuideOpen((current) => !current)}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
          >
            Guide
          </button>
          <button
            type="button"
            onClick={() => setCaptionsOpen((current) => !current)}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
          >
            Closed Captions
          </button>
          <button
            type="button"
            onClick={endVoiceRolePlay}
            disabled={isEnding || callStatus === "Ended"}
            className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-400"
          >
            {isEnding ? "Ending..." : "End Role Play"}
          </button>
        </div>
      </header>

      <main className="grid min-h-[calc(100vh-73px)] grid-cols-1 lg:grid-cols-[1fr_auto]">
        <section className="flex flex-col p-6">
          <div className="grid flex-1 place-items-center rounded-lg border border-white/10 bg-slate-900">
            <div className="text-center">
              <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-cyan-300 text-4xl font-semibold text-slate-950">
                {config.character.name.slice(0, 1).toUpperCase()}
              </div>
              <h2 className="mt-5 text-2xl font-semibold">{config.character.name}</h2>
              <p className="mt-2 text-sm text-cyan-200">{config.character.role}</p>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-300">
                {callStatus === "In Call"
                  ? `Joined RTC channel ${startResponse?.channelName ?? ""}. Speak as the learner and listen for the AI character response.`
                  : "Starting the ConvoAI role play and joining the learner to the same RTC channel."}
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-xs text-slate-400">
                <span>RTC: {connectionState}</span>
                <span>Agent audio: {remoteAudioPublished ? "published" : "waiting"}</span>
              </div>
              {errorMessage && (
                <div className="mx-auto mt-5 max-w-xl rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">
                  {errorMessage}
                </div>
              )}
              {callStatus !== "In Call" && !isStarting && !sessionEnded && (
                <button
                  type="button"
                  onClick={() => startVoiceRolePlay(config)}
                  className="mt-5 rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
                >
                  Start Voice Role Play
                </button>
              )}
            </div>
          </div>

          {captionsOpen && (
            <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Closed Captions</p>
                <span className="text-xs text-slate-500">
                  {normalizedTranscript.length > 0 ? "ConvoAI toolkit transcript" : "Waiting for transcript"}
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {normalizedTranscript.length > 0
                  ? normalizedTranscript.map((caption) => (
                      <p key={caption.id} className="text-sm text-slate-300">
                        <span className="font-semibold text-white">
                          {caption.speaker_type === "customer_ai" ? config.character.name : "Engineer"}:
                        </span>{" "}
                        {caption.text}
                      </p>
                    ))
                  : fallbackCaptions.map((caption, index) => (
                      <p key={`${caption.speaker}-${index}`} className="text-sm text-slate-300">
                        <span className="font-semibold text-white">{caption.speaker}:</span>{" "}
                        {caption.text}
                      </p>
                    ))}
              </div>
            </div>
          )}

          {sessionEnded && (
            <div className="mt-4 rounded-lg border border-emerald-300/30 bg-emerald-300/10 p-4">
              <p className="text-sm font-semibold text-emerald-100">Role play ended</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/admin/roleplays/preview/${config.id}`}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-100 hover:bg-white/10"
                >
                  Back to Preview
                </Link>
                <button
                  type="button"
                  onClick={() => router.push("/courses")}
                  className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
                >
                  Return to Courses
                </button>
              </div>
            </div>
          )}
        </section>

        {guideOpen && (
          <aside className="w-full border-l border-white/10 bg-slate-900 p-5 lg:w-96">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Role play guide</h2>
              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                className="rounded-md border border-white/10 px-3 py-1 text-sm text-slate-300 hover:bg-white/10"
              >
                Close
              </button>
            </div>
            <div className="mt-5 space-y-5">
              <section>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Scenario</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{config.plan.scenario}</p>
              </section>
              <section>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">AI Character</p>
                <p className="mt-2 text-sm font-semibold text-white">{config.character.name}</p>
                <p className="text-sm text-cyan-200">{config.character.role}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {config.character.personalityBackground}
                </p>
              </section>
              <section>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Learner Goals</p>
                <div className="mt-3 space-y-2">
                  {learnerGoals.map((goal) => (
                    <div key={goal.id} className="rounded-lg border border-white/10 bg-slate-950 p-3">
                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border text-xs ${
                            goal.completed
                              ? "border-emerald-300 bg-emerald-300 text-slate-950"
                              : "border-slate-600 text-slate-500"
                          }`}
                        >
                          {goal.completed ? "✓" : ""}
                        </span>
                        <div>
                          <p className="text-sm text-white">{goal.label}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {goal.required ? "Required" : "Optional"} ·{" "}
                            {goal.completed ? "Covered" : "Not covered yet"}
                          </p>
                          {goal.completed && (
                            <div className="mt-2 rounded-md border border-emerald-300/20 bg-emerald-300/10 p-2 text-xs text-emerald-100">
                              {goal.evidence && <p>Evidence: “{goal.evidence}”</p>}
                              {typeof goal.confidence === "number" && (
                                <p className="mt-1 text-emerald-200/80">
                                  Confidence: {Math.round(goal.confidence * 100)}%
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-slate-400">
                  {isEvaluatingObjectives
                    ? "Checking latest engineer response against learner goals..."
                    : `${learnerGoals.filter((goal) => goal.completed).length}/${learnerGoals.length} goals covered`}
                  {objectiveEvalError && (
                    <p className="mt-2 text-amber-200">{objectiveEvalError}</p>
                  )}
                </div>
              </section>
            </div>
          </aside>
        )}
      </main>
    </div>
  );
}
