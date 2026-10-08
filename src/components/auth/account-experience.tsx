"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LineChart } from "@/components/analytics/line-chart";
import { useLocale } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { authMessages } from "@/lib/i18n/auth-messages";
import type { StudentProgress } from "@/lib/analytics/types";
import { PasswordInput } from "@/components/auth/password-input";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { creditPolicy } from "@/lib/credits/types";
import { getScoreGoalMessage } from "@/lib/analytics/score-encouragement";
import { PaymentAccountPanel } from "@/components/payments/payment-account-panel";
import { PaymentPlanCards } from "@/components/payments/payment-plan-cards";

export function AccountExperience({
  email,
  username,
  targetScore,
  isAdmin = false,
  progress,
  configured,
}: {
  email: string | null;
  username: string | null;
  targetScore?: number | null;
  isAdmin?: boolean;
  progress?: StudentProgress | null;
  configured: boolean;
}) {
  const router = useRouter();
  const { locale } = useLocale();
  const copy = authMessages[locale];
  const vi = locale === "vi";
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [name, setName] = useState(username ?? "");
  const [aim, setAim] = useState(targetScore == null ? "" : String(targetScore));
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [currentPlan, setCurrentPlan] = useState("starter");

  useEffect(() => {
    let active = true;
    void fetch("/api/ai/quota", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = (await response.json()) as { quota?: { plan?: string } };
        if (active && payload.quota?.plan) {
          const normalizedPlan = payload.quota.plan === "free" ? "starter" : payload.quota.plan;
          setCurrentPlan(
            creditPolicy.paidPlans.some((plan) => plan.slug === normalizedPlan)
              ? normalizedPlan
              : "starter",
          );
        }
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  async function signOut() {
    setError("");
    let cleared = false;
    try {
      const response = await fetch("/api/auth/sign-out", { method: "POST" });
      cleared = response.ok;
    } catch {
      // Fall through to the browser session cleanup.
    }
    try {
      const { error: browserError } = await getSupabaseBrowserClient().auth.signOut();
      cleared = cleared || !browserError;
    } catch {
      // The server sign-out may already have cleared the session.
    }
    if (!cleared) {
      setError(vi ? "Chưa đăng xuất được. Hãy tải lại trang rồi thử lại." : "Could not sign out. Reload the page and try again.");
      return;
    }
    window.location.replace("/");
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSavingProfile(true);
    try {
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: name.trim(),
          targetScore: aim === "" ? null : Number(aim),
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: { code?: string } } | null;
      if (!response.ok) {
        setError(payload?.error?.code === "username_taken" ? copy.usernameTaken : copy.genericError);
        return;
      }
      setNotice(vi ? "Đã lưu hồ sơ của bạn." : "Your profile is saved.");
      window.dispatchEvent(new Event("mathpath:profile-updated"));
      router.refresh();
    } catch {
      setError(copy.genericError);
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice("");
    if (newPassword.length < 8 || newPassword !== confirmPassword) {
      setError(newPassword.length < 8 ? copy.invalid : (vi ? "Mật khẩu xác nhận chưa khớp." : "Passwords do not match.")); return;
    }
    setSavingPassword(true);
    try {
      const response = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: newPassword }) });
      if (!response.ok) throw new Error();
      setNewPassword(""); setConfirmPassword(""); setNotice(vi ? "Đã cập nhật mật khẩu." : "Password updated.");
    } catch { setError(copy.genericError); } finally { setSavingPassword(false); }
  }

  const labels = progress?.trend.map((point) => new Intl.DateTimeFormat(vi ? "vi-VN" : "en-US", { day: "2-digit", month: "2-digit" }).format(new Date(point.submittedAt))) ?? [];
  const trendSeries = progress?.trend.length ? [{ label: vi ? "Điểm từng đề" : "Exam scores", color: "#d71920", values: progress.trend.map((point) => point.score) }, ...(progress.targetScore === null ? [] : [{ label: vi ? "Mục tiêu" : "Target", color: "#1f2937", dashed: true, values: progress.trend.map(() => progress.targetScore!) }])] : [];
  const latestScore = progress?.trend.at(-1)?.score;
  const scoreMessage = getScoreGoalMessage(latestScore, progress?.targetScore ?? targetScore ?? null, locale);
  const activePlanName = currentPlan === "starter"
    ? "Starter"
    : creditPolicy.paidPlans.find((plan) => plan.slug === currentPlan)?.name ?? currentPlan;

  return (
    <main className="site-main page-shell account-dashboard container" id="main-content">
      <header className="account-dashboard-heading">
        <div className="account-heading-top">
          <p className="eyebrow">MATHPATH · {vi ? "HỒ SƠ HỌC TẬP" : "LEARNING PROFILE"}</p>
          {isAdmin ? (
            <Link className="button button--secondary button--small" href="/admin/analytics">
              {vi ? "Trang quản trị" : "Admin dashboard"}
            </Link>
          ) : null}
        </div>
        <h1>{copy.accountTitle}</h1>
        <p>{vi ? "Chỉnh hồ sơ, xem điểm và chọn nhịp học hợp với bạn." : "Update your profile, review your scores, and find a plan that fits."}</p>
      </header>
      {!configured ? <Card className="account-panel">{copy.setupMissing}</Card> : (
        <>
          <div className="account-dashboard-grid">
            <div className="account-learning-column account-left-column">
              <Card className="account-panel account-profile-panel">
                <h2>{name || (vi ? "Chọn tên đăng nhập" : "Choose a username")}</h2>
                <p className="account-email">{email || "—"}</p>
                <form className="auth-form" onSubmit={(event) => void saveProfile(event)}>
                  <label>{copy.username}<input autoComplete="username" value={name} onChange={(event) => setName(event.target.value)} minLength={3} maxLength={30} pattern="[A-Za-z0-9._-]{3,30}" required /></label>
                  <p className="account-field-hint">{vi ? "Tên đăng nhập cũng là tên hiển thị của bạn. Dùng 3–30 chữ cái, số, dấu chấm, gạch dưới hoặc gạch ngang." : "Your username is also your display name. Use 3–30 letters, numbers, dots, underscores, or hyphens."}</p>
                  <label>{copy.email}<input value={email ?? "—"} readOnly /></label>
                  <label>{vi ? "Gói học tập" : "Learning plan"}<input value={activePlanName} readOnly /></label>
                  <label>{copy.targetScoreLabel} (0–10)<input type="number" min="0" max="10" step="0.1" value={aim} onChange={(event) => setAim(event.target.value)} placeholder={vi ? "Chưa đặt mục tiêu" : "No target set"} /></label>
                  <Button type="submit" disabled={savingProfile}>{savingProfile ? (vi ? "Đang lưu…" : "Saving…") : (vi ? "Lưu hồ sơ" : "Save profile")}</Button>
                </form>
              </Card>
              <Card className="account-panel account-password-panel">
                <div className="account-panel-heading"><div><p className="eyebrow">{vi ? "BẢO MẬT" : "SECURITY"}</p><h2>{vi ? "Đổi mật khẩu" : "Change password"}</h2></div></div>
                <form className="auth-form account-password-form" onSubmit={(event) => void changePassword(event)}>
                  <label>{copy.newPassword}<PasswordInput autoComplete="new-password" minLength={8} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label>
                  <label>{vi ? "Nhập lại mật khẩu mới" : "Confirm new password"}<PasswordInput autoComplete="new-password" minLength={8} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label>
                  <Button type="submit" disabled={savingPassword}>{savingPassword ? (vi ? "Đang cập nhật…" : "Updating…") : copy.submitPassword}</Button>
                </form>
                <p className="account-recovery-link"><Link href="/auth/recovery">{vi ? "Quên mật khẩu? Gửi liên kết đặt lại qua email" : "Forgot your password? Request an email reset link"}</Link></p>
                <Button className="account-signout" onClick={() => void signOut()} variant="secondary">{copy.signOut}</Button>
              </Card>
            </div>

            <div className="account-learning-column">
              <Card className="account-panel account-score-panel">
                <div className="account-panel-heading"><div><p className="eyebrow">{vi ? "TIẾN BỘ CỦA BẠN" : "YOUR PROGRESS"}</p><h2>{scoreMessage.title}</h2><p className="account-score-message">{scoreMessage.body}</p></div><Link href="/progress" className="text-link">{vi ? "Mở lịch sử →" : "View history →"}</Link></div>
                <div className="account-score-summary"><strong>{progress?.averageScore == null ? "—" : progress.averageScore.toLocaleString(vi ? "vi-VN" : "en-US", { maximumFractionDigits: 2 })}<small>/10</small></strong><span>{vi ? "Điểm trung bình" : "Average score"}</span><strong>{progress?.totalAttempts ?? 0}</strong><span>{vi ? "Đề đã nộp" : "Exams submitted"}</span></div>
                {labels.length ? <><LineChart ariaLabel={vi ? "Biểu đồ điểm và mục tiêu" : "Scores and target chart"} labels={labels} series={trendSeries} formatValue={(value) => value.toLocaleString(vi ? "vi-VN" : "en-US", { maximumFractionDigits: 1 })} /><div className="account-chart-legend"><span><i />{vi ? "Điểm từng đề" : "Exam scores"}</span>{progress?.targetScore != null ? <span className="account-chart-target"><i />{vi ? `Mục tiêu ${progress.targetScore}/10` : `Target ${progress.targetScore}/10`}</span> : null}</div></> : null}
              </Card>
              <Card className="account-panel account-history-preview"><div className="account-panel-heading"><div><p className="eyebrow">{vi ? "ÔN TẬP" : "PRACTICE"}</p><h2>{vi ? "Lịch sử làm bài" : "Attempt history"}</h2></div><Link href="/progress" className="text-link">{vi ? "Xem tất cả →" : "See all →"}</Link></div>
                {progress?.history.slice(0, 4).map((attempt) => <Link className="account-history-row" href={`/progress/attempts/${attempt.attemptId}`} key={attempt.attemptId}><span><strong>{attempt.examTitle}</strong><small>{new Intl.DateTimeFormat(vi ? "vi-VN" : "en-US", { dateStyle: "medium", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(attempt.submittedAt))}</small></span><strong className="account-history-score">{attempt.score.toLocaleString(vi ? "vi-VN" : "en-US", { maximumFractionDigits: 2 })}<small>/10</small></strong><span aria-hidden="true">›</span></Link>)}
                {!progress?.history.length ? <p className="analytics-empty-message">{vi ? "Chưa có bài làm nào. Làm thử một đề nhé!" : "No attempts yet. Try your first exam!"}</p> : null}
              </Card>
            </div>
          </div>
          <section className="account-plans-panel" aria-labelledby="account-plans-title">
            <div className="account-panel-heading"><div><p className="eyebrow">{vi ? "GÓI HỌC MATHPATH" : "MATHPATH PLANS"}</p><h2 id="account-plans-title">{vi ? "Chọn hoặc gia hạn gói học" : "Choose or renew a plan"}</h2></div></div>
            <PaymentPlanCards currentPlan={currentPlan} />
          </section>
          <PaymentAccountPanel />

        </>
      )}
      {error ? <p className="auth-message auth-message--error" role="alert">{error}</p> : null}{notice ? <p className="auth-message" role="status">{notice}</p> : null}
    </main>
  );
}
