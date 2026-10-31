import './AuthSuccessPopup.css';

export default function AuthSuccessPopup({ isOpen, message = 'Success!' }) {
  if (!isOpen) return null;

  return (
    <div
      className="auth-success-popup"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="auth-success-popup__icon" aria-hidden="true">✓</div>
      <span className="auth-success-popup__message">{message}</span>
    </div>
  );
}
