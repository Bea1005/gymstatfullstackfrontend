import React, { useState } from 'react';
import NotificationToast from '../../components/NotificationToast';
import './StudentPortal.css';

const StudentSettings = () => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [toast, setToast] = useState({ message: '', type: 'success' });

  const handleToggleNotifications = () => {
    setNotificationsEnabled((prev) => !prev);
    setToast({
      message: `Notifications ${notificationsEnabled ? 'disabled' : 'enabled'}.`,
      type: 'success',
    });
  };

  const openPasswordModal = () => {
    setShowPasswordModal(true);
    setSettingsError('');
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setNewPassword('');
    setConfirmPassword('');
    setSettingsError('');
  };

  const handleSavePassword = () => {
    if (!newPassword || !confirmPassword) {
      setSettingsError('Please enter and confirm your new password.');
      setToast({ message: 'Please enter and confirm your new password.', type: 'error' });
      return;
    }
    if (newPassword.length < 8) {
      setSettingsError('Password must be at least 8 characters.');
      setToast({ message: 'Password must be at least 8 characters.', type: 'error' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setSettingsError('Passwords do not match.');
      setToast({ message: 'Passwords do not match.', type: 'error' });
      return;
    }

    closePasswordModal();
    setToast({ message: 'Password changed successfully.', type: 'success' });
  };

  const handleContactSupport = () => {
    setToast({ message: 'Please email support@gymstat.edu for help.', type: 'success' });
  };

  return (
    <div className="student-settings-page">
      <h2 className="student-settings-page__title">Settings</h2>

      <div className="student-settings-page__content">
        <section className="student-settings-page__section">
          <div className="student-settings-page__heading">
            <div>
              <p className="student-settings-page__section-label">Account</p>
            </div>
          </div>

          <div className="student-settings-page__row">
            <div>
              <p className="student-settings-page__row-title">🔐 Change Password</p>
              <p className="student-settings-page__row-description">
                Update your account password
              </p>
            </div>
            <button className="student-settings-page__action student-settings-page__action--primary" onClick={openPasswordModal}>
              Update
            </button>
          </div>
        </section>

        <section className="student-settings-page__section">
          <div className="student-settings-page__heading">
            <div>
              <p className="student-settings-page__section-label">Preferences</p>
            </div>
          </div>

          <div className="student-settings-page__row">
            <div>
              <p className="student-settings-page__row-title">Notifications</p>
              <p className="student-settings-page__row-description">
                Receive updates about your requirements.
              </p>
            </div>
            <button
              onClick={handleToggleNotifications}
              className={`student-settings-page__toggle-btn ${notificationsEnabled ? '' : 'student-settings-page__toggle-btn--off'}`}
            >
              {notificationsEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
        </section>

        <section className="student-settings-page__section student-settings-page__section--accent">
          <div className="student-settings-page__support-row">
            <div>
              <p className="student-settings-page__support-title">Need Help?</p>
              <p className="student-settings-page__support-description">
                Contact our support team for assistance.
              </p>
            </div>
            <button className="student-settings-page__action student-settings-page__action--accent" onClick={handleContactSupport}>
              Contact Support
            </button>
          </div>
        </section>
      </div>

      {showPasswordModal && (
        <div className="modal-backdrop" onClick={closePasswordModal}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="password-modal-title" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 id="password-modal-title">Change Password</h3>
            </div>
            <p className="modal-message">Enter a new password to update your account credentials.</p>
            <div className="modal-body">
              <input
                type="password"
                className="modal-input"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <input
                type="password"
                className="modal-input"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {settingsError && <p className="modal-error">{settingsError}</p>}
            </div>
            <div className="modal-actions">
              <button className="modal-btn modal-cancel" onClick={closePasswordModal}>Cancel</button>
              <button className="modal-btn modal-confirm" onClick={handleSavePassword}>Save Password</button>
            </div>
          </div>
        </div>
      )}

      <NotificationToast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />
    </div>
  );
};

export default StudentSettings;
