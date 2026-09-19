import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { register as registerUser } from "../../services/api";
import { useNotifications } from "../../components/NotificationProvider";
import Icon from "../../components/Icon";
import { DEPARTMENT_OPTIONS } from "../../constants/studentRegistrationOptions";
import "./RegisterPage.css";

import gymBackground from "../../assets/gym-background.jpg";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { notify } = useNotifications();

  const [form, setForm] = useState({
    fullname: "",
    email: "",
    password: "",
    department: "",
    id: ""  // ✅ Changed from studentId to id
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  // Password validation function
  const validatePassword = (password) => {
    if (password.length < 8) {
      return "Password must be at least 8 characters long";
    }
    if (!/[A-Z]/.test(password)) {
      return "Password must contain at least one uppercase letter";
    }
    if (!/[a-z]/.test(password)) {
      return "Password must contain at least one lowercase letter";
    }
    if (!/[0-9]/.test(password)) {
      return "Password must contain at least one number";
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return "Password must contain at least one special character (!@#$%^&* etc.)";
    }
    return null;
  };

  const handlePasswordChange = (e) => {
    setForm((prev) => ({ ...prev, password: e.target.value }));
  };

  const validateIdForRoleDetection = (value) => {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return "Please enter your ID.";
    }

    if (trimmedValue.length < 7) {
      return "ID must be at least 7 characters long.";
    }

    if (/\s/.test(trimmedValue)) {
      return "ID cannot contain spaces.";
    }

    if (!/^[A-Za-z0-9!@#$%^&*(),.?":{}|<>_-]+$/.test(trimmedValue)) {
      return "ID can only include letters, numbers, or common special characters.";
    }

    return null;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    
    // ✅ ID and Email are both required for all users
    if (!form.fullname || !form.email || !form.password || !confirmPassword || !form.id) {
      notify("warning", "Missing Information", "Please fill in all required fields.");
      return;
    }

    if (form.password !== confirmPassword) {
      notify("warning", "Passwords Do Not Match", "Passwords do not match.");
      return;
    }

    const idValidationError = validateIdForRoleDetection(form.id);
    if (idValidationError) {
      notify("warning", "Invalid ID", idValidationError);
      return;
    }

    const passwordValidationError = validatePassword(form.password);
    if (passwordValidationError) {
      notify("warning", "Invalid Password", passwordValidationError);
      return;
    }

    setLoading(true);

    try {
      const data = await registerUser(form);

      if (data.success) {
        notify("success", "Registration Successful", "Your account is ready! Redirecting to login...");
        setTimeout(() => navigate("/login"), 1500);
      } else {
        notify("error", "Registration Failed", data.message || "Please review your information and try again.");
      }
    } catch (err) {
      console.error("Register error:", err);
      // Show the actual error message from the API
      const errorMessage = err.message || "Cannot connect to server. Please check if backend is running.";
      notify("error", "Registration Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-root">
      <button type="button" className="auth-back-btn" onClick={() => navigate(-1)} aria-label="Go back">
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
          <h1 className="login-system-name" style={{ color: "white" }}>GYMSTAT</h1>
          <p className="login-system-sub">
            Gymnasium and Student-Athlete Record Management System
          </p>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="login-right">
        <div className="login-right-inner">
          <h2 className="login-title">Sign Up Your Account</h2>

          <form onSubmit={handleRegister} className="login-form">
            <div className="login-field">
              <label>Full Name</label>
              <input
                type="text"
                className="login-input"
                value={form.fullname}
                onChange={set("fullname")}
                placeholder="Enter your full name"
                required
              />
            </div>

            <div className="login-field">
              <label>Email</label>
              <input
                type="email"
                className="login-input"
                value={form.email}
                onChange={set("email")}
                placeholder="Enter your email"
                autoComplete="off"
                required
              />
            </div>

            <div className="login-field">
              <label>Password</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  className="login-input"
                  value={form.password}
                  onChange={handlePasswordChange}
                  placeholder="Create a password "
                  autoComplete="new-password"
                  style={{ paddingRight: "40px" }}
                  required
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
                  <Icon name={showPassword ? "eye" : "eyeOff"} />
                </button>
              </div>
            </div>

            <div className="login-field">
              <label>Confirm Password</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  className="login-input"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                  style={{ paddingRight: "40px" }}
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
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
                  <Icon name={showConfirmPassword ? "eye" : "eyeOff"} />
                </button>
              </div>
              {confirmPassword && form.password !== confirmPassword && (
                <p className="password-match-error">Passwords do not match.</p>
              )}
            </div>

            <div className="login-field">
              <label>ID Number</label>
              <input
                type="text"
                className="login-input"
                value={form.id}
                onChange={set("id")}
                placeholder="e.g., 23B1509"
                required
              />
            </div>

            <div className="login-field">
              <label>Department</label>
              <select
                className="login-input"
                value={form.department}
                onChange={set("department")}
              >
                <option value="">Select Department</option>
                {DEPARTMENT_OPTIONS.map((department) => (
                  <option key={department} value={department}>{department}</option>
                ))}
              </select>
            </div>

            <button type="submit" className="login-submit-btn" disabled={loading}>
              {loading ? "Registering..." : "Sign Up"}
            </button>

            <p className="login-switch-text">
              Already have an account?{" "}
              <button
                type="button"
                className="login-link-btn"
                onClick={() => navigate("/login")}
              >
                Log in
              </button>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}