import React, { useState, useEffect } from 'react';
import './DocumentViewer.css';
import ConfirmModal from './ConfirmModal';

export default function DocumentViewer({ isOpen, src, fileName, onClose }) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!isOpen) setScale(1);
  }, [isOpen]);

  if (!isOpen) return null;

  const isPdf = src && (src.toLowerCase().endsWith('.pdf') || (fileName && fileName.toLowerCase().endsWith('.pdf')));
  const isImage = src && /\.(png|jpe?g|gif|webp)$/i.test(src || fileName || '');

  const zoomIn = () => setScale((s) => Math.min(3, +(s + 0.25).toFixed(2)));
  const zoomOut = () => setScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2)));

  return (
    <ConfirmModal isOpen={isOpen} title={fileName || 'Document Viewer'} onCancel={onClose} singleButton={true} confirmText="Close">
      <div className="docviewer-controls">
        <button type="button" className="doc-zoom-btn" onClick={zoomOut}>-</button>
        <div className="doc-zoom-level">{Math.round(scale * 100)}%</div>
        <button type="button" className="doc-zoom-btn" onClick={zoomIn}>+</button>
      </div>

      <div className="docviewer-body">
        {isPdf ? (
          <iframe
            title={fileName || 'pdf-viewer'}
            src={src}
            className="doc-embed"
            style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
          />
        ) : isImage ? (
          <img
            src={src}
            alt={fileName || 'Uploaded document'}
            className="doc-embed"
            style={{ transform: `scale(${scale})`, transformOrigin: 'top left', maxWidth: '100%' }}
          />
        ) : (
          <div className="docviewer-unsupported">
            <p>Preview is unavailable for this file type.</p>
            <a href={src} download={fileName} className="doc-download-btn">Download {fileName}</a>
          </div>
        )}
      </div>
    </ConfirmModal>
  );
}
