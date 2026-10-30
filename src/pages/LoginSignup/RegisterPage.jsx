import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  register as registerUser,
  verifyRegistrationOtp,
  resendRegistrationOtp,
} from "../../services/api";
import { useNotifications } from "../../components/useNotifications";
import Icon from "../../components/Icon";
import { DEPARTMENT_OPTIONS } from "../../constants/studentRegistrationOptions";
import {
  PREFERRED_CATEGORY_OPTIONS,
  REGISTRATION_CATEGORIES,
} from "../../constants/registrationCategories";
import { PASSWORD_POLICY_MESSAGE, isPasswordValid } from "../../constants/passwordPolicy";
import "./RegisterPage.css";

import gymBackground from "../../assets/GYMSTAT BG.jpg";

const FULL_NAME_PATTERN = /^[\p{L}\p{M}]+(?:[\s'’.-][\p{L}\p{M}]+)*$/u;
const DUMMY_FULL_NAME_VALUES = new Set([
  "test", "user", "admin", "guest", "student", "coach", "example", "sample",
  "placeholder", "dummy", "demo", "fake", "null", "undefined", "n/a", "na",
  "asdf", "qwerty", "lorem", "ipsum", "foo", "bar"
]);
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "dispostable.com", "temp-mail.org",
  "10minutemail.com", "throwawaymail.com", "yopmail.com", "yomail.info",
  "trashmail.com", "maildrop.cc"
]);
const DUMMY_EMAIL_PREFIXES = new Set([
  "test", "dummy", "demo", "sample", "placeholder", "guest", "fake", "invalid",
  "noreply", "no-reply", "asdf", "qwerty", "lorem", "ipsum"
]);

const validateFullName = (value) => {
  const trimmedValue = String(value || "").trim();
  if (!trimmedValue || trimmedValue.length < 2) {
    return "Please enter your full name.";
  }

  if (!/[\p{L}]/u.test(trimmedValue)) {
    return "Full name must include letters.";
  }

  const sanitizedLetters = trimmedValue.replace(/[\s'’.-]/g, "");
  if (sanitizedLetters.length < 2) {
    return "Please enter a valid full name.";
  }

  if (/(.)\1{4,}/u.test(sanitizedLetters)) {
    return "Full name contains too many repeated characters.";
  }

  const normalizedValue = trimmedValue.toLowerCase().replace(/[\s'’.-]+/g, " ").trim();
  if (DUMMY_FULL_NAME_VALUES.has(normalizedValue)) {
    return "Please enter a realistic full name instead of a placeholder or dummy value.";
  }

  const lettersOnly = sanitizedLetters.replace(/[^\p{L}]/gu, "");
  const vowelCount = (lettersOnly.match(/[AEIOUaeiou]/g) || []).length;
  const consonantRatio = lettersOnly.length ? (lettersOnly.length - vowelCount) / lettersOnly.length : 0;
  if (lettersOnly.length >= 10 && consonantRatio >= 0.7 && !/\s/.test(trimmedValue)) {
    return "Please enter a realistic full name. Random character sequences are not allowed.";
  }

  if (!FULL_NAME_PATTERN.test(trimmedValue)) {
    return "Please enter a valid full name using letters and common name punctuation.";
  }

  return null;
};

const validateEmailAddress = (value) => {
  const email = String(value || "").trim();
  if (!email) {
    return "Please enter your email address.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Please enter a valid email address. Use a real email address you regularly access.";
  }

  const [localPart, domain] = email.toLowerCase().split("@");
  if (!localPart || !domain) {
    return "Please enter a valid email address. Use a real email address you regularly access.";
  }

  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return "Please use a real email address that you regularly access.";
  }

  const normalizedLocalPart = localPart.replace(/[._+-]+/g, "").toLowerCase();
  if (normalizedLocalPart && [...DUMMY_EMAIL_PREFIXES].some((prefix) => normalizedLocalPart === prefix || normalizedLocalPart.startsWith(prefix))) {
    return "Please use a real email address that you regularly access.";
  }

  return null;
};

const validateRegistrationId = (value) => {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "Please enter your ID number.";
  }

  if (/\s/.test(trimmedValue)) {
    return "ID number cannot contain spaces.";
  }

  if (/^\d{4}-\d{4}$/.test(trimmedValue)) {
    return null;
  }

  if (trimmedValue.length < 7) {
    return "Student ID numbers must be at least 7 characters long.";
  }

  if (!/^[A-Za-z0-9!@#$%^&*(),.?":{}|<>_-]+$/.test(trimmedValue)) {
    return "The ID number format is invalid. Use letters, numbers, or common special characters only.";
  }

  return null;
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const { notify } = useNotifications();
  const registrationInFlightRef = useRef(false);

  const [form, setForm] = useState({
    fullname: "",
    email: "",
    password: "",
    department: "",
    sport: "",
    id: ""  // ✅ Changed from studentId to id
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verificationStep, setVerificationStep] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationEmailSent, setVerificationEmailSent] = useState(true);
  const [verificationNotice, setVerificationNotice] = useState("");
  const [verificationOtp, setVerificationOtp] = useState("");
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);
  const [departmentError, setDepartmentError] = useState("");
  const [mainCategory, setMainCategory] = useState("");
  const [sportSubcategory, setSportSubcategory] = useState("");
  const [preferredCategory, setPreferredCategory] = useState("");

  const registrationRole = /^\d{4}-\d{4}$/.test(form.id.trim()) ? "coach" : "student";
  const selectedCategory = REGISTRATION_CATEGORIES.find(({ name }) => name === mainCategory);
  const selectedSubcategory = selectedCategory?.subcategories?.find(({ name }) => name === sportSubcategory);
  const specificOptions = mainCategory === "Sports Event"
    ? selectedSubcategory?.sports || []
    : selectedCategory?.events || [];

  useEffect(() => {
    if (resendSecondsLeft <= 0) return undefined;
    const timer = window.setTimeout(() => {
      setResendSecondsLeft((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [resendSecondsLeft]);

  const set = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  // Password validation function
  const validatePassword = (password) => {
    return isPasswordValid(password) ? null : PASSWORD_POLICY_MESSAGE;
  };

  const handlePasswordChange = (e) => {
    setForm((prev) => ({ ...prev, password: e.target.value }));
  };

  const showVerificationStep = (email, resendDelay = 60, emailSent = true, notice = "") => {
    setVerificationEmail(email);
    setVerificationEmailSent(emailSent);
    setVerificationNotice(notice || (emailSent
      ? "Registration saved. Check your email for the verification code."
      : "Registration saved, but the verification email was not sent. Request another code to retry."));
    setVerificationOtp("");
    setVerificationStep(true);
    setResendSecondsLeft(resendDelay);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (registrationInFlightRef.current) return;

    if (!form.department.trim() || form.department === "Select Department") {
      setDepartmentError("Please select department.");
      return;
    }
    setDepartmentError("");

    if (
      !selectedCategory
      || (mainCategory === "Sports Event" && !selectedSubcategory)
      || !specificOptions.includes(form.sport)
      || (preferredCategory && !PREFERRED_CATEGORY_OPTIONS.includes(preferredCategory))
    ) {
      notify("warning", "Missing Information", "Please select a category and a valid sport or event.");
      return;
    }

    const trimmedFullName = form.fullname.trim();
    const trimmedEmail = form.email.trim();
    const trimmedId = form.id.trim();

    if (!trimmedFullName || !trimmedEmail || !form.password || !confirmPassword || !trimmedId) {
      notify("warning", "Missing Information", "Please fill in all required fields.");
      return;
    }

    const fullNameValidationError = validateFullName(trimmedFullName);
    if (fullNameValidationError) {
      notify("warning", "Invalid Full Name", fullNameValidationError);
      return;
    }

    const emailValidationError = validateEmailAddress(trimmedEmail);
    if (emailValidationError) {
      notify("warning", "Invalid Email", emailValidationError);
      return;
    }

    if (form.password !== confirmPassword) {
      notify("warning", "Passwords Do Not Match", "Passwords do not match.");
      return;
    }

    const idValidationError = validateRegistrationId(trimmedId);
    if (idValidationError) {
      notify("warning", "Invalid ID Number", idValidationError);
      return;
    }

    const passwordValidationError = validatePassword(form.password);
    if (passwordValidationError) {
      notify("warning", "Invalid Password", passwordValidationError);
      return;
    }

    registrationInFlightRef.current = true;
    setLoading(true);

    try {
      const data = await registerUser({
        ...form,
        fullname: trimmedFullName,
        email: trimmedEmail.toLowerCase(),
        id: trimmedId,
        role: registrationRole
      });

      if (data.success && data.verificationRequired) {
        const retryAfter = Number.isInteger(data.retryAfterSeconds) ? data.retryAfterSeconds : 60;
        showVerificationStep(
          form.email.trim().toLowerCase(),
          retryAfter,
          data.emailSent !== false,
          data.emailSent === false ? data.message : ""
        );
        notify(
          data.emailSent === false ? "warning" : "success",
          data.emailSent === false ? "Email Not Sent" : "Check Your Email",
          data.emailSent === false
            ? data.message || "Your registration is saved. Request a new code when email delivery is available."
            : "Your registration has been saved. Enter the verification code sent to your email."
        );
      } else {
        notify("error", "Registration Failed", data.message || "Please review your information and try again.");
      }
    } catch (err) {
      console.error("Register error:", err);
      if (err.responseData?.verificationRequired) {
        showVerificationStep(form.email.trim().toLowerCase(), 0, false, err.message);
        notify("warning", "Email Not Sent", err.message || "Registration is saved. You can retry by requesting a new code.");
        return;
      }
      // Show the actual error message from the API
      const errorMessage = err.message || "Cannot connect to server. Please check if backend is running.";
      notify("error", "Registration Error", errorMessage);
    } finally {
      registrationInFlightRef.current = false;
      setLoading(false);
    }
  };

  const handleVerifyEmail = async (event) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(verificationOtp)) {
      notify("warning", "Invalid Code", "Enter the 6-digit verification code from your email.");
      return;
    }

    setVerificationLoading(true);
    try {
      await verifyRegistrationOtp(verificationEmail, verificationOtp);
      notify("success", "Email Verified", "Your email is verified. Redirecting to login...");
      setTimeout(() => navigate("/login"), 1500);
    } catch (error) {
      notify("error", "Verification Failed", error.message || "The code is invalid or expired.");
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (resendLoading || resendSecondsLeft > 0) return;

    setResendLoading(true);
    try {
      const result = await resendRegistrationOtp(verificationEmail);
      if (result.emailSent === false) {
        setVerificationEmailSent(false);
        setVerificationNotice(result.message || "The verification email could not be sent. Please try again.");
        setResendSecondsLeft(Number(result.retryAfterSeconds || 0));
        notify("error", "Unable to Resend Code", result.message || "Please try again later.");
        return;
      }
      setVerificationEmailSent(true);
      setVerificationNotice("A new verification code was sent. Check your email, including the spam folder.");
      setResendSecondsLeft(60);
      notify("success", "Check Your Email", "A new verification code was sent. Check your spam folder if it is not in your inbox.");
    } catch (error) {
      const retryAfterSeconds = Number(error.responseData?.retryAfterSeconds || 0);
      setVerificationEmailSent(false);
      setVerificationNotice(error.message || "The verification email could not be sent. Please try again.");
      if (retryAfterSeconds > 0) setResendSecondsLeft(retryAfterSeconds);
      notify("error", "Unable to Resend Code", error.message || "Please try again later.");
    } finally {
      setResendLoading(false);
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
          <h1 className="login-system-name" style={{ color: "white" }}>GYMSTAT</h1>
          <p className="login-system-sub">
            Gymnasium and Student-Athlete Record Management System
          </p>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="login-right">
        <div className="login-right-inner">
          <h2 className="login-title">
            {verificationStep ? "Verify Your Email" : "Sign Up Your Account"}
          </h2>

          {verificationStep ? (
            <form onSubmit={handleVerifyEmail} className="login-form registration-verification-form">
              <div
                className={`registration-verification-notice${verificationEmailSent ? " registration-verification-notice-success" : " registration-verification-notice-warning"}`}
                role={verificationEmailSent ? "status" : "alert"}
                aria-live="polite"
              >
                <strong>{verificationEmailSent ? "Registration received — check your email." : "Registration saved — verification email not sent."}</strong>
                <span>{verificationNotice}</span>
                <span><strong>{verificationEmail}</strong></span>
                {verificationEmailSent && (
                  <span>Enter the code below to complete registration. If you do not see it, check your spam folder.</span>
                )}
              </div>
              <div className="login-field">
                <label htmlFor="registration-verification-code">6-Digit Verification Code</label>
                <input
                  id="registration-verification-code"
                  type="text"
                  className="login-input"
                  value={verificationOtp}
                  onChange={(event) => setVerificationOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="Enter your code"
                  required
                />
              </div>
              <button
                type="submit"
                className="login-submit-btn"
                disabled={verificationLoading || verificationOtp.length !== 6}
              >
                {verificationLoading ? "Verifying..." : "Verify Email"}
              </button>
              <button
                type="button"
                className="login-link-btn registration-resend-btn"
                onClick={handleResendVerification}
                disabled={resendLoading || resendSecondsLeft > 0}
              >
                {resendLoading
                  ? "Sending..."
                  : resendSecondsLeft > 0
                    ? `Resend Code (${resendSecondsLeft}s)`
                    : "Resend Code"}
              </button>
              <p className="login-switch-text">
                Need to update your registration?{" "}
                <button
                  type="button"
                  className="login-link-btn"
                  onClick={() => setVerificationStep(false)}
                  disabled={verificationLoading || resendLoading}
                >
                  Back to registration
                </button>
              </p>
            </form>
          ) : (
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
              <label>Program</label>
              <select
                className={`login-input ${departmentError ? "input-error" : ""}`}
                value={form.department}
                onChange={(event) => {
                  set("department")(event);
                  setDepartmentError("");
                }}
                aria-invalid={Boolean(departmentError)}
              >
                <option value="">Select Program</option>
                {DEPARTMENT_OPTIONS.map((department) => (
                  <option key={department} value={department}>{department}</option>
                ))}
              </select>
              {departmentError && <p className="password-match-error">{departmentError}</p>}
            </div>

            <div className="login-field">
              <label htmlFor="registration-main-category">Sports</label>
              <select
                id="registration-main-category"
                className="login-input"
                value={mainCategory}
                onChange={(event) => {
                  setMainCategory(event.target.value);
                  setSportSubcategory("");
                  setPreferredCategory("");
                  setForm((prev) => ({ ...prev, sport: "" }));
                }}
                required
              >
                <option value="">Select Category</option>
                {REGISTRATION_CATEGORIES.map(({ name }) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            {mainCategory === "Sports Event" && (
              <div className="login-field">
                <label htmlFor="registration-sport-subcategory">Sports Subcategory</label>
                <select
                  id="registration-sport-subcategory"
                  className="login-input"
                  value={sportSubcategory}
                  onChange={(event) => {
                    setSportSubcategory(event.target.value);
                    setPreferredCategory("");
                    setForm((prev) => ({ ...prev, sport: "" }));
                  }}
                  required
                >
                  <option value="">Select Sports Subcategory</option>
                  {selectedCategory.subcategories.map(({ name }) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            )}

            {specificOptions.length > 0 && (
              <div className="login-field">
                <label htmlFor="registration-sport">
                  {mainCategory === "Sports Event" ? "Sport" : "Event"}
                </label>
                <select
                  id="registration-sport"
                  className="login-input"
                  value={form.sport}
                  onChange={set("sport")}
                  required
                >
                  <option value="">Select {mainCategory === "Sports Event" ? "Sport" : "Event"}</option>
                  {specificOptions.map((sport) => (
                    <option key={sport} value={sport}>{sport}</option>
                  ))}
                </select>
              </div>
            )}

            {sportSubcategory === "Racket & Net Sports" && (
              <div className="login-field">
                <label htmlFor="registration-preferred-category">Preferred Category (Optional)</label>
                <select
                  id="registration-preferred-category"
                  className="login-input"
                  value={preferredCategory}
                  onChange={(event) => setPreferredCategory(event.target.value)}
                >
                  <option value="">Select Preferred Category</option>
                  {PREFERRED_CATEGORY_OPTIONS.map((category) => (
                    <option key={category} value={category}>{category}</option>
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
          )}
        </div>
      </div>
    </div>
  );
}