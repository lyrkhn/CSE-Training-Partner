import { Suspense } from "react";

import { MockRoleGuard } from "@/components/auth/mock-role-guard";
import { CourseBuilderWorkspace } from "@/components/admin/course-builder-workspace";

export default function CourseBuilderPage() {
  return (
    <MockRoleGuard allowedRoles={["root_admin", "course_admin"]}>
      <Suspense fallback={<div className="text-sm text-slate-500">Loading course builder...</div>}>
        <CourseBuilderWorkspace />
      </Suspense>
    </MockRoleGuard>
  );
}
