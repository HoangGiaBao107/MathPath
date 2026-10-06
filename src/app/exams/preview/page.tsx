import { redirect } from "next/navigation";

export const metadata = { title: "Luyện đề | MathPath" };

export default function PreviewIndexPage() {
  redirect("/problems");
}
