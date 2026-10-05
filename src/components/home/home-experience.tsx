"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useLocale } from "@/components/providers/locale-provider";
import { ExamCountdown } from "@/components/home/countdown";
import { Reveal } from "@/components/home/reveal";
import { TargetScoreOnboarding } from "@/components/home/target-score-onboarding";
import { interpolate } from "@/lib/i18n/messages";
import { SectionHeading } from "@/components/ui/section-heading";
import { formatTargetScore } from "@/lib/onboarding/target-score";
import {
  getTargetScoreServerSnapshot,
  getTargetScoreSnapshot,
  subscribeToTargetScoreChanges,
} from "@/lib/onboarding/target-score";

export function HomeExperience() {
  const { messages, locale } = useLocale();
  const targetScore = useSyncExternalStore(
    subscribeToTargetScoreChanges,
    getTargetScoreSnapshot,
    getTargetScoreServerSnapshot,
  );
  const home = messages.home;
  const greeting =
    targetScore === null
      ? messages.microcopy.welcome
      : targetScore < 7
        ? interpolate(messages.microcopy.targetLow, {
            score: formatTargetScore(targetScore, locale),
          })
        : targetScore === 10
          ? messages.microcopy.targetTen
          : interpolate(messages.microcopy.targetHigh, {
              score: formatTargetScore(targetScore, locale),
            });
  const featureItems = [
    {
      id: "practice",
      title: home.practiceTitle,
      description: home.practiceDescription,
      microcopy: home.practiceMicrocopy,
      pointA: home.practicePointA,
      pointB: home.practicePointB,
      label: home.practiceLabel,
      icon: "▤",
      type: "practice",
    },
    {
      id: "ai",
      title: home.aiTitle,
      description: home.aiDescription,
      microcopy: home.aiMicrocopy,
      pointA: home.aiPointA,
      pointB: home.aiPointB,
      label: home.aiLabel,
      icon: "∑",
      type: "ai",
    },
    {
      id: "progress",
      title: home.progressTitle,
      description: home.progressDescription,
      microcopy: home.progressMicrocopy,
      pointA: home.progressPointA,
      pointB: home.progressPointB,
      label: home.progressLabel,
      icon: "↗",
      type: "progress",
    },
    {
      id: "similar-practice",
      title: home.similarTitle,
      description: home.similarDescription,
      microcopy: messages.microcopy.similar,
      pointA: home.similarPointA,
      pointB: home.similarPointB,
      label: home.similarLabel,
      icon: "⌁",
      type: "similar",
    },
  ] as const;

  return (
    <main className="site-main" id="main-content">
      <TargetScoreOnboarding />
      <section className="container home-hero" aria-labelledby="home-title">
        <div className="hero-red-orb" aria-hidden="true">
          <span className="hero-orb-star">✳</span>
          <span className="hero-orb-label">MathPath</span>
        </div>
        <div className="hero-content">
          <p className="eyebrow hero-eyebrow">
            <span className="eyebrow-dot" aria-hidden="true" />
            {home.heroEyebrow}
          </p>
          <p className="hero-typing">{home.heroTyping}</p>
          <h1 className="hero-title" id="home-title">
            {home.heroTitleFirst}
            <span>{home.heroTitleSecond}</span>
          </h1>
          <p className="hero-description">{home.heroDescription}</p>
          <p className="hero-greeting" role="status">
            {greeting}
          </p>
          <div className="hero-actions">
            <Link className="button button--primary button--large" href="/problems">
              {home.practiceCta}
              <span aria-hidden="true">↗</span>
            </Link>
            <Link className="button button--secondary button--large" href="#ai">
              {home.aiCta}
              <span aria-hidden="true">✳</span>
            </Link>
          </div>
          <button
            className="hero-status hero-status--interactive"
            onClick={() => window.dispatchEvent(new Event("mathpath:edit-goal"))}
            type="button"
          >
            <span className="hero-status-mark" aria-hidden="true" />
            {targetScore === null
              ? home.status
              : locale === "vi"
                ? `Mục tiêu hiện tại: ${formatTargetScore(targetScore, locale)} điểm · Thay đổi mục tiêu`
                : `Current goal: ${formatTargetScore(targetScore, locale)} · Change goal`}
          </button>
        </div>
        <div className="hero-preview" aria-label={home.demoLabel}>
          <div className="hero-preview-top">
            <span className="preview-window-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span>{home.demoLabel}</span>
          </div>
          <div className="preview-problem">
            <span className="preview-tag">{home.demoTopic}</span>
            <h2>{home.demoQuestion}</h2>
            <p>{home.demoFormula}</p>
            <div className="preview-rule" />
            <div className="preview-solution">
              <span className="preview-check" aria-hidden="true">
                ✓
              </span>
              <span>{home.demoSteps}</span>
              <span className="preview-arrow" aria-hidden="true">
                ↗
              </span>
            </div>
          </div>
          <span className="hero-preview-stamp" aria-hidden="true">
            M
          </span>
        </div>
        <span className="hero-geometry hero-geometry--one" aria-hidden="true" />
        <span className="hero-geometry hero-geometry--two" aria-hidden="true" />
      </section>

      <ExamCountdown />

      <section className="home-sections feature-section" aria-labelledby="features-title">
        <div className="container">
          <Reveal>
            <SectionHeading
              id="features-title"
              eyebrow={home.overviewEyebrow}
              title={home.overviewTitle}
              description={home.overviewDescription}
            />
          </Reveal>
          <div className="feature-grid">
            {featureItems.map((feature, index) => (
              <Reveal className={`feature-reveal feature-reveal--${index + 1}`} key={feature.id}>
                <article
                  className={`feature-card feature-card--${feature.type} section-anchor`}
                  id={feature.id}
                >
                  <div className="feature-card-top">
                    <span className="feature-icon" aria-hidden="true">
                      {feature.icon}
                    </span>
                    <span className="feature-label">{feature.label}</span>
                  </div>
                  <h3>{feature.title}</h3>
                  <p className="feature-description">{feature.description}</p>
                  <p className="feature-microcopy">{feature.microcopy}</p>
                  <ul className="feature-points">
                    <li>
                      <span aria-hidden="true">✓</span>
                      {feature.pointA}
                    </li>
                    <li>
                      <span aria-hidden="true">✓</span>
                      {feature.pointB}
                    </li>
                  </ul>
                  {feature.type === "practice" ? (
                    <div className="practice-preview" aria-hidden="true">
                      <span>01</span>
                      <span>02</span>
                      <span>03</span>
                      <i />
                    </div>
                  ) : null}
                  {feature.type === "ai" ? (
                    <div className="ai-preview" aria-hidden="true">
                      <span>∫ x² dx</span>
                      <span className="ai-preview-answer">→ x³/3 + C</span>
                    </div>
                  ) : null}
                  {feature.type === "progress" ? (
                    <div className="progress-preview">
                      <div className="progress-preview-label">
                        <span>{home.targetLabel}</span>
                        <strong>
                          {targetScore === null ? "—" : formatTargetScore(targetScore, locale)}
                        </strong>
                      </div>
                      <div className="progress-track" aria-hidden="true">
                        <span
                          style={{
                            width:
                              targetScore === null ? "20%" : `${Math.max(15, targetScore * 8)}%`,
                          }}
                        />
                      </div>
                      <small>{home.targetExample}</small>
                    </div>
                  ) : null}
                  {feature.type === "similar" ? (
                    <div className="similar-preview" aria-hidden="true">
                      <span>f(x)</span>
                      <i>↗</i>
                      <span>f(x + 1)</span>
                    </div>
                  ) : null}
                  {feature.type === "practice" ? (
                    <Link className="feature-link" href="/problems">
                      {home.practiceCta}
                      <span aria-hidden="true">↗</span>
                    </Link>
                  ) : null}
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="goal-section" aria-labelledby="goal-title">
        <div className="container goal-layout">
          <Reveal>
            <div className="goal-copy">
              <span className="eyebrow">
                <span className="eyebrow-dot" aria-hidden="true" />
                {home.targetEyebrow}
              </span>
              <h2 id="goal-title">{home.targetTitle}</h2>
              <p>{home.targetDescription}</p>
              <button
                className="goal-edit-button"
                onClick={() => window.dispatchEvent(new Event("mathpath:edit-goal"))}
                type="button"
              >
                {targetScore === null
                  ? messages.onboarding.save
                  : `${locale === "vi" ? "Sửa mục tiêu" : "Edit goal"} · ${formatTargetScore(targetScore, locale)}`}
                <span aria-hidden="true">↗</span>
              </button>
            </div>
          </Reveal>
          <Reveal>
            <div className="goal-visual" role="group" aria-label={home.targetExample}>
              <span className="goal-orbit goal-orbit--outer" aria-hidden="true" />
              <span className="goal-orbit goal-orbit--inner" aria-hidden="true" />
              <div className="goal-score">
                <span>{home.targetLabel}</span>
                <strong>
                  {targetScore === null ? "?" : formatTargetScore(targetScore, locale)}
                </strong>
                <span>/ 10</span>
              </div>
              <span className="goal-visual-caption">{home.targetExample}</span>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="final-cta-section" aria-labelledby="final-cta-title">
        <div className="container">
          <Reveal>
            <div className="final-cta-card">
              <span className="eyebrow">{home.finalEyebrow}</span>
              <h2 id="final-cta-title">{home.finalTitle}</h2>
              <p>{home.finalDescription}</p>
              <Link className="button button--primary button--large" href="/problems">
                {home.finalCta}
                <span aria-hidden="true">↗</span>
              </Link>
              <span className="final-cta-mark" aria-hidden="true">
                M
              </span>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
