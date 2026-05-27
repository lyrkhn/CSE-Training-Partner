"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { Objective } from "@/src/lib/objectives/types";
import { buildConvoAIConfig } from "@/src/lib/roleplays/buildConvoAIConfig";
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

const storagePrefix = "cse-roleplay-config";
const steps = ["Plan Role Play", "AI Character Customization", "Role Play Settings"];

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `roleplay-${Date.now()}`;
}

export function RolePlayBuilder({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [scenario, setScenario] = useState(
    "A customer is frustrated because their production video session had quality issues and their previous support case did not produce clear next steps.",
  );
  const [learnerRole, setLearnerRole] = useState("Customer Support Engineer");
  const [characterName, setCharacterName] = useState("Morgan Lee");
  const [characterRole, setCharacterRole] = useState("Enterprise customer escalation contact");
  const [personalityBackground, setPersonalityBackground] = useState(
    "Morgan is direct, time-sensitive, and skeptical after repeating the issue to multiple teams. They become more cooperative when the engineer shows ownership and asks specific diagnostic questions.",
  );
  const [greetingMessage, setGreetingMessage] = useState(
    "I have already explained this issue several times. Can you actually help me get this resolved?",
  );
  const [meetingTitle, setMeetingTitle] = useState("Escalated Video Quality Support Call");
  const [durationMinutes, setDurationMinutes] = useState(8);
  const [learnerGoals, setLearnerGoals] = useState<Objective[]>(defaultObjectives);
  const [evaluatorPrompt, setEvaluatorPrompt] = useState(evaluatorPromptDefault);
  const [draftMessage, setDraftMessage] = useState<string | null>(null);

  const generated = useMemo(
    () =>
      buildConvoAIConfig({
        scenario,
        learnerRole,
        aiCharacterName: characterName,
        aiCharacterRole: characterRole,
        personalityBackground,
        greetingMessage,
        learnerGoals,
      }),
    [
      scenario,
      learnerRole,
      characterName,
      characterRole,
      personalityBackground,
      greetingMessage,
      learnerGoals,
    ],
  );

  function buildRolePlayConfig(status: RolePlayStatus): RolePlayConfig {
    return {
      id: createId(),
      status,
      plan: {
        scenario,
        learnerRole,
      },
      character: {
        name: characterName,
        role: characterRole,
        personalityBackground,
        greetingMessage,
      },
      settings: {
        meetingTitle,
        durationMinutes,
        learnerGoals,
        evaluatorPrompt,
      },
      generated,
    };
  }

  function persistConfig(config: RolePlayConfig) {
    // TODO: Replace localStorage with server-side role play persistence.
    localStorage.setItem(`${storagePrefix}:${config.id}`, JSON.stringify(config));
    localStorage.setItem(`${storagePrefix}:latest`, config.id);
  }

  function save(status: RolePlayStatus) {
    const config = buildRolePlayConfig(status);
    persistConfig(config);
    setDraftMessage(status === "published" ? "Role play published locally." : "Draft saved locally.");
    return config;
  }

  function previewRolePlay() {
    const config = save("draft");
    router.push(`/admin/roleplays/preview/${config.id}`);
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

  const progressPercent = Math.round(((step + 1) / steps.length) * 100);

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
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate-700">AI Character Name</span>
                    <input
                      value={characterName}
                      onChange={(event) => setCharacterName(event.target.value)}
                      className="w-full rounded-2xl border border-blue-100 bg-slate-50/80 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-blue-100"
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

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">Evaluator Prompt</span>
                  <textarea
                    value={evaluatorPrompt}
                    onChange={(event) => setEvaluatorPrompt(event.target.value)}
                    rows={6}
                    className="w-full rounded-2xl border border-blue-100 bg-slate-50/80 px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </label>
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-blue-100 pt-5">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep((current) => Math.max(0, current - 1))}
                  disabled={step === 0}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setStep((current) => Math.min(steps.length - 1, current + 1))}
                  disabled={step === steps.length - 1}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => save("draft")}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50"
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  onClick={() => save("published")}
                  className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-600"
                >
                  Publish
                </button>
                <button
                  type="button"
                  onClick={previewRolePlay}
                  className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
                >
                  Preview/Test
                </button>
              </div>
            </div>
            {draftMessage && (
              <p className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700">
                {draftMessage}
              </p>
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
    </section>
  );
}
