import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  register as registerUser,
  checkStudentIdAvailability,
  verifyRegistrationOtp,
  resendRegistrationOtp,
} from "../../services/api";
import { useNotifications } from "../../components/useNotifications";
import AuthSuccessPopup from "../../components/AuthSuccessPopup";
import Icon from "../../components/Icon";
import { DEPARTMENT_OPTIONS } from "../../constants/studentRegistrationOptions";
import {
  PREFERRED_CATEGORY_OPTIONS,
  REGISTRATION_CATEGORIES,
} from "../../constants/registrationCategories";
import { PASSWORD_POLICY_MESSAGE, isPasswordValid } from "../../constants/passwordPolicy";
import "./RegisterPage.css";

import gymBackground from "../../assets/GYMSTAT BG.jpg";

const NAME_COMPONENT_PATTERN = /^[\p{L}\p{M}]+(?:[\s'’.-][\p{L}\p{M}]+)*\.?$/u;
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "dispostable.com", "temp-mail.org",
  "10minutemail.com", "throwawaymail.com", "yopmail.com", "yomail.info",
  "trashmail.com", "maildrop.cc"
]);
const DUMMY_EMAIL_PREFIXES = new Set([
  "test", "dummy", "demo", "sample", "placeholder", "guest", "fake", "invalid",
  "noreply", "no-reply", "asdf", "qwerty", "lorem", "ipsum"
]);
const GMAIL_EMAIL_PATTERN = /^[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?@gmail\.com$/i;
const STUDENT_ID_PATTERN = /^23[BGST]\d{4}$/;
const DUPLICATE_STUDENT_ID_MESSAGE = "This ID number has already been used. Please use a different ID number.";

const normalizeNamePart = (value) => String(value || "").trim().replace(/\s+/g, " ");
const validateNamePart = (value, label, { required = false, maxLength = 100 } = {}) => {
  const normalizedValue = normalizeNamePart(value);
  if (!normalizedValue) return required ? `Please enter your ${label}.` : "";
  if (
    normalizedValue.length > maxLength
    || !NAME_COMPONENT_PATTERN.test(normalizedValue)
  ) {
    return `Enter a valid ${label.toLowerCase()} using letters, spaces, hyphens, apostrophes, or periods.`;
  }
  return "";
};
const normalizePhilippineContactNumber = (value) => {
  const trimmedValue = String(value || "").trim();
  if (/^09\d{9}$/.test(trimmedValue)) return `+63${trimmedValue.slice(1)}`;
  if (/^\+639\d{9}$/.test(trimmedValue)) return trimmedValue;
  return "";
};
const validateRegistrationField = (field, value) => {
  if (field === "contactNumber") {
    if (!String(value || "").trim()) return "Please enter your Contact Number.";
    return normalizePhilippineContactNumber(value)
      ? ""
      : "Enter a valid Philippine mobile number (09XXXXXXXXX or +639XXXXXXXXX).";
  }
  const options = field === "middleInitial"
    ? { maxLength: 8 }
    : field === "suffix"
      ? { maxLength: 16 }
      : { required: true };
  const label = {
    firstName: "First Name",
    middleInitial: "Middle Initial",
    lastName: "Last Name",
    suffix: "Suffix",
  }[field];
  return validateNamePart(value, label, options);
};

const validateEmailAddress = (value) => {
  const email = String(value || "").trim();

  if (!email) {
    return "Please enter your Gmail address.";
  }

  if (email.includes(" ")) {
    return "Email address cannot contain spaces.";
  }

  const atCount = (email.match(/@/g) || []).length;
  if (atCount !== 1) {
    return "Please enter a valid Gmail address in the format name@gmail.com.";
  }

  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) {
    return "Please enter a valid Gmail address in the format name@gmail.com.";
  }

  if (!/^[A-Za-z0-9](?:[A-Za-z0-9._%+-]*[A-Za-z0-9])?$/.test(localPart)) {
    return "The Gmail username is invalid. Use letters, numbers, periods, underscores, hyphens, or plus signs only.";
  }

  if (domain.toLowerCase() !== "gmail.com") {
    return "Use a valid Gmail address ending in @gmail.com. Other extensions such as @gmail.com.ph are not accepted.";
  }

  if (!GMAIL_EMAIL_PATTERN.test(email)) {
    return "Please enter a valid Gmail address in the format name@gmail.com.";
  }

  if (DISPOSABLE_EMAIL_DOMAINS.has(domain.toLowerCase())) {
    return "Please use a real Gmail address that you regularly access.";
  }

  const normalizedLocalPart = localPart.replace(/[._+-]+/g, "").toLowerCase();
  if (normalizedLocalPart && [...DUMMY_EMAIL_PREFIXES].some((prefix) => normalizedLocalPart === prefix || normalizedLocalPart.startsWith(prefix))) {
    return "Please use a real Gmail address that you regularly access.";
  }

  return null;
};

const validateRegistrationId = (value) => {
  const trimmedValue = String(value || "").trim();

  if (!trimmedValue) {
    return "Please enter your ID number.";
  }

  if (/^\d{4}-\d{4}$/.test(trimmedValue)) {
    return null;
  }

  if (!STUDENT_ID_PATTERN.test(trimmedValue)) {
    return "ID Number format is invalid.";
  }

  return null;
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const { notify } = useNotifications();
  const registrationInFlightRef = useRef(false);
  const registrationPendingRef = useRef(false);

  const [form, setForm] = useState({
    firstName: "",
    middleInitial: "",
    lastName: "",
    suffix: "",
    contactNumber: "",
    email: "",
    password: "",
    department: "",
    sport: "",
    id: ""
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [registrationSuccessPopup, setRegistrationSuccessPopup] = useState(false);
  const [registrationSuccessMessage, setRegistrationSuccessMessage] = useState("Registration Successful!");
  const [emailError, setEmailError] = useState("");
  const [identityErrors, setIdentityErrors] = useState({});
  const [verificationStep, setVerificationStep] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationCodeSent, setVerificationCodeSent] = useState(true);
  const [verificationNotice, setVerificationNotice] = useState("");
  const [verificationOtp, setVerificationOtp] = useState("");
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);
  const [departmentError, setDepartmentError] = useState("");
  const [mainCategory, setMainCategory] = useState("");
  const [sportSubcategory, setSportSubcategory] = useState("");
  const [preferredCategory, setPreferredCategory] = useState("");
  const [checkingStudentId, setCheckingStudentId] = useState(false);

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

  useEffect(() => {
    if (!registrationSuccessPopup) return undefined;

    const timer = window.setTimeout(() => {
      setRegistrationSuccessPopup(false);
    }, 1600);

    return () => window.clearTimeout(timer);
  }, [registrationSuccessPopup]);

  const showRegistrationSuccessPopup = (message) => {
    setRegistrationSuccessMessage(message);
    setRegistrationSuccessPopup(true);
  };

  const set = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  const setIdentityField = (field) => (event) => {
    const { value } = event.target;
    setForm((previous) => ({ ...previous, [field]: value }));
    setIdentityErrors((previous) => previous[field]
      ? { ...previous, [field]: validateRegistrationField(field, value) }
      : previous);
  };

  // Password validation function
  const validatePassword = (password) => {
    return isPasswordValid(password) ? null : PASSWORD_POLICY_MESSAGE;
  };

  const handlePasswordChange = (e) => {
    setForm((prev) => ({ ...prev, password: e.target.value }));
  };

  const showVerificationStep = (email, resendDelay = 60, emailSent = true, notice = "") => {
    setVerificationEmail(email);
    setVerificationCodeSent(emailSent);
    setVerificationNotice(notice || "Registration saved. Check your email for the verification code.");
    setVerificationOtp("");
    setVerificationStep(true);
    setResendSecondsLeft(resendDelay);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (registrationInFlightRef.current) return;

    const nextIdentityErrors = Object.fromEntries(
      ["firstName", "middleInitial", "lastName", "suffix", "contactNumber"]
        .map((field) => [field, validateRegistrationField(field, form[field])])
    );
    setIdentityErrors(nextIdentityErrors);
    if (Object.values(nextIdentityErrors).some(Boolean)) return;

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

    const trimmedEmail = form.email.trim();
    const trimmedId = form.id.trim();

    if (!trimmedEmail || !form.password || !confirmPassword || !trimmedId) {
      notify("warning", "Missing Information", "Please fill in all required fields.");
      return;
    }

    const emailValidationError = validateEmailAddress(trimmedEmail);
    if (emailValidationError) {
      setEmailError(emailValidationError);
      notify("warning", "Invalid Email", emailValidationError);
      return;
    }
    setEmailError("");

    if (form.password !== confirmPassword) {
      notify("warning", "Passwords Do Not Match", "Passwords do not match.");
      return;
    }

    const idValidationError = registrationRole === "student"
      ? validateRegistrationId(trimmedId)
      : null;
    if (idValidationError) {
      notify("warning", "Invalid ID Number", "ID Number format is invalid.");
      return;
    }

    if (registrationRole === "student") {
      setCheckingStudentId(true);
      try {
        const availability = await checkStudentIdAvailability(trimmedId);
        if (availability?.success !== true) {
          // Server error — warn and let registration proceed; backend will reject duplicates
          console.warn("ID availability check returned non-success:", availability?.message);
        } else if (availability.available === false) {
          notify("warning", "ID Number Already Used", DUPLICATE_STUDENT_ID_MESSAGE);
          return;
        } else if (availability.available === true) {
          notify("success", "ID Number Available", "This ID Number is available.");
        }
        // available === null means the check was inconclusive; let registration proceed
      } catch (error) {
        console.warn(
          "Unable to pre-check student ID availability; registration will validate the ID:",
          error
        );
      } finally {
        setCheckingStudentId(false);
      }
    }

    const passwordValidationError = validatePassword(form.password);
    if (passwordValidationError) {
      notify("warning", "Invalid Password", passwordValidationError);
      return;
    }

    await submitRegistration();
  };

  const submitRegistration = async () => {
    if (registrationInFlightRef.current) return;
    registrationInFlightRef.current = true;
    setLoading(true);
    try {
      const email = form.email.trim().toLowerCase();
      const data = registrationPendingRef.current
        ? await resendRegistrationOtp(email)
        : await registerUser({
          ...form,
          firstName: normalizeNamePart(form.firstName),
          middleInitial: normalizeNamePart(form.middleInitial),
          lastName: normalizeNamePart(form.lastName),
          suffix: normalizeNamePart(form.suffix),
          fullname: [
            normalizeNamePart(form.firstName),
            normalizeNamePart(form.middleInitial),
            normalizeNamePart(form.lastName),
            normalizeNamePart(form.suffix),
          ].filter(Boolean).join(" "),
          contactNumber: normalizePhilippineContactNumber(form.contactNumber),
          email,
          id: form.id.trim(),
          role: registrationRole
        });

      if (data.success && data.verificationRequired) {
        registrationPendingRef.current = true;
        const retryAfter = Number.isInteger(data.retryAfterSeconds) ? data.retryAfterSeconds : 60;
        const codeSent = data.codeSent !== false && data.emailSent !== false;
        showVerificationStep(
          email,
          retryAfter,
          codeSent,
          data.message || ""
        );
        if (!codeSent) {
          notify("warning", "Email Not Sent", data.message || "Your registration is awaiting email verification. Request a new code when delivery is available.");
        }
      } else {
        notify("error", "Registration Failed", data.message || "Please review your information and try again.");
      }
    } catch (err) {
      console.error("Register error:", err);
      if (err.status === 409 && /id/i.test(err.message || "")) {
        notify("warning", "ID Number Already Used", DUPLICATE_STUDENT_ID_MESSAGE);
        return;
      }
      if (registrationRole === "student" && /student id must be 7 characters/i.test(err.message || "")) {
        notify("warning", "Invalid ID Number", "ID Number format is invalid.");
        return;
      }
      if (err.responseData?.verificationRequired) {
        notify("warning", "Email Not Sent", err.message || "The verification code could not be sent. Please try again.");
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
      showRegistrationSuccessPopup("Registration Successful!");
      setTimeout(() => navigate("/login"), 1600);
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
      if (result.codeSent === false || result.emailSent === false) {
        setVerificationCodeSent(false);
        setVerificationNotice(result.message || "The verification code could not be sent. Please try again.");
        setResendSecondsLeft(Number(result.retryAfterSeconds || 0));
        notify("error", "Unable to Resend Code", result.message || "Please try again later.");
        return;
      }
      setVerificationCodeSent(true);
      setVerificationNotice("A new verification code was sent. Check your email, including the spam folder.");
      setResendSecondsLeft(60);
      showRegistrationSuccessPopup("Verification code sent!");
    } catch (error) {
      const retryAfterSeconds = Number(error.responseData?.retryAfterSeconds || 0);
      setVerificationCodeSent(false);
      setVerificationNotice(error.message || "The verification code could not be sent. Please try again.");
      if (retryAfterSeconds > 0) setResendSecondsLeft(retryAfterSeconds);
      notify("error", "Unable to Resend Code", error.message || "Please try again later.");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="login-root">
      <AuthSuccessPopup isOpen={registrationSuccessPopup} message={registrationSuccessMessage} />
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
          {/*<div className="login-university-badge">
            <span>MARINDUQUE STATE UNIVERSITY</span>
          </div>*/}

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
                className={`registration-verification-notice${verificationCodeSent ? " registration-verification-notice-success" : " registration-verification-notice-warning"}`}
                role={verificationCodeSent ? "status" : "alert"}
                aria-live="polite"
              >
                <strong>{verificationCodeSent
                  ? "Registration received — check your email."
                  : "Registration saved — verification email not sent."}</strong>
                <span>{verificationNotice}</span>
                <span><strong>{verificationEmail}</strong></span>
                {verificationCodeSent && (
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
                disabled={!verificationCodeSent || verificationLoading || verificationOtp.length !== 6}
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
            </form>
          ) : (
          <form onSubmit={handleRegister} className="login-form">
            {[
              { field: "firstName", label: "First Name", required: true, placeholder: "Enter your first name", maxLength: 100 },
              { field: "middleInitial", label: "Middle Initial", required: false, placeholder: "Optional", maxLength: 8 },
              { field: "lastName", label: "Last Name", required: true, placeholder: "Enter your last name", maxLength: 100 },
              { field: "suffix", label: "Suffix", required: false, placeholder: "e.g., Jr., Sr., II", maxLength: 16 },
              { field: "contactNumber", label: "Contact Number", required: true, placeholder: "09XXXXXXXXX or +639XXXXXXXXX", maxLength: 13 },
            ].map(({ field, label, required, placeholder, maxLength }) => (
              <div className="login-field" key={field}>
                <label htmlFor={`registration-${field}`}>{label}{required ? " (Required)" : " (Optional)"}</label>
                <input
                  id={`registration-${field}`}
                  name={field}
                  type={field === "contactNumber" ? "tel" : "text"}
                  className={`login-input ${identityErrors[field] ? "input-error" : ""}`}
                  value={form[field]}
                  onChange={setIdentityField(field)}
                  onBlur={() => setIdentityErrors((previous) => ({
                    ...previous,
                    [field]: validateRegistrationField(field, form[field]),
                  }))}
                  placeholder={placeholder}
                  maxLength={maxLength}
                  autoComplete={field === "contactNumber"
                    ? "tel"
                    : field === "firstName"
                      ? "given-name"
                      : field === "middleInitial"
                        ? "additional-name"
                        : field === "lastName"
                          ? "family-name"
                          : "honorific-suffix"}
                  inputMode={field === "contactNumber" ? "tel" : undefined}
                  aria-invalid={Boolean(identityErrors[field])}
                  aria-describedby={identityErrors[field] ? `registration-${field}-error` : undefined}
                  required={required}
                />
                {identityErrors[field] && (
                  <p id={`registration-${field}-error`} className="password-match-error" role="alert">
                    {identityErrors[field]}
                  </p>
                )}
              </div>
            ))}

            <div className="login-field">
              <label>Email</label>
              <input
                type="email"
                className={`login-input ${emailError ? "input-error" : ""}`}
                value={form.email}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setForm((previous) => ({ ...previous, email: nextValue }));
                  setEmailError(validateEmailAddress(nextValue));
                }}
                onBlur={() => {
                  setEmailError(validateEmailAddress(form.email));
                }}
                placeholder="name@gmail.com"
                autoComplete="off"
                aria-invalid={Boolean(emailError)}
                required
              />
              {emailError && <p className="password-match-error">{emailError}</p>}
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

            <button type="submit" className="login-submit-btn" disabled={loading || checkingStudentId}>
              {checkingStudentId ? "Checking ID..." : loading ? "Registering..." : "Sign Up"}
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