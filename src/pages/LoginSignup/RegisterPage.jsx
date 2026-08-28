import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { register as registerUser } from "../../services/api";
import { useNotifications } from "../../components/NotificationProvider";
import { DEPARTMENT_OPTIONS, SPORT_OPTIONS, YEAR_LEVEL_OPTIONS } from "../../constants/studentRegistrationOptions";
import "./RegisterPage.css";

import gymBackground from "../../assets/gym-background.jpg";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { notify } = useNotifications();

  const [form, setForm] = useState({
    fullname: "",
    username: "",
    email: "",
    password: "",
    role: "student", // Default role
    department: "",
    yearLevel: "",
    sport: "",
    id: ""  // ✅ Changed from studentId to id
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleRoleChange = (e) => {
    const nextRole = e.target.value;
    setForm((prev) => ({
      ...prev,
      role: nextRole,
      ...(nextRole === "coach" ? { sport: "" } : {})
    }));
  };

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
    if (!form.fullname || !form.username || !form.email || !form.password || !form.id) {
      notify("warning", "Missing Information", "Please fill in all required fields.");
      return;
    }

    if (form.role === "student" && !form.sport.trim()) {
      notify("warning", "Missing Sport", "Please enter your sport.");
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
            Gymnasium and Student Athlete Record Management System
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
              <label>Username</label>
              <input
                type="text"
                className="login-input"
                value={form.username}
                onChange={set("username")}
                placeholder="Choose a username"
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

            {/* Role Selection Dropdown */}
            <div className="login-field">
              <label>Role</label>
              <select
                className="login-input"
                value={form.role}
                onChange={handleRoleChange}
                required
              >
                <option value="student">Student</option>
                <option value="coach">Coach</option>
              </select>
            </div>

            {/* Department field - shown for both student and coach roles */}
            {(form.role === "student" || form.role === "coach") && (
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
            )}

            {form.role === "student" && (
              <div className="login-field">
                <label>Year Level</label>
                <select
                  className="login-input"
                  value={form.yearLevel}
                  onChange={set("yearLevel")}
                  required
                >
                  <option value="">Select year level</option>
                  {YEAR_LEVEL_OPTIONS.map((yearLevel) => (
                    <option key={yearLevel} value={yearLevel}>{yearLevel}</option>
                  ))}
                </select>
              </div>
            )}

            {form.role === "student" && (
              <div className="login-field">
                <label>Sport</label>
                <select
                  className="login-input"
                  value={form.sport}
                  onChange={set("sport")}
                  required
                >
                  <option value="">Select sport</option>
                  {SPORT_OPTIONS.map((sport) => (
                    <option key={sport} value={sport}>{sport}</option>
                  ))}
                </select>
              </div>
            )}

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