"use client";

import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/providers/locale-provider";
import { authMessages } from "@/lib/i18n/auth-messages";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const { locale, setLocale, messages } = useLocale();
  const authCopy = authMessages[locale];
  const navigation = [
    { label: messages.navigation.home, href: "/" as const },
    { label: messages.navigation.practice, href: "/problems" as const },
    { label: messages.navigation.ai, href: "/ai" as const },
    { label: locale === "vi" ? "Lịch sử làm bài" : "Attempt history", href: "/progress" as const },
    { label: messages.navigation.plans, href: "/#plans" as const },
    ...(isAdmin
      ? [{ label: locale === "vi" ? "Quản trị" : "Admin", href: "/admin/analytics" as const }]
      : []),
  ];

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, []);

  useEffect(() => {
    try {
      const supabase = getSupabaseBrowserClient();
      async function syncUser(user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] | null) {
        setSignedIn(Boolean(user));
        if (!user) {
          setAccountName("");
          setIsAdmin(false);
          return;
        }
        const metadataUsername = typeof user.user_metadata?.username === "string" ? user.user_metadata.username : "";
        setAccountName(metadataUsername || user.email?.split("@")[0] || "");
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("username, display_name, role")
          .eq("id", user.id)
          .maybeSingle();
        if (!error) {
          setAccountName(profile?.username?.trim() || profile?.display_name?.trim() || metadataUsername || user.email?.split("@")[0] || "");
          setIsAdmin(profile?.role === "admin");
        }
      }
      void supabase.auth.getUser().then(({ data }) => void syncUser(data.user));
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        void syncUser(session?.user ?? null);
      });
      const refreshProfile = () => void supabase.auth.getUser().then(({ data }) => void syncUser(data.user));
      window.addEventListener("mathpath:profile-updated", refreshProfile);
      return () => {
        subscription.unsubscribe();
        window.removeEventListener("mathpath:profile-updated", refreshProfile);
      };
    } catch {
      // Supabase is optional in the disconnected local mock mode.
    }
  }, []);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="site-header" id="top">
      <div className="container header-inner">
        <Link
          className="brand-link"
          href="/"
          aria-label={messages.navigation.brandHome}
          onClick={closeMenu}
        >
          <Image
            className="brand-image"
            src="/branding/logo.png"
            alt=""
            width={1240}
            height={1240}
            priority
          />
          <span className="brand-wordmark">
            Math<span>Path</span>
          </span>
        </Link>

        <nav
          id="mobile-primary-navigation"
          className={`primary-nav${menuOpen ? " is-open" : ""}`}
          aria-label={messages.navigation.label}
        >
          {navigation.map((item) => (
            <Link href={item.href as Route} key={item.href} onClick={closeMenu}>
              {item.label}
            </Link>
          ))}
          <Link
            className="mobile-account-link"
            href={signedIn ? "/account" : "/auth/login"}
            onClick={closeMenu}
          >
            {signedIn ? accountName || authCopy.accountLink : messages.actions.login}
          </Link>
        </nav>

        <div className="header-actions">
          <div className="language-switch" role="group" aria-label={messages.actions.language}>
            {(["VI", "EN"] as const).map((option) => (
              <button
                aria-pressed={locale.toUpperCase() === option}
                key={option}
                onClick={() => setLocale(option.toLowerCase() as "vi" | "en")}
                type="button"
              >
                {option}
              </button>
            ))}
          </div>
          <Link
            className="button button--secondary button--small header-login"
            href={signedIn ? "/account" : "/auth/login"}
          >
            {signedIn ? accountName || authCopy.accountLink : messages.actions.login}
          </Link>
          <button
            className="mobile-menu-toggle"
            type="button"
            aria-label={menuOpen ? messages.actions.menuClose : messages.actions.menuOpen}
            aria-controls="mobile-primary-navigation"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? (
              <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none">
                <path
                  d="m6 6 12 12M18 6 6 18"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none">
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
