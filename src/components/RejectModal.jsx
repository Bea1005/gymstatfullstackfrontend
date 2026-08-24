import React, { useState, useEffect } from 'react';
import ConfirmModal from './ConfirmModal';

const predefinedReasons = [
  'Incomplete documents',
  'Illegible / corrupted file',
  'Wrong document uploaded',
  'Not meeting requirements',
  'Other',
];

export default function RejectModal({ isOpen, onCancel, onConfirm }) {
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setReason('');
      setRemarks('');
    }
  }, [isOpen]);

  const confirmAllowed = reason.trim().length > 0 || remarks.trim().length > 0;

  const handleConfirm = () => {
    if (!confirmAllowed) return;
    onConfirm({ reason: reason || 'Other', remarks });
  };

  return (
    <ConfirmModal
      isOpen={isOpen}
      title="Reject Requirement"
      message="Please select a reason for rejection and provide additional remarks (optional)."
      confirmText="Reject"
      cancelText="Cancel"
      onCancel={onCancel}
      onConfirm={handleConfirm}
      confirmDisabled={!confirmAllowed}
    >
      <div style={{display: 'grid', gap: 12}}>
        <label style={{fontWeight:700}}>Reason</label>
        <select value={reason} onChange={(e) => setReason(e.target.value)} style={{padding:10, borderRadius:8, border:'1px solid #dcc7a8'}}>
          <option value="">-- Select reason --</option>
          {predefinedReasons.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        <label style={{fontWeight:700}}>Additional Remarks</label>
        <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={4} style={{padding:10, borderRadius:8, border:'1px solid #dcc7a8'}} />
      </div>
    </ConfirmModal>
  );
}
