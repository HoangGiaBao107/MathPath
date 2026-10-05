import type { Locale } from "./types";

export const authMessages: Record<
  Locale,
  {
    loginTitle: string;
    registerTitle: string;
    recoveryTitle: string;
    recoveryUpdateTitle: string;
    description: string;
    name: string;
    email: string;
    password: string;
    newPassword: string;
    submitLogin: string;
    submitRegister: string;
    submitRecovery: string;
    submitPassword: string;
    google: string;
    noAccount: string;
    hasAccount: string;
    forgot: string;
    loginLink: string;
    registerLink: string;
    checkEmail: string;
    resendConfirmation: string;
    confirmationResent: string;
    recoverySent: string;
    passwordUpdated: string;
    signOut: string;
    accountTitle: string;
    accountDescription: string;
    accountLink: string;
    languageLabel: string;
    targetScoreLabel: string;
    setupMissing: string;
    genericError: string;
    emailDeliveryNotConfigured: string;
    authRedirectNotAllowed: string;
    emailRateLimited: string;
    invalid: string;
  }
> = {
  vi: {
    loginTitle: "Đăng nhập MathPath",
    registerTitle: "Tạo tài khoản MathPath",
    recoveryTitle: "Lấy lại mật khẩu",
    recoveryUpdateTitle: "Đặt mật khẩu mới",
    description: "Lưu lại hành trình học và tiếp tục bài làm trên các thiết bị của bạn.",
    name: "Tên hiển thị",
    email: "Email",
    password: "Mật khẩu (ít nhất 8 ký tự)",
    newPassword: "Mật khẩu mới (ít nhất 8 ký tự)",
    submitLogin: "Đăng nhập",
    submitRegister: "Tạo tài khoản",
    submitRecovery: "Gửi link lấy lại mật khẩu",
    submitPassword: "Cập nhật mật khẩu",
    google: "Tiếp tục với Google",
    noAccount: "Chưa có tài khoản?",
    hasAccount: "Đã có tài khoản?",
    forgot: "Quên mật khẩu?",
    loginLink: "Đăng nhập",
    registerLink: "Tạo tài khoản",
    checkEmail: "Kiểm tra email để xác nhận tài khoản, rồi quay lại đăng nhập nhé.",
    resendConfirmation: "Gửi lại email xác nhận",
    confirmationResent: "Đã yêu cầu gửi lại email xác nhận. Hãy kiểm tra hộp thư và thư rác.",
    recoverySent: "Nếu email này đã đăng ký, MathPath sẽ gửi hướng dẫn đặt lại mật khẩu.",
    passwordUpdated: "Mật khẩu đã được cập nhật.",
    signOut: "Đăng xuất",
    accountTitle: "Tài khoản của bạn",
    accountDescription: "Thông tin được quản lý bởi Supabase Auth và hồ sơ MathPath.",
    accountLink: "Tài khoản",
    languageLabel: "Ngôn ngữ",
    targetScoreLabel: "Mục tiêu điểm",
    setupMissing:
      "Chưa cấu hình Supabase. Hãy thêm URL, anon key và service role key vào .env.local rồi khởi động lại ứng dụng.",
    genericError: "Chưa thực hiện được yêu cầu. Kiểm tra cấu hình rồi thử lại nhé.",
    emailDeliveryNotConfigured:
      "Supabase chưa cho phép gửi thư đến email này. Cần cấu hình SMTP tùy chỉnh trong Authentication → SMTP Settings.",
    authRedirectNotAllowed:
      "Supabase chưa cho phép đường dẫn quay lại ứng dụng. Thêm URL callback vào Authentication → URL Configuration.",
    emailRateLimited: "Email xác nhận đang bị giới hạn tần suất. Hãy đợi một lúc rồi thử gửi lại.",
    invalid: "Nhập email hợp lệ và mật khẩu có ít nhất 8 ký tự.",
  },
  en: {
    loginTitle: "Sign in to MathPath",
    registerTitle: "Create a MathPath account",
    recoveryTitle: "Reset your password",
    recoveryUpdateTitle: "Choose a new password",
    description: "Keep your learning journey and continue attempts across your devices.",
    name: "Display name",
    email: "Email",
    password: "Password (at least 8 characters)",
    newPassword: "New password (at least 8 characters)",
    submitLogin: "Sign in",
    submitRegister: "Create account",
    submitRecovery: "Send recovery link",
    submitPassword: "Update password",
    google: "Continue with Google",
    noAccount: "New to MathPath?",
    hasAccount: "Already have an account?",
    forgot: "Forgot your password?",
    loginLink: "Sign in",
    registerLink: "Create an account",
    checkEmail: "Check your email to confirm your account, then come back to sign in.",
    resendConfirmation: "Resend confirmation email",
    confirmationResent: "A new confirmation email was requested. Check your inbox and spam folder.",
    recoverySent: "If this email has an account, MathPath will send password reset instructions.",
    passwordUpdated: "Your password has been updated.",
    signOut: "Sign out",
    accountTitle: "Your account",
    accountDescription: "Your account uses Supabase Auth and your MathPath profile.",
    accountLink: "Account",
    languageLabel: "Language",
    targetScoreLabel: "Target score",
    setupMissing:
      "Supabase is not configured. Add the project URL, anon key, and service role key to .env.local, then restart the app.",
    genericError: "That request could not be completed. Check the configuration and try again.",
    emailDeliveryNotConfigured:
      "Supabase is not configured to send email to this address. Set up custom SMTP in Authentication → SMTP Settings.",
    authRedirectNotAllowed:
      "Supabase does not allow this return URL. Add the callback URL in Authentication → URL Configuration.",
    emailRateLimited: "Confirmation email sending is rate limited. Wait a while, then try again.",
    invalid: "Enter a valid email and a password of at least 8 characters.",
  },
};
