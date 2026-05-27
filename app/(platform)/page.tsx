import { AssessmentCard } from "@/components/dashboard/assessment-card";
import { ProfileStats } from "@/components/dashboard/profile-stats";
import { ScenarioCard } from "@/components/dashboard/scenario-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listEvaluations } from "@/lib/services/evaluations";
import { getProgressOverview } from "@/lib/services/progress";
import { listScenarios } from "@/lib/services/scenarios";

export default async function DashboardPage() {
  const [scenarioList, evaluationList, progress] = await Promise.all([
    listScenarios(),
    listEvaluations(),
    getProgressOverview(),
  ]);

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.5fr_0.8fr]">
        <Card className="overflow-hidden border-none bg-hero-grid shadow-soft">
          <CardContent className="p-8">
            <Badge>AI-powered support readiness</Badge>
            <h1 className="mt-5 max-w-2xl text-4xl font-semibold tracking-tight text-slate-950">
              Build confident Technical Support Engineers with hands-on simulations.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              Blend guided practice, realistic customer conversations, and structured AI feedback
              in one clean learning environment.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button>Resume today&apos;s training</Button>
              <Button variant="secondary">Review latest assessment</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-950 text-white">
          <CardHeader>
            <CardDescription className="text-slate-400">Upcoming sessions</CardDescription>
            <CardTitle className="text-white">Training calendar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {progress.upcomingSessions.map((session) => (
              <div key={session.title} className="rounded-2xl bg-white/10 p-4">
                <p className="font-medium">{session.title}</p>
                <p className="mt-2 text-sm text-slate-300">{session.time}</p>
                <p className="text-sm text-slate-400">{session.host}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <ProfileStats metrics={progress.profileMetrics} />

      <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                Recommended scenarios
              </h2>
              <p className="text-sm text-muted-foreground">
                Curated practice modules aligned to current skill gaps
              </p>
            </div>
            <Badge variant="secondary">3 active</Badge>
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            {scenarioList.slice(0, 2).map((scenario) => (
              <ScenarioCard key={scenario.id} scenario={scenario} />
            ))}
          </div>
        </div>

        <AssessmentCard assessment={evaluationList[0]} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="bg-white/90">
          <CardHeader>
            <CardDescription>Readiness overview</CardDescription>
            <CardTitle>Progress snapshot</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {progress.dashboardStats.map((stat) => (
              <div key={stat.label} className="rounded-2xl bg-secondary p-5">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="mt-3 text-3xl font-semibold text-slate-950">{stat.value}</p>
                <p className="mt-2 text-sm text-slate-600">{stat.helper}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-white/90">
          <CardHeader>
            <CardDescription>Milestones</CardDescription>
            <CardTitle>Learning path health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {progress.milestones.map((milestone) => (
              <div key={milestone.id} className="rounded-2xl border bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-slate-950">{milestone.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{milestone.dueDate}</p>
                  </div>
                  <Badge
                    variant={
                      milestone.status === "Completed"
                        ? "success"
                        : milestone.status === "Needs Attention"
                          ? "warning"
                          : "default"
                    }
                  >
                    {milestone.status}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
