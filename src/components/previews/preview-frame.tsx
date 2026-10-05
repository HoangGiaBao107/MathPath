import type { ReactNode } from "react";
import Link from "next/link";

export function PreviewFrame({
  children,
  showBanner = true,
}: {
  children: ReactNode;
  showBanner?: boolean;
}) {
  return (
    <main className="student-preview-page">
      {showBanner ? (
        <div className="student-preview-banner">
          <strong>BẢN XEM ĐỀ MATHPATH</strong>
          <span>Nội dung được nhập từ Word.</span>
          <Link href="/problems">Về Ngân hàng câu hỏi</Link>
        </div>
      ) : null}
      {children}
    </main>
  );
}
