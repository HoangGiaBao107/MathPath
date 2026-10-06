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
    loginIdentifier: string;
    username: string;
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
    usernameTaken: string;
    plansTitle: string;
    plansDescription: string;
    planCurrent: string;
    planComingSoon: string;
    planPerDay: string;
    scoreGoalExceeded: string;
    scoreGoalReached: string;
    scoreGoalProgress: string;
    scoreNoAttempts: string;
    scoreSetGoal: string;
    scoreWithNoGoal: string;
    setupMissing: string;
    genericError: string;
    emailDeliveryNotConfigured: string;
    authRedirectNotAllowed: string;
    emailRateLimited: string;
    credentialsNotAccepted: string;
    emailNotConfirmed: string;
    recoveryLinkExpired: string;
    recoveryNotSent: string;
    accountNotCreated: string;
    authCallbackFailed: string;
    invalid: string;
  }
> = {
  vi: {
    loginTitle: "Đăng nhập MathPath",
    registerTitle: "Tạo tài khoản MathPath",
    recoveryTitle: "Lấy lại mật khẩu",
    recoveryUpdateTitle: "Đặt mật khẩu mới",
    description: "Lưu lại hành trình học và tiếp tục bài làm trên các thiết bị của bạn.",
    name: "Tên đăng nhập",
    email: "Email",
    loginIdentifier: "Email hoặc tên đăng nhập",
    username: "Tên đăng nhập (3–30 ký tự, không chứa @)",
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
    recoverySent: "Nếu email hoặc tên đăng nhập này đã có tài khoản, MathPath sẽ gửi hướng dẫn đặt lại mật khẩu.",
    passwordUpdated: "Mật khẩu đã được cập nhật.",
    signOut: "Đăng xuất",
    accountTitle: "Tài khoản của bạn",
    accountDescription: "Quản lý hồ sơ học tập, mục tiêu và bảo mật tài khoản của bạn.",
    accountLink: "Tài khoản",
    languageLabel: "Ngôn ngữ",
    targetScoreLabel: "Mục tiêu điểm THPTQG",
    usernameTaken: "Tên đăng nhập này đã có người dùng. Chọn tên khác nhé.",
    plansTitle: "Gói học tập",
    plansDescription: "Bắt đầu với Starter, rồi chọn gói phù hợp khi bạn cần thêm lượt AI.",
    planCurrent: "Đang dùng",
    planComingSoon: "Sắp mở",
    planPerDay: "lượt AI mỗi ngày",
    scoreGoalExceeded: "Bạn vừa vượt mục tiêu {goal}/10 — quá xịn, giữ nhịp này nhé!",
    scoreGoalReached: "Bạn đã chạm mục tiêu {goal}/10 rồi — chúc mừng nhé!",
    scoreGoalProgress: "Còn {gap} điểm nữa là chạm mục tiêu {goal}/10. Mình cùng gỡ từng câu nhé!",
    scoreNoAttempts: "Làm thử một đề nhé — mình sẽ cùng bạn theo dõi mục tiêu {goal}/10.",
    scoreSetGoal: "Đặt mục tiêu điểm để mình cổ vũ bạn trên từng chặng nhé!",
    scoreWithNoGoal: "Điểm gần nhất của bạn là {score}/10. Đặt mục tiêu để mình cùng chinh phục nhé!",
    setupMissing: "Tài khoản hiện chưa khả dụng. Vui lòng thử lại sau.",
    genericError: "Chưa thực hiện được yêu cầu. Vui lòng thử lại sau.",
    emailDeliveryNotConfigured: "Chưa gửi được email đến địa chỉ này. Vui lòng thử lại sau.",
    authRedirectNotAllowed: "Liên kết chưa dùng được. Hãy yêu cầu gửi email mới rồi thử lại.",
    emailRateLimited: "Email xác nhận đang bị giới hạn tần suất. Hãy đợi một lúc rồi thử gửi lại.",
    credentialsNotAccepted:
      "Email hoặc mật khẩu chưa đúng. Kiểm tra lại thông tin hoặc chọn Quên mật khẩu nếu bạn không nhớ mật khẩu.",
    emailNotConfirmed:
      "Email tài khoản chưa được xác nhận. Hãy xác nhận email rồi thử đăng nhập lại.",
    recoveryLinkExpired:
      "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Hãy gửi yêu cầu lấy lại mật khẩu mới.",
    recoveryNotSent: "Chưa gửi được email đặt lại mật khẩu. Vui lòng thử lại sau.",
    accountNotCreated:
      "Chưa tạo được tài khoản. Email có thể đã đăng ký; hãy thử đăng nhập hoặc chọn Quên mật khẩu.",
    authCallbackFailed: "Không hoàn tất được đăng nhập. Vui lòng thử lại sau.",
    invalid: "Kiểm tra email, tên đăng nhập và mật khẩu có ít nhất 8 ký tự.",
  },
  en: {
    loginTitle: "Sign in to MathPath",
    registerTitle: "Create a MathPath account",
    recoveryTitle: "Reset your password",
    recoveryUpdateTitle: "Choose a new password",
    description: "Keep your learning journey and continue attempts across your devices.",
    name: "Username",
    email: "Email",
    loginIdentifier: "Email or username",
    username: "Username (3–30 characters, no @)",
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
    recoverySent: "If this email or username has an account, MathPath will send password reset instructions.",
    passwordUpdated: "Your password has been updated.",
    signOut: "Sign out",
    accountTitle: "Your account",
    accountDescription: "Manage your learning profile, goals, and account security.",
    accountLink: "Account",
    languageLabel: "Language",
    targetScoreLabel: "THPTQG target score",
    usernameTaken: "That username is already in use. Please choose another.",
    plansTitle: "Learning plans",
    plansDescription: "Start with Starter, then choose a plan if you need more AI requests.",
    planCurrent: "Current plan",
    planComingSoon: "Coming soon",
    planPerDay: "AI requests per day",
    scoreGoalExceeded: "You just passed your {goal}/10 target — amazing work, keep it going!",
    scoreGoalReached: "You reached your {goal}/10 target — congratulations!",
    scoreGoalProgress: "You’re {gap} points away from your {goal}/10 target. Let’s work through it one question at a time!",
    scoreNoAttempts: "Try an exam and we’ll track your progress toward {goal}/10 together.",
    scoreSetGoal: "Set a score target and I’ll cheer you on along the way!",
    scoreWithNoGoal: "Your latest score is {score}/10. Set a target and we’ll work toward it together!",
    setupMissing: "This account area is temporarily unavailable. Please try again later.",
    genericError: "That request could not be completed. Please try again later.",
    emailDeliveryNotConfigured: "We could not send an email to this address. Please try again later.",
    authRedirectNotAllowed: "This link is unavailable. Request a new email and try again.",
    emailRateLimited: "Confirmation email sending is rate limited. Wait a while, then try again.",
    credentialsNotAccepted:
      "The email or password is incorrect. Check your details, or choose Forgot password if needed.",
    emailNotConfirmed:
      "This account's email is not confirmed. Confirm it, then try signing in again.",
    recoveryLinkExpired:
      "This password reset link is invalid or expired. Request a new password reset link.",
    recoveryNotSent: "The password reset email could not be sent. Please try again later.",
    accountNotCreated:
      "The account could not be created. This email may already be registered; try signing in or resetting the password.",
    authCallbackFailed: "Sign-in could not be completed. Please try again later.",
    invalid: "Check your email, username, and password (at least 8 characters).",
  },
};
