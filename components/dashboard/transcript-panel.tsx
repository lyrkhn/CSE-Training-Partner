import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TranscriptEntry } from "@/lib/types";

const speakerTone: Record<TranscriptEntry["speaker"], string> = {
  Learner: "bg-primary/10 text-primary",
  Customer: "bg-slate-100 text-slate-700",
  Coach: "bg-emerald-100 text-emerald-700",
};

export function TranscriptPanel({ entries }: { entries: TranscriptEntry[] }) {
  return (
    <Card className="bg-white/90">
      <CardHeader>
        <CardDescription>Simulation transcript</CardDescription>
        <CardTitle>Conversation timeline</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {entries.map((entry) => (
          <div key={entry.id} className="rounded-2xl border bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <Badge className={speakerTone[entry.speaker]}>{entry.speaker}</Badge>
              <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                {entry.timestamp}
              </span>
            </div>
            <p className="text-sm leading-6 text-slate-700">{entry.message}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
