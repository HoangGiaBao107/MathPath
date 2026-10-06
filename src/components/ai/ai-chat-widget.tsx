"use client";

import { useEffect, useRef, useState } from "react";
import { MathContentView } from "@/components/problems/math-content-view";
import { useLocale } from "@/components/providers/locale-provider";
import { interpolate } from "@/lib/i18n/messages";

type ChatMessage = { role: "user" | "assistant"; content: string };
type Quota = {
  kind: "guest" | "account" | "admin";
  remaining: number | null;
  limit: number | null;
  unlimited: boolean;
};

export function AIChatWidget() {
  const { locale, messages } = useLocale();
  const copy = messages.ai;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/ai/quota", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const body = (await response.json()) as { quota: Quota };
        if (active) setQuota(body.quota);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [open, conversation, busy]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        launcherRef.current?.focus();
      }
      if (event.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), textarea:not([disabled]), a[href]",
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  async function send() {
    const message = input.trim();
    if (!message || busy) return;
    setBusy(true);
    setError(null);
    const pendingConversation = [
      ...conversation,
      { role: "user" as const, content: message },
    ].slice(-12);
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale, messages: pendingConversation }),
      });
      const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok) {
        const code = typeof body.error === "string" ? body.error : "request_failed";
        setError(
          code === "ai_not_configured" ? "setup" : code === "quota_exhausted" ? "quota" : "generic",
        );
        return;
      }
      setConversation([
        ...pendingConversation,
        { role: "assistant", content: String(body.answer ?? "") },
      ]);
      if (body.quota) setQuota(body.quota as Quota);
      setInput("");
    } catch {
      setError("generic");
    } finally {
      setBusy(false);
    }
  }

  const errorText =
    error === "setup"
      ? copy.errorSetup
      : error === "quota"
        ? copy.errorQuota
        : error === "generic"
          ? copy.errorGeneric
          : null;

  return (
    <aside className="ai-chat-widget" aria-label={copy.chatHeading}>
      {open ? (
        <section
          ref={panelRef}
          className="ai-chat-panel"
          id="ai-chat-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="ai-widget-title"
        >
          <header className="ai-chat-panel-header">
            <span className="ai-robot-badge" aria-hidden="true">
              <RobotIcon />
            </span>
            <div className="ai-chat-panel-title">
              <strong id="ai-widget-title">MathPath AI</strong>
              <span>{copy.chatHeading}</span>
            </div>
            <button
              className="ai-chat-close"
              type="button"
              aria-label={copy.chatClose}
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </header>
          <div className="ai-chat-log" aria-live="polite" aria-relevant="additions text">
            {conversation.length === 0 ? (
              <p className="ai-empty-state">{copy.emptyChat}</p>
            ) : (
              conversation.map((item, index) => (
                <div
                  className={`ai-chat-message ai-chat-message--${item.role}`}
                  key={`${index}-${item.role}`}
                >
                  <span>
                    {item.role === "user" ? (locale === "vi" ? "Bạn" : "You") : "MathPath AI"}
                  </span>
                  <div>
                    <MathContentView value={item.content} />
                  </div>
                </div>
              ))
            )}
            {busy ? (
              <p className="ai-loading" role="status">
                {copy.thinking}
              </p>
            ) : null}
            <div ref={endRef} />
          </div>
          <form
            className="ai-chat-composer"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            {errorText ? (
              <p className="ai-chat-error" role="alert">
                {errorText}
              </p>
            ) : null}
            <label className="sr-only" htmlFor="ai-widget-input">
              {copy.chatPlaceholder}
            </label>
            <textarea
              ref={inputRef}
              id="ai-widget-input"
              rows={2}
              maxLength={5000}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={copy.chatPlaceholder}
            />
            <div className="ai-chat-composer-footer">
              {quota ? (
                <span className="ai-quota">
                  {quota.unlimited
                    ? copy.quotaUnlimited
                    : interpolate(quota.kind === "guest" ? copy.quotaGuest : copy.quotaDaily, {
                        remaining: quota.remaining ?? 0,
                        limit: quota.limit ?? 0,
                      })}
                </span>
              ) : (
                <span />
              )}
              <button
                className="button button--primary"
                type="submit"
                disabled={busy || !input.trim() || quota?.remaining === 0}
              >
                {busy ? copy.loading : copy.send}
              </button>
            </div>
            {error === "setup" ? (
              <p className="ai-chat-setup">
                <strong>
                  {locale === "vi" ? "Vì sao chưa chat được?" : "Why is chat unavailable?"}
                </strong>
                {copy.setupHint}
              </p>
            ) : null}
          </form>
        </section>
      ) : null}
      <button
        ref={launcherRef}
        className="ai-chat-launcher"
        type="button"
        aria-label={open ? copy.chatClose : copy.chatLauncher}
        aria-expanded={open}
        aria-controls="ai-chat-panel"
        onClick={() => setOpen((current) => !current)}
      >
        {open ? (
          <span aria-hidden="true" className="ai-widget-x">
            ×
          </span>
        ) : (
          <RobotIcon />
        )}
      </button>
    </aside>
  );
}

function RobotIcon() {
  return (
    <svg className="ai-robot-icon" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <g className="ai-robot-float">
        <path d="M32 9V5" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        <circle className="ai-robot-antenna" cx="32" cy="5" r="4" fill="#fff" />
        <path d="M9 32H5M59 32h-4" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
        <path d="M20 53v4m24-4v4" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
        <rect x="8" y="15" width="48" height="39" rx="16" fill="#fff" />
        <rect x="8" y="15" width="48" height="39" rx="16" stroke="#b80f1b" strokeWidth="2.5" />
        <path
          d="M9.5 30c0-8.01 6.49-14.5 14.5-14.5h17c8.01 0 14.5 6.49 14.5 14.5v1h-46v-1Z"
          fill="#ffedf0"
        />
        <path d="M12 31h40" stroke="#ed1c24" strokeWidth="2" />
        <path
          d="M19 37c0-2.3 1.55-4 3.4-4s3.4 1.7 3.4 4-1.55 4-3.4 4-3.4-1.7-3.4-4Zm19 0c0-2.3 1.55-4 3.4-4s3.4 1.7 3.4 4-1.55 4-3.4 4-3.4-1.7-3.4-4Z"
          fill="#171b2b"
        />
        <circle cx="23.2" cy="36" r="1" fill="white" />
        <circle cx="42.2" cy="36" r="1" fill="white" />
        <ellipse cx="15.5" cy="43" rx="3" ry="1.8" fill="#ffc9cd" />
        <ellipse cx="48.5" cy="43" rx="3" ry="1.8" fill="#ffc9cd" />
        <path
          d="M25 44c1.7 2.2 4 3.2 7 3.2s5.3-1 7-3.2"
          stroke="#ed1c24"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <rect x="27" y="52" width="10" height="7" rx="2.5" fill="#fff" />
        <text x="32" y="57.2" fill="#ed1c24" fontSize="5" fontWeight="900" textAnchor="middle">
          M
        </text>
      </g>
    </svg>
  );
}
