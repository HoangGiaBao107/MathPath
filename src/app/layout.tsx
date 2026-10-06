import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SkipNavigation } from "@/components/layout/skip-navigation";
import { AIChatWidget } from "@/components/ai/ai-chat-widget";
import { LocaleProvider } from "@/components/providers/locale-provider";
import "./globals.css";
import "katex/dist/katex.min.css";

export const metadata: Metadata = {
  title: {
    default: "MathPath — Your Math, your Path",
    template: "%s | MathPath",
  },
  description:
    "Ôn đúng phần cần học, hiểu cách giải từng bước và tự tin tiến gần mục tiêu THPTQG cùng MathPath.",
  applicationName: "MathPath",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  alternates: { canonical: "/", languages: { "vi-VN": "/", "en-US": "/" } },
  openGraph: {
    type: "website",
    siteName: "MathPath",
    title: "MathPath — Your Math, your Path",
    description:
      "Ôn đúng phần cần học, hiểu cách giải từng bước và tự tin tiến gần mục tiêu THPTQG cùng MathPath.",
    locale: "vi_VN",
    alternateLocale: ["en_US"],
    url: "/",
  },
  twitter: {
    card: "summary",
    title: "MathPath — Your Math, your Path",
    description:
      "Ôn đúng phần cần học, hiểu cách giải từng bước và tự tin tiến gần mục tiêu THPTQG cùng MathPath.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="vi">
      <body>
        <LocaleProvider>
          <SkipNavigation />
          <SiteHeader />
          {children}
          <AIChatWidget />
          <SiteFooter />
        </LocaleProvider>
      </body>
    </html>
  );
}
