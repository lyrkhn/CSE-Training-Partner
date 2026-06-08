"use client";

import { useSearchParams } from "next/navigation";

import { CreatedRoleplaysList } from "@/components/admin/created-roleplays-list";
import { RolePlayBuilder } from "@/components/admin/role-play-builder";

export function CourseBuilderWorkspace() {
  const searchParams = useSearchParams();
  const previewRolePlayId = searchParams.get("preview");

  if (previewRolePlayId) {
    return <RolePlayBuilder embedded />;
  }

  return <CreatedRoleplaysList />;
}
