"use client";

import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { getMessages } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/i18n/types";

type LocaleContextValue = { locale: Locale; setLocale: (locale: Locale) => void };
const LocaleContext = createContext<LocaleContextValue | null>(null);
const localeStorageKey = "mathpath.locale.v1";
const localeChangedEvent = "mathpath:locale-changed";

function subscribeToLocale(listener: () => void) {
  window.addEventListener(localeChangedEvent, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(localeChangedEvent, listener);
    window.removeEventListener("storage", listener);
  };
}

function getLocaleSnapshot(): Locale {
  try {
    return window.localStorage.getItem(localeStorageKey) === "en" ? "en" : "vi";
  } catch {
    return "vi";
  }
}

function getLocaleServerSnapshot(): Locale {
  return "vi";
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(
    subscribeToLocale,
    getLocaleSnapshot,
    getLocaleServerSnapshot,
  );

  useEffect(() => {
    document.documentElement.lang = locale === "vi" ? "vi" : "en";
  }, [locale]);

  const value: LocaleContextValue = {
    locale,
    setLocale(nextLocale) {
      try {
        window.localStorage.setItem(localeStorageKey, nextLocale);
      } catch {
        // Locale changes still apply for this visit when storage is unavailable.
      }
      window.dispatchEvent(new Event(localeChangedEvent));
    },
  };

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used inside LocaleProvider");
  return { ...context, messages: getMessages(context.locale) };
}
