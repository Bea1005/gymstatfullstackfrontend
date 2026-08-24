import React from 'react';
import './LogoutConfirmModal.css';

const LogoutConfirmModal = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="logout-modal-backdrop" onClick={onClose}>
      <div className="logout-modal-card" role="dialog" aria-modal="true" aria-labelledby="logout-modal-title" onClick={(e) => e.stopPropagation()}>
        <div className="logout-modal-icon">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 4H8a4 4 0 0 0-4 4v8a4 4 0 0 0 4 4h8" stroke="#7B1E1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10 12h10" stroke="#7B1E1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M17 8l4 4-4 4" stroke="#7B1E1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h2 id="logout-modal-title">Logout</h2>
        <p>Are you sure you want to logout? You will be redirected to the login page after logging out.</p>
        <div className="logout-modal-actions">
          <button type="button" className="logout-modal-button logout-modal-cancel" onClick={onClose}>Cancel</button>
          <button type="button" className="logout-modal-button logout-modal-confirm" onClick={onConfirm}>Logout</button>
        </div>
      </div>
    </div>
  );
};

export default LogoutConfirmModal;
