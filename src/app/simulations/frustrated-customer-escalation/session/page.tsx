"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type {
  IAgoraRTCClient,
  IMicrophoneAudioTrack,
  IRemoteAudioTrack,
} from "agora-rtc-sdk-ng";

type CallStatus = "Waiting" | "Connecting" | "In Call" | "Muted" | "Ended";

type StartResponse = {
  status: string;
  agentId: string;
  createTs: number | null;
  channelName: string;
  traineeUid: string;
  agentUid: string;
  engineerRtc: {
    appId: string;
    channelName: string;
    uid: string;
    token: string;
  };
  configSummary: {
    greeting_message_switch: string;
    delay_ms: number;
    llmProvider: string | null;
    llmPreset?: string;
    asrProvider: string | null;
    asrLanguage?: string;
    ttsProvider: string | null;
    ttsModel?: string;
    appIdConfigured: boolean;
    rtcTokenGenerated: boolean;
    tokenVersion: string;
    baseUrl: string;
  };
};

type TranscriptItem = {
  id: string;
  speaker: "System" | "Engineer" | "AI Customer";
  message: string;
  time: string;
};

const fixedGreetingSwitch = "single_first";
const fixedDelayMs = 1200;
const quietMeterLevels = [7, 9, 11, 12, 13, 12, 11, 9, 7];
const engineerMeterProfile = [0.45, 0.62, 0.82, 0.95, 1, 0.95, 0.82, 0.62, 0.45];
const agentMeterProfile = [0.5, 0.68, 0.86, 0.97, 1, 0.97, 0.86, 0.68, 0.5];

const initialTranscript: TranscriptItem[] = [
  {
    id: "t-1",
    speaker: "System",
    time: "00:00",
    message: "Sample session ready. Configure the prompt and join when you want to test the UI flow.",
  },
];

function formatClock(value: number) {
  return value.toString().padStart(2, "0");
}

function sessionTimestamp() {
  const now = new Date();
  return `${formatClock(now.getMinutes())}:${formatClock(now.getSeconds())}`;
}

function buildMeterLevels(level: number, profile: number[]) {
  const intensity = Math.pow(Math.max(0, Math.min(1, level)), 0.72);
  return profile.map((weight) => Math.round(7 + intensity * 46 * weight));
}

export default function FrustratedCustomerEscalationSessionPage() {
  const [systemMessage, setSystemMessage] = useState(
    "You are a frustrated enterprise customer whose production support case has bounced between teams. Challenge vague troubleshooting, demand ownership, and respond more positively when the engineer is calm, specific, and accountable.",
  );
  const [greetingMessage, setGreetingMessage] = useState(
    "I have already repeated this issue three times. Why is nobody actually fixing it?",
  );
  const [status, setStatus] = useState<CallStatus>("Waiting");
  const [isMuted, setIsMuted] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [engineerLevels, setEngineerLevels] = useState(quietMeterLevels);
  const [agentLevels, setAgentLevels] = useState(quietMeterLevels);
  const [startResponse, setStartResponse] = useState<StartResponse | null>(null);
  const [transcript, setTranscript] = useState<TranscriptItem[]>(initialTranscript);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState("DISCONNECTED");
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [remoteAudioPublished, setRemoteAudioPublished] = useState(false);
  const rtcClientRef = useRef<IAgoraRTCClient | null>(null);
  const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const remoteAudioTrackRef = useRef<IRemoteAudioTrack | null>(null);
  const remotePublishWatchdogRef = useRef<number | null>(null);
  const agentIdRef = useRef<string | null>(null);
  const engineerEnvelopeRef = useRef(0);
  const agentEnvelopeRef = useRef(0);
  const agentIdleWaveRef = useRef(0);

  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID ?? "";
  const isActiveCall = status === "In Call" || status === "Muted";

  useEffect(() => {
    if (!isActiveCall) {
      engineerEnvelopeRef.current = 0;
      agentEnvelopeRef.current = 0;
      setIsAiSpeaking(false);
      setEngineerLevels(quietMeterLevels);
      setAgentLevels(quietMeterLevels);
      return;
    }

    const interval = window.setInterval(() => {
      const localRaw = status === "Muted" ? 0 : localAudioTrackRef.current?.getVolumeLevel() ?? 0;
      const localGated = localRaw < 0.045 ? 0 : localRaw;
      const localPrev = engineerEnvelopeRef.current;
      const localNext =
        localGated > localPrev
          ? localPrev * 0.42 + localGated * 0.58
          : localPrev * 0.9 + localGated * 0.1;
      engineerEnvelopeRef.current = localNext;
      setEngineerLevels(buildMeterLevels(localNext, engineerMeterProfile));

      const remoteRaw = remoteAudioTrackRef.current?.getVolumeLevel() ?? 0;
      const remoteGated = remoteRaw < 0.03 ? 0 : remoteRaw;
      agentIdleWaveRef.current += 0.22;
      const breathingFallback =
        remoteAudioTrackRef.current || status === "Muted"
          ? 0
          : 0.01 + (Math.sin(agentIdleWaveRef.current) + 1) * 0.007;
      const remoteInput = remoteGated || breathingFallback;
      const remotePrev = agentEnvelopeRef.current;
      const remoteNext =
        remoteInput > remotePrev
          ? remotePrev * 0.45 + remoteInput * 0.55
          : remotePrev * 0.88 + remoteInput * 0.12;

      agentEnvelopeRef.current = remoteNext;
      setAgentLevels(buildMeterLevels(remoteNext, agentMeterProfile));
      setIsAiSpeaking(remoteNext > 0.055);
    }, 90);

    return () => window.clearInterval(interval);
  }, [isActiveCall, status]);

  const statusTone = useMemo(() => {
    switch (status) {
      case "Connecting":
        return "border-amber-400/30 bg-amber-400/10 text-amber-200";
      case "In Call":
        return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
      case "Muted":
        return "border-rose-400/30 bg-rose-400/10 text-rose-200";
      case "Ended":
        return "border-slate-500/30 bg-slate-500/10 text-slate-300";
      default:
        return "border-sky-400/30 bg-sky-400/10 text-sky-200";
    }
  }, [status]);

  async function joinCall() {
    if (isJoining) return;

    setIsJoining(true);
    setStatus("Connecting");
    setErrorMessage(null);
    setAutoplayBlocked(false);
    setRemoteAudioPublished(false);

    try {
      const response = await fetch("/api/convoai/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          system_message: systemMessage,
          greeting_message: greetingMessage,
          greeting_message_switch: fixedGreetingSwitch,
          delay_ms: fixedDelayMs,
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
          [
            payload?.error ?? `Unable to start ConvoAI session. HTTP ${response.status}.`,
            detailText,
          ]
            .filter(Boolean)
            .join(" "),
        );
      }

      const data: StartResponse = await response.json();
      agentIdRef.current = data.agentId;
      const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
      AgoraRTC.onAutoplayFailed = () => {
        setAutoplayBlocked(true);
      };
      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      rtcClientRef.current = client;

      client.on("connection-state-change", (currentState) => {
        setConnectionState(currentState);
      });

      client.on("user-published", async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        if (mediaType === "audio") {
          if (user.audioTrack) {
            remoteAudioTrackRef.current = user.audioTrack;
            user.audioTrack.setVolume(100);
            user.audioTrack.play();
            setRemoteAudioPublished(true);
            if (remotePublishWatchdogRef.current) {
              window.clearTimeout(remotePublishWatchdogRef.current);
              remotePublishWatchdogRef.current = null;
            }
          }
          setTranscript((current) => [
            ...current,
            {
              id: crypto.randomUUID(),
              speaker: "System",
              time: sessionTimestamp(),
              message: `Remote audio published by UID ${String(user.uid)}.`,
            },
          ]);
        }
      });

      client.on("user-unpublished", (user, mediaType) => {
        if (mediaType === "audio" && String(user.uid) === String(data.agentUid)) {
          remoteAudioTrackRef.current = null;
          setRemoteAudioPublished(false);
        }
      });

      const [joinedUid, microphoneTrack] = await Promise.all([
        client.join(
          data.engineerRtc.appId,
          data.engineerRtc.channelName,
          data.engineerRtc.token || null,
          Number(data.engineerRtc.uid),
        ),
        AgoraRTC.createMicrophoneAudioTrack(),
      ]);

      localAudioTrackRef.current = microphoneTrack;
      await client.publish([microphoneTrack]);

      setStartResponse(data);
      setStatus("In Call");
      setIsMuted(false);
      setTranscript([
        ...initialTranscript,
        {
          id: crypto.randomUUID(),
          speaker: "System",
          time: sessionTimestamp(),
          message: `Joined RTC channel ${data.channelName} as engineer UID ${joinedUid}. Agora ConvoAI agent ${data.agentId} is running on UID ${data.agentUid}.`,
        },
        {
          id: crypto.randomUUID(),
          speaker: "AI Customer",
          time: sessionTimestamp(),
          message: greetingMessage,
        },
      ]);
      remotePublishWatchdogRef.current = window.setTimeout(() => {
        if (!remoteAudioTrackRef.current) {
          setTranscript((current) => [
            ...current,
            {
              id: crypto.randomUUID(),
              speaker: "System",
              time: sessionTimestamp(),
              message:
                "No agent audio track published yet. If this persists, check the ConvoAI start error/details.",
            },
          ]);
        }
      }, 9000);
    } catch (error) {
      setStatus("Waiting");
      setErrorMessage(
        error instanceof Error ? error.message : "Unknown error starting session.",
      );
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.stop();
        localAudioTrackRef.current.close();
        localAudioTrackRef.current = null;
      }
      remoteAudioTrackRef.current = null;
      setRemoteAudioPublished(false);
      if (remotePublishWatchdogRef.current) {
        window.clearTimeout(remotePublishWatchdogRef.current);
        remotePublishWatchdogRef.current = null;
      }
      if (rtcClientRef.current) {
        await rtcClientRef.current.leave().catch(() => undefined);
        rtcClientRef.current.removeAllListeners();
        rtcClientRef.current = null;
        setConnectionState("DISCONNECTED");
      }
      if (agentIdRef.current) {
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
      setTranscript((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          speaker: "System",
          time: sessionTimestamp(),
          message: error instanceof Error ? error.message : "Unknown error starting session.",
        },
      ]);
    } finally {
      setIsJoining(false);
    }
  }

  async function endCall() {
    if (isEnding || status === "Waiting" || status === "Ended") return;

    setIsEnding(true);

    try {
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.stop();
        localAudioTrackRef.current.close();
        localAudioTrackRef.current = null;
      }
      remoteAudioTrackRef.current = null;
      setRemoteAudioPublished(false);
      if (remotePublishWatchdogRef.current) {
        window.clearTimeout(remotePublishWatchdogRef.current);
        remotePublishWatchdogRef.current = null;
      }

      if (rtcClientRef.current) {
        await rtcClientRef.current.leave();
        rtcClientRef.current.removeAllListeners();
        rtcClientRef.current = null;
        setConnectionState("DISCONNECTED");
      }

      await fetch("/api/convoai/end", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agent_id: agentIdRef.current,
        }),
      });
      agentIdRef.current = null;

      setStatus("Ended");
      setIsMuted(false);
      setIsAiSpeaking(false);
      setEngineerLevels(quietMeterLevels);
      setAgentLevels(quietMeterLevels);
      setTranscript((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          speaker: "System",
          time: sessionTimestamp(),
          message: "ConvoAI session ended.",
        },
      ]);
    } finally {
      setIsEnding(false);
    }
  }

  async function toggleMute() {
    if (!isActiveCall || !localAudioTrackRef.current) return;

    const next = !isMuted;
    await localAudioTrackRef.current.setMuted(next);
    setIsMuted(next);
    setStatus(next ? "Muted" : "In Call");
  }

  useEffect(() => {
    return () => {
      void (async () => {
        if (localAudioTrackRef.current) {
          localAudioTrackRef.current.stop();
          localAudioTrackRef.current.close();
          localAudioTrackRef.current = null;
        }
        remoteAudioTrackRef.current = null;
        setRemoteAudioPublished(false);
        if (remotePublishWatchdogRef.current) {
          window.clearTimeout(remotePublishWatchdogRef.current);
          remotePublishWatchdogRef.current = null;
        }

        if (rtcClientRef.current) {
          await rtcClientRef.current.leave().catch(() => undefined);
          rtcClientRef.current.removeAllListeners();
          rtcClientRef.current = null;
        }

        if (agentIdRef.current) {
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
      })();
    };
  }, []);

  function resumeAgentAudio() {
    if (!remoteAudioTrackRef.current) return;
    remoteAudioTrackRef.current.play();
    setAutoplayBlocked(false);
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#0f172a_52%,_#020617_100%)] px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-[0_30px_80px_-40px_rgba(56,189,248,0.45)] backdrop-blur-xl">
          <div className="flex flex-col gap-3 border-b border-white/10 pb-5">
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">Agora ConvoAI Sample</p>
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              Frustrated Customer Escalation Session
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-300">
              This sample keeps all secrets on the server, sends the session inputs to
              `/api/convoai/start`, joins the browser into the RTC channel as the engineer, and
              still uses mock AI speaking animation for now.
            </p>
          </div>

          {(!appId || errorMessage) && (
            <div className="mt-6 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-100">
              {!appId && (
                <p>
                  `NEXT_PUBLIC_AGORA_APP_ID` is not available in the client. Add it to `.env.local`
                  and restart `npm run dev`.
                </p>
              )}
              {errorMessage && <p className={!appId ? "mt-2" : ""}>{errorMessage}</p>}
            </div>
          )}

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-200">system_message</span>
              <textarea
                value={systemMessage}
                onChange={(event) => setSystemMessage(event.target.value)}
                rows={6}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/30"
              />
            </label>

            <div className="grid gap-4">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">greeting_message</span>
                <textarea
                  value={greetingMessage}
                  onChange={(event) => setGreetingMessage(event.target.value)}
                  rows={4}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/30"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                    greeting_message_switch
                  </p>
                  <p className="mt-3 text-sm font-medium text-cyan-200">{fixedGreetingSwitch}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">delay_ms</p>
                  <p className="mt-3 text-sm font-medium text-cyan-200">{fixedDelayMs}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-[30px] border border-white/10 bg-slate-950/70 p-6 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.95)] backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div className="flex items-center gap-3">
                <span className={`rounded-full border px-3 py-1 text-sm font-medium ${statusTone}`}>
                  Status: {status}
                </span>
                <span className="text-sm text-slate-400">
                  {appId ? "Agora App ID detected in client env" : "NEXT_PUBLIC_AGORA_APP_ID not set"}
                </span>
                <span className="text-sm text-slate-500">RTC: {connectionState}</span>
                <span className="text-sm text-slate-500">
                  Agent Audio: {remoteAudioPublished ? "Published" : "Waiting"}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={joinCall}
                  disabled={isJoining || isActiveCall}
                  className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-cyan-400/40 disabled:text-slate-300"
                >
                  {isJoining ? "Connecting..." : "Join Call"}
                </button>
                <button
                  type="button"
                  onClick={endCall}
                  disabled={isEnding || status === "Waiting" || status === "Ended"}
                  className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isEnding ? "Ending..." : "End Call"}
                </button>
              </div>
            </div>

            {autoplayBlocked && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-amber-300/35 bg-amber-300/10 px-4 py-3">
                <p className="text-sm text-amber-100">
                  Browser blocked remote autoplay.
                </p>
                <button
                  type="button"
                  onClick={resumeAgentAudio}
                  className="rounded-xl bg-amber-300 px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-amber-200"
                >
                  Resume Agent Audio
                </button>
              </div>
            )}

            <div className="flex min-h-[520px] flex-col items-center justify-between py-10">
              <div className="text-center">
                <p className="text-xs uppercase tracking-[0.26em] text-slate-500">AI Customer</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Escalated Enterprise Caller</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Mock voice presence with animated orb and call state controls
                </p>
              </div>

              <div className="relative flex items-center justify-center py-10">
                <div
                  className={`absolute h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl transition-all duration-500 ${
                    isAiSpeaking ? "scale-110 opacity-100" : "scale-90 opacity-60"
                  }`}
                />
                <div
                  className={`relative flex h-52 w-52 items-center justify-center rounded-full border border-cyan-300/30 bg-[radial-gradient(circle_at_30%_30%,_rgba(125,211,252,0.95),_rgba(6,182,212,0.55)_42%,_rgba(14,116,144,0.18)_76%,_transparent_100%)] shadow-[0_0_60px_rgba(34,211,238,0.28)] transition-all duration-500 ${
                    isAiSpeaking ? "scale-105 shadow-[0_0_90px_rgba(34,211,238,0.42)]" : ""
                  }`}
                >
                  <div
                    className={`absolute inset-3 rounded-full border border-white/15 ${
                      isAiSpeaking ? "animate-ping" : ""
                    }`}
                  />
                  <div className="text-center">
                    <p className="text-xs uppercase tracking-[0.26em] text-slate-900/70">AI Voice</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">Customer</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-4">
                <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/5 px-4 py-3">
                  <p className="mb-2 text-center text-[10px] uppercase tracking-[0.2em] text-cyan-200/80">
                    AI Level
                  </p>
                  <div className="flex items-end gap-1">
                    {agentLevels.map((height, index) => (
                      <span
                        key={`agent-${height}-${index}`}
                        className={`inline-block w-1.5 rounded-full transition-[height,opacity,background-color] duration-220 ${
                          isAiSpeaking ? "bg-cyan-200 opacity-100" : "bg-cyan-500/50 opacity-75"
                        }`}
                        style={{ height: `${height}px` }}
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={toggleMute}
                  disabled={!isActiveCall}
                  className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                    isMuted
                      ? "bg-rose-500 text-white hover:bg-rose-400"
                      : "bg-white/10 text-white hover:bg-white/15"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {isMuted ? "Unmute" : "Mute"}
                </button>

                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="mb-2 text-center text-[10px] uppercase tracking-[0.2em] text-slate-300/80">
                    Engineer Level
                  </p>
                  <div className="flex items-end gap-1">
                  {engineerLevels.map((height, index) => (
                    <span
                      key={`engineer-${height}-${index}`}
                      className={`inline-block w-1.5 rounded-full transition-[height,opacity,background-color] duration-220 ${
                        isMuted ? "opacity-35" : "opacity-100"
                      } ${
                        isMuted
                          ? "bg-slate-500/90"
                          : height > 26
                            ? "bg-cyan-300"
                            : "bg-slate-500"
                      }`}
                      style={{ height: `${height}px` }}
                    />
                  ))}
                </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
              <p className="text-xs uppercase tracking-[0.26em] text-slate-500">Session Details</p>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <p className="text-slate-500">Channel</p>
                  <p className="mt-2 font-medium text-white">
                    {startResponse?.channelName ?? "Not started"}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                    <p className="text-slate-500">Trainee UID</p>
                    <p className="mt-2 font-medium text-white">
                      {startResponse?.traineeUid ?? "--"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                    <p className="text-slate-500">Agent UID</p>
                    <p className="mt-2 font-medium text-white">
                      {startResponse?.agentUid ?? "--"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.26em] text-slate-500">Mock Transcript</p>
                <span className="text-xs text-slate-500">{transcript.length} events</span>
              </div>
              <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1">
                {transcript.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white">{item.speaker}</p>
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{item.time}</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{item.message}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-cyan-400/15 bg-cyan-400/5 p-5">
              <p className="text-xs uppercase tracking-[0.26em] text-cyan-300">Config Summary</p>
              <div className="mt-4 space-y-2 text-sm text-slate-300">
                <p>greeting_message_switch: {fixedGreetingSwitch}</p>
                <p>delay_ms: {fixedDelayMs}</p>
                <p>ASR provider: {startResponse?.configSummary.asrProvider ?? "not mapped yet"}</p>
                <p>ASR language: {startResponse?.configSummary.asrLanguage ?? "en-US"}</p>
                <p>LLM provider: {startResponse?.configSummary.llmProvider ?? "not mapped yet"}</p>
                <p>LLM preset: {startResponse?.configSummary.llmPreset ?? "openai_gpt_4o_mini"}</p>
                <p>TTS provider: {startResponse?.configSummary.ttsProvider ?? "not mapped yet"}</p>
                <p>TTS model: {startResponse?.configSummary.ttsModel ?? "eleven_flash_v2_5"}</p>
                <p>
                  RTC token: {startResponse?.configSummary.rtcTokenGenerated ? "generated" : "not generated"}
                </p>
                <p>Token version: {startResponse?.configSummary.tokenVersion ?? "AccessToken2"}</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
