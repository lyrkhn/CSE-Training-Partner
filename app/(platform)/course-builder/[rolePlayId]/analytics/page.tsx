import { Suspense } from "react";

import { CourseAnalyticsPage } from "@/components/admin/course-analytics-page";
import { MockRoleGuard } from "@/components/auth/mock-role-guard";

export default async function CourseBuilderAnalyticsRoute({
  params,
}: {
  params: Promise<{ rolePlayId: string }>;
}) {
  const { rolePlayId } = await params;

  return (
    <MockRoleGuard allowedRoles={["root_admin", "course_admin"]}>
      <Suspense fallback={<div className="text-sm text-slate-500">Loading course analytics...</div>}>
        <CourseAnalyticsPage rolePlayId={rolePlayId} />
      </Suspense>
    </MockRoleGuard>
  );
}
