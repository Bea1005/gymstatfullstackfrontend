import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as api from '../../services/api';
import { useNotifications } from '../../components/useNotifications';
import Icon from '../../components/Icon';
import './StudentPortal.css';

const requirementTypes = [
  { id: 'medical', label: 'Medical Certificate', icon: 'stethoscope' },
  { id: 'cor', label: 'Certificate of Registration', icon: 'fileCheck' },
  { id: 'psa', label: 'PSA', icon: 'clipboard' },
  { id: 'insurance', label: 'Insurance', icon: 'shield' },
  { id: 'profile', label: 'Profile', icon: 'user' },
  { id: 'consent', label: 'Parent Consent', icon: 'fileText' },
];

const formatUploadDateTime = (value) => {
  if (!value) return 'Not available';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';

  const datePart = date.toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  });
  const timePart = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return `${datePart} | ${timePart}`;
};

export default function StudentRequirements() {
  const navigate = useNavigate();
  const { notify } = useNotifications();
  const [activeTab, setActiveTab] = useState('requirements');
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, total: 0, expired: 0, archived: 0, reusable: 0 });
  const [uploadedFiles, setUploadedFiles] = useState({});
  const [submissions, setSubmissions] = useState([]);
  const [publishedRequirements, setPublishedRequirements] = useState([]);
  const [loading, setLoading] = useState(false);
  const fileActionInProgressRef = useRef(false);
  const uploadInProgressRef = useRef(false);
  const importInProgressRef = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [selectedSport, setSelectedSport] = useState('General');
  const participationType = 'Intrams';
  const [confirmUpload, setConfirmUpload] = useState(null);
  const [confirmPreviewUrl, setConfirmPreviewUrl] = useState('');
  const [previewModal, setPreviewModal] = useState(null);
  const [requirementsAssuranceAccepted, setRequirementsAssuranceAccepted] = useState(false);

  useEffect(() => {
    try {
      const storedUser = sessionStorage.getItem('user') || localStorage.getItem('user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser?.sport) {
          setSelectedSport(parsedUser.sport);
        }
      }
    } catch (error) {
      console.warn('Unable to read saved user data', error);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [navigate, selectedSport]);

  // Listen for admin deletions and refresh lists
  useEffect(() => {
    const handler = () => {
      console.log('🔁 requirement update event received, refreshing lists');
      fetchData();
    };

    const handleStorageUpdate = (event) => {
      if (event.key === 'gymstat-requirement-updated') {
        handler();
      }
    };

    window.addEventListener('requirementDeleted', handler);
    window.addEventListener('gymstat-requirement-updated', handler);
    window.addEventListener('storage', handleStorageUpdate);

    return () => {
      window.removeEventListener('requirementDeleted', handler);
      window.removeEventListener('gymstat-requirement-updated', handler);
      window.removeEventListener('storage', handleStorageUpdate);
    };
  }, [selectedSport]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch published requirements from MongoDB
      try {
        const publishedReqData = await api.getPublishedRequirements();
        setPublishedRequirements(Array.isArray(publishedReqData?.data)
          ? publishedReqData.data.filter((requirement) => (
            requirement?.status === 'published' && requirement.isActive !== false
          ))
          : []);
      } catch (err) {
        console.warn('⚠️ Warning: Failed to fetch published requirements:', err);
        setPublishedRequirements([]);
      }

      // Fetch student submissions first so the counters can reflect the actual uploaded files
      let submissionsData = [];
      try {
        const requirementsData = await api.getStudentRequirements();
        submissionsData = Array.isArray(requirementsData.data) ? requirementsData.data : [];
        setSubmissions(submissionsData);
      } catch (err) {
        console.warn('⚠️ Warning: Failed to fetch student submissions:', err);
        submissionsData = [];
        setSubmissions([]);
      }

      // Fetch student stats, but fall back to the submissions data if the stats endpoint is empty or unavailable
      try {
        const statsData = await api.getStudentStats();
        const derivedStats = {
          pending: statsData.data?.pending ?? submissionsData.filter((item) => item.status === 'pending').length,
          approved: statsData.data?.approved ?? submissionsData.filter((item) => item.status === 'approved').length,
          rejected: statsData.data?.rejected ?? submissionsData.filter((item) => item.status === 'rejected').length,
          expired: statsData.data?.expired ?? submissionsData.filter((item) => item.requirementStatus === 'expired').length,
          archived: statsData.data?.archived ?? submissionsData.filter((item) => item.requirementStatus === 'archived').length,
          reusable: statsData.data?.reusable ?? submissionsData.filter((item) => item.requirementStatus === 'reusable').length,
          total: statsData.data?.total ?? submissionsData.length
        };

        setStats(derivedStats);
      } catch (err) {
        console.warn('⚠️ Warning: Failed to fetch student stats:', err);
        setStats({
          pending: submissionsData.filter((item) => item.status === 'pending').length,
          approved: submissionsData.filter((item) => item.status === 'approved').length,
          rejected: submissionsData.filter((item) => item.status === 'rejected').length,
          expired: submissionsData.filter((item) => item.requirementStatus === 'expired').length,
          archived: submissionsData.filter((item) => item.requirementStatus === 'archived').length,
          reusable: submissionsData.filter((item) => item.requirementStatus === 'reusable').length,
          total: submissionsData.length
        });
      }
    } catch (err) {
      console.error('❌ Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const adminCustomRequirementCards = [...new Map(
    (Array.isArray(publishedRequirements) ? publishedRequirements : [])
      .filter((requirement) => requirement?._id || requirement?.id)
      .map((requirement) => [String(requirement._id || requirement.id), requirement])
  ).values()]
    .filter((requirement) => (
      requirement?.type === 'other'
      && !requirement.file?.filename
      && !requirement.file?.path
      && requirement.status === 'published'
      && requirement.isActive !== false
    ))
    .map((requirement) => ({
      id: String(requirement._id || requirement.id),
      label: requirement.title,
      description: requirement.description || '',
      instructions: requirement.instructions || '',
      icon: 'document',
      isCustom: true,
      requirementType: 'other',
      customRequirementId: String(requirement._id || requirement.id),
      customRequirementLabel: requirement.title
    }));

  const handleFileChange = (requirementId, e, extra = {}) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const previewUrl = URL.createObjectURL(file);
      setUploadedFiles(prev => ({ ...prev, [requirementId]: file }));
      setConfirmUpload({ requirementId, file, previewUrl, ...extra });
      setConfirmPreviewUrl(previewUrl);
    }
  };

  const triggerFileInput = (requirementId) => {
    document.getElementById(`input-${requirementId}`)?.click();
  };

  const handleUndoUpload = () => {
    if (confirmUpload?.previewUrl) {
      URL.revokeObjectURL(confirmUpload.previewUrl);
    }
    if (confirmUpload?.requirementId) {
      setUploadedFiles(prev => {
        const next = { ...prev };
        delete next[confirmUpload.requirementId];
        return next;
      });
    }
    setConfirmUpload(null);
    setConfirmPreviewUrl('');
  };

  const handleConfirmUpload = async () => {
    if (!confirmUpload?.requirementId || !confirmUpload?.file) return;
    await handleSubmitFile(confirmUpload.requirementId, confirmUpload.file);
  };

  const notifyRequirementUpdate = () => {
    try {
      localStorage.setItem('gymstat-requirement-updated', String(Date.now()));
      window.dispatchEvent(new Event('gymstat-requirement-updated'));
    } catch (error) {
      console.warn('Unable to broadcast requirement update', error);
    }
  };

  const handleSubmitFile = async (requirementId, fileOverride) => {
    if (uploadInProgressRef.current) return;
    const file = fileOverride || uploadedFiles[requirementId];
    const uploadedRequirementType = confirmUpload?.requirementType || requirementId;
    const uploadedCustomRequirementId = confirmUpload?.customRequirementId || '';
    const uploadedCustomRequirementLabel = confirmUpload?.customRequirementLabel || '';
    const existingPsaSubmission = uploadedRequirementType === 'psa'
      ? getSubmissionForRequirement('psa')
      : null;

    if (!file) {
      notify('error', 'File Required', 'Please select a file first');
      return;
    }

    if (!requirementsAssuranceAccepted) {
      notify('error', 'Acceptance Required', 'Please confirm the submission assurance before submitting your requirements.');
      return;
    }

    uploadInProgressRef.current = true;
    try {
      setUploading(true);

      // Check if this is a re-upload of a rejected requirement
      await api.uploadRequirement(
        file,
        uploadedRequirementType,
        selectedSport,
        participationType,
        uploadedCustomRequirementId,
        uploadedCustomRequirementLabel,
        existingPsaSubmission?._id || ''
      );

      notifyRequirementUpdate();
      setUploadedFiles(prev => {
        const newFiles = { ...prev };
        delete newFiles[requirementId];
        return newFiles;
      });
      if (confirmUpload?.previewUrl) {
        URL.revokeObjectURL(confirmUpload.previewUrl);
      }
      setConfirmUpload(null);
      setConfirmPreviewUrl('');
      setRequirementsAssuranceAccepted(false);

      await fetchData();
    } catch (err) {
      notify('error', 'Submission Failed', err.message || 'Failed to upload file');
    } finally {
      uploadInProgressRef.current = false;
      setUploading(false);
    }
  };

  const visibleRequirementCards = [
    ...requirementTypes,
    ...adminCustomRequirementCards
  ];

  const getSubmissionForRequirement = (requirementId, customRequirementId = '', customRequirementLabel = '') => {
    return [...submissions]
      .filter((sub) => {
        if (requirementId !== 'other' && sub.requirementType === requirementId) return true;
        if (sub.requirementType === 'other') {
          if (customRequirementId) return String(sub.customRequirementId) === String(customRequirementId);
          if (customRequirementLabel && sub.customRequirementLabel === customRequirementLabel) return true;
          if (sub._id === requirementId) return true;
        }
        return false;
      })
      .sort((a, b) => new Date(b.uploadDate || b.createdAt || 0) - new Date(a.uploadDate || a.createdAt || 0))[0] || null;
  };

  const isRequirementSubmitted = (requirementId, customRequirementId = '', customRequirementLabel = '') => {
    return Boolean(getSubmissionForRequirement(requirementId, customRequirementId, customRequirementLabel));
  };

  const getSubmissionStatus = (requirementId, customRequirementId = '', customRequirementLabel = '') => {
    return getSubmissionForRequirement(requirementId, customRequirementId, customRequirementLabel)?.status || null;
  };

  const isUploadLocked = (requirementId, customRequirementId = '', customRequirementLabel = '') => {
    const submission = getSubmissionForRequirement(requirementId, customRequirementId, customRequirementLabel);
    const status = submission?.status;
    const reusable = submission?.requirementStatus === 'reusable' || submission?.isReusable || (submission?.requirementType === 'psa' && submission?.importedFromPreviousYear);
    return status === 'approved' && !reusable;
  };

  const getPreviousYearImportCount = () => {
    const currentYear = new Date().getFullYear();
    const currentAcademic = new Date().getMonth() >= 5 ? `${currentYear}-${String(currentYear + 1).slice(-2)}` : `${currentYear - 1}-${String(currentYear).slice(-2)}`;
    return submissions.filter((submission) => (
      submission.status === 'approved' && submission.academicYear && submission.academicYear !== currentAcademic && submission.requirementStatus !== 'archived'
    )).length;
  };

  const handleImportPreviousYearRequirements = async () => {
    if (importInProgressRef.current) return;
    importInProgressRef.current = true;
    try {
      setLoading(true);
      await api.importPreviousYearRequirements({});
      await fetchData();
    } catch (err) {
      notify('error', 'Import Failed', err.message || 'Unable to import previous-year records.');
    } finally {
      importInProgressRef.current = false;
      setLoading(false);
    }
  };

  // Download requirement file
  const handleOpenModal = async (req) => {
    if (!req || !req._id) {
      notify('error', 'Download Error', 'Invalid requirement. Please try again.');
      return;
    }
    if (fileActionInProgressRef.current) return;
    fileActionInProgressRef.current = true;
    
    try {
      setLoading(true);
      await api.downloadPublishedRequirement(
        req._id,
        req.file?.filename || req.fileName || req.title || 'requirement.pdf'
      );
    } catch (err) {
      console.error('❌ Download error:', err);
      notify('error', 'Download Failed', `Failed to download: ${err.message || 'Unknown error'}`);
    } finally {
      fileActionInProgressRef.current = false;
      setLoading(false);
    }
  };

  const closePreviewModal = () => {
    if (previewModal?.url) {
      URL.revokeObjectURL(previewModal.url);
    }
    setPreviewModal(null);
  };

  const handleViewSubmission = async (submission) => {
    if (!submission?._id) {
      notify('error', 'Preview Failed', 'This submission does not have a valid file record.');
      return;
    }
    if (fileActionInProgressRef.current) return;
    fileActionInProgressRef.current = true;
    try {
      setLoading(true);
      const previewData = await api.viewRequirement(
        submission._id,
        submission.fileName || 'uploaded-file',
        submission.participationType || participationType
      );
      setPreviewModal({
        url: previewData.url,
        fileType: previewData.fileType,
        filename: previewData.filename,
        submission
      });
    } catch (err) {
      console.error('❌ View error:', err);
      notify('error', 'Preview Failed', err.message || 'Unable to open this file right now.');
    } finally {
      fileActionInProgressRef.current = false;
      setLoading(false);
    }
  };

  const handleDownloadSubmission = async (submission) => {
    if (!submission?._id) {
      notify('error', 'Download Failed', 'This submission does not have a valid file record.');
      return;
    }
    if (fileActionInProgressRef.current) return;
    fileActionInProgressRef.current = true;
    try {
      setLoading(true);
      await api.downloadRequirement(
        submission._id,
        submission.fileName || 'uploaded-file',
        submission.participationType || participationType
      );
    } catch (err) {
      console.error('❌ Download error:', err);
      notify('error', 'Download Failed', err.message || 'Unable to download this file right now.');
    } finally {
      fileActionInProgressRef.current = false;
      setLoading(false);
    }
  };

  const requirementsAssuranceSection = (
    <div className="requirements-assurance">
      <label>
        <input
          type="checkbox"
          checked={requirementsAssuranceAccepted}
          onChange={(e) => setRequirementsAssuranceAccepted(e.target.checked)}
        />
        <span>
          <strong>I certify that the requirements I am submitting are true, valid, and belong to me. I understand that submitting false, invalid, or unauthorized documents may result in the rejection of my requirements.</strong>
          <span className="requirements-assurance__terms">
            By submitting these requirements, you agree to the system’s{' '}
            <Link to="/student/terms-of-service">Terms of Service</Link>
            {' | '}
            <Link to="/student/privacy-policy">Privacy Policy</Link>
            {' '}and confirm that the information and documents provided are accurate.
          </span>
        </span>
      </label>
    </div>
  );

  return (
    <div className="requirements-page gymstat-page">
      {confirmUpload && (
        <div className="modal-overlay" onClick={handleUndoUpload}>
          <div className="announcement-detail-modal requirements-upload-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm Upload</h2>
              <button className="modal-close-btn" onClick={handleUndoUpload}><Icon name="close" /></button>
            </div>
            <div className="detail-modal-body">
              <p style={{ marginBottom: '1rem' }}>Please review the selected file before it is submitted for screening.</p>
              {confirmPreviewUrl && (
                <div style={{ marginBottom: '1rem', border: '1px solid #ddd', borderRadius: '8px', padding: '0.75rem', background: '#f9f9f9' }}>
                  {confirmUpload.file?.type?.startsWith('image/') ? (
                    <img src={confirmPreviewUrl} alt="Uploaded preview" style={{ maxWidth: '100%', maxHeight: '220px', objectFit: 'contain', display: 'block', margin: '0 auto' }} />
                  ) : (
                    <iframe title="uploaded-file-preview" src={confirmPreviewUrl} style={{ width: '100%', height: '260px', border: 'none' }} />
                  )}
                </div>
              )}
              {requirementsAssuranceSection}
              <div className="detail-actions" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button className="detail-close-btn" onClick={handleUndoUpload}>Undo / Replace</button>
                <button className="upload-action-btn" onClick={handleConfirmUpload} disabled={uploading}>
                  {uploading ? 'Uploading...' : 'Confirm Upload'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {previewModal && (
        <div className="modal-overlay" onClick={closePreviewModal}>
          <div className="announcement-detail-modal requirement-preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{previewModal.filename || 'File Preview'}</h2>
              <button className="modal-close-btn" onClick={closePreviewModal}><Icon name="close" /></button>
            </div>
            <div className="detail-modal-body">
              {previewModal.fileType?.startsWith('image/') ? (
                <div className="requirement-preview-frame">
                  <img className="requirement-preview-image" src={previewModal.url} alt="Preview" />
                </div>
              ) : previewModal.fileType?.includes('pdf') ? (
                <div className="requirement-preview-frame">
                  <iframe className="requirement-preview-document" title="file-preview" src={previewModal.url} />
                </div>
              ) : (
                <div className="requirement-preview-unavailable">Preview is not supported for this file type. You can still download it.</div>
              )}
              <div className="requirement-preview-actions">
                <button className="requirement-preview-cancel" onClick={closePreviewModal}>Cancel</button>
                <button className="requirement-preview-download" onClick={() => handleDownloadSubmission(previewModal.submission)} disabled={loading}>
                  {loading ? 'Downloading...' : 'Download'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="requirements-page-content">
        <header className="requirements-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div>
              <h1>Sport Requirements</h1>
              <p>Download Requirements and submit your documents</p>
            </div>
          </div>
        </header>

        <div className="counter-badges">
          <div className="badge pending">
            <span className="count-num">{stats.pending}</span>
            <span className="count-label">PENDING</span>
          </div>
          <div className="badge approved">
            <span className="count-num">{stats.approved}</span>
            <span className="count-label">APPROVED</span>
          </div>
          <div className="badge rejected">
            <span className="count-num">{stats.rejected}</span>
            <span className="count-label">REJECTED</span>
          </div>
        </div>



        <div className="tab-navigation">
          <button
            className={`tab-btn ${activeTab === 'requirements' ? 'active-tab' : ''}`} 
            onClick={() => setActiveTab('requirements')}
          >
            My Submissions ({submissions.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'submission' ? 'active-tab' : ''}`} 
            onClick={() => setActiveTab('submission')}
          >
            + Upload New
          </button>
          <button
            className={`tab-btn ${activeTab === 'import' ? 'active-tab' : ''}`}
            onClick={() => setActiveTab('import')}
          >
            Import Student Records (Intrams – STRASUC) {getPreviousYearImportCount() > 0 ? `(${getPreviousYearImportCount()})` : ''}
          </button>
        </div>

        <hr className="divider" />

        {loading ? (
          <div className="loading-message">
            <p>Loading requirements...</p>
          </div>
        ) : activeTab === 'requirements' ? (
          <section className="tab-panel">
            <div className="admin-requirements-list">
              <div className="admin-reqs-header">
                <h3><Icon name="document" size={20} /> Active Requirements</h3>
                <p>Published requirements for you to complete</p>
              </div>

              {publishedRequirements.length > 0 ? (
                <div className="requirements-boxes-grid">
                  {publishedRequirements
                    .map((req) => {
                      const hasFile = Boolean(req.file?.filename || req.file?.path);
                      return (
                    <div 
                      key={req._id} 
                      className="requirement-box"
                      onClick={hasFile ? () => handleOpenModal(req) : undefined}
                      role={hasFile ? 'button' : undefined}
                      tabIndex={hasFile ? 0 : undefined}
                      onKeyDown={hasFile ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          handleOpenModal(req);
                        }
                      } : undefined}
                    >
                      <div className="requirement-box-icon">
                        <Icon name="document" />
                      </div>
                      <div className="requirement-box-content">
                        <h4>{req.title}</h4>
                        <p>{req.description}</p>
                        <div className="requirement-box-meta">
                          <span className="meta-date">
                            <Icon name="calendar" size={16} /> Posted: {new Date(req.publishedAt || req.createdAt).toLocaleDateString()}
                          </span>
                          {!hasFile && <span>Submit in Upload New</span>}
                        </div>
                      </div>
                      {hasFile && (
                        <div className="requirement-box-arrow">
                          <span className="arrow-icon"><Icon name="chevronRight" /></span>
                        </div>
                      )}
                    </div>
                      );
                    })}
                </div>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
                  <p><Icon name="folder" size={18} /> No requirements published yet</p>
                </div>
              )}

              <div className="admin-reqs-note">
                <p><Icon name="info" size={16} /> <strong>Note:</strong> Download required forms and submit your completed documents in the "Upload New" tab.</p>
              </div>

              <div className="admin-requirements-list" style={{ marginTop: '1.5rem' }}>
                <div className="admin-reqs-header">
                  <h3>Student Requirements</h3>
                  <p>Your submitted documents and their current review status</p>
                </div>

                {submissions.length > 0 ? (
                  <div className="student-requirements-table-wrapper my-submissions-table-wrapper">
                    <table className="student-requirements-table my-submissions-table">
                      <thead>
                        <tr className="student-requirements-table-row">
                          <th className="student-requirements-table-head">Requirement</th>
                          <th className="student-requirements-table-head">Status</th>
                          <th className="student-requirements-table-head">Upload Date &amp; Time</th>
                          <th className="student-requirements-table-head">Download</th>
                        </tr>
                      </thead>
                      <tbody>
                        {submissions.map((submission) => (
                          <tr key={submission._id} className="student-requirements-table-row">
                            <td className="student-requirements-table-cell">
                              {requirementTypes.find((type) => type.id === submission.requirementType)?.label || submission.customRequirementLabel || submission.requirementType || 'Other'}
                            </td>
                            <td className="student-requirements-table-cell">
                              <div className="my-submissions-status-content" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                <span className={`badge ${submission.status === 'approved' ? 'badge-completed' : submission.status === 'rejected' ? 'badge-declined' : 'badge-pending'}`}>
                                  {submission.status || 'pending'}
                                </span>
                                {submission.status === 'rejected' && (
                                  <span style={{ fontSize: '0.8rem', color: '#c62828', lineHeight: 1.4 }}>
                                    {submission.remarks || submission.feedback || 'Please upload a corrected copy.'}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="student-requirements-table-cell">{formatUploadDateTime(submission.uploadDate || submission.createdAt)}</td>
                            <td className="student-requirements-table-cell">
                              <button
                                type="button"
                                className="submit-single-btn"
                                onClick={() => handleViewSubmission(submission)}
                                disabled={loading}
                                aria-label={`View ${submission.fileName || 'uploaded document'}`}
                              >
                                <Icon name="eye" size={16} /> View
                              </button>
                              <button
                                type="button"
                                className="student-requirement-download-btn"
                                onClick={() => handleDownloadSubmission(submission)}
                                disabled={loading}
                                aria-label={`Download ${submission.fileName || 'uploaded document'}`}
                                title="Download document"
                              >
                                <Icon name="download" size={18} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: '1rem', color: '#666' }}>No uploaded files yet.</div>
                )}
              </div>
            </div>
          </section>
        ) : activeTab === 'import' ? (
          <section className="tab-panel">
            <div className="submission-header">
              <div>
                <h3 className="section-title"><Icon name="download" size={20} /> Import Student Records (Intrams – STRASUC)</h3>
                <p className="section-subtitle">Reuse eligible records from the previous academic year instead of resubmitting everything.</p>
              </div>
            </div>

            <div className="admin-requirements-list" style={{ marginTop: '1rem' }}>
              <div className="admin-reqs-header">
                <h3><Icon name="folder" size={20} /> Reusable & Available Records</h3>
                <p>Approved files from the last academic year can be imported here. PSA requirements remain reusable when eligible.</p>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                <button className="upload-action-btn" onClick={handleImportPreviousYearRequirements} disabled={loading}>
                  {loading ? 'Importing...' : 'Import Previous-Year Records'}
                </button>
                <span style={{ alignSelf: 'center', color: '#666', fontSize: '0.9rem' }}>
                  {getPreviousYearImportCount()} eligible record(s) available
                </span>
              </div>

              {submissions.filter((submission) => submission.requirementStatus === 'reusable' || submission.requirementStatus === 'expired' || submission.importedFromPreviousYear || submission.academicYear).length ? (
                <div className="student-requirements-table-wrapper import-records-table-wrapper">
                  <table className="student-requirements-table import-records-table">
                    <thead>
                      <tr className="student-requirements-table-row">
                        <th className="student-requirements-table-head">Requirement Name</th>
                        <th className="student-requirements-table-head">Status</th>
                        <th className="student-requirements-table-head">Academic Year</th>
                        <th className="student-requirements-table-head">Upload Date &amp; Time</th>
                        <th className="student-requirements-table-head">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.filter((submission) => submission.requirementStatus === 'reusable' || submission.requirementStatus === 'expired' || submission.importedFromPreviousYear || submission.academicYear).map((submission) => {
                        const reusable = submission.requirementStatus === 'reusable' || (submission.requirementType === 'psa' && submission.importedFromPreviousYear);
                        const canReplacePsa = reusable && submission.requirementType === 'psa';
                        return (
                          <tr key={submission._id} className="student-requirements-table-row">
                            <td className="student-requirements-table-cell">
                              {submission.requirementName || requirementTypes.find((type) => type.id === submission.requirementType)?.label || submission.customRequirementLabel || submission.requirementType || 'Other'}
                            </td>
                            <td className="student-requirements-table-cell">
                              <span className={`import-records-status-badge badge ${submission.requirementStatus === 'reusable' ? 'badge-completed' : submission.requirementStatus === 'expired' ? 'badge-declined' : submission.requirementStatus === 'archived' ? 'badge-pending' : 'badge-pending'}`}>
                                {submission.requirementStatus || submission.status || 'active'}
                              </span>
                            </td>
                            <td className="student-requirements-table-cell">{submission.academicYear || 'N/A'}</td>
                            <td className="student-requirements-table-cell">{formatUploadDateTime(submission.uploadDate || submission.uploadedAt || submission.createdAt)}</td>
                            <td className="student-requirements-table-cell">
                              <div className="import-records-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <button type="button" className="submit-single-btn" onClick={() => handleViewSubmission(submission)} disabled={loading} aria-label={`View ${submission.fileName || 'uploaded document'}`}>
                                  <Icon name="eye" size={16} /> View
                                </button>
                                <button
                                  type="button"
                                  className="student-requirement-download-btn"
                                  onClick={() => handleDownloadSubmission(submission)}
                                  disabled={loading}
                                  aria-label={`Download ${submission.fileName || 'uploaded document'}`}
                                  title="Download document"
                                >
                                  <Icon name="download" size={18} />
                                </button>
                                {canReplacePsa && (
                                  <button className="submit-single-btn" onClick={() => { setActiveTab('submission'); setTimeout(() => triggerFileInput(submission.requirementType), 0); }}>
                                    Replace / Update File
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: '1rem', color: '#666' }}>No prior-year or reusable requirement records are currently available for import.</div>
              )}
            </div>
          </section>
        ) : (
          <section className="tab-panel">
            <div className="submission-header">
              <div>
                <h3 className="section-title"><Icon name="upload" size={20} /> Upload New Requirement</h3>
                <p className="section-subtitle">Select a requirement type and upload your document</p>
              </div>

            </div>

            <div className="upload-grid">
              {visibleRequirementCards.map((req) => {
                const isCustomCard = Boolean(req.isCustom);
                const cardCustomRequirementId = req.customRequirementId || req.id;
                const cardCustomRequirementLabel = req.customRequirementLabel || req.label;
                const isSubmitted = isRequirementSubmitted(isCustomCard ? 'other' : req.id, isCustomCard ? cardCustomRequirementId : '', isCustomCard ? cardCustomRequirementLabel : '');
                const submission = getSubmissionForRequirement(isCustomCard ? 'other' : req.id, isCustomCard ? cardCustomRequirementId : '', isCustomCard ? cardCustomRequirementLabel : '');
                const submissionStatus = getSubmissionStatus(isCustomCard ? 'other' : req.id, isCustomCard ? cardCustomRequirementId : '', isCustomCard ? cardCustomRequirementLabel : '');
                const locked = isUploadLocked(isCustomCard ? 'other' : req.id, isCustomCard ? cardCustomRequirementId : '', isCustomCard ? cardCustomRequirementLabel : '');
                const isRejected = submissionStatus === 'rejected';
                const isReusable = submission?.requirementStatus === 'reusable' || submission?.isReusable || (submission?.requirementType === 'psa' && submission?.importedFromPreviousYear);
                const canReplaceReusable = isReusable && !isRejected;
                const isApprovedMedicalOrCor = ['medical', 'cor'].includes(req.id) && submissionStatus === 'approved';
                const isPsaApproved = req.id === 'psa' && submissionStatus === 'approved';
                const rejectionReason = submission?.remarks || submission?.feedback || 'The screener marked this file as rejected. Please upload a corrected copy.';
                const rejectionDate = submission?.reviewedAt ? new Date(submission.reviewedAt).toLocaleDateString() : 'Recently';
                const savedFileName = uploadedFiles[req.id]?.name || submission?.fileName || req.savedFileName || '';

                return (
                  <div key={req.id} className={`upload-card${req.id === 'cor' ? ' upload-card--optional' : ''} ${isRejected ? 'rejected-state' : ''}`}>
                    {req.id === 'cor' && <span className="optional-requirement-label">OPTIONAL</span>}
                    <div className="upload-icon"><Icon name={req.icon} /></div>
                    <span className="upload-label">{req.label}</span>
                    {isCustomCard && req.description && <p className="upload-description">{req.description}</p>}
                    {isCustomCard && req.instructions && (
                      <p className="upload-description"><strong>Instructions:</strong> {req.instructions}</p>
                    )}

                    <input
                      type="file"
                      id={`input-${req.id}`}
                      className="hidden-file-input"
                      onChange={(e) => handleFileChange(req.id, e, isCustomCard ? {
                        requirementType: 'other',
                        customRequirementId: cardCustomRequirementId,
                        customRequirementLabel: cardCustomRequirementLabel,
                      } : {})}
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                      disabled={uploading || (locked && !isPsaApproved && !isApprovedMedicalOrCor)}
                    />
                    {isPsaApproved ? (
                      <button className="upload-action-btn" disabled>
                        ✓ Approved
                      </button>
                    ) : isApprovedMedicalOrCor ? (
                      <>
                        <button className="upload-action-btn" disabled>
                          ✓ Approved
                        </button>
                        <button
                          className="upload-action-btn"
                          onClick={() => triggerFileInput(req.id)}
                          disabled={uploading}
                        >
                          Replace / Update
                        </button>
                      </>
                    ) : (
                      <button
                        className="upload-action-btn"
                        onClick={() => triggerFileInput(req.id)}
                        disabled={uploading || (locked && !canReplaceReusable)}
                      >
                        {locked && !canReplaceReusable ? '✓ Approved' : canReplaceReusable ? 'Replace / Update' : isSubmitted ? (isRejected ? 'Re-upload' : 'Submitted') : 'Upload'}
                      </button>
                    )}
                    {isRejected && (
                      <div className="rejection-note">
                        <span className="rejection-pill"><Icon name="xCircle" size={16} /> Rejected</span>
                        <p className="rejection-reason"><strong>Reason:</strong> {rejectionReason}</p>
                        <p className="rejection-detail" style={{ fontSize: '0.75rem', color: '#6b1c1c', marginTop: '0.35rem' }}>
                          Rejected on {rejectionDate}
                        </p>
                      </div>
                    )}
                    {savedFileName && (
                      <div className="file-preview">
                        <div className="file-name" title={savedFileName}>
                          <Icon name="paperclip" size={16} /> {savedFileName}
                        </div>
                        {!uploadedFiles[req.id] && submission && (
                          <>
                            <button
                              type="button"
                              className="submit-single-btn"
                              onClick={() => handleViewSubmission(submission)}
                              disabled={loading || uploading}
                              aria-label={`View ${savedFileName}`}
                            >
                              <Icon name="eye" size={16} /> View
                            </button>
                            <button
                              type="button"
                              className="student-requirement-download-btn"
                              onClick={() => handleDownloadSubmission(submission)}
                              disabled={loading || uploading}
                              aria-label={`Download ${savedFileName}`}
                              title="Download document"
                            >
                              <Icon name="download" size={18} />
                            </button>
                            <button
                              type="button"
                              className="submit-single-btn"
                              onClick={() => triggerFileInput(req.id)}
                              disabled={uploading}
                            >
                              {uploading ? 'Uploading...' : 'Replace File'}
                            </button>
                          </>
                        )}
                        {uploadedFiles[req.id] && (
                          <button
                            className="submit-single-btn"
                            onClick={() => {
                              const file = uploadedFiles[req.id];
                              const previewUrl = URL.createObjectURL(file);
                              setConfirmUpload({
                                requirementId: req.id,
                                file,
                                previewUrl,
                                requirementType: isCustomCard ? 'other' : req.id,
                                customRequirementId: isCustomCard ? cardCustomRequirementId : '',
                                customRequirementLabel: isCustomCard ? cardCustomRequirementLabel : '',
                              });
                              setConfirmPreviewUrl(previewUrl);
                            }}
                            disabled={uploading}
                          >
                            {uploading ? 'Uploading...' : 'Review & Confirm'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {!confirmUpload && requirementsAssuranceSection}

          </section>
        )}
      </div>
    </div>
  );
}
