import type { AuthSessionUser } from "@/src/lib/auth/session";
import type { RolePlayConfig } from "@/src/lib/roleplays/types";

export function canUserAccessRolePlay(user: AuthSessionUser, roleplay: RolePlayConfig) {
  if (user.role === "root_admin" || user.role === "course_admin") {
    return true;
  }

  return canUserTakeRolePlay(user, roleplay);
}

export function canUserTakeRolePlay(user: AuthSessionUser, roleplay: RolePlayConfig) {
  const assignedTraineeIds = roleplay.settings.assignedTraineeIds ?? [];
  return (
    roleplay.status === "published" &&
    (user.role === "trainee" || user.role === "course_admin") &&
    assignedTraineeIds.includes(user.id)
  );
}

export function canUserManageRolePlay(user: AuthSessionUser, roleplay: RolePlayConfig) {
  return user.role === "root_admin" || roleplay.createdBy?.id === user.id;
}

export function visibleRoleplaysForUser(user: AuthSessionUser, roleplays: RolePlayConfig[]) {
  if (user.role === "root_admin") {
    return roleplays.filter((roleplay) => roleplay.status === "published");
  }

  return roleplays.filter((roleplay) => canUserTakeRolePlay(user, roleplay));
}
