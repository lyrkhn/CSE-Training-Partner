import type { AuthSessionUser } from "@/src/lib/auth/session";
import type { RolePlayConfig } from "@/src/lib/roleplays/types";

export function canUserAccessRolePlay(user: AuthSessionUser, roleplay: RolePlayConfig) {
  if (user.role === "root_admin" || user.role === "course_admin") {
    return true;
  }

  const assignedTraineeIds = roleplay.settings.assignedTraineeIds ?? [];
  return roleplay.status === "published" && assignedTraineeIds.includes(user.id);
}

export function visibleRoleplaysForUser(user: AuthSessionUser, roleplays: RolePlayConfig[]) {
  return roleplays.filter((roleplay) => canUserAccessRolePlay(user, roleplay));
}

