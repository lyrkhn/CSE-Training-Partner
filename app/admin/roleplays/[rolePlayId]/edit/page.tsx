import { redirect } from "next/navigation";

export default async function AdminRoleplayEditRedirect({
  params,
}: {
  params: Promise<{ rolePlayId: string }>;
}) {
  const { rolePlayId } = await params;

  redirect(`/course-builder/${rolePlayId}/edit`);
}
