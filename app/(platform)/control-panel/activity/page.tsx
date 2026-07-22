import { ActivityLogPanel } from "@/components/admin/activity-log-panel";
import { MockRoleGuard } from "@/components/auth/mock-role-guard";

export default function ControlPanelActivityPage() {
  return (
    <MockRoleGuard allowedRoles={["root_admin"]}>
      <ActivityLogPanel />
    </MockRoleGuard>
  );
}
