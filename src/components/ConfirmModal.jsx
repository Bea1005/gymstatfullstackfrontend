import React from 'react';
import './ConfirmModal.css';

const ConfirmModal = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  children,
  confirmDisabled = false,
  singleButton = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
        <div className="modal-header">
          <h3 id="confirm-modal-title">{title}</h3>
        </div>
        {message && <p className="modal-message">{message}</p>}
        {children && <div className="modal-body">{children}</div>}
        <div className="modal-actions">
          {singleButton ? (
            <button type="button" className="modal-btn modal-confirm" onClick={onCancel || onConfirm}>{confirmText || cancelText}</button>
          ) : (
            <>
              <button type="button" className="modal-btn modal-cancel" onClick={onCancel}>{cancelText}</button>
              <button type="button" className="modal-btn modal-confirm" onClick={onConfirm} disabled={confirmDisabled} aria-disabled={confirmDisabled}>{confirmText}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
