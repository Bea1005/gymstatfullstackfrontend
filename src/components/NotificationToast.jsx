import React, { useEffect } from 'react';
import './NotificationToast.css';

const NotificationToast = ({ message, type = 'success', onClose }) => {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, 4200);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className={`toast-notification ${type === 'error' ? 'toast-error' : 'toast-success'}`} role="status" aria-live="polite">
      <div className="toast-message">{message}</div>
      <button className="toast-close" onClick={onClose} aria-label="Dismiss notification">
        ×
      </button>
    </div>
  );
};

export default NotificationToast;
