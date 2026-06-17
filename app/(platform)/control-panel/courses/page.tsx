import { MockRoleGuard } from "@/components/auth/mock-role-guard";
import { ControlPanel } from "@/components/admin/control-panel";

export default function ControlPanelCoursesPage() {
  return (
    <MockRoleGuard allowedRoles={["root_admin", "course_admin"]}>
      <ControlPanel section="courses" />
    </MockRoleGuard>
  );
}
