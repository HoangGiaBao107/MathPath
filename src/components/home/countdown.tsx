"use client";

import { useEffect, useState } from "react";
import {
  EXAM_TIME_ZONE,
  getCountdownParts,
  THPTQG_2027_TIMESTAMP,
  type CountdownParts,
} from "@/lib/config/exam";
import { interpolate } from "@/lib/i18n/messages";
import { useLocale } from "@/components/providers/locale-provider";

function formatExamDate(locale: "vi" | "en") {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-GB", {
    day: "numeric",
    month: locale === "vi" ? "2-digit" : "long",
    year: "numeric",
    timeZone: EXAM_TIME_ZONE,
  }).format(THPTQG_2027_TIMESTAMP);
}

export function ExamCountdown() {
  const { locale, messages } = useLocale();
  const [parts, setParts] = useState<CountdownParts | null>(null);

  useEffect(() => {
    const update = () => setParts(getCountdownParts(Date.now()));
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const date = formatExamDate(locale);
  const values = [
    [messages.home.days, parts?.days],
    [messages.home.hours, parts?.hours],
    [messages.home.minutes, parts?.minutes],
    [messages.home.seconds, parts?.seconds],
  ] as const;
  const accessibleCountdown = parts
    ? interpolate(messages.home.countdownAnnouncement, {
        days: parts.days,
        hours: parts.hours,
        minutes: parts.minutes,
        seconds: parts.seconds,
      })
    : messages.home.countdownTitle;

  return (
    <section className="countdown-section" aria-labelledby="countdown-title">
      <div className="countdown-card">
        <div className="countdown-copy">
          <span className="eyebrow">
            <span className="eyebrow-dot" aria-hidden="true" />
            {messages.home.countdownEyebrow}
          </span>
          <h2 id="countdown-title">{messages.home.countdownTitle}</h2>
          <p>{interpolate(messages.home.examDate, { date })}</p>
        </div>
        {parts?.complete ? (
          <p className="countdown-finished" role="status">
            {messages.home.countdownComplete}
          </p>
        ) : (
          <div
            className="countdown-clock"
            role="timer"
            aria-label={accessibleCountdown}
            aria-live="off"
          >
            <span className="sr-only">{accessibleCountdown}</span>
            <div className="countdown-units" aria-hidden="true">
              {values.map(([label, value], index) => (
                <div className="countdown-unit" key={label}>
                  <span className="countdown-value" key={`${label}-${value ?? "waiting"}`}>
                    {value === undefined ? "—" : String(value).padStart(2, "0")}
                  </span>
                  <span className="countdown-label">{label}</span>
                  {index < values.length - 1 ? (
                    <span className="countdown-separator">:</span>
                  ) : null}
                </div>
              ))}
            </div>
            <p className="countdown-note">{messages.home.deadline}</p>
          </div>
        )}
      </div>
    </section>
  );
}
