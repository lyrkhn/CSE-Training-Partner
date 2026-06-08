import type { MockRole, NavItem } from "@/lib/types";

export const mockRoleStorageKey = "cse-mock-role";

export const mockRoles: Array<{
  id: MockRole;
  label: string;
  description: string;
  displayName: string;
}> = [
  {
    id: "course_admin",
    label: "Course Admin",
    description: "Build and test roleplay courses",
    displayName: "Course Admin",
  },
  {
    id: "trainee",
    label: "Trainee",
    description: "Practice assigned simulations",
    displayName: "Maya Chen",
  },
  {
    id: "root_admin",
    label: "Root Admin",
    description: "Manage platform-wide setup",
    displayName: "Root Admin",
  },
];

export function isMockRole(value: string | null): value is MockRole {
  return value === "root_admin" || value === "course_admin" || value === "trainee";
}

export function canAccessNavItem(role: MockRole, item: Pick<NavItem, "allowedRoles">) {
  return !item.allowedRoles || item.allowedRoles.includes(role);
}
