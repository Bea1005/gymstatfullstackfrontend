import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, requestPasswordReset, verifyPasswordResetOtp, resetPassword } from "../../services/api";
import { useNotifications } from "../../components/NotificationProvider";
import "./LoginPage.css";
import gymBackground from "../../assets/gym-background.jpg";
import Icon from '../../components/Icon';

export default function LoginPage() {
  const navigate = useNavigate();
  const { notify } = useNotifications();

  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotStep, setForgotStep] = useState("email");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotPasswordValue, setForgotPasswordValue] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false);
  const [forgotValidationError, setForgotValidationError] = useState("");
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(0);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);

  useEffect(() => {
    if (!showForgotModal || forgotStep !== "otp") return undefined;

    const timer = window.setInterval(() => {
      setOtpSecondsLeft((seconds) => Math.max(0, seconds - 1));
      setResendSecondsLeft((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [showForgotModal, forgotStep]);

  const handleLogin = async (e) => {
    e.preventDefault();

    // Custom validation instead of relying on HTML5
    if (!id.trim()) {
      notify("warning", "Missing ID", "Please provide your ID Number.");
      return;
    }
    
    if (!password.trim()) {
      notify("warning", "Missing password", "Please provide your password.");
      return;
    }

    setLoading(true);

    try {
      // Login using ID
      const data = await login(id, password);

      if (data.success) {
        const resolvedRole = (data.user?.role || "student").toLowerCase();
        const normalizedUser = {
          ...data.user,
          role: resolvedRole,
        };

        localStorage.setItem("token", data.token);
        localStorage.setItem("role", resolvedRole);
        localStorage.setItem("user", JSON.stringify(normalizedUser));
        // store session-scoped values so each tab retains its own session
        try {
          sessionStorage.setItem("token", data.token);
          sessionStorage.setItem("role", resolvedRole);
          sessionStorage.setItem("user", JSON.stringify(normalizedUser));
        } catch (e) {
          console.warn('Session storage not available', e.message);
        }

        notify("success", "Login Successful", "Welcome back! Redirecting to your portal...");

        const pathname =
          resolvedRole === "student"
            ? "/student/home"
            : resolvedRole === "coach"
            ? "/coach/home"
            : resolvedRole === "admin"
            ? "/admin/dashboard"
            : resolvedRole === "screener"
            ? "/screener/dashboard"
            : "/";

        setTimeout(() => navigate(pathname), 1500);
      } else {
        notify("error", "Login Failed", data.message || "Please check your credentials and try again.");
      }
    } catch (error) {
      console.error("Login error:", error);
      notify(
        "error",
        "Unable to Login",
        error.message || "Cannot connect to server. Please check if backend is running."
      );
    } finally {
      setLoading(false);
    }
  };

  const resetForgotFlow = () => {
    setShowForgotModal(false);
    setForgotStep("email");
    setForgotEmail("");
    setForgotOtp("");
    setForgotPasswordValue("");
    setForgotConfirmPassword("");
    setForgotValidationError("");
    setOtpSecondsLeft(0);
    setResendSecondsLeft(0);
    setShowForgotNewPassword(false);
    setShowForgotConfirmPassword(false);
  };

  const handleForgotClose = () => {
    if (!forgotLoading) resetForgotFlow();
  };

  const handleForgotEmailSubmit = async (e) => {
    e.preventDefault();
    const normalizedEmail = forgotEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setForgotValidationError("Please enter a valid email address.");
      return;
    }
    setForgotValidationError("");
    setForgotLoading(true);
    try {
      await requestPasswordReset(normalizedEmail);
      setForgotEmail(normalizedEmail);
      setForgotStep("otp");
      setOtpSecondsLeft(600);
      setResendSecondsLeft(60);
    } catch (error) {
      notify("error", "Unable to send code", error.message || "Please try again later.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(forgotOtp)) {
      setForgotValidationError("Enter the 6-digit verification code from your email.");
      return;
    }
    setForgotValidationError("");
    setForgotLoading(true);
    try {
      await verifyPasswordResetOtp(forgotEmail, forgotOtp);
      setForgotStep("password");
    } catch (error) {
      notify("error", "Verification failed", error.message || "The code is invalid or expired.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendSecondsLeft > 0 || forgotLoading) return;
    setForgotLoading(true);
    try {
      await requestPasswordReset(forgotEmail);
      setOtpSecondsLeft(600);
      setResendSecondsLeft(60);
      setForgotOtp("");
      setForgotValidationError("");
    } catch (error) {
      notify("error", "Unable to resend code", error.message || "Please try again later.");
    } finally {
      setForgotLoading(false);
    }
  };

  const validateNewPassword = () => {
    if (!/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>_-]).{8,}$/.test(forgotPasswordValue)) {
      return "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.";
    }
    if (forgotPasswordValue !== forgotConfirmPassword) {
      return "The new passwords do not match.";
    }
    return "";
  };

  const handleNewPasswordSubmit = async (e) => {
    e.preventDefault();
    const validationError = validateNewPassword();
    if (validationError) {
      setForgotValidationError(validationError);
      return;
    }

    setForgotValidationError("");
    setForgotLoading(true);
    try {
      await resetPassword(forgotEmail, forgotPasswordValue);
      setForgotStep("success");
      notify("success", "Password reset successfully", "You can now log in with your new password.");
      window.setTimeout(resetForgotFlow, 1800);
    } catch (error) {
      notify("error", "Reset failed", error.message || "Unable to reset your password right now.");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="login-root">
      <button type="button" className="auth-back-btn" onClick={() => navigate('/landingpage', { replace: true })} aria-label="Go back">
        <Icon name="arrowLeft" size={18} />
        <span>Back</span>
      </button>
      {/* LEFT SIDE */}
      <div
        className="login-left"
        style={{ backgroundImage: `url(${gymBackground})` }}
      >
        <div className="login-left-overlay"></div>

        <div className="login-left-content">
          <div className="login-university-badge">
            <span>MARINDUQUE STATE UNIVERSITY</span>
          </div>

          <h1 className="login-system-name" style={{ color: "white" }}>
            GYMSTAT
          </h1>

          <p className="login-system-sub">
            Gymnasium and Student-Athlete Record Management System
          </p>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="login-right">
        <div className="login-right-inner">
          <h2 className="login-title">Log In</h2>

          <form onSubmit={handleLogin} className="login-form" noValidate>
            {/* ID FIELD */}
            <div className="login-field">
              <label>ID Number</label>

              <div className="login-input-wrapper">
                <Icon name="user" className="login-icon" />

                <input
                  type="text"
                  className="login-input"
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  placeholder="Enter your ID Number"
                  autoComplete="off"
                />
              </div>
            </div>

            {/* PASSWORD FIELD */}
            <div className="login-field">
              <label>Password</label>

              <div className="login-input-wrapper">
                <Icon name="shield" className="login-icon" />

                <input
                  type={showPassword ? "text" : "password"}
                  className="login-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="new-password"
                />

                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#666"
                  }}
                >
                  <Icon name={showPassword ? 'eye' : 'eyeOff'} />
                </button>
              </div>
            </div>

            <div className="login-options">
              <button
                type="button"
                className="login-forgot-btn"
                onClick={() => setShowForgotModal(true)}
              >
                Forgot Password?
              </button>
            </div>

            <button
              type="submit"
              className="login-submit-btn"
              disabled={loading}
            >
              {loading ? "Logging in..." : "Log In"}
            </button>

            <p className="login-switch-text">
              Don't have an account?{" "}
              <button
                type="button"
                className="login-link-btn"
                onClick={() => navigate("/register")}
              >
                Sign up
              </button>
            </p>
          </form>
        </div>
      </div>

      {showForgotModal && (
        <div className="forgot-modal-backdrop" onClick={handleForgotClose}>
          <div className="forgot-modal" onClick={(e) => e.stopPropagation()}>
            <div className="forgot-modal-header">
              <h3>{forgotStep === "success" ? "Password Updated" : "Reset Password"}</h3>
              <button type="button" className="forgot-modal-close" onClick={handleForgotClose} aria-label="Close password reset">
                <Icon name="close" />
              </button>
            </div>

            {forgotStep === "email" && (
              <form onSubmit={handleForgotEmailSubmit} className="forgot-modal-form">
                <p className="forgot-modal-description">Enter your registered email. If an account is associated with it, we will send a verification code.</p>
                <label className="forgot-modal-field">
                  <span>Registered Email</span>
                  <input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="Enter your registered email" autoComplete="email" />
                </label>
                {forgotValidationError && <p className="forgot-validation-error">{forgotValidationError}</p>}
                <div className="forgot-modal-actions">
                  <button type="button" className="forgot-cancel-btn" onClick={handleForgotClose}>Cancel</button>
                  <button type="submit" className="forgot-submit-btn" disabled={forgotLoading}>{forgotLoading ? "Sending..." : "Continue"}</button>
                </div>
              </form>
            )}

            {forgotStep === "otp" && (
              <form onSubmit={handleOtpSubmit} className="forgot-modal-form">
                <p className="forgot-modal-description">Enter the verification code sent to your email.</p>
                <label className="forgot-modal-field">
                  <span>Verification Code</span>
                  <input className="forgot-otp-input" inputMode="numeric" maxLength={6} value={forgotOtp} onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} onPaste={(e) => { e.preventDefault(); setForgotOtp(e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)); }} placeholder="6-digit code" autoComplete="one-time-code" />
                </label>
                <p className="forgot-countdown">Code expires in {Math.floor(otpSecondsLeft / 60)}:{String(otpSecondsLeft % 60).padStart(2, "0")}</p>
                {forgotValidationError && <p className="forgot-validation-error">{forgotValidationError}</p>}
                <button type="button" className="forgot-resend-btn" onClick={handleResendOtp} disabled={resendSecondsLeft > 0 || forgotLoading}>
                  {resendSecondsLeft > 0 ? `Resend code in ${resendSecondsLeft}s` : "Resend code"}
                </button>
                <div className="forgot-modal-actions">
                  <button type="button" className="forgot-cancel-btn" onClick={handleForgotClose}>Cancel</button>
                  <button type="submit" className="forgot-submit-btn" disabled={forgotLoading}>{forgotLoading ? "Verifying..." : "Verify Code"}</button>
                </div>
              </form>
            )}

            {forgotStep === "password" && (
              <form onSubmit={handleNewPasswordSubmit} className="forgot-modal-form">
                <p className="forgot-modal-description">Create a new password for your GYMSTAT account.</p>
                <label className="forgot-modal-field">
                  <span>New Password</span>
                  <div className="forgot-password-input-wrapper">
                    <input type={showForgotNewPassword ? "text" : "password"} value={forgotPasswordValue} onChange={(e) => setForgotPasswordValue(e.target.value)} placeholder="Enter a new password" autoComplete="new-password" />
                    <button type="button" className="forgot-password-toggle" onClick={() => setShowForgotNewPassword((prev) => !prev)} aria-label={showForgotNewPassword ? "Hide password" : "Show password"}><Icon name={showForgotNewPassword ? "eye" : "eyeOff"} size={18} /></button>
                  </div>
                </label>
                <label className="forgot-modal-field">
                  <span>Confirm New Password</span>
                  <div className="forgot-password-input-wrapper">
                    <input type={showForgotConfirmPassword ? "text" : "password"} value={forgotConfirmPassword} onChange={(e) => setForgotConfirmPassword(e.target.value)} placeholder="Confirm your new password" autoComplete="new-password" />
                    <button type="button" className="forgot-password-toggle" onClick={() => setShowForgotConfirmPassword((prev) => !prev)} aria-label={showForgotConfirmPassword ? "Hide password" : "Show password"}><Icon name={showForgotConfirmPassword ? "eye" : "eyeOff"} size={18} /></button>
                  </div>
                </label>
                <p className="forgot-password-hint">At least 8 characters, including uppercase, lowercase, number, and special character.</p>
                {forgotValidationError && <p className="forgot-validation-error">{forgotValidationError}</p>}
                <div className="forgot-modal-actions">
                  <button type="button" className="forgot-cancel-btn" onClick={handleForgotClose}>Cancel</button>
                  <button type="submit" className="forgot-submit-btn" disabled={forgotLoading}>{forgotLoading ? "Saving..." : "Create Password"}</button>
                </div>
              </form>
            )}

            {forgotStep === "success" && (
              <div className="forgot-success-state">
                <Icon name="checkCircle" size={42} />
                <p>Password reset successfully.</p>
                <small>Returning you to the login page...</small>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}