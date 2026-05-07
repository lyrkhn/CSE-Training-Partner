import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Assessment } from "@/lib/types";

export function AssessmentCard({ assessment }: { assessment: Assessment }) {
  return (
    <Card className="h-full bg-white/90">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardDescription>{assessment.evaluatedAt}</CardDescription>
            <CardTitle>{assessment.title}</CardTitle>
          </div>
          <Badge variant={assessment.score >= 85 ? "success" : "warning"}>
            {assessment.score}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-muted-foreground">{assessment.summary}</p>
        <div className="space-y-3">
          {assessment.dimensions.map((dimension) => (
            <div key={dimension.label} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-700">{dimension.label}</span>
                <span className="font-medium text-slate-950">{dimension.value}%</span>
              </div>
              <Progress value={dimension.value} />
            </div>
          ))}
        </div>
        <div className="rounded-2xl bg-secondary p-4 text-sm text-slate-700">
          <span className="font-semibold text-slate-950">Coach note:</span> {assessment.coachNote}
        </div>
      </CardContent>
    </Card>
  );
}
