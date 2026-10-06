"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function SiteVisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (
      !pathname || pathname === "/admin" || pathname.startsWith("/admin/") ||
      pathname === "/auth" || pathname.startsWith("/auth/") ||
      pathname.startsWith("/api/") || pathname.startsWith("/_next/")
    ) return;

    void fetch("/api/analytics/page-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname }),
      keepalive: true,
    }).catch(() => undefined);
  }, [pathname]);

  return null;
}
