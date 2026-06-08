import { Suspense } from "react";

import { RolePlayBuilder } from "@/components/admin/role-play-builder";
import { MockRoleGuard } from "@/components/auth/mock-role-guard";

export default function NewCourseBuilderRolePlayPage() {
  return (
    <MockRoleGuard allowedRoles={["root_admin", "course_admin"]}>
      <Suspense fallback={<div className="text-sm text-slate-500">Loading role play builder...</div>}>
        <RolePlayBuilder embedded />
      </Suspense>
    </MockRoleGuard>
  );
}
