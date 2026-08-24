import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, forgotPassword as resetPassword } from "../../services/api";
import { useNotifications } from "../../components/NotificationProvider";
import "./LoginPage.css";
import gymBackground from "../../assets/gym-background.jpg";
import personIcon from "../../assets/person.png";
import passwordIcon from "../../assets/password.png";

export default function LoginPage() {
  const navigate = useNavigate();
  const { notify } = useNotifications();

  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotId, setForgotId] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotPasswordValue, setForgotPasswordValue] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false);

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

  const handleForgotPassword = async (e) => {
    e.preventDefault();

    if (!forgotId.trim()) {
      notify("warning", "Missing ID", "Please provide your ID Number.");
      return;
    }

    if (!forgotEmail.trim()) {
      notify("warning", "Missing email", "Please provide the email linked to your account.");
      return;
    }

    if (!forgotPasswordValue.trim()) {
      notify("warning", "Missing password", "Please enter a new password.");
      return;
    }

    if (forgotPasswordValue !== forgotConfirmPassword) {
      notify("warning", "Password mismatch", "The new passwords do not match.");
      return;
    }

    setForgotLoading(true);

    try {
      const data = await resetPassword({
        id: forgotId.trim(),
        email: forgotEmail.trim(),
        newPassword: forgotPasswordValue,
      });

      if (data.success) {
        notify("success", "Password Updated", data.message || "You can now log in with your new password.");
        setShowForgotModal(false);
        setForgotId("");
        setForgotEmail("");
        setForgotPasswordValue("");
        setForgotConfirmPassword("");
      } else {
        notify("error", "Reset Failed", data.message || "Unable to reset your password right now.");
      }
    } catch (error) {
      notify("error", "Reset Failed", error.message || "Unable to reset your password right now.");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="login-root">
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
            Gymnasium and Student Athlete Record Management System
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
                <img
                  src={personIcon}
                  alt="person icon"
                  className="login-icon"
                />

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
                <img
                  src={passwordIcon}
                  alt="password icon"
                  className="login-icon"
                />

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
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
                    </svg>
                  )}
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
        <div className="forgot-modal-backdrop" onClick={() => setShowForgotModal(false)}>
          <div className="forgot-modal" onClick={(e) => e.stopPropagation()}>
            <div className="forgot-modal-header">
              <h3>Reset Password</h3>
              <button type="button" className="forgot-modal-close" onClick={() => setShowForgotModal(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleForgotPassword} className="forgot-modal-form">
              <label className="forgot-modal-field">
                <span>User ID</span>
                <input
                  type="text"
                  value={forgotId}
                  onChange={(e) => setForgotId(e.target.value)}
                  placeholder="Enter your ID Number"
                />
              </label>

              <label className="forgot-modal-field">
                <span>Registered Email</span>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="Enter your registered email"
                />
              </label>

              <label className="forgot-modal-field">
                <span>New Password</span>
                <div className="forgot-password-input-wrapper">
                  <input
                    type={showForgotNewPassword ? "text" : "password"}
                    value={forgotPasswordValue}
                    onChange={(e) => setForgotPasswordValue(e.target.value)}
                    placeholder="Enter a new password"
                  />
                  <button
                    type="button"
                    className="forgot-password-toggle"
                    onClick={() => setShowForgotNewPassword((prev) => !prev)}
                    aria-label={showForgotNewPassword ? "Hide password" : "Show password"}
                  >
                    {showForgotNewPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 512 512">
                        <path fill="#000000" fillRule="evenodd" d="m89.752 59.582l138.656 138.656C236.763 194.239 246.12 192 256 192c35.346 0 64 28.654 64 64c0 9.881-2.239 19.239-6.237 27.594l138.656 138.655l-30.17 30.17l-59.207-59.208c-29.128 19.7-64.646 33.456-107.042 33.456C106.667 426.667 42.667 256 42.667 256s22.862-60.965 73.14-110.02L59.583 89.751zm56.355 116.695c-28.73 27.818-47.477 60.904-56.726 79.73C107.404 292.697 161.739 384 256 384c29.106 0 54.406-8.706 76.006-21.823l-48.414-48.414C275.238 317.761 265.881 320 256 320c-35.346 0-64-28.654-64-64c0-9.88 2.24-19.238 6.238-27.592ZM256 85.334C405.334 85.334 469.334 256 469.334 256s-14.239 37.97-44.955 78.09l-30.56-30.567c13.43-18.244 22.99-35.702 28.802-47.53C404.597 219.302 350.262 128 256.001 128c-11.838 0-23.046 1.44-33.631 4.031l-34.04-34.049c20.25-7.905 42.775-12.648 67.67-12.648"/>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 1024 1024">
                        <path fill="#000000" d="M515.472 321.408c-106.032 0-192 85.968-192 192c0 106.016 85.968 192 192 192s192-85.968 192-192s-85.968-192-192-192zm0 320c-70.576 0-129.473-58.816-129.473-129.393s57.424-128 128-128c70.592 0 128 57.424 128 128s-55.935 129.393-126.527 129.393zm508.208-136.832c-.368-1.616-.207-3.325-.688-4.91c-.208-.671-.624-1.055-.864-1.647c-.336-.912-.256-1.984-.72-2.864c-93.072-213.104-293.663-335.76-507.423-335.76S95.617 281.827 2.497 494.947c-.4.897-.336 1.824-.657 2.849c-.223.624-.687.975-.895 1.567c-.496 1.616-.304 3.296-.608 4.928c-.591 2.88-1.135 5.68-1.135 8.592c0 2.944.544 5.664 1.135 8.591c.32 1.6.113 3.344.609 4.88c.208.72.672 1.024.895 1.68c.336.88.256 1.968.656 2.848c93.136 213.056 295.744 333.712 509.504 333.712c213.776 0 416.336-120.4 509.44-333.505c.464-.912.369-1.872.72-2.88c.224-.56.655-.976.848-1.6c.496-1.568.336-3.28.687-4.912c.56-2.864 1.088-5.664 1.088-8.624c0-2.816-.528-5.6-1.104-8.497zM512 800.595c-181.296 0-359.743-95.568-447.423-287.681c86.848-191.472 267.68-289.504 449.424-289.504c181.68 0 358.496 98.144 445.376 289.712C872.561 704.53 693.744 800.595 512 800.595z"/>
                      </svg>
                    )}
                  </button>
                </div>
              </label>

              <label className="forgot-modal-field">
                <span>Confirm Password</span>
                <div className="forgot-password-input-wrapper">
                  <input
                    type={showForgotConfirmPassword ? "text" : "password"}
                    value={forgotConfirmPassword}
                    onChange={(e) => setForgotConfirmPassword(e.target.value)}
                    placeholder="Confirm your new password"
                  />
                  <button
                    type="button"
                    className="forgot-password-toggle"
                    onClick={() => setShowForgotConfirmPassword((prev) => !prev)}
                    aria-label={showForgotConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showForgotConfirmPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 512 512">
                        <path fill="#000000" fillRule="evenodd" d="m89.752 59.582l138.656 138.656C236.763 194.239 246.12 192 256 192c35.346 0 64 28.654 64 64c0 9.881-2.239 19.239-6.237 27.594l138.656 138.655l-30.17 30.17l-59.207-59.208c-29.128 19.7-64.646 33.456-107.042 33.456C106.667 426.667 42.667 256 42.667 256s22.862-60.965 73.14-110.02L59.583 89.751zm56.355 116.695c-28.73 27.818-47.477 60.904-56.726 79.73C107.404 292.697 161.739 384 256 384c29.106 0 54.406-8.706 76.006-21.823l-48.414-48.414C275.238 317.761 265.881 320 256 320c-35.346 0-64-28.654-64-64c0-9.88 2.24-19.238 6.238-27.592ZM256 85.334C405.334 85.334 469.334 256 469.334 256s-14.239 37.97-44.955 78.09l-30.56-30.567c13.43-18.244 22.99-35.702 28.802-47.53C404.597 219.302 350.262 128 256.001 128c-11.838 0-23.046 1.44-33.631 4.031l-34.04-34.049c20.25-7.905 42.775-12.648 67.67-12.648"/>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 1024 1024">
                        <path fill="#000000" d="M515.472 321.408c-106.032 0-192 85.968-192 192c0 106.016 85.968 192 192 192s192-85.968 192-192s-85.968-192-192-192zm0 320c-70.576 0-129.473-58.816-129.473-129.393s57.424-128 128-128c70.592 0 128 57.424 128 128s-55.935 129.393-126.527 129.393zm508.208-136.832c-.368-1.616-.207-3.325-.688-4.91c-.208-.671-.624-1.055-.864-1.647c-.336-.912-.256-1.984-.72-2.864c-93.072-213.104-293.663-335.76-507.423-335.76S95.617 281.827 2.497 494.947c-.4.897-.336 1.824-.657 2.849c-.223.624-.687.975-.895 1.567c-.496 1.616-.304 3.296-.608 4.928c-.591 2.88-1.135 5.68-1.135 8.592c0 2.944.544 5.664 1.135 8.591c.32 1.6.113 3.344.609 4.88c.208.72.672 1.024.895 1.68c.336.88.256 1.968.656 2.848c93.136 213.056 295.744 333.712 509.504 333.712c213.776 0 416.336-120.4 509.44-333.505c.464-.912.369-1.872.72-2.88c.224-.56.655-.976.848-1.6c.496-1.568.336-3.28.687-4.912c.56-2.864 1.088-5.664 1.088-8.624c0-2.816-.528-5.6-1.104-8.497zM512 800.595c-181.296 0-359.743-95.568-447.423-287.681c86.848-191.472 267.68-289.504 449.424-289.504c181.68 0 358.496 98.144 445.376 289.712C872.561 704.53 693.744 800.595 512 800.595z"/>
                      </svg>
                    )}
                  </button>
                </div>
              </label>

              <div className="forgot-modal-actions">
                <button type="button" className="forgot-cancel-btn" onClick={() => setShowForgotModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="forgot-submit-btn" disabled={forgotLoading}>
                  {forgotLoading ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}