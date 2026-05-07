import { TranscriptPanel } from "@/components/dashboard/transcript-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionTranscript } from "@/lib/services/transcripts";
import { listScenarios } from "@/lib/services/scenarios";

export default async function SimulationPage() {
  const [scenarioList, transcript] = await Promise.all([
    listScenarios(),
    getSessionTranscript(),
  ]);

  const activeScenario = scenarioList[1];

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="bg-white/90">
          <CardHeader>
            <CardDescription>Active simulation</CardDescription>
            <CardTitle className="text-3xl">{activeScenario.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-3">
              <Badge>{activeScenario.category}</Badge>
              <Badge variant="secondary">{activeScenario.difficulty}</Badge>
              <Badge variant="secondary">{activeScenario.duration}</Badge>
            </div>
            <p className="text-sm leading-7 text-muted-foreground">
              {activeScenario.description}
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-secondary p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                  Objective
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  Diagnose the likely source of call degradation while keeping the customer calm,
                  informed, and committed to the next diagnostic checkpoint.
                </p>
              </div>
              <div className="rounded-2xl bg-secondary p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                  Success criteria
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  Confirm impact scope, isolate reproducible conditions, summarize next steps, and
                  set expectations on follow-up ownership.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button>Start Voice Simulation</Button>
              <Button variant="secondary">Open Scenario Guide</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-950 text-white">
          <CardHeader>
            <CardDescription className="text-slate-400">Integration placeholder</CardDescription>
            <CardTitle className="text-white">Agora ConvoAI workspace</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-5">
              <p className="font-medium">Reserved for real-time conversation controls</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Future integration can mount Agora ConvoAI session state, agent controls,
                connection indicators, and live transcript events here.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl bg-white/10 p-4 text-sm text-slate-300">
                Session metadata
              </div>
              <div className="rounded-2xl bg-white/10 p-4 text-sm text-slate-300">
                Real-time coaching prompts
              </div>
              <div className="rounded-2xl bg-white/10 p-4 text-sm text-slate-300">
                Audio device controls
              </div>
              <div className="rounded-2xl bg-white/10 p-4 text-sm text-slate-300">
                Turn-by-turn transcript stream
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <TranscriptPanel entries={transcript} />

        <Card className="bg-white/90">
          <CardHeader>
            <CardDescription>Simulation checklist</CardDescription>
            <CardTitle>Live coaching notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              "Validate impact scope across platforms and regions.",
              "Confirm whether issue started after a release or infrastructure change.",
              "Reflect customer frustration before requesting more evidence.",
              "End with a clear recap, owner, and next timeline checkpoint.",
            ].map((item) => (
              <div key={item} className="rounded-2xl border bg-slate-50 p-4 text-sm text-slate-700">
                {item}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
