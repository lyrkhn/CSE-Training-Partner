import { Card, CardContent } from "@/components/ui/card";
import type { ProfileMetric } from "@/lib/types";

export function ProfileStats({ metrics }: { metrics: ProfileMetric[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <Card key={metric.label} className="bg-white/90">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{metric.label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              {metric.value}
            </p>
            <p className="mt-2 text-sm text-primary">{metric.helper}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
