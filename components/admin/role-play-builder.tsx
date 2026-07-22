"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { SparklesIcon } from "@/components/ui/icons";
import type { AuthSessionUser } from "@/src/lib/auth/session";
import type { Objective } from "@/src/lib/objectives/types";
import { canUserManageRolePlay } from "@/src/lib/roleplays/access";
import { buildConvoAIConfig } from "@/src/lib/roleplays/buildConvoAIConfig";
import {
  defaultRolePlayCharacterPreset,
  getRolePlayCharacterPreset,
  getRolePlayCharacterPresetByVoiceId,
  rolePlayCharacterPresets,
} from "@/src/lib/roleplays/characterPresets";
import {
  fetchRolePlayConfig,
  getStoredRolePlayConfig,
  persistRolePlayConfig,
  saveStoredRolePlayConfig,
} from "@/src/lib/roleplays/storage";
import type { RolePlayConfig, RolePlayStatus } from "@/src/lib/roleplays/types";

const evaluatorPromptDefault =
  "You are a hidden objective evaluator for a role play training simulation. Evaluate only the learner's responses. Determine whether the latest learner message satisfies any incomplete goals. Only mark a goal complete if clearly satisfied, even when the wording is not an exact match. Use exact evidence from the learner response. Return strict JSON only.";

const defaultObjectives: Objective[] = [
  {
    id: "goal-acknowledge-context",
    label: "Acknowledge the customer's situation",
    required: true,
    completed: false,
  },
  {
    id: "goal-collect-details",
    label: "Collect the details needed to move the case forward",
    required: true,
    completed: false,
  },
  {
    id: "goal-next-steps",
    label: "Explain clear next steps",
    required: true,
    completed: false,
  },
];

const steps = ["Plan Role Play", "AI Character Customization", "Role Play Settings"];

type BuilderAction = "draft" | "publish" | "preview" | "unpublish";
type BuilderActionPhase = "loading" | "completing" | "success";

type AssignableTrainee = {
  id: string;
  email: string;
  name: string;
  role: "trainee" | "course_admin";
};

type TranscriptRolePlayDraft = {
  meetingTitle: string;
  scenario: string;
  aiCustomerKeyPoints: string[];
  originalCallSummary: string;
  aiCustomerBehavior: string;
  learnerRole: string;
  characterName: string;
  characterRole: string;
  personalityBackground: string;
  greetingMessage: string;
  durationMinutes: number;
  learnerGoals: Objective[];
  evaluatorPrompt: string;
  privacyNotes: string[];
};

function inferCharacterPresetId(character?: { presetId?: string; voiceId?: string; name?: string }) {
  return (
    getRolePlayCharacterPreset(character?.presetId)?.id ??
    getRolePlayCharacterPresetByVoiceId(character?.voiceId)?.id ??
    rolePlayCharacterPresets.find((preset) => preset.name === character?.name)?.id ??
    defaultRolePlayCharacterPreset.id
  );
}

function replaceDraftCharacterName(value: string, draftName: string, selectedName: string) {
  const normalizedDraftName = draftName.trim();

  if (!normalizedDraftName || normalizedDraftName === selectedName) {
    return value;
  }

  return value.replaceAll(normalizedDraftName, selectedName);
}

function linesToList(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

function listToLines(items: string[] | undefined) {
  return (items ?? []).filter(Boolean).join("\n");
}

function isoToUtcDateTimeInput(value: string | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

function utcDateTimeInputToIso(value: string) {
  if (!value) return undefined;
  const date = new Date(`${value}:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `roleplay-${Date.now()}`;
}

async function fetchCurrentUser() {
  const response = await fetch("/api/auth/session", { cache: "no-store" });
  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { user?: AuthSessionUser };
  return payload.user ?? null;
}

export function RolePlayBuilder({
  embedded = false,
  rolePlayId,
}: {
  embedded?: boolean;
  rolePlayId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  const previewRolePlayId = searchParams.get("preview");
  const [previewConfig, setPreviewConfig] = useState<RolePlayConfig | null>(null);
  const [isLoadingPreviewConfig, setIsLoadingPreviewConfig] = useState(false);
  const [isLoadingExistingRolePlay, setIsLoadingExistingRolePlay] = useState(Boolean(rolePlayId));
  const [currentUser, setCurrentUser] = useState<AuthSessionUser | null>(null);
  const [editAccessDenied, setEditAccessDenied] = useState(false);
  const [currentRolePlayId, setCurrentRolePlayId] = useState<string | null>(rolePlayId ?? null);
  const [currentStatus, setCurrentStatus] = useState<RolePlayStatus>("draft");
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [scenario, setScenario] = useState(
    "A customer is frustrated because their production video session had quality issues and their previous support case did not produce clear next steps.",
  );
  const [learnerRole, setLearnerRole] = useState("Customer Support Engineer");
  const [characterPresetId, setCharacterPresetId] = useState<string>(
    defaultRolePlayCharacterPreset.id,
  );
  const [characterName, setCharacterName] = useState<string>(defaultRolePlayCharacterPreset.name);
  const [characterVoiceId, setCharacterVoiceId] = useState<string>(
    defaultRolePlayCharacterPreset.voiceId,
  );
  const [characterRole, setCharacterRole] = useState("Enterprise customer escalation contact");
  const [personalityBackground, setPersonalityBackground] = useState(
    `${defaultRolePlayCharacterPreset.name} is direct, time-sensitive, and skeptical after repeating the issue to multiple teams. They become more cooperative when the engineer shows ownership and asks specific diagnostic questions.`,
  );
  const [greetingMessage, setGreetingMessage] = useState(
    "I have already explained this issue several times. Can you actually help me get this resolved?",
  );
  const [aiCustomerKeyPointsText, setAiCustomerKeyPointsText] = useState("");
  const [originalCallSummary, setOriginalCallSummary] = useState("");
  const [aiCustomerBehavior, setAiCustomerBehavior] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("Escalated Video Quality Support Call");
  const [durationMinutes, setDurationMinutes] = useState(8);
  const [deadlineDateTimeUtc, setDeadlineDateTimeUtc] = useState("");
  const [deadlineTimezone, setDeadlineTimezone] = useState("UTC");
  const [attemptOverrides, setAttemptOverrides] =
    useState<RolePlayConfig["settings"]["attemptOverrides"]>({});
  const [learnerGoals, setLearnerGoals] = useState<Objective[]>(defaultObjectives);
  const [evaluatorPrompt, setEvaluatorPrompt] = useState(evaluatorPromptDefault);
  const [assignedTraineeIds, setAssignedTraineeIds] = useState<string[]>([]);
  const [trainees, setTrainees] = useState<AssignableTrainee[]>([]);
  const [traineeLoadError, setTraineeLoadError] = useState<string | null>(null);
  const [showTranscriptGenerator, setShowTranscriptGenerator] = useState(false);
  const [transcriptText, setTranscriptText] = useState("");
  const [transcriptFileName, setTranscriptFileName] = useState<string | null>(null);
  const [isGeneratingFromTranscript, setIsGeneratingFromTranscript] = useState(false);
  const [transcriptGenerateMessage, setTranscriptGenerateMessage] = useState<string | null>(null);
  const [transcriptPrivacyNotes, setTranscriptPrivacyNotes] = useState<string[]>([]);
  const [draftMessage, setDraftMessage] = useState<string | null>(null);
  const [activeBuilderAction, setActiveBuilderAction] = useState<BuilderAction | null>(null);
  const [builderActionPhase, setBuilderActionPhase] = useState<BuilderActionPhase>("loading");
  const [actionProgress, setActionProgress] = useState(0);

  useEffect(() => {
    void fetchCurrentUser().then(setCurrentUser);
  }, []);

  useEffect(() => {
    if (!activeBuilderAction) {
      setActionProgress(0);
      return;
    }

    if (builderActionPhase !== "loading") {
      return;
    }

    setActionProgress((current) => Math.max(current, 12));
    const interval = window.setInterval(() => {
      setActionProgress((current) => {
        if (current >= 88) {
          return current;
        }

        return Math.min(88, current + Math.max(1.5, (100 - current) * 0.1));
      });
    }, 220);

    return () => window.clearInterval(interval);
  }, [activeBuilderAction, builderActionPhase]);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/users/trainees", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Unable to load assignable users. HTTP ${response.status}.`);
        }

        const payload = (await response.json()) as { users?: AssignableTrainee[] };
        setTrainees(Array.isArray(payload.users) ? payload.users : []);
      } catch (error) {
        setTraineeLoadError(
          error instanceof Error ? error.message : "Unable to load assignable users.",
        );
      }
    })();
  }, []);

  useEffect(() => {
    if (!previewRolePlayId) {
      setPreviewConfig(null);
      setIsLoadingPreviewConfig(false);
      return;
    }

    setIsLoadingPreviewConfig(true);
    void fetchRolePlayConfig(previewRolePlayId)
      .then((config) => setPreviewConfig(config))
      .finally(() => setIsLoadingPreviewConfig(false));
  }, [previewRolePlayId]);

  useEffect(() => {
    if (!rolePlayId) {
      setIsLoadingExistingRolePlay(false);
      setCurrentRolePlayId(null);
      setCurrentStatus("draft");
      setCreatedAt(null);
      setAttemptOverrides({});
      setEditAccessDenied(false);
      return;
    }

    setIsLoadingExistingRolePlay(true);
    void (async () => {
      try {
        const [remoteConfig, sessionUser] = await Promise.all([
          fetchRolePlayConfig(rolePlayId),
          fetchCurrentUser(),
        ]);
        const stored = remoteConfig ?? getStoredRolePlayConfig(rolePlayId);

        if (sessionUser) {
          setCurrentUser(sessionUser);
        }

        if (!stored) {
          setEditAccessDenied(false);
          setDraftMessage("Saved role play not found. You can create a new version here.");
          return;
        }

        if (!sessionUser || !canUserManageRolePlay(sessionUser, stored)) {
          setEditAccessDenied(true);
          setDraftMessage("Only the course owner or root admin can edit this role play.");
          return;
        }

        setEditAccessDenied(false);
        setCurrentRolePlayId(stored.id);
        setCurrentStatus(stored.status);
        setCreatedAt(stored.createdAt ?? null);
        setScenario(stored.plan.scenario);
        setLearnerRole(stored.plan.learnerRole);
        const presetId = inferCharacterPresetId(stored.character);
        const preset = getRolePlayCharacterPreset(presetId) ?? defaultRolePlayCharacterPreset;
        setCharacterPresetId(preset.id);
        setCharacterVoiceId(preset.voiceId);
        setCharacterName(preset.name);
        setCharacterRole(stored.character.role);
        setPersonalityBackground(stored.character.personalityBackground);
        setGreetingMessage(stored.character.greetingMessage);
        setAiCustomerKeyPointsText(listToLines(stored.settings.aiCustomerKeyPoints));
        setOriginalCallSummary(stored.settings.originalCallSummary ?? "");
        setAiCustomerBehavior(stored.settings.aiCustomerBehavior ?? "");
        setMeetingTitle(stored.settings.meetingTitle);
        setDurationMinutes(stored.settings.durationMinutes);
        setDeadlineDateTimeUtc(isoToUtcDateTimeInput(stored.settings.deadlineAt));
        setDeadlineTimezone(stored.settings.deadlineTimezone ?? "UTC");
        setAttemptOverrides(stored.settings.attemptOverrides ?? {});
        setLearnerGoals(
          stored.settings.learnerGoals.length > 0 ? stored.settings.learnerGoals : defaultObjectives,
        );
        setEvaluatorPrompt(stored.settings.evaluatorPrompt);
        setAssignedTraineeIds(stored.settings.assignedTraineeIds ?? []);
        setDraftMessage(null);
      } finally {
        setIsLoadingExistingRolePlay(false);
      }
    })();
  }, [rolePlayId]);

  const generated = useMemo(
    () =>
      buildConvoAIConfig({
        scenario,
        learnerRole,
        aiCharacterName: characterName,
        aiCharacterRole: characterRole,
        personalityBackground,
        greetingMessage,
        aiCustomerKeyPoints: linesToList(aiCustomerKeyPointsText),
        originalCallSummary,
        aiCustomerBehavior,
        learnerGoals,
      }),
    [
      scenario,
      learnerRole,
      characterName,
      characterRole,
      characterVoiceId,
      personalityBackground,
      greetingMessage,
      aiCustomerKeyPointsText,
      originalCallSummary,
      aiCustomerBehavior,
      learnerGoals,
    ],
  );

  function selectCharacterPreset(presetId: string) {
    const preset = getRolePlayCharacterPreset(presetId) ?? defaultRolePlayCharacterPreset;
    const previousName = characterName;

    setCharacterPresetId(preset.id);
    setCharacterName(preset.name);
    setCharacterVoiceId(preset.voiceId);
    setPersonalityBackground((current) =>
      replaceDraftCharacterName(current, previousName, preset.name),
    );
    setGreetingMessage((current) => replaceDraftCharacterName(current, previousName, preset.name));
  }

  function buildRolePlayConfig(status: RolePlayStatus): RolePlayConfig {
    const now = new Date().toISOString();
    const selectedPreset =
      getRolePlayCharacterPreset(characterPresetId) ?? defaultRolePlayCharacterPreset;

    return {
      id: currentRolePlayId ?? createId(),
      status,
      createdAt: createdAt ?? now,
      updatedAt: now,
      plan: {
        scenario,
        learnerRole,
      },
      character: {
        presetId: selectedPreset.id,
        name: characterName,
        role: characterRole,
        voiceId: characterVoiceId || selectedPreset.voiceId,
        personalityBackground,
        greetingMessage,
      },
      settings: {
        meetingTitle,
        durationMinutes,
        learnerGoals,
        aiCustomerKeyPoints: linesToList(aiCustomerKeyPointsText),
        originalCallSummary,
        aiCustomerBehavior,
        deadlineAt: utcDateTimeInputToIso(deadlineDateTimeUtc),
        deadlineTimezone: deadlineTimezone.trim() || "UTC",
        attemptOverrides,
        evaluatorPrompt,
        assignedTraineeIds,
      },
      generated,
    };
  }

  async function completeBuilderAction(message: string) {
    setBuilderActionPhase("completing");
    setActionProgress((current) => Math.max(current, 94));
    await wait(350);
    setActionProgress(100);
    await wait(950);
    setDraftMessage(message);
    setBuilderActionPhase("success");
  }

  async function save(
    status: RolePlayStatus,
    action: BuilderAction = status === "published" ? "publish" : "draft",
  ) {
    setActiveBuilderAction(action);
    setBuilderActionPhase("loading");
    setDraftMessage(null);
    const config = buildRolePlayConfig(status);
    try {
      const saved = await persistRolePlayConfig(config);
      saveStoredRolePlayConfig(saved);
      setCurrentRolePlayId(saved.id);
      setCurrentStatus(saved.status);
      setCreatedAt(saved.createdAt ?? null);
      setAttemptOverrides(saved.settings.attemptOverrides ?? {});
      await completeBuilderAction(
        action === "preview"
          ? "Preview ready."
          : action === "unpublish"
            ? "Role play unpublished and saved as draft."
          : status === "published"
            ? "Role play published."
            : "Draft saved.",
      );
      return saved;
    } catch (error) {
      setDraftMessage(error instanceof Error ? error.message : "Unable to save role play.");
      setActiveBuilderAction(null);
      throw error;
    }
  }

  async function previewRolePlay() {
    const config = await save(currentStatus, "preview");
    window.setTimeout(() => {
      setPreviewConfig(config);
      router.push(`/course-builder?preview=${config.id}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
      setActiveBuilderAction(null);
    }, 900);
  }

  function startPreviewRolePlay(config: RolePlayConfig) {
    saveStoredRolePlayConfig(config);
    router.push(`/admin/roleplays/preview/${config.id}/session`);
  }

  function addObjective() {
    setLearnerGoals((current) => [
      ...current,
      {
        id: createId(),
        label: "",
        required: true,
        completed: false,
      },
    ]);
  }

  function removeObjective(objectiveId: string) {
    setLearnerGoals((current) => current.filter((objective) => objective.id !== objectiveId));
  }

  function updateObjective(objectiveId: string, updates: Partial<Objective>) {
    setLearnerGoals((current) =>
      current.map((objective) =>
        objective.id === objectiveId ? { ...objective, ...updates } : objective,
      ),
    );
  }

  function toggleTraineeAssignment(traineeId: string, assigned: boolean) {
    setAssignedTraineeIds((current) => {
      if (assigned) {
        return current.includes(traineeId) ? current : [...current, traineeId];
      }
      return current.filter((id) => id !== traineeId);
    });
  }

  async function loadTranscriptFile(file: File | undefined) {
    if (!file) {
      return;
    }

    setTranscriptFileName(file.name);
    setTranscriptGenerateMessage(null);
    setTranscriptText(await file.text());
  }

  function applyTranscriptDraft(draft: TranscriptRolePlayDraft) {
    const selectedPreset =
      getRolePlayCharacterPreset(characterPresetId) ?? defaultRolePlayCharacterPreset;

    setMeetingTitle(draft.meetingTitle);
    setScenario(draft.scenario);
    setLearnerRole(draft.learnerRole);
    setCharacterName(selectedPreset.name);
    setCharacterVoiceId(selectedPreset.voiceId);
    setCharacterRole(draft.characterRole);
    setPersonalityBackground(
      replaceDraftCharacterName(draft.personalityBackground, draft.characterName, selectedPreset.name),
    );
    setGreetingMessage(
      replaceDraftCharacterName(draft.greetingMessage, draft.characterName, selectedPreset.name),
    );
    setAiCustomerKeyPointsText(listToLines(draft.aiCustomerKeyPoints));
    setOriginalCallSummary(draft.originalCallSummary);
    setAiCustomerBehavior(
      replaceDraftCharacterName(draft.aiCustomerBehavior, draft.characterName, selectedPreset.name),
    );
    setDurationMinutes(draft.durationMinutes);
    setLearnerGoals(draft.learnerGoals.length > 0 ? draft.learnerGoals : defaultObjectives);
    setEvaluatorPrompt(draft.evaluatorPrompt);
    setTranscriptPrivacyNotes(draft.privacyNotes);
  }

  async function generateFromTranscript() {
    setTranscriptGenerateMessage(null);
    setDraftMessage(null);

    if (transcriptText.trim().length < 80) {
      setTranscriptGenerateMessage("Add at least 80 characters of transcript context first.");
      return;
    }

    setIsGeneratingFromTranscript(true);

    try {
      const response = await fetch("/api/roleplays/generate-from-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcriptText }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        draft?: TranscriptRolePlayDraft;
        error?: string;
      };

      if (!response.ok || !payload.draft) {
        throw new Error(payload.error ?? `Unable to generate draft. HTTP ${response.status}.`);
      }

      applyTranscriptDraft(payload.draft);
      setStep(0);
      setShowTranscriptGenerator(false);
      setTranscriptGenerateMessage(
        "Generated a draft from the transcript. Review every field before saving or publishing.",
      );
    } catch (error) {
      setTranscriptGenerateMessage(
        error instanceof Error ? error.message : "Unable to generate a draft from the transcript.",
      );
    } finally {
      setIsGeneratingFromTranscript(false);
    }
  }

  const progressPercent = Math.round(((step + 1) / steps.length) * 100);
  const isFinalStep = step === steps.length - 1;
  const isBuilderActionRunning = Boolean(activeBuilderAction);
  const activeBuilderActionLabel =
    activeBuilderAction === "draft"
      ? "Saving draft"
      : activeBuilderAction === "unpublish"
        ? "Unpublishing role play"
      : activeBuilderAction === "publish"
        ? "Publishing role play"
        : activeBuilderAction === "preview"
          ? "Preparing preview"
          : "";
  const actionSuccessTitle =
    activeBuilderAction === "publish"
      ? "Role play published"
      : activeBuilderAction === "unpublish"
        ? "Role play unpublished"
      : activeBuilderAction === "draft"
        ? "Draft saved"
        : "Preview ready";
  const actionSuccessBody =
    activeBuilderAction === "publish"
      ? "Your course is now available in Preview Created Courses. Redirecting you back to the course list."
      : activeBuilderAction === "unpublish"
        ? "Your course is now saved as a draft and hidden from learners. Redirecting you back to the course list."
      : activeBuilderAction === "draft"
        ? "Your draft has been saved. Redirecting you back to Preview Created Courses."
        : "Your learner-facing preview is ready.";

  useEffect(() => {
    if (!activeBuilderAction || builderActionPhase !== "success") {
      return;
    }

    if (activeBuilderAction === "preview") {
      return;
    }

    const timeout = window.setTimeout(() => {
      router.push("/course-builder");
      setActiveBuilderAction(null);
    }, 1500);

    return () => window.clearTimeout(timeout);
  }, [activeBuilderAction, builderActionPhase, router]);

  if (isLoadingPreviewConfig) {
    return (
      <section
        id="course-builder"
        className={
          embedded
            ? "rounded-3xl border border-blue-100 bg-white/90 p-6 shadow-soft"
            : "min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_34%),linear-gradient(180deg,#f8fbff,#f4f7fb)] px-6 py-8"
        }
      >
        <div className={embedded ? "text-sm text-slate-500" : "mx-auto max-w-6xl text-sm text-slate-500"}>
          Loading role play preview...
        </div>
      </section>
    );
  }

  if (isLoadingExistingRolePlay) {
    return (
      <section
        id="course-builder"
        className={
          embedded
            ? "rounded-3xl border border-blue-100 bg-white/90 p-6 shadow-soft"
            : "min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_34%),linear-gradient(180deg,#f8fbff,#f4f7fb)] px-6 py-8"
        }
      >
        <div className={embedded ? "text-sm text-slate-500" : "mx-auto max-w-6xl text-sm text-slate-500"}>
          Loading role play editor...
        </div>
      </section>
    );
  }

  if (previewConfig) {
    const canManagePreview = currentUser ? canUserManageRolePlay(currentUser, previewConfig) : false;

    return (
      <section
        id="course-builder"
        className={
          embedded
            ? "overflow-hidden rounded-3xl border border-blue-100 bg-white/90 p-5 shadow-soft sm:p-6"
            : "min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_34%),linear-gradient(180deg,#f8fbff,#f4f7fb)] px-6 py-8"
        }
      >
        <div className={embedded ? "space-y-6" : "mx-auto max-w-6xl space-y-6"}>
          <header className="overflow-hidden rounded-3xl border border-blue-100 bg-hero-grid p-6 shadow-soft">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-primary">Powered by AI</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                  {previewConfig.settings.meetingTitle}
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                  Learner-facing preview for a {previewConfig.settings.durationMinutes}-minute
                  roleplay with {previewConfig.character.name}.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canManagePreview && (
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewConfig(null);
                      router.push(`/course-builder/${previewConfig.id}/edit`);
                    }}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-soft transition hover:border-blue-200 hover:bg-blue-50"
                  >
                    Edit Builder
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => startPreviewRolePlay(previewConfig)}
                  className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
                >
                  Start Role Play
                </button>
              </div>
            </div>
          </header>

          <main className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <section className="space-y-5">
              <div className="rounded-3xl border border-blue-100 bg-white p-6 shadow-soft">
                <p className="text-xs uppercase tracking-[0.2em] text-primary">Scenario Summary</p>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {previewConfig.plan.scenario}
                </p>
              </div>

              <div className="rounded-3xl border border-blue-100 bg-white p-6 shadow-soft">
                <p className="text-xs uppercase tracking-[0.2em] text-primary">AI Character</p>
                <div className="mt-4 flex items-start gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#dbeafe,#60a5fa)] text-2xl font-semibold text-white shadow-lg shadow-blue-500/20">
                    {previewConfig.character.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950">
                      {previewConfig.character.name}
                    </h2>
                    <p className="text-sm font-medium text-blue-700">
                      {previewConfig.character.role}
                    </p>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      {previewConfig.character.personalityBackground}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-blue-100 bg-white p-6 shadow-soft">
                <p className="text-xs uppercase tracking-[0.2em] text-primary">Learner Role</p>
                <p className="mt-3 text-sm font-medium text-slate-700">
                  {previewConfig.plan.learnerRole}
                </p>
              </div>
            </section>

            <aside className="rounded-3xl border border-blue-100 bg-white p-6 shadow-soft">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-primary">Meeting Goals</p>
                  <h2 className="mt-2 text-lg font-semibold text-slate-950">
                    What the learner should cover
                  </h2>
                </div>
                <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  {previewConfig.settings.learnerGoals.length} goals
                </span>
              </div>
              <div className="mt-5 space-y-3">
                {previewConfig.settings.learnerGoals.map((goal) => (
                  <div key={goal.id} className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium leading-6 text-slate-800">{goal.label}</p>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-500">
                        {goal.required ? "Required" : "Optional"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </main>
        </div>
      </section>
    );
  }

  if (editAccessDenied) {
    return (
      <section
        id="course-builder"
        className={
          embedded
            ? "rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-soft"
            : "min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_34%),linear-gradient(180deg,#fffbeb,#f8fafc)] px-6 py-8"
        }
      >
        <div className={embedded ? "space-y-4" : "mx-auto max-w-3xl space-y-4"}>
          <p className="text-xs uppercase tracking-[0.24em] text-amber-700">Owner-only access</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            This role play can only be edited by its owner or root admin.
          </h1>
          <p className="text-sm leading-7 text-slate-600">
            You can still preview or take assigned roleplay courses, but management actions are
            limited to the creator who made the simulation.
          </p>
          <Link
            href="/course-builder"
            className="inline-flex rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
          >
            Back to Courses
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section
      id="course-builder"
      className={
        embedded
          ? "overflow-hidden rounded-3xl border border-blue-100 bg-white/90 p-5 shadow-soft sm:p-6"
          : "min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_34%),linear-gradient(180deg,#f8fbff,#f4f7fb)] px-6 py-8"
      }
    >
      {activeBuilderAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[2rem] border border-white/80 bg-white/95 p-8 text-center shadow-[0_30px_80px_-35px_rgba(15,23,42,0.55)]">
            <div
              className={`mx-auto flex h-16 w-16 items-center justify-center rounded-3xl text-2xl font-semibold ${
                builderActionPhase === "success"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              {builderActionPhase === "success" ? "✓" : (
                <span className="h-7 w-7 animate-spin rounded-full border-4 border-blue-200 border-t-blue-700" />
              )}
            </div>
            <p className="mt-5 text-xs uppercase tracking-[0.28em] text-primary">
              Role Play Builder
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              {builderActionPhase === "success" ? actionSuccessTitle : activeBuilderActionLabel}
            </h2>
            <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-slate-600">
              {builderActionPhase === "success"
                ? actionSuccessBody
                : "Please keep this window open while we save the latest roleplay configuration."}
            </p>
            <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
                <span>{builderActionPhase === "success" ? "Complete" : "Saving progress"}</span>
                <span>{Math.round(actionProgress)}%</span>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white">
                <div
                  className={`h-full rounded-full transition-all duration-200 ease-out ${
                    builderActionPhase === "success" ? "bg-emerald-500" : "bg-primary"
                  }`}
                  style={{ width: `${actionProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
      <div className={embedded ? "space-y-6 pb-40" : "mx-auto max-w-6xl space-y-6 pb-40"}>
        <header className="overflow-hidden rounded-3xl border border-blue-100 bg-hero-grid p-6 shadow-soft">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
              <p className="text-xs uppercase tracking-[0.24em] text-primary">Course Admin</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                Role Play Builder
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                Build, save, publish, and preview AI customer roleplays from the same workspace
                your learners use for practice.
              </p>
          </div>
            <div className="w-full max-w-xl">
              <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <span>Builder progress</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="h-2 rounded-full bg-blue-100">
                <div
                  className="h-2 rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {steps.map((label, index) => (
              <button
                key={label}
                type="button"
                onClick={() => setStep(index)}
                className={`rounded-2xl border p-4 text-left transition ${
                  step === index
                    ? "border-primary bg-primary text-white shadow-lg shadow-blue-500/20"
                    : "border-blue-100 bg-white/80 text-slate-600 hover:border-blue-200 hover:bg-white"
                }`}
              >
                <span
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-xl text-sm font-semibold ${
                    step === index ? "bg-white/20 text-white" : "bg-blue-50 text-primary"
                  }`}
                >
                  {index + 1}
                </span>
                <span className="mt-3 block text-sm font-semibold">{label}</span>
              </button>
            ))}
          </div>
        </header>

        <main className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-3xl border border-blue-100 bg-white p-6 shadow-soft">
            {step === 0 && (
              <div className="space-y-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-primary">Step 1</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                      Plan Role Play
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">
                      Define the learner context and the situation the AI customer should bring into
                      the meeting.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTranscriptGenerator((current) => !current);
                      setTranscriptGenerateMessage(null);
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-200 bg-cyan-50 px-3.5 py-2 text-xs font-semibold text-cyan-800 shadow-sm transition hover:bg-cyan-100"
                    aria-expanded={showTranscriptGenerator}
                  >
                    <SparklesIcon className="h-4 w-4" />
                    <span>Generate from Transcript</span>
                  </button>
                </div>
                {showTranscriptGenerator && (
                <div className="rounded-3xl border border-cyan-100 bg-cyan-50/60 p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-cyan-700">
                        Generate from real call
                      </p>
                      <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
                        Upload or paste a customer-call transcript
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                        The generator creates an anonymized draft scenario, customer persona,
                        greeting, and learner goals. Review the output for privacy and accuracy
                        before saving.
                      </p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl border border-cyan-200 bg-white px-4 py-2 text-sm font-semibold text-cyan-800 shadow-sm transition hover:bg-cyan-50">
                      Upload (.vtt, .txt)
                      <input
                        type="file"
                        accept=".vtt,.txt,text/vtt,text/plain"
                        className="sr-only"
                        onChange={(event) =>
                          void loadTranscriptFile(event.currentTarget.files?.[0])
                        }
                      />
                    </label>
                  </div>
                  {transcriptFileName && (
                    <p className="mt-3 text-xs font-semibold text-cyan-800">
                      Loaded file: {transcriptFileName}
                    </p>
                  )}
                  <label className="mt-4 block space-y-2">
                    <span className="text-sm font-medium text-slate-700">Transcript</span>
                    <textarea
                      value={transcriptText}
                      onChange={(event) => {
                        setTranscriptText(event.target.value);
                        setTranscriptFileName(null);
                      }}
                      rows={7}
                      placeholder="Paste the actual call transcript here. Avoid adding account IDs, emails, phone numbers, or other sensitive data when possible."
                      className="w-full rounded-2xl border border-cyan-100 bg-white/90 px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                    />
                  </label>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs leading-5 text-slate-500">
                      The transcript is sent only to generate the draft. The builder saves the
                      resulting scenario, not the raw transcript.
                    </p>
                    <button
                      type="button"
                      onClick={() => void generateFromTranscript()}
                      disabled={isGeneratingFromTranscript || isBuilderActionRunning}
                      className="rounded-2xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isGeneratingFromTranscript ? "Generating..." : "Generate Draft"}
                    </button>
                  </div>
                  {transcriptGenerateMessage && (
                    <div className="mt-4 rounded-2xl border border-cyan-100 bg-white p-3 text-sm font-medium text-cyan-800">
                      {transcriptGenerateMessage}
                    </div>
                  )}
                  {transcriptPrivacyNotes.length > 0 && (
                    <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                        Privacy review notes
                      </p>
                      <ul className="mt-2 space-y-1 text-sm leading-6 text-amber-900">
                        {transcriptPrivacyNotes.map((note) => (
                          <li key={note}>- {note}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                )}
                {transcriptGenerateMessage && !showTranscriptGenerator && (
                  <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-3 text-sm font-medium text-cyan-800">
                    {transcriptGenerateMessage}
                  </div>
                )}
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">Scenario</span>
                  <textarea
                    value={scenario}
                    onChange={(event) => setScenario(event.target.value)}
                    rows={8}
                    className="w-full rounded-2xl border border-blue-100 bg-slate-50/80 px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    AI Customer Talking Points
                  </span>
                  <textarea
                    value={aiCustomerKeyPointsText}
                    onChange={(event) => setAiCustomerKeyPointsText(event.target.value)}
                    rows={5}
                    placeholder="One prompt-only talking point per line. These are added to the AI customer prompt, not the visible scenario."
                    className="w-full rounded-2xl border border-blue-100 bg-slate-50/80 px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                  <span className="block text-xs leading-5 text-slate-500">
                    These points guide what the AI customer should naturally mention during the call.
                    They are kept separate from the scenario brief.
                  </span>
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">Learner Role</span>
                  <input
                    value={learnerRole}
                    onChange={(event) => setLearnerRole(event.target.value)}
                    className="w-full rounded-2xl border border-blue-100 bg-slate-50/80 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </label>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-primary">Step 2</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    AI Character Customization
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Shape the customer persona so the roleplay feels specific, grounded, and
                    repeatable.
                  </p>
                </div>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">AI Character</span>
                  <select
                    value={characterPresetId}
                    onChange={(event) => selectCharacterPreset(event.target.value)}
                    className="w-full rounded-2xl border border-blue-100 bg-slate-50/80 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-blue-100"
                  >
                    {rolePlayCharacterPresets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.name} - {preset.gender === "female" ? "Female" : "Male"}
                      </option>
                    ))}
                  </select>
                  <span className="block text-xs leading-5 text-slate-500">
                    The matching voice is selected automatically for the chosen character.
                  </span>
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate-700">Selected Name</span>
                    <input
                      value={characterName}
                      readOnly
                      className="w-full rounded-2xl border border-blue-100 bg-slate-100/80 px-4 py-3 text-sm text-slate-700 outline-none"
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate-700">Character Role</span>
                    <input
                      value={characterRole}
                      onChange={(event) => setCharacterRole(event.target.value)}
                      className="w-full rounded-2xl border border-blue-100 bg-slate-50/80 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-blue-100"
                    />
                  </label>
                </div>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">Personality and Background</span>
                  <textarea
                    value={personalityBackground}
                    onChange={(event) => setPersonalityBackground(event.target.value)}
                    rows={7}
                    className="w-full rounded-2xl border border-blue-100 bg-slate-50/80 px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">Greeting Message</span>
                  <textarea
                    value={greetingMessage}
                    onChange={(event) => setGreetingMessage(event.target.value)}
                    rows={3}
                    className="w-full rounded-2xl border border-blue-100 bg-slate-50/80 px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </label>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-primary">Step 3</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    Role Play Settings
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Configure learner goals, timing, and the evaluator that checks objective
                    coverage.
                  </p>
                </div>
                {currentRolePlayId && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">Publishing Status</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {currentStatus === "published"
                            ? "This course is visible to assigned learners. Use Unpublish to move it back to draft."
                            : "This course is saved as a draft and hidden from learners until published."}
                        </p>
                      </div>
                      <span
                        className={`w-fit rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${
                          currentStatus === "published"
                            ? "border-emerald-200 bg-white text-emerald-700"
                            : "border-amber-200 bg-white text-amber-700"
                        }`}
                      >
                        {currentStatus === "published" ? "Published" : "Draft"}
                      </span>
                    </div>
                    {currentStatus === "published" && (
                      <button
                        type="button"
                        onClick={() => void save("draft", "unpublish")}
                        disabled={isBuilderActionRunning}
                        className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 shadow-sm transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Unpublish to Draft
                      </button>
                    )}
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate-700">Meeting Title</span>
                    <input
                      value={meetingTitle}
                      onChange={(event) => setMeetingTitle(event.target.value)}
                      className="w-full rounded-2xl border border-blue-100 bg-slate-50/80 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-blue-100"
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate-700">Role Play Duration</span>
                    <select
                      value={durationMinutes}
                      onChange={(event) => setDurationMinutes(Number(event.target.value))}
                      className="w-full rounded-2xl border border-blue-100 bg-slate-50/80 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-blue-100"
                    >
                      {[5, 8, 10, 15, 20].map((value) => (
                        <option key={value} value={value}>
                          {value} minutes
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate-700">
                      Deadline Date/Time
                    </span>
                    <input
                      type="datetime-local"
                      value={deadlineDateTimeUtc}
                      onChange={(event) => setDeadlineDateTimeUtc(event.target.value)}
                      className="w-full rounded-2xl border border-blue-100 bg-slate-50/80 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-blue-100"
                    />
                    <span className="block text-xs leading-5 text-slate-500">
                      Leave empty for no deadline. This value is saved as UTC.
                    </span>
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate-700">Deadline Timezone</span>
                    <input
                      value={deadlineTimezone}
                      onChange={(event) => setDeadlineTimezone(event.target.value)}
                      placeholder="UTC"
                      className="w-full rounded-2xl border border-blue-100 bg-slate-50/80 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-blue-100"
                    />
                    <span className="block text-xs leading-5 text-slate-500">
                      Use UTC by default, or enter an IANA timezone label for display.
                    </span>
                  </label>
                </div>

                <div className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        Learner Goals / Objectives
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Required goals power live tracking during the roleplay session.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addObjective}
                      className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
                    >
                      Add Objective
                    </button>
                  </div>
                  {learnerGoals.map((goal) => (
                    <div key={goal.id} className="grid gap-3 rounded-2xl border border-blue-100 bg-white p-3">
                      <input
                        value={goal.label}
                        onChange={(event) => updateObjective(goal.id, { label: event.target.value })}
                        className="rounded-xl border border-blue-100 bg-slate-50/80 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-blue-100"
                      />
                      <div className="flex items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                          <input
                            type="checkbox"
                            checked={goal.required}
                            onChange={(event) =>
                              updateObjective(goal.id, { required: event.target.checked })
                            }
                          />
                          Required
                        </label>
                        <button
                          type="button"
                          onClick={() => removeObjective(goal.id)}
                          disabled={learnerGoals.length <= 1}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3 rounded-2xl border border-blue-100 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">User Access</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Choose which trainee and course admin accounts can see and start this
                        course after it is published.
                      </p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
                      {assignedTraineeIds.length} assigned
                    </span>
                  </div>

                  {traineeLoadError && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                      {traineeLoadError}
                    </div>
                  )}

                  {!traineeLoadError && trainees.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/60 p-4 text-sm text-slate-600">
                      No assignable users available yet. Add trainee or course admin accounts
                      before assigning this course.
                    </div>
                  )}

                  {trainees.length > 0 && (
                    <div className="grid gap-2">
                      {trainees.map((trainee) => (
                        <label
                          key={trainee.id}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-3"
                        >
                          <span>
                            <span className="block text-sm font-semibold text-slate-950">
                              {trainee.name}
                            </span>
                            <span className="block text-xs text-slate-500">{trainee.email}</span>
                            <span className="mt-1 inline-flex rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-blue-100">
                              {trainee.role === "course_admin" ? "Course Admin + Learner" : "Trainee"}
                            </span>
                          </span>
                          <input
                            type="checkbox"
                            checked={assignedTraineeIds.includes(trainee.id)}
                            onChange={(event) =>
                              toggleTraineeAssignment(trainee.id, event.target.checked)
                            }
                            className="h-4 w-4"
                          />
                        </label>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}
          </section>

          <aside className="space-y-4">
            <div className="overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-soft">
              <div className="border-b border-blue-100 bg-slate-50/80 px-5 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-primary">Generated Config</p>
                <h3 className="mt-2 text-lg font-semibold text-slate-950">ConvoAI Preview</h3>
              </div>
              <dl className="space-y-3 p-5 text-sm">
                <div className="rounded-2xl bg-blue-50/60 p-4">
                  <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    greeting_message_switch
                  </dt>
                  <dd className="mt-2 font-semibold text-slate-950">
                    {generated.greeting_message_switch}
                  </dd>
                </div>
                <div className="rounded-2xl bg-blue-50/60 p-4">
                  <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    delay_ms
                  </dt>
                  <dd className="mt-2 font-semibold text-slate-950">{generated.delay_ms}</dd>
                </div>
                <div className="rounded-2xl bg-blue-50/60 p-4">
                  <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    greeting_message
                  </dt>
                  <dd className="mt-2 leading-6 text-slate-700">{generated.greeting_message}</dd>
                </div>
              </dl>
            </div>
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 shadow-soft">
              <div className="border-b border-white/10 px-5 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">
                  System Message Preview
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  This is the generated roleplay instruction sent to the AI customer.
                </p>
              </div>
              <pre className="max-h-[420px] overflow-y-auto whitespace-pre-wrap p-5 text-xs leading-5 text-slate-300">
                {generated.system_message}
              </pre>
            </div>
          </aside>
        </main>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-blue-100 bg-white/95 px-4 py-3 shadow-[0_-20px_45px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:px-6 lg:left-[var(--app-sidebar-width,0px)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              disabled={step === 0}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setStep((current) => Math.min(steps.length - 1, current + 1))}
              disabled={step === steps.length - 1}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            {draftMessage && !isBuilderActionRunning ? (
              <p className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
                {draftMessage}
              </p>
            ) : !isFinalStep ? (
              <p className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-500">
                Publish and Preview/Test unlock in Role Play Settings.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <button
                type="button"
                onClick={() =>
                  void save("draft", currentStatus === "published" ? "unpublish" : "draft")
                }
                disabled={isBuilderActionRunning}
                className={`rounded-2xl border px-4 py-2 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  currentStatus === "published"
                    ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                    : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50"
                }`}
              >
                {currentStatus === "published" ? "Unpublish to Draft" : "Save Draft"}
              </button>
              {isFinalStep && (
                <>
                  <button
                    type="button"
                    onClick={() => void save("published")}
                    disabled={isBuilderActionRunning}
                    className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Publish
                  </button>
                  <button
                    type="button"
                    onClick={() => void previewRolePlay()}
                    disabled={isBuilderActionRunning}
                    className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Preview/Test
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
