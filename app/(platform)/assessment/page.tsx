import { AssessmentCard } from "@/components/dashboard/assessment-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listEvaluations } from "@/lib/services/evaluations";

export default async function AssessmentPage() {
  const evaluationList = await listEvaluations();
  const featured = evaluationList[0];

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="bg-white/90">
          <CardHeader>
            <CardDescription>Mock AI-generated evaluation</CardDescription>
            <CardTitle className="text-3xl">Assessment Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap gap-3">
              <Badge>Automated rubric scoring</Badge>
              <Badge variant="secondary">Conversation quality signals</Badge>
              <Badge variant="secondary">Coaching summary</Badge>
            </div>
            <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
              This assessment experience uses mock evaluation data today, but the structure is
              ready for future AI scoring pipelines that combine transcript analysis, rubric-based
              grading, and progress history over time.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-950 text-white">
          <CardHeader>
            <CardDescription className="text-slate-400">Evaluation summary</CardDescription>
            <CardTitle className="text-white">Latest score</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-6xl font-semibold">{featured.score}%</p>
            <p className="mt-3 text-sm leading-6 text-slate-300">{featured.summary}</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <AssessmentCard assessment={featured} />

        <Card className="bg-white/90">
          <CardHeader>
            <CardDescription>AI recommendations</CardDescription>
            <CardTitle>Next best actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              "Ask one tighter reproduction question before exploring multiple root causes.",
              "Use stronger ownership language when confirming follow-up timelines.",
              "Close each simulation with a concise verbal summary and customer confirmation.",
            ].map((item) => (
              <div key={item} className="rounded-2xl border bg-slate-50 p-4 text-sm text-slate-700">
                {item}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        {evaluationList.map((assessment) => (
          <AssessmentCard key={assessment.id} assessment={assessment} />
        ))}
      </section>
    </div>
  );
}
