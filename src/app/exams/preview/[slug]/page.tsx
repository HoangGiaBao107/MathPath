import { redirect } from "next/navigation";

export default async function SourcePreviewPage({ params }: { params: Promise<{ slug: string }> }) {
  await params;
  redirect("/problems");
}
