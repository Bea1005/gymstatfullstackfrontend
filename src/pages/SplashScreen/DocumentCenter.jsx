import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './DocumentCenter.css';
import borrowersTemplateDoc from '../../assets/borrowers-template.doc?url';

const documents = [
  {
    id: 'equipment-borrowing-request',
    title: 'Equipment Borrowing Request',
    fileName: 'borrowers-template.doc',
    fileUrl: borrowersTemplateDoc,
  },
  {
    id: 'gymnasium-schedule-request',
    fileName: 'gymnasium_schedule_request.docx',
    fileUrl: '/documents/gymnasium_schedule_request.docx',
  },
];

const DocumentCenter = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;900&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }, []);

  return (
    <div className="document-center-container">
      <button className="back-btn" onClick={() => navigate('/landingpage')}>
        ← Back to Onboarding
      </button>

      <div className="downloads-section">
        <div className="downloads-header">
          <h1 className="downloads-title">DOWNLOADS</h1>
          <h2 className="downloads-subtitle">Download forms and schedule templates</h2>
          <p className="document-center-description">
            Access the most requested forms for gymnasium schedule requests and equipment borrowing.
          </p>
        </div>
        
        <div className="downloads-grid">
          {documents.map((doc) => (
            <div className="download-card" key={doc.id}>
              <div className="doc-icon-container">
                <svg 
                  className="doc-icon" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="1.5"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <line x1="12" y1="9" x2="8" y2="9" />
                </svg>
              </div>

              <a 
                href={doc.fileUrl}
                download={doc.fileName}
                className="file-name-link"
              >
                {(doc.title || doc.fileName).toString().replace(/_/g, ' ')}
              </a>

              <div className="card-actions">
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="action-btn"
                  title="Preview document"
                  aria-label={`Open ${doc.fileName}`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                </a>

                <a 
                  href={doc.fileUrl}
                  download={doc.fileName}
                  className="action-btn" 
                  title="Download"
                  aria-label={`Download ${doc.fileName}`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DocumentCenter;