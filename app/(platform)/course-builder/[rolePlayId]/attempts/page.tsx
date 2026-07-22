import { Suspense } from "react";

import { CourseAttemptsPage } from "@/components/admin/course-attempts-page";
import { MockRoleGuard } from "@/components/auth/mock-role-guard";

export default async function CourseBuilderAttemptsRoute({
  params,
}: {
  params: Promise<{ rolePlayId: string }>;
}) {
  const { rolePlayId } = await params;

  return (
    <MockRoleGuard allowedRoles={["root_admin", "course_admin"]}>
      <Suspense fallback={<div className="text-sm text-slate-500">Loading course attempts...</div>}>
        <CourseAttemptsPage rolePlayId={rolePlayId} />
      </Suspense>
    </MockRoleGuard>
  );
}
