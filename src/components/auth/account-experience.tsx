"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LineChart } from "@/components/analytics/line-chart";
import { useLocale } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { authMessages } from "@/lib/i18n/auth-messages";
import type { StudentProgress } from "@/lib/analytics/types";
import { PasswordInput } from "@/components/auth/password-input";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export function AccountExperience({
  email,
  displayName,
  language,
  targetScore,
  progress,
  configured,
}: {
  email: string | null;
  displayName: string | null;
  language?: string | null;
  targetScore?: number | null;
  progress?: StudentProgress | null;
  configured: boolean;
}) {
  const router = useRouter();
  const { locale } = useLocale();
  const copy = authMessages[locale];
  const vi = locale === "vi";
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [name, setName] = useState(displayName ?? "");
  const [aim, setAim] = useState(targetScore == null ? "" : String(targetScore));
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

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
    event.preventDefault(); setError(""); setNotice(""); setSavingProfile(true);
    try {
      const response = await fetch("/api/auth/profile", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name.trim(), ...(aim === "" ? {} : { targetScore: Number(aim) }) }),
      });
      if (!response.ok) throw new Error();
      setNotice(vi ? "Đã lưu thông tin tài khoản." : "Account details saved."); router.refresh();
    } catch { setError(copy.genericError); } finally { setSavingProfile(false); }
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

  return (
    <main className="page-shell account-dashboard" id="main-content">
      <header className="account-dashboard-heading">
        <p className="eyebrow">MATHPATH · {vi ? "HỒ SƠ HỌC TẬP" : "LEARNING PROFILE"}</p>
        <h1>{copy.accountTitle}</h1>
        <p>{vi ? "Quản lý hồ sơ và xem lại hành trình ôn tập của bạn." : "Manage your profile and review your learning journey."}</p>
      </header>
      {!configured ? <Card className="account-panel">{copy.setupMissing}</Card> : (
        <div className="account-dashboard-grid">
          <Card className="account-panel account-profile-panel">
            <div className="account-avatar" aria-hidden="true">{(displayName || email || "M").slice(0, 1).toUpperCase()}</div>
            <h2>{displayName || (vi ? "Học sinh MathPath" : "MathPath learner")}</h2>
            <p className="account-email">{email || "—"}</p>
            <form className="auth-form" onSubmit={saveProfile}>
              <label>{copy.name}<input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required /></label>
              <label>{copy.email}<input value={email ?? "—"} readOnly /></label>
              <label>{copy.languageLabel}<input value={(language || locale).toUpperCase()} readOnly /></label>
              <label>{copy.targetScoreLabel} (0–10)<input type="number" min="0" max="10" step="0.1" value={aim} onChange={(event) => setAim(event.target.value)} placeholder={vi ? "Chưa đặt mục tiêu" : "No target set"} /></label>
              <Button type="submit" disabled={savingProfile}>{savingProfile ? (vi ? "Đang lưu…" : "Saving…") : (vi ? "Lưu thay đổi" : "Save changes")}</Button>
            </form>
            <section className="account-vip-card"><span className="account-vip-mark">VIP</span><div><strong>{vi ? "Gói học tập nâng cao" : "Advanced learning plan"}</strong><p>{vi ? "Khu vực gói VIP sẽ sớm ra mắt." : "VIP plans will be available later."}</p></div><span className="account-coming-soon">{vi ? "Sắp có" : "Coming soon"}</span></section>
            <Button onClick={() => void signOut()} variant="secondary">{copy.signOut}</Button>
          </Card>

          <div className="account-learning-column">
            <Card className="account-panel account-score-panel">
              <div className="account-panel-heading"><div><p className="eyebrow">{vi ? "KEEP TRACK" : "KEEP TRACK"}</p><h2>{vi ? "Đường điểm của bạn" : "Your score journey"}</h2></div><Link href="/progress" className="text-link">{vi ? "Mở lịch sử →" : "View history →"}</Link></div>
              <div className="account-score-summary"><strong>{progress?.averageScore == null ? "—" : progress.averageScore.toLocaleString(vi ? "vi-VN" : "en-US", { maximumFractionDigits: 2 })}<small>/10</small></strong><span>{vi ? "Điểm trung bình" : "Average score"}</span><strong>{progress?.totalAttempts ?? 0}</strong><span>{vi ? "Đề đã nộp" : "Exams submitted"}</span></div>
              {labels.length ? <><LineChart ariaLabel={vi ? "Biểu đồ điểm và mục tiêu" : "Scores and target chart"} labels={labels} series={trendSeries} formatValue={(value) => value.toLocaleString(vi ? "vi-VN" : "en-US", { maximumFractionDigits: 1 })} /><div className="account-chart-legend"><span><i />{vi ? "Điểm từng đề" : "Exam scores"}</span>{progress?.targetScore != null ? <span className="account-chart-target"><i />{vi ? `Mục tiêu ${progress.targetScore}/10` : `Target ${progress.targetScore}/10`}</span> : null}</div></> : <p className="analytics-empty-message">{vi ? "Nộp đề đầu tiên để bắt đầu theo dõi điểm." : "Submit your first exam to start tracking scores."}</p>}
            </Card>
            <Card className="account-panel account-history-preview"><div className="account-panel-heading"><div><p className="eyebrow">{vi ? "ÔN TẬP" : "PRACTICE"}</p><h2>{vi ? "Lịch sử làm bài" : "Attempt history"}</h2></div><Link href="/progress" className="text-link">{vi ? "Xem tất cả →" : "See all →"}</Link></div>
              {progress?.history.slice(0, 4).map((attempt) => <Link className="account-history-row" href={`/progress/attempts/${attempt.attemptId}`} key={attempt.attemptId}><span><strong>{attempt.examTitle}</strong><small>{new Intl.DateTimeFormat(vi ? "vi-VN" : "en-US", { dateStyle: "medium", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(attempt.submittedAt))}</small></span><strong className="account-history-score">{attempt.score.toLocaleString(vi ? "vi-VN" : "en-US", { maximumFractionDigits: 2 })}<small>/10</small></strong><span aria-hidden="true">›</span></Link>)}
              {!progress?.history.length ? <p className="analytics-empty-message">{vi ? "Chưa có bài làm nào." : "No attempts yet."}</p> : null}
            </Card>
            <Card className="account-panel account-password-panel"><div className="account-panel-heading"><div><p className="eyebrow">{vi ? "BẢO MẬT" : "SECURITY"}</p><h2>{vi ? "Đổi mật khẩu" : "Change password"}</h2></div></div><form className="auth-form account-password-form" onSubmit={changePassword}><label>{copy.newPassword}<PasswordInput autoComplete="new-password" minLength={8} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label><label>{vi ? "Nhập lại mật khẩu mới" : "Confirm new password"}<PasswordInput autoComplete="new-password" minLength={8} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label><Button type="submit" disabled={savingPassword}>{savingPassword ? (vi ? "Đang cập nhật…" : "Updating…") : copy.submitPassword}</Button></form><p className="account-recovery-link"><Link href="/auth/recovery">{vi ? "Quên mật khẩu? Gửi liên kết đặt lại qua email" : "Forgot your password? Request an email reset link"}</Link></p></Card>
          </div>
        </div>
      )}
      {error ? <p className="auth-message auth-message--error" role="alert">{error}</p> : null}{notice ? <p className="auth-message" role="status">{notice}</p> : null}
    </main>
  );
}
