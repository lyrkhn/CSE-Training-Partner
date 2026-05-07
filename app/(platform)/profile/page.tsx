import { ProfileStats } from "@/components/dashboard/profile-stats";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getProgressOverview } from "@/lib/services/progress";

export default async function ProfilePage() {
  const progress = await getProgressOverview();

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="bg-slate-950 text-white">
          <CardHeader>
            <CardDescription className="text-slate-400">Learner profile</CardDescription>
            <CardTitle className="text-white">Maya Chen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-2xl font-semibold">
                MC
              </div>
              <div>
                <p className="text-lg font-medium">Senior Technical Support Engineer trainee</p>
                <p className="text-sm text-slate-400">
                  Voice, RTC, and customer escalation specialization
                </p>
              </div>
            </div>
            <p className="text-sm leading-7 text-slate-300">
              Focused on becoming a dependable escalation owner with stronger diagnostic structure,
              customer confidence, and faster action planning.
            </p>
            <div className="flex flex-wrap gap-3">
              <Badge>Level 2 Certification</Badge>
              <Badge className="bg-white/10 text-white">Cohort Spring 2026</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/90">
          <CardHeader>
            <CardDescription>Readiness summary</CardDescription>
            <CardTitle className="text-3xl">Performance snapshot</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
              The profile area centralizes learner identity, progress, certifications, and growth
              opportunities. It is ready for future backend enrichment from progress tracking and
              historical assessment services.
            </p>
          </CardContent>
        </Card>
      </section>

      <ProfileStats metrics={progress.profileMetrics} />

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="bg-white/90">
          <CardHeader>
            <CardDescription>Milestones</CardDescription>
            <CardTitle>Current plan</CardTitle>
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

        <Card className="bg-white/90">
          <CardHeader>
            <CardDescription>Strength focus</CardDescription>
            <CardTitle>Recommended next modules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              "Advanced incident triage and hypothesis framing",
              "Closing loops with executive stakeholders",
              "Cross-functional coordination during escalations",
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
