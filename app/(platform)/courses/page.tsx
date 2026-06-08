import { PublishedRoleplayCourses } from "@/components/courses/published-roleplay-courses";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CoursesPage() {
  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="bg-white/90">
          <CardHeader>
            <CardDescription>Simulation catalog</CardDescription>
            <CardTitle className="text-3xl">Simulation Courses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
              Access is now driven by roleplay assignments from the Course Builder. Trainees only
              see published courses assigned to their alpha account.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Badge>Diagnostics</Badge>
              <Badge variant="secondary">Communication</Badge>
              <Badge variant="secondary">Escalation</Badge>
              <Badge variant="secondary">Product Guidance</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-950 text-white">
          <CardHeader>
            <CardDescription className="text-slate-400">Course strategy</CardDescription>
            <CardTitle className="text-white">Future backend support</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-300">
            <div className="rounded-2xl bg-white/10 p-4">
              Scenario authoring can later feed this page from a dedicated creation workflow.
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              Progress tracking services can personalize recommendations and ordering.
            </div>
          </CardContent>
        </Card>
      </section>

      <PublishedRoleplayCourses emptyState />
    </div>
  );
}
