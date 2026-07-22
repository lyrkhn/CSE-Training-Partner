import { PublishedRoleplayCourses } from "@/components/courses/published-roleplay-courses";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SimulationIcon } from "@/components/ui/icons";

export default function CoursesPage() {
  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="overflow-hidden bg-white/90">
          <CardHeader>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#e0f2fe,#38bdf8)] text-white shadow-lg shadow-sky-500/20">
              <SimulationIcon className="h-6 w-6" />
            </div>
            <CardDescription>Assigned roleplay courses</CardDescription>
            <CardTitle className="text-3xl">Simulation Courses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
              Start the roleplay courses assigned to your account, review the scenario and
              objectives before joining, then complete the live AI customer conversation to generate
              your final assessment.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Badge>AI customer roleplay</Badge>
              <Badge variant="secondary">Assigned courses</Badge>
              <Badge variant="secondary">Deadline aware</Badge>
              <Badge variant="secondary">Final assessment</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-950 text-white">
          <CardHeader>
            <CardDescription className="text-slate-400">How courses work</CardDescription>
            <CardTitle className="text-white">Practice, submit, improve</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-300">
            <div className="rounded-2xl bg-white/10 p-4">
              Each course includes a learner scenario, customer persona, objectives, duration, and
              attempt allowance set by the course admin.
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              After the call, the system saves the transcript and creates coaching feedback you can
              review from Assessment Results.
            </div>
          </CardContent>
        </Card>
      </section>

      <PublishedRoleplayCourses emptyState />
    </div>
  );
}
