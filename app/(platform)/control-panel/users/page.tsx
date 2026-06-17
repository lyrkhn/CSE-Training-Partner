import { MockRoleGuard } from "@/components/auth/mock-role-guard";
import { ControlPanel } from "@/components/admin/control-panel";

export default function ControlPanelUsersPage() {
  return (
    <MockRoleGuard allowedRoles={["root_admin", "course_admin"]}>
      <ControlPanel section="users" />
    </MockRoleGuard>
  );
}
