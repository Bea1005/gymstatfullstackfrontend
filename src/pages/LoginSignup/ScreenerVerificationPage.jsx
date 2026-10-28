import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { resendLoginOtp, storeClientSessionMetadata, verifyLoginOtp } from '../../services/api';
import { useNotifications } from '../../components/useNotifications';

export default function ScreenerVerificationPage() {
  const navigate = useNavigate();
  const { notify } = useNotifications();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(60);

  const pendingLogin = useMemo(() => {
    try {
      const raw = sessionStorage.getItem('pendingScreenerLogin');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.id) return null;
      return {
        id: String(parsed.id),
        email: String(parsed.email || ''),
        role: 'screener'
      };
    } catch (error) {
      console.warn('Unable to read pending screener login data.', error);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!pendingLogin) {
      navigate('/login', { replace: true });
      return undefined;
    }

    const timer = window.setInterval(() => {
      setResendSecondsLeft((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [navigate, pendingLogin]);

  const handleVerify = async (event) => {
    event.preventDefault();
    if (!pendingLogin) return;
    if (!/^\d{6}$/.test(code)) {
      notify('warning', 'Invalid Code', 'Enter the 6-digit verification code from your institutional email.');
      return;
    }

    setLoading(true);
    try {
      const data = await verifyLoginOtp(pendingLogin.id, code);
      sessionStorage.removeItem('pendingScreenerLogin');
      storeClientSessionMetadata({ ...data.user, role: 'screener' });
      notify('success', 'Verification successful', 'Redirecting to the Screener Portal...');
      navigate('/screener/dashboard', { replace: true });
    } catch (error) {
      notify('error', 'Verification failed', error.message || 'The verification code is invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!pendingLogin || resendLoading || resendSecondsLeft > 0) return;
    setResendLoading(true);
    try {
      await resendLoginOtp(pendingLogin.id);
      setCode('');
      setResendSecondsLeft(60);
      notify('success', 'New code sent', 'A fresh verification code has been sent to your institutional email.');
    } catch (error) {
      notify('error', 'Unable to resend code', error.message || 'Please try again later.');
    } finally {
      setResendLoading(false);
    }
  };

  if (!pendingLogin) {
    return null;
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #f4f1eb 0%, #efe6dd 100%)',
      padding: '24px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '480px',
        background: '#fff',
        borderRadius: '16px',
        boxShadow: '0 16px 40px rgba(0,0,0,0.12)',
        padding: '28px 24px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, color: '#7a0a0a', fontSize: '32px' }}>GYMSTAT</h2>
          <p style={{ margin: '10px 0 0', color: '#555', fontSize: '14px' }}>Screener Verification</p>
        </div>

        <div style={{ background: '#fdf5f5', border: '1px solid #f0d7d7', borderRadius: '10px', padding: '12px 14px', marginBottom: '18px' }}>
          <div style={{ fontWeight: 700, color: '#7a0a0a', marginBottom: '6px' }}>Verification required</div>
          <div style={{ color: '#555', fontSize: '14px' }}>
            Enter the 6-digit code sent to <strong>{pendingLogin.email || 'your institutional email'}</strong>.
          </div>
        </div>

        <form onSubmit={handleVerify}>
          <label htmlFor="verification-code" style={{ display: 'block', fontWeight: 700, marginBottom: '8px', color: '#333' }}>
            Verification code
          </label>
          <input
            id="verification-code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              borderRadius: '10px',
              border: '1px solid #d7d7d7',
              padding: '12px 14px',
              fontSize: '18px',
              letterSpacing: '0.2em',
              textAlign: 'center',
              marginBottom: '12px'
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              marginTop: '8px',
              border: 'none',
              borderRadius: '10px',
              background: '#7a0a0a',
              color: '#fff',
              padding: '12px 16px',
              fontSize: '15px',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Verifying...' : 'Verify Code'}
          </button>
        </form>

        <div style={{ marginTop: '18px', textAlign: 'center' }}>
          <button
            type="button"
            onClick={handleResend}
            disabled={resendLoading || resendSecondsLeft > 0}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#7a0a0a',
              textDecoration: 'underline',
              cursor: resendLoading || resendSecondsLeft > 0 ? 'not-allowed' : 'pointer',
              opacity: resendLoading || resendSecondsLeft > 0 ? 0.6 : 1
            }}
          >
            {resendLoading
              ? 'Sending...'
              : resendSecondsLeft > 0
                ? `Resend code in ${resendSecondsLeft}s`
                : 'Resend code'}
          </button>
        </div>

        <div style={{ marginTop: '22px', textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => {
              sessionStorage.removeItem('pendingScreenerLogin');
              navigate('/login', { replace: true });
            }}
            style={{
              background: 'transparent',
              border: '1px solid #ccc',
              borderRadius: '8px',
              padding: '8px 12px',
              color: '#444',
              cursor: 'pointer'
            }}
          >
            Back to login
          </button>
        </div>
      </div>
    </div>
  );
}
