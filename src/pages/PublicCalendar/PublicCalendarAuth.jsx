import { useEffect, useRef, useState } from 'react';
import {
  completeCalendarProfile,
  loginCalendarAccount,
  loginCalendarWithGoogle,
  registerCalendarAccount,
  requestPasswordReset,
  resetPassword,
  resendCalendarVerification,
  verifyCalendarRegistration,
  verifyPasswordResetOtp,
} from '../../services/api';
import Icon from '../../components/Icon';
import logo from '../../assets/logo.png';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^(09\d{9}|\+639\d{9})$/;
const GOOGLE_CLIENT_ID = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();

export default function PublicCalendarAuth({
  selectedDate,
  initialUser,
  needsProfileCompletion,
  onClose,
  onAuthenticated,
  onNotify,
}) {
  const [screen, setScreen] = useState(needsProfileCompletion ? 'profile' : 'login');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationOtp, setVerificationOtp] = useState('');
  const [resendSeconds, setResendSeconds] = useState(0);
  const [resetOtp, setResetOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [profileFullname, setProfileFullname] = useState(initialUser?.fullname || '');
  const [profilePhone, setProfilePhone] = useState(initialUser?.contactNumber || '');
  const [googleStatus, setGoogleStatus] = useState(GOOGLE_CLIENT_ID ? 'loading' : 'missing');
  const googleButtonRef = useRef(null);
  const onAuthenticatedRef = useRef(onAuthenticated);
  onAuthenticatedRef.current = onAuthenticated;

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || screen !== 'login') return undefined;
    let active = true;
    const renderGoogleButton = () => {
      if (!active || !window.google?.accounts?.id || !googleButtonRef.current) return false;
      // Guard against duplicate initialization — GIS logs a warning if initialize()
      // is called more than once with the same client_id in the same page load.
      if (!window.__gymstatGoogleInitialized) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async ({ credential }) => {
            if (!credential) {
              setError('Google did not return an identity credential.');
              return;
            }
          setLoading(true);
          setError('');
          try {
            const result = await loginCalendarWithGoogle(credential);
            if (result.needsProfileCompletion) {
              setProfileFullname(result.user?.fullname || '');
              setProfilePhone(result.user?.contactNumber || '');
              setScreen('profile');
              return;
            }
            onAuthenticatedRef.current(result.user);
          } catch (authError) {
            setError(authError.message || 'Google sign-in failed. Please try again.');
          } finally {
            setLoading(false);
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });
        window.__gymstatGoogleInitialized = true;
      }
      googleButtonRef.current.replaceChildren();
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: Math.min(360, googleButtonRef.current.clientWidth || 360),
      });
      setGoogleStatus('ready');
      return true;
    };

    if (renderGoogleButton()) return () => { active = false; };

    let script = document.getElementById('google-identity-services');
    const handleLoad = () => {
      if (!renderGoogleButton() && active) setGoogleStatus('error');
    };
    if (!script) {
      script = document.createElement('script');
      script.id = 'google-identity-services';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.addEventListener('load', handleLoad, { once: true });
      script.addEventListener('error', () => active && setGoogleStatus('error'), { once: true });
      document.head.appendChild(script);
    } else {
      script.addEventListener('load', handleLoad, { once: true });
    }

    return () => {
      active = false;
      script?.removeEventListener('load', handleLoad);
    };
  }, [screen]);

  useEffect(() => {
    if (resendSeconds <= 0) return undefined;
    const timer = window.setInterval(() => setResendSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  const beginProfileCompletion = (user) => {
    setProfileFullname(user?.fullname || '');
    setProfilePhone(user?.contactNumber || '');
    setScreen('profile');
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail) || !password) {
      setError('Enter a valid email address and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await loginCalendarAccount(normalizedEmail, password);
      if (result.needsProfileCompletion) {
        beginProfileCompletion(result.user);
        return;
      }
      onAuthenticated(result.user);
    } catch (loginError) {
      setError(loginError.message || 'Unable to log in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phoneNumber.trim();
    if (!firstName.trim() || !lastName.trim() || !EMAIL_PATTERN.test(normalizedEmail)) {
      setError('Enter your first name, last name, and a valid email address.');
      return;
    }
    if (!PHONE_PATTERN.test(normalizedPhone)) {
      setError('Enter a Philippine mobile number in the format 09XXXXXXXXX or +639XXXXXXXXX.');
      return;
    }
    if (password.length < 10 || !/[A-Z]/.test(password) || !/[a-z]/.test(password)
      || !/\d/.test(password) || !/[!@#$%^&*(),.?":{}|<>_-]/.test(password)) {
      setError('Password must be at least 10 characters and include uppercase, lowercase, number, and special character.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await registerCalendarAccount({
        firstName: firstName.trim(),
        middleName: middleName.trim(),
        lastName: lastName.trim(),
        email: normalizedEmail,
        phoneNumber: normalizedPhone,
        password,
      });
      setEmail(normalizedEmail);
      setResendSeconds(60);
      setScreen('verification');
    } catch (registrationError) {
      setError(registrationError.message || 'Unable to create your account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (event) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(verificationOtp.trim())) {
      setError('Enter the 6-digit code sent to your email.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await verifyCalendarRegistration(email.trim().toLowerCase(), verificationOtp.trim());
      if (result.needsProfileCompletion) {
        beginProfileCompletion(result.user);
        return;
      }
      onAuthenticated(result.user);
    } catch (verificationError) {
      setError(verificationError.message || 'Unable to verify your email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await resendCalendarVerification(email.trim().toLowerCase());
      setResendSeconds(result.retryAfterSeconds || 60);
      onNotify('success', result.message || 'A new verification code was sent.');
    } catch (resendError) {
      if (resendError.responseData?.retryAfterSeconds) {
        setResendSeconds(resendError.responseData.retryAfterSeconds);
      }
      setError(resendError.message || 'Unable to resend the verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotRequest = async (event) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setError('Enter the valid email address associated with your account.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await requestPasswordReset(normalizedEmail);
      setEmail(normalizedEmail);
      setScreen('forgot-otp');
    } catch (resetError) {
      setError(resetError.message || 'Unable to request a password reset.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotVerify = async (event) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(resetOtp.trim())) {
      setError('Enter the 6-digit password-reset code.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await verifyPasswordResetOtp(email.trim().toLowerCase(), resetOtp.trim());
      setResetToken(result.resetToken);
      setScreen('forgot-password');
    } catch (resetError) {
      setError(resetError.message || 'The password-reset code is invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotReset = async (event) => {
    event.preventDefault();
    if (newPassword.length < 10 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword)
      || !/\d/.test(newPassword) || !/[!@#$%^&*(),.?":{}|<>_-]/.test(newPassword)) {
      setError('Password must be at least 10 characters and include uppercase, lowercase, number, and special character.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await resetPassword(email.trim().toLowerCase(), resetToken, newPassword);
      setPassword('');
      setConfirmPassword('');
      setNewPassword('');
      setResetOtp('');
      setResetToken('');
      setScreen('login');
      onNotify('success', 'Password reset successfully. Log in with your new password.');
    } catch (resetError) {
      setError(resetError.message || 'Unable to reset your password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileComplete = async (event) => {
    event.preventDefault();
    if (!profileFullname.trim() || !PHONE_PATTERN.test(profilePhone.trim())) {
      setError('Enter your full name and a valid Philippine mobile number.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await completeCalendarProfile(profileFullname.trim(), profilePhone.trim());
      onAuthenticated(result.user);
    } catch (profileError) {
      setError(profileError.message || 'Unable to save the required account details.');
    } finally {
      setLoading(false);
    }
  };

  const switchScreen = (nextScreen) => {
    setError('');
    setScreen(nextScreen);
  };
  const title = screen === 'register'
    ? 'Create an Account'
    : screen.startsWith('forgot')
      ? 'Reset Password'
      : screen === 'verification'
        ? 'Verify Your Email'
        : screen === 'profile'
          ? 'Complete Your Details'
          : 'Welcome Back';

  return (
    <div className="pc-auth-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !loading) onClose();
    }}>
      <section className="pc-auth-card" role="dialog" aria-modal="true" aria-labelledby="pc-auth-title">
        <button className="pc-auth-close" type="button" aria-label="Close authentication" onClick={onClose} disabled={loading}>
          <Icon name="close" size={20} />
        </button>
        <div className="pc-auth-content" key={screen}>
          <img className="pc-auth-logo" src={logo} alt="GYMSTAT" />
          <h2 id="pc-auth-title">{title}</h2>
          <p className="pc-auth-context">Continue to request a schedule for {selectedDate}.</p>

          {screen === 'login' && (
            <form className="pc-auth-form" onSubmit={handleLogin}>
              <label className="pc-auth-field">
                Email
                <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </label>
              <label className="pc-auth-field">
                Password
                <span className="pc-auth-password">
                  <input type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
                  <button type="button" className="pc-auth-icon-button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((visible) => !visible)}>
                    <Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} />
                  </button>
                </span>
              </label>
              <button type="button" className="pc-auth-text-button pc-auth-forgot" onClick={() => switchScreen('forgot-email')}>Forgot Password?</button>
              <button className="pc-auth-submit" type="submit" disabled={loading}>{loading ? 'Logging in...' : 'Login'}</button>
              <div className="pc-auth-separator"><span>Or continue with</span></div>
              {GOOGLE_CLIENT_ID
                ? <div className={`pc-auth-google${googleStatus === 'loading' ? ' pc-auth-google--loading' : ''}`} ref={googleButtonRef} aria-label="Continue with Google" />
                : (
                  <div className="pc-auth-google-unavailable" role="status">
                    <p className="pc-auth-google-unavailable__title">Google Sign-In is currently unavailable.</p>
                    <p className="pc-auth-google-unavailable__detail">
                      To enable Google sign-in, configure <code>VITE_GOOGLE_CLIENT_ID</code> in the frontend
                      environment and <code>GOOGLE_CLIENT_ID</code> in the backend environment using the same
                      Google OAuth Web Client ID. See the project README or DEPLOYMENT.md for setup steps.
                    </p>
                  </div>
                )}
              {googleStatus === 'error' && <p className="pc-auth-hint">Google sign-in could not load. Check your connection and OAuth client configuration.</p>}
              <p className="pc-auth-switch">Don't have an account? <button type="button" className="pc-auth-text-button" onClick={() => switchScreen('register')}>Create Account</button></p>
            </form>
          )}

          {screen === 'register' && (
            <form className="pc-auth-form pc-auth-form--register" onSubmit={handleRegister}>
              <label className="pc-auth-field">First Name<input autoComplete="given-name" maxLength={60} value={firstName} onChange={(event) => setFirstName(event.target.value)} required /></label>
              <label className="pc-auth-field">Middle Name <span className="pc-auth-optional">(optional)</span><input autoComplete="additional-name" maxLength={60} value={middleName} onChange={(event) => setMiddleName(event.target.value)} /></label>
              <label className="pc-auth-field">Last Name<input autoComplete="family-name" maxLength={60} value={lastName} onChange={(event) => setLastName(event.target.value)} required /></label>
              <label className="pc-auth-field">Email<input type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
              <label className="pc-auth-field">Phone Number<input type="tel" autoComplete="tel" inputMode="tel" placeholder="09XXXXXXXXX or +639XXXXXXXXX" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} required /></label>
              <label className="pc-auth-field">Password
                <span className="pc-auth-password"><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required /><button type="button" className="pc-auth-icon-button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((visible) => !visible)}><Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} /></button></span>
              </label>
              <label className="pc-auth-field">Confirm Password
                <span className="pc-auth-password"><input type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /><button type="button" className="pc-auth-icon-button" aria-label={showConfirmPassword ? 'Hide password' : 'Show password'} onClick={() => setShowConfirmPassword((visible) => !visible)}><Icon name={showConfirmPassword ? 'eyeOff' : 'eye'} size={18} /></button></span>
              </label>
              <button className="pc-auth-submit" type="submit" disabled={loading}>{loading ? 'Creating account...' : 'Create Account'}</button>
              <p className="pc-auth-terms">By clicking Create account, you agree to our <a href="/terms-of-service" target="_blank" rel="noreferrer">Terms</a> and have read and acknowledge our <a href="/privacy-policy" target="_blank" rel="noreferrer">Privacy Statement</a>.</p>
              <p className="pc-auth-switch">Already have an account? <button type="button" className="pc-auth-text-button" onClick={() => switchScreen('login')}>Log In</button></p>
            </form>
          )}

          {screen === 'verification' && (
            <form className="pc-auth-form" onSubmit={handleVerify}>
              <p className="pc-auth-description">Your account is not active yet. Enter the verification code sent to <strong>{email}</strong> to continue.</p>
              <label className="pc-auth-field">Email verification code<input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={verificationOtp} onChange={(event) => setVerificationOtp(event.target.value.replace(/\D/g, ''))} required /></label>
              <button className="pc-auth-submit" type="submit" disabled={loading}>{loading ? 'Verifying...' : 'Verify Email'}</button>
              <button type="button" className="pc-auth-text-button pc-auth-resend" disabled={loading || resendSeconds > 0} onClick={handleResend}>
                {resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : 'Resend verification code'}
              </button>
              <p className="pc-auth-switch">Already verified? <button type="button" className="pc-auth-text-button" onClick={() => switchScreen('login')}>Log In</button></p>
            </form>
          )}

          {screen === 'forgot-email' && (
            <form className="pc-auth-form" onSubmit={handleForgotRequest}>
              <p className="pc-auth-description">We’ll send a secure password-reset code to your account email.</p>
              <label className="pc-auth-field">Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
              <button className="pc-auth-submit" type="submit" disabled={loading}>{loading ? 'Sending code...' : 'Send Reset Code'}</button>
              <p className="pc-auth-switch"><button type="button" className="pc-auth-text-button" onClick={() => switchScreen('login')}>Back to Login</button></p>
            </form>
          )}

          {screen === 'forgot-otp' && (
            <form className="pc-auth-form" onSubmit={handleForgotVerify}>
              <p className="pc-auth-description">Enter the password-reset code sent to <strong>{email}</strong>.</p>
              <label className="pc-auth-field">Verification code<input autoComplete="one-time-code" inputMode="numeric" maxLength={6} value={resetOtp} onChange={(event) => setResetOtp(event.target.value.replace(/\D/g, ''))} required /></label>
              <button className="pc-auth-submit" type="submit" disabled={loading}>{loading ? 'Verifying...' : 'Verify Code'}</button>
              <p className="pc-auth-switch"><button type="button" className="pc-auth-text-button" onClick={() => switchScreen('forgot-email')}>Request another code</button></p>
            </form>
          )}

          {screen === 'forgot-password' && (
            <form className="pc-auth-form" onSubmit={handleForgotReset}>
              <label className="pc-auth-field">New Password<input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label>
              <label className="pc-auth-field">Confirm New Password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label>
              <button className="pc-auth-submit" type="submit" disabled={loading}>{loading ? 'Resetting...' : 'Reset Password'}</button>
            </form>
          )}

          {screen === 'profile' && (
            <form className="pc-auth-form" onSubmit={handleProfileComplete}>
              <p className="pc-auth-description">Add the required contact details before continuing to your schedule request.</p>
              <label className="pc-auth-field">Full Name<input autoComplete="name" maxLength={180} value={profileFullname} onChange={(event) => setProfileFullname(event.target.value)} required /></label>
              <label className="pc-auth-field">Phone Number<input type="tel" autoComplete="tel" inputMode="tel" placeholder="09XXXXXXXXX or +639XXXXXXXXX" value={profilePhone} onChange={(event) => setProfilePhone(event.target.value)} required /></label>
              <button className="pc-auth-submit" type="submit" disabled={loading}>{loading ? 'Saving details...' : 'Continue'}</button>
            </form>
          )}

          {error && <p className="pc-auth-error" role="alert">{error}</p>}
        </div>
      </section>
    </div>
  );
}
