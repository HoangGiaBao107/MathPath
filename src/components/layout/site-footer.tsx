"use client";

import Link from "next/link";
import { useLocale } from "@/components/providers/locale-provider";

export function SiteFooter() {
  const { messages } = useLocale();
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <Link className="footer-brand" href="#top">
          <span className="footer-brand-mark" aria-hidden="true">
            M
          </span>
          MathPath
        </Link>
        <span>{messages.footer.tagline}</span>
        <span>{messages.footer.copyright}</span>
      </div>
    </footer>
  );
}
