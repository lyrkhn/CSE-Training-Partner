import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Scenario } from "@/lib/types";

export function ScenarioCard({ scenario }: { scenario: Scenario }) {
  return (
    <Card className="h-full bg-white/90">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardDescription>{scenario.category}</CardDescription>
            <CardTitle className="mt-1 text-xl">{scenario.title}</CardTitle>
          </div>
          <Badge variant={scenario.status === "Completed" ? "success" : "default"}>
            {scenario.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm leading-6 text-muted-foreground">{scenario.description}</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-secondary p-4">
            <p className="text-muted-foreground">Difficulty</p>
            <p className="mt-1 font-semibold text-slate-950">{scenario.difficulty}</p>
          </div>
          <div className="rounded-2xl bg-secondary p-4">
            <p className="text-muted-foreground">Est. Duration</p>
            <p className="mt-1 font-semibold text-slate-950">{scenario.duration}</p>
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Course completion</span>
            <span className="font-medium text-slate-950">{scenario.completionRate}%</span>
          </div>
          <Progress value={scenario.completionRate} />
        </div>
        <div className="rounded-2xl border border-dashed border-primary/20 bg-primary/5 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-primary">Skill Focus</p>
          <p className="mt-2 text-sm text-slate-700">{scenario.focus}</p>
        </div>
        <Button className="w-full">Launch Simulation</Button>
      </CardContent>
    </Card>
  );
}
