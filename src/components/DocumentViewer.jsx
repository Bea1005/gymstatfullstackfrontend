import React, { useState } from 'react';
import './DocumentViewer.css';
import ConfirmModal from './ConfirmModal';

export default function DocumentViewer({
  isOpen,
  src,
  fileName,
  fileType,
  onClose,
  navigationVisible = false,
  navigationLabel = '',
  navigationLoading = false,
  onPrevious,
  onNext
}) {
  const [scale, setScale] = useState(1);

  if (!isOpen) return null;

  const normalizedType = String(fileType || '').toLowerCase();
  const normalizedName = String(fileName || '').toLowerCase();
  const isPdf = normalizedType === 'application/pdf' || normalizedName.endsWith('.pdf');
  const isImage = normalizedType.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(normalizedName);

  const zoomIn = () => setScale((s) => Math.min(3, +(s + 0.25).toFixed(2)));
  const zoomOut = () => setScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2)));

  return (
    <ConfirmModal isOpen={isOpen} title={fileName || 'Document Viewer'} onCancel={onClose} singleButton={true} confirmText="Close">
      <div className="docviewer-controls">
        <button type="button" className="doc-zoom-btn" onClick={zoomOut}>-</button>
        <div className="doc-zoom-level">{Math.round(scale * 100)}%</div>
        <button type="button" className="doc-zoom-btn" onClick={zoomIn}>+</button>
      </div>

      {navigationVisible && (
        <div className="docviewer-navigation" aria-label="Requirement photo navigation">
          <button type="button" onClick={onPrevious} disabled={navigationLoading} aria-label="Previous photo">&lt;</button>
          <span>{navigationLabel}</span>
          <button type="button" onClick={onNext} disabled={navigationLoading} aria-label="Next photo">&gt;</button>
        </div>
      )}

      <div className="docviewer-body">
        {isPdf ? (
          <iframe
            title={fileName || 'pdf-viewer'}
            src={src}
            className="doc-embed"
            style={{ width: `${100 / scale}%`, height: `${100 / scale}%` }}
          />
        ) : isImage ? (
          <img
            src={src}
            alt={fileName || 'Uploaded document'}
            className="doc-image"
            style={{ width: `${scale * 100}%`, height: 'auto' }}
          />
        ) : (
          <div className="docviewer-unsupported">
            <p>Preview is unavailable for this file type.</p>
          </div>
        )}
      </div>
    </ConfirmModal>
  );
}
