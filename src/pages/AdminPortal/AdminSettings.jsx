import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NotificationToast from '../../components/NotificationToast';
import '../../components/ConfirmModal.css';
import './AdminPortal.css';
import { getProfile, updateProfile } from '../../services/api';

const AdminSettings = () => {
  const navigate = useNavigate();
  const [adminInfo, setAdminInfo] = useState({
    email: '',
    notifications: true
  });
  const [loading, setLoading] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'success' });

  const showToast = (message, type = 'success') => setToast({ message, type });
  const closeToast = () => setToast({ message: '', type: 'success' });

  const openPasswordModal = () => {
    setPasswordInput('');
    setSettingsError('');
    setShowPasswordModal(true);
  };

  const openEmailModal = () => {
    setEmailInput(adminInfo.email || '');
    setSettingsError('');
    setShowEmailModal(true);
  };

  const handleSavePassword = async () => {
    if (!passwordInput) {
      setSettingsError('Password is required.');
      showToast('Password is required.', 'error');
      return;
    }

    if (passwordInput.length < 8) {
      setSettingsError('Password must be at least 8 characters');
      showToast('Password must be at least 8 characters', 'error');
      return;
    }

    try {
      const response = await updateProfile({ newPassword: passwordInput });
      if (response.success) {
        setNewPassword('');
        setPasswordInput('');
        setShowPasswordModal(false);
        setSettingsError('');
        showToast(response.message || 'Password changed successfully!', 'success');
      } else {
        setSettingsError(response.message || 'Unable to update password.');
        showToast(response.message || 'Unable to update password.', 'error');
      }
    } catch (error) {
      const message = error.message || 'Unable to update password.';
      setSettingsError(message);
      showToast(message, 'error');
    }
  };

  const handleSaveEmail = async () => {
    if (!emailInput.trim()) {
      setSettingsError('Email is required.');
      showToast('Email is required.', 'error');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.trim())) {
      setSettingsError('Please enter a valid email address.');
      showToast('Please enter a valid email address.', 'error');
      return;
    }

    try {
      const response = await updateProfile({ email: emailInput.trim() });
      if (response.success) {
        setAdminInfo({ ...adminInfo, email: emailInput.trim() });
        setShowEmailModal(false);
        setSettingsError('');
        showToast(response.message || 'Email changed successfully!', 'success');
      } else {
        setSettingsError(response.message || 'Unable to update email.');
        showToast(response.message || 'Unable to update email.', 'error');
      }
    } catch (error) {
      const message = error.message || 'Unable to update email.';
      setSettingsError(message);
      showToast(message, 'error');
    }
  };

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await getProfile();
        if (response.success && response.user) {
          setAdminInfo({
            email: response.user.email || '',
            notifications: response.user.notifications !== undefined ? response.user.notifications : true
          });
          setEmailInput(response.user.email || '');
        } else {
          showToast(response.message || 'Unable to load profile.', 'error');
        }
      } catch (error) {
        showToast(error.message || 'Unable to load profile.', 'error');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  return (
    <div className="admin-page-content">
      <div style={{ maxWidth: "600px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "28px", marginBottom: "20px", color: "#333" }}>Settings</h1>

        {/* Account Section */}
        <div style={{ background: "white", borderRadius: "12px", padding: "20px", marginBottom: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
          <h2 style={{ fontSize: "18px", marginBottom: "15px", color: "#7b1e1e", borderBottom: "2px solid #ffdc00", paddingBottom: "8px" }}>
            Account
          </h2>
          
          {/* Change Password - Updated style */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #eee" }}>
            <div>
              <p style={{ fontWeight: "600", marginBottom: "4px" }}>🔐 Change Password</p>
              <p style={{ fontSize: "12px", color: "#888" }}>Update your account password</p>
            </div>
            <button 
              onClick={openPasswordModal}
              style={{ background: "#7b1e1e", color: "white", border: "none", padding: "8px 16px", borderRadius: "6px", cursor: "pointer" }}
            >
              Update
            </button>
          </div>

          {/* Email Address */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #eee" }}>
            <div>
              <p style={{ fontWeight: "600", marginBottom: "4px" }}>📧 Email Address</p>
              <p style={{ fontSize: "12px", color: "#888" }}>{adminInfo.email || 'Not set'}</p>
            </div>
            <button 
              style={{ background: "#7b1e1e", color: "white", border: "none", padding: "6px 16px", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}
              onClick={openEmailModal}
            >
              Change
            </button>
          </div>

          {/* Notifications */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0" }}>
            <div>
              <p style={{ fontWeight: "600", marginBottom: "4px" }}>🔔 Notifications</p>
              <p style={{ fontSize: "12px", color: "#888" }}>Receive system updates</p>
            </div>
            <button
              onClick={async () => {
                try {
                  const updated = !adminInfo.notifications;
                  const response = await updateProfile({ notifications: updated });
                  if (response.success) {
                    setAdminInfo({ ...adminInfo, notifications: updated });
                    showToast('Notification settings updated.', 'success');
                  } else {
                    showToast(response.message || 'Unable to update notification settings.', 'error');
                  }
                } catch (error) {
                  showToast(error.message || 'Unable to update notification settings.', 'error');
                }
              }}
              style={{
                background: adminInfo.notifications ? "#7b1e1e" : "#ccc",
                color: "white",
                border: "none",
                padding: "6px 20px",
                borderRadius: "20px",
                cursor: "pointer",
                minWidth: "60px"
              }}
            >
              {adminInfo.notifications ? "ON" : "OFF"}
            </button>
          </div>
        </div>

        {/* System Info Section */}
        <div style={{ background: "white", borderRadius: "12px", padding: "20px", marginBottom: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
          <h2 style={{ fontSize: "18px", marginBottom: "15px", color: "#7b1e1e", borderBottom: "2px solid #ffdc00", paddingBottom: "8px" }}>
            System Info
          </h2>
          
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #eee" }}>
            <span style={{ color: "#666" }}>Version</span>
            <strong>v1.0</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0" }}>
            <span style={{ color: "#666" }}>Support</span>
            <strong>support@gymstat.edu</strong>
          </div>
        </div>


      </div>

      {showPasswordModal && (
        <div className="modal-backdrop" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Change Password</h3>
            </div>
            <p className="modal-message">Enter a new password to update your account credentials.</p>
            <div className="modal-body">
              <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: 600 }}>New Password</label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="modal-input"
                placeholder="Enter new password"
              />
              {settingsError && <p className="modal-error">{settingsError}</p>}
            </div>
            <div className="modal-actions">
              <button className="modal-btn modal-cancel" onClick={() => setShowPasswordModal(false)}>Cancel</button>
              <button className="modal-btn modal-confirm" onClick={handleSavePassword}>Save Password</button>
            </div>
          </div>
        </div>
      )}

      {showEmailModal && (
        <div className="modal-backdrop" onClick={() => setShowEmailModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Change Email Address</h3>
            </div>
            <p className="modal-message">Update the email address used for admin login and notifications.</p>
            <div className="modal-body">
              <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: 600 }}>Email Address</label>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="modal-input"
                placeholder="Enter email address"
              />
              {settingsError && <p className="modal-error">{settingsError}</p>}
            </div>
            <div className="modal-actions">
              <button className="modal-btn modal-cancel" onClick={() => setShowEmailModal(false)}>Cancel</button>
              <button className="modal-btn modal-confirm" onClick={handleSaveEmail}>Save Email</button>
            </div>
          </div>
        </div>
      )}

      <NotificationToast message={toast.message} type={toast.type} onClose={closeToast} />
    </div>
  );
};

export default AdminSettings;