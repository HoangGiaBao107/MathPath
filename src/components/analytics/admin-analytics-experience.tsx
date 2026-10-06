"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { LineChart } from "@/components/analytics/line-chart";
import { useLocale } from "@/components/providers/locale-provider";
import { Card } from "@/components/ui/card";
import type { AdminAnalytics } from "@/lib/analytics/types";

type Range = 7 | 30 | 90;
type UserSort = "questions" | "attempts" | "score";

export function AdminAnalyticsExperience({ data }: { data: AdminAnalytics }) {
  const { locale, messages } = useLocale();
  const copy = messages.adminAnalytics;
  const vi = locale === "vi";
  const [range, setRange] = useState<Range>(30);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<UserSort>("questions");
  const activity = data.dailyActivity.slice(-range);
  const scoreTrend = data.scoreTrend.filter((point) =>
    activity.some((day) => day.date === point.date),
  );
  const userRows = useMemo(
    () =>
      data.users
        .filter((user) =>
          `${user.email ?? ""} ${user.displayName}`
            .toLocaleLowerCase()
            .includes(search.toLocaleLowerCase()),
        )
        .slice()
        .sort((left, right) => {
          if (sort === "attempts")
            return (
              right.attempts - left.attempts || right.questionsAttempted - left.questionsAttempted
            );
          if (sort === "score") return (right.averageScore ?? -1) - (left.averageScore ?? -1);
          return (
            right.questionsAttempted - left.questionsAttempted || right.attempts - left.attempts
          );
        }),
    [data.users, search, sort],
  );
  const accountPlans = [
    { label: copy.free, value: data.subscriptions.free, color: "#d1d5db" },
    { label: copy.plus, value: data.subscriptions.plus, color: "#f7b4b7" },
    { label: copy.pro, value: data.subscriptions.pro, color: "#d71920" },
    { label: copy.proMax, value: data.subscriptions.proMax, color: "#8d1117" },
    { label: copy.otherVip, value: data.subscriptions.otherVip, color: "#a855f7" },
  ];
  return (
    <div className="admin-dashboard-layout">
      <aside className="admin-sidebar" aria-label={vi ? "Điều hướng quản trị" : "Admin navigation"}>
        <div className="admin-sidebar-brand"><Image className="admin-sidebar-mark" src="/branding/logo.png" alt="" width={40} height={40} /><span>MathPath<small>ADMIN</small></span></div>
        <p className="admin-sidebar-caption">{vi ? "QUẢN LÝ" : "MANAGEMENT"}</p>
        <a className="is-active" href="#overview">▦ <span>{vi ? "Tổng quan" : "Overview"}</span></a>
        <a href="#analytics-activity">⌁ <span>{vi ? "Lưu lượng & hoạt động" : "Traffic & activity"}</span></a>
        <a href="#attempt-history">◷ <span>{vi ? "Lịch sử làm bài" : "Attempt history"}</span></a>
        <a href="#users">♙ <span>{vi ? "Người dùng" : "Users"}</span></a>
        <a href="#plans">◇ <span>{vi ? "Gói thành viên" : "Membership plans"}</span></a>
        <a href="/" className="admin-sidebar-back">← <span>{vi ? "Về trang học tập" : "Back to platform"}</span></a>
      </aside>
      <main className="page-shell analytics-page admin-analytics-page" id="main-content">
      <header className="analytics-page-heading" id="overview">
        <p className="eyebrow">ADMIN · MATHPATH</p>
        <h1>{copy.title}</h1>
        <p>{copy.description}</p>
      </header>

      <section className="analytics-kpi-grid admin-kpi-grid" aria-label={copy.title}>
        <AdminMetric label={copy.accounts} value={formatCount(data.totalAccounts, locale)} />
        <AdminMetric label={copy.activeVip} value={formatCount(data.totalVip, locale)} accent />
        <AdminMetric label={copy.allAttempts} value={formatCount(data.totalAttempts, locale)} />
        <AdminMetric
          label={copy.averageScore}
          value={formatScore(data.averageScore, locale)}
          suffix="/10"
        />
        <AdminMetric
          label={copy.completionRate}
          value={formatPercent(data.submissionRate, locale)}
        />
        <AdminMetric
          label={copy.averageAttempts}
          value={
            data.averageAttemptsPerAccount === null
              ? "—"
              : formatCount(data.averageAttemptsPerAccount, locale)
          }
        />
      </section>

      <section className="analytics-primary-grid admin-analytics-grid">
        <Card className="analytics-panel analytics-admin-activity" id="analytics-activity">
          <div className="analytics-panel-heading" id="attempt-history">
            <div>
              <p className="eyebrow">{copy.activity}</p>
              <h2>{copy.activity}</h2>
            </div>
            <div className="analytics-range-switch" role="group" aria-label={copy.activity}>
              {([7, 30, 90] as const).map((days) => (
                <button
                  type="button"
                  key={days}
                  aria-pressed={range === days}
                  onClick={() => setRange(days)}
                >
                  {days === 7 ? copy.range7 : days === 30 ? copy.range30 : copy.range90}
                </button>
              ))}
            </div>
          </div>
          <div className="analytics-activity-legend">
            <span>
              <i className="analytics-legend-dot analytics-legend-dot--red" />
              {copy.submissions}
            </span>
            <span>
              <i className="analytics-legend-dot analytics-legend-dot--dark" />
              {copy.activeUsers}
            </span>
          </div>
          {activity.length ? (
            <LineChart
              ariaLabel={copy.activity}
              labels={activity.map((day) => formatDateShort(day.date, locale))}
              series={[
                {
                  label: copy.submissions,
                  color: "#d71920",
                  values: activity.map((day) => day.submissions),
                },
                {
                  label: copy.activeUsers,
                  color: "#1f2937",
                  values: activity.map((day) => day.activeUsers),
                },
              ]}
              formatValue={(value) => formatCount(value, locale)}
            />
          ) : (
            <p className="analytics-empty-message">{copy.noActivity}</p>
          )}
          <div className="analytics-period-summary">
            {([7, 30, 90] as const).map((days) => {
              const slice = data.dailyActivity.slice(-days);
              const total = slice.reduce((sum, day) => sum + day.submissions, 0);
              return (
                <div key={days}>
                  <span>
                    {days === 7 ? copy.range7 : days === 30 ? copy.range30 : copy.range90}
                  </span>
                  <strong>{formatCount(total, locale)}</strong>
                  <small>{copy.submissions}</small>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="analytics-panel analytics-admin-score">
          <div className="analytics-panel-heading">
            <div>
              <p className="eyebrow">{copy.scoreTrend}</p>
              <h2>{copy.scoreTrend}</h2>
            </div>
          </div>
          {scoreTrend.length ? (
            <LineChart
              ariaLabel={copy.scoreTrend}
              labels={scoreTrend.map((point) => formatDateShort(point.date, locale))}
              series={[
                {
                  label: copy.dailyAverage,
                  color: "#d71920",
                  values: scoreTrend.map((point) => point.averageScore),
                },
              ]}
              formatValue={(value) => formatNumber(value, locale)}
            />
          ) : (
            <p className="analytics-empty-message">{copy.noActivity}</p>
          )}
        </Card>
      </section>

      <section className="analytics-primary-grid admin-analytics-grid">
        <Card className="analytics-panel" id="plans">
          <div className="analytics-panel-heading">
            <div>
              <p className="eyebrow">{copy.targetDistribution}</p>
              <h2>{copy.targetDistribution}</h2>
            </div>
          </div>
          {data.targetDistribution.some((item) => item.count > 0) ? (
            <div className="analytics-histogram" role="img" aria-label={copy.targetDistribution}>
              {data.targetDistribution.map((item) => {
                const max = Math.max(1, ...data.targetDistribution.map((bucket) => bucket.count));
                return (
                  <div
                    className="analytics-histogram-column"
                    key={item.bucket}
                    title={`${item.label}: ${item.count}`}
                  >
                    <span className="analytics-histogram-value">{item.count || ""}</span>
                    <div>
                      <i style={{ height: `${(item.count / max) * 100}%` }} />
                    </div>
                    <small>{item.label}</small>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="analytics-empty-message">{copy.noTargets}</p>
          )}
        </Card>

        <Card className="analytics-panel">
          <div className="analytics-panel-heading">
            <div>
              <p className="eyebrow">{copy.subscriptions}</p>
              <h2>{copy.subscriptions}</h2>
            </div>
          </div>
          <div className="analytics-plan-total">
            <strong>{formatCount(data.totalAccounts, locale)}</strong>
            <span>{copy.accounts}</span>
          </div>
          <div className="analytics-plan-list">
            {accountPlans.map((plan) => (
              <div className="analytics-plan-row" key={plan.label}>
                <span>
                  <i style={{ backgroundColor: plan.color }} />
                  {plan.label}
                </span>
                <strong>{formatCount(plan.value, locale)}</strong>
                <div className="analytics-plan-track">
                  <i
                    style={{
                      width: `${data.totalAccounts ? (plan.value / data.totalAccounts) * 100 : 0}%`,
                      backgroundColor: plan.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="analytics-history-section" id="users">
        <div className="analytics-section-heading">
          <div>
            <p className="eyebrow">{copy.questionsByUser}</p>
            <h2>{copy.questionsByUser}</h2>
          </div>
        </div>
        <Card className="analytics-users-card">
          <div className="analytics-users-tools">
            <input
              aria-label={copy.searchUsers}
              placeholder={copy.searchUsers}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <label>
              {copy.attempts}
              <select value={sort} onChange={(event) => setSort(event.target.value as UserSort)}>
                <option value="questions">{copy.questions}</option>
                <option value="attempts">{copy.attempts}</option>
                <option value="score">{copy.averageScore}</option>
              </select>
            </label>
          </div>
          {userRows.length === 0 ? (
            <p className="analytics-empty-message">
              {data.users.length === 0 ? copy.noAccounts : copy.noUsers}
            </p>
          ) : (
            <div className="analytics-table-scroll">
              <table className="analytics-users-table">
                <thead>
                  <tr>
                    <th>{copy.user}</th>
                    <th>{copy.questions}</th>
                    <th>{copy.attempts}</th>
                    <th>{copy.averageScore}</th>
                  </tr>
                </thead>
                <tbody>
                  {userRows.map((user) => (
                    <tr key={user.userId}>
                      <td>
                        <strong>{user.displayName || copy.unknownUser}</strong>
                        <small>{user.email ?? user.userId}</small>
                      </td>
                      <td>{formatCount(user.questionsAttempted, locale)}</td>
                      <td>{formatCount(user.attempts, locale)}</td>
                      <td>
                        {formatScore(user.averageScore, locale)}
                        {user.averageScore === null ? "" : "/10"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>
      </main>
    </div>
  );
}

function AdminMetric({
  label,
  value,
  suffix,
  accent = false,
}: {
  label: string;
  value: string;
  suffix?: string;
  accent?: boolean;
}) {
  return (
    <Card className={`analytics-metric${accent ? " analytics-metric--accent" : ""}`}>
      <span>{label}</span>
      <strong>
        {value}
        {suffix ? <small>{suffix}</small> : null}
      </strong>
    </Card>
  );
}

function formatCount(value: number, locale: "vi" | "en") {
  return value.toLocaleString(locale === "vi" ? "vi-VN" : "en-US", { maximumFractionDigits: 2 });
}

function formatNumber(value: number, locale: "vi" | "en") {
  return value.toLocaleString(locale === "vi" ? "vi-VN" : "en-US", { maximumFractionDigits: 2 });
}

function formatScore(value: number | null, locale: "vi" | "en") {
  return value === null ? "—" : formatNumber(value, locale);
}

function formatPercent(value: number | null, locale: "vi" | "en") {
  return value === null ? "—" : `${formatNumber(value, locale)}%`;
}

function formatDateShort(value: string, locale: "vi" | "en") {
  const day = new Date(`${value}T12:00:00Z`);
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(day);
}
