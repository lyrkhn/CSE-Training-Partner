import { redirect } from "next/navigation";

export default async function AdminRoleplaySessionRedirect({
  params,
}: {
  params: Promise<{ rolePlayId: string }>;
}) {
  const { rolePlayId } = await params;

  redirect(`/admin/roleplays/preview/${rolePlayId}/session`);
}
