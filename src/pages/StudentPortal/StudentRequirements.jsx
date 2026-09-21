import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../../services/api';
import { useNotifications } from '../../components/NotificationProvider';
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

// Detailed Announcement View Modal
const AnnouncementDetailModal = ({ announcement, onClose }) => {
  if (!announcement) return null;

  const getIconForAnnouncement = (title) => {
    if (!title) return 'megaphone';
    if (title.includes('Sport Event')) return 'trophy';
    if (title.includes('Athlete Records')) return 'barChart';
    if (title.includes('Sports Clearance')) return 'checkCircle';
    if (title.includes('Medical Evaluation')) return 'stethoscope';
    if (title.includes('Records Verification')) return 'search';
    if (title.includes('Requirement')) return 'clipboard';
    return 'megaphone';
  };

  const getStatusStyle = (type) => {
    switch (type) {
      case "requirement":
        return { backgroundColor: "#fee2e2", color: "#991b1b" };
      case "event":
        return { backgroundColor: "#dbeafe", color: "#1e40af" };
      case "training":
        return { backgroundColor: "#dbeafe", color: "#1e40af" };
      default:
        return { backgroundColor: "#fef3c7", color: "#92400e" };
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="announcement-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="header-icon"><Icon name={getIconForAnnouncement(announcement.title)} /></div>
          <h2>{announcement.title || 'Announcement'}</h2>
          <button className="modal-close-btn" onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="detail-modal-body">
          <div className="detail-status">
            <span 
              className="detail-status-badge"
              style={{ 
                padding: '0.5rem 1rem', 
                borderRadius: '9999px', 
                fontSize: '0.875rem', 
                fontWeight: '700', 
                textTransform: 'uppercase',
                ...getStatusStyle(announcement.type)
              }}
            >
              {announcement.type || 'general'}
            </span>
            <span className="detail-date"><Icon name="calendar" size={16} /> Posted: {announcement.date ? new Date(announcement.date).toLocaleDateString() : 'Recently'}</span>
          </div>
          <div className="detail-description">
            <p>{announcement.description || 'No description available'}</p>
          </div>
          <div className="detail-actions">
            <button className="detail-close-btn" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Announcements component to be shown in modal
const AnnouncementsModal = ({ onClose, onSelectAnnouncement, announcements = [] }) => {
  // Filter announcements, handle null/undefined
  const validAnnouncements = Array.isArray(announcements) ? announcements.filter(a => a && a.type) : [];
  const requirementAnnouncements = validAnnouncements.filter(a => a.type === 'requirement');

  const getStatusStyle = (type) => {
    if (type === 'requirement') {
      return { backgroundColor: "#fee2e2", color: "#991b1b" };
    }
    if (type === 'event') {
      return { backgroundColor: "#dbeafe", color: "#1e40af" };
    }
    if (type === 'training') {
      return { backgroundColor: "#c7d2fe", color: "#3730a3" };
    }
    return { backgroundColor: "#fef3c7", color: "#92400e" };
  };

  const getIconForType = (type) => {
    if (type === 'requirement') return 'clipboard';
    if (type === 'event') return 'trophy';
    if (type === 'training') return 'dumbbell';
    return 'megaphone';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="announcements-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2><Icon name="megaphone" size={22} /> Announcements ({requirementAnnouncements.length})</h2>
          <button className="modal-close-btn" onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="modal-body no-scrollbar">
          {requirementAnnouncements.length > 0 ? (
            requirementAnnouncements.map((item) => (
              <div 
                key={item._id || item.id} 
                className="announcement-card clickable"
                onClick={() => onSelectAnnouncement(item)}
              >
                <div className="announcement-icon-left">
                  <span className="announcement-icon"><Icon name={getIconForType(item.type)} /></span>
                </div>
                <div className="announcement-content">
                  <h3>{item.title || 'Untitled Announcement'}</h3>
                  <p>{(item.description || '').substring(0, 100)}...</p>
                  <span className="announcement-date">
                    Posted: {item.date ? new Date(item.date).toLocaleDateString() : 'Recently'}
                  </span>
                </div>
                <span 
                  className="announcement-status"
                  style={{ 
                    padding: '0.35rem 0.85rem', 
                    borderRadius: '9999px', 
                    fontSize: '0.75rem', 
                    fontWeight: '700', 
                    textTransform: 'uppercase',
                    ...getStatusStyle(item.type)
                  }}
                >
                  {item.type}
                </span>
              </div>
            ))
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
              <p><Icon name="folder" size={18} /> No requirement announcements at this time</p>
              <p style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: '#999' }}>
                Admin will publish requirements here
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 

export default function StudentRequirements() {
  const navigate = useNavigate();
  const { notify } = useNotifications();
  const [activeTab, setActiveTab] = useState('requirements');
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, total: 0, expired: 0, archived: 0, reusable: 0 });
  const [uploadedFiles, setUploadedFiles] = useState({});
  const [submissions, setSubmissions] = useState([]);
  const [publishedRequirements, setPublishedRequirements] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedSport, setSelectedSport] = useState('General');
  const participationType = 'Intrams';
  const [customRequirementCards, setCustomRequirementCards] = useState([]);
  const [customRequirementModal, setCustomRequirementModal] = useState(null);
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
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
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    const role = sessionStorage.getItem('role') || localStorage.getItem('role');

    if (!token || role !== 'student') {
      // clear both storages on invalid auth
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      localStorage.removeItem('user');
      try { sessionStorage.removeItem('token'); sessionStorage.removeItem('role'); sessionStorage.removeItem('user'); } catch { /* storage may be unavailable */ }
      alert('Unauthorized access. Please login.');
      navigate('/login');
      return;
    }

    fetchData();
  }, [navigate]);

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
  }, []);

  const fetchData = async () => {
    const role = sessionStorage.getItem('role') || localStorage.getItem('role');
    if (role !== 'student') {
      return;
    }

    try {
      setLoading(true);

      // Fetch published requirements from MongoDB
      try {
        const publishedReqData = await api.getPublishedRequirements();
        setPublishedRequirements(publishedReqData.data || []);
      } catch (err) {
        console.warn('⚠️ Warning: Failed to fetch published requirements:', err);
        setPublishedRequirements([]);
      }

      // Fetch announcements from MongoDB
      try {
        const announcementsData = await api.getAnnouncements({ limit: 10 });
        setAnnouncements(announcementsData.data || []);
      } catch (err) {
        console.warn('⚠️ Warning: Failed to fetch announcements:', err);
        setAnnouncements([]);
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
    const file = fileOverride || uploadedFiles[requirementId];
    const uploadedRequirementType = confirmUpload?.requirementType || requirementId;
    const uploadedCustomRequirementId = confirmUpload?.customRequirementId || '';
    const uploadedCustomRequirementLabel = confirmUpload?.customRequirementLabel || '';

    if (!file) {
      notify('error', 'File Required', 'Please select a file first');
      return;
    }

    if (!requirementsAssuranceAccepted) {
      notify('error', 'Acceptance Required', 'Please confirm the submission assurance before submitting your requirements.');
      return;
    }

    try {
      setUploading(true);

      // Check if this is a re-upload of a rejected requirement
      const submission = getSubmissionForRequirement(requirementId);
      const isReuploadingRejected = submission?.status === 'rejected';

      await api.uploadRequirement(
        file,
        uploadedRequirementType,
        selectedSport,
        participationType,
        uploadedCustomRequirementId,
        uploadedCustomRequirementLabel
      );

      if (isReuploadingRejected) {
        notify('success', 'Re-submission Successful', `✅ ${file.name} re-submitted successfully! Your updated document is now pending review.`);
      } else {
        notify('success', 'Submission Successful', `✅ ${file.name} submitted successfully!`);
      }
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
      setUploading(false);
    }
  };

  const handleSubmitAll = async () => {
    const pendingUploads = Object.entries(uploadedFiles).filter(([, file]) => Boolean(file));

    if (pendingUploads.length === 0) {
      notify('error', 'No Files Selected', 'Select at least one file to submit.');
      return;
    }

    if (!requirementsAssuranceAccepted) {
      notify('error', 'Acceptance Required', 'Please confirm the submission assurance before submitting your requirements.');
      return;
    }

    try {
      setUploading(true);
      for (const [requirementId, file] of pendingUploads) {
        const matchingCard = [...customRequirementCards, ...persistedCustomRequirementCards].find((card) => card.id === requirementId);
        const requirementType = matchingCard ? 'other' : requirementId;
        const customRequirementId = matchingCard ? (matchingCard.customRequirementId || requirementId) : '';
        const customRequirementLabel = matchingCard ? (matchingCard.customRequirementLabel || matchingCard.label || '') : '';
        await api.uploadRequirement(file, requirementType, selectedSport, participationType, customRequirementId, customRequirementLabel);
      }
      notify('success', 'All Files Submitted', 'Your selected requirement files were uploaded successfully.');
      notifyRequirementUpdate();
      setUploadedFiles({});
      setRequirementsAssuranceAccepted(false);
      await fetchData();
    } catch (err) {
      notify('error', 'Submission Failed', err.message || 'Failed to upload files');
    } finally {
      setUploading(false);
    }
  };

  const addCustomRequirementCard = () => {
    const requirementName = customRequirementModal?.requirementName?.trim();

    if (!requirementName) {
      notify('error', 'Requirement Name Required', 'Please enter a requirement name before continuing.');
      return;
    }

    setCustomRequirementCards((prev) => {
      const nextIndex = prev.filter((card) => card.participationType === participationType).length + 1;
      const customId = `custom-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      const label = requirementName || `Others Requirement ${nextIndex}`;
      return [
        ...prev,
        {
          id: customId,
          label,
          icon: 'document',
          isCustom: true,
          participationType,
          customRequirementId: customId,
          customRequirementLabel: label,
        }
      ];
    });

    setCustomRequirementModal(null);
  };

  const persistedCustomRequirementCards = (Array.isArray(submissions) ? submissions : [])
    .filter((submission) => {
      const hasCustomName = Boolean(submission?.customRequirementLabel && String(submission.customRequirementLabel).trim());
      return (submission?.requirementType === 'other' || hasCustomName) && submission?.participationType === participationType;
    })
    .map((submission) => ({
      id: submission.customRequirementId || submission._id || `custom-${submission.fileName || Date.now()}`,
      label: submission.customRequirementLabel || 'Others Requirement',
      icon: 'paperclip',
      isCustom: true,
      requirementType: 'other',
      customRequirementId: submission.customRequirementId || submission._id || '',
      customRequirementLabel: submission.customRequirementLabel || 'Others Requirement',
      savedFileName: submission.fileName || '',
      savedSubmissionId: submission._id || ''
    }))
    .filter((card, index, list) => list.findIndex((entry) => entry.id === card.id) === index);

  const visibleRequirementCards = [
    ...requirementTypes,
    ...persistedCustomRequirementCards,
    ...customRequirementCards.filter((card) => card.participationType === participationType),
    { id: 'others-add', label: 'Others – Add Requirement', icon: 'plus', isAddCard: true }
  ];

  const getSubmissionForRequirement = (requirementId, customRequirementId = '', customRequirementLabel = '') => {
    return [...submissions]
      .filter((sub) => {
        if (sub.requirementType === requirementId) return true;
        if (sub.requirementType === 'other') {
          if (customRequirementId && (sub.customRequirementId === customRequirementId || sub._id === customRequirementId)) return true;
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
    try {
      setLoading(true);
      const response = await api.importPreviousYearRequirements({});
      const imported = Array.isArray(response?.data) ? response.data : [];
      notify('success', imported.length > 0 ? 'Previous-Year Records Imported' : 'No Records Available', imported.length > 0 ? 'Eligible records were imported for reuse.' : 'There were no eligible prior-year records to import.');
      await fetchData();
    } catch (err) {
      notify('error', 'Import Failed', err.message || 'Unable to import previous-year records.');
    } finally {
      setLoading(false);
    }
  };

  const getUrgentCount = () => {
    return announcements.filter(a => a.type === 'requirement').length;
  };

  const handleSelectAnnouncement = (announcement) => {
    setSelectedAnnouncement(announcement);
  };

  // Download requirement file
  const handleOpenModal = async (req) => {
    if (!req || !req._id) {
      notify('error', 'Download Error', 'Invalid requirement. Please try again.');
      return;
    }
    
    try {
      console.log(`📥 Downloading requirement: ${req.title}`);
      setLoading(true);
      // Directly call the published requirement download endpoint (bypass api helper to ensure correct route)
      const token = sessionStorage.getItem('token') || localStorage.getItem('token');
      const headers = token ? { Authorization: 'Bearer ' + token } : {};
      const apiBaseUrl = import.meta.env.VITE_API_URL || '/api';
      const fullUrl = `${apiBaseUrl}/requirements/${req._id}/download`;
      const response = await fetch(fullUrl, { method: 'GET', headers });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to download file');
      }

      const contentDisposition = response.headers.get('content-disposition');
      let filename = req.title || 'requirement.pdf';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"\s]+)"?/);
        if (match) filename = match[1];
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      notify('success', 'Download Successful', `✅ ${filename} downloaded successfully!`);
    } catch (err) {
      console.error('❌ Download error:', err);
      notify('error', 'Download Failed', `Failed to download: ${err.message || 'Unknown error'}`);
    } finally {
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
    if (!submission?._id) return;
    try {
      setLoading(true);
      const previewData = await api.viewRequirement(submission._id, submission.fileName || 'uploaded-file', submission.participationType);
      setPreviewModal({
        url: previewData.url,
        fileType: previewData.fileType,
        filename: previewData.filename,
        submission
      });
      notify('success', 'Preview Opened', `✅ ${submission.fileName || 'Uploaded file'} opened successfully!`);
    } catch (err) {
      console.error('❌ View error:', err);
      notify('error', 'Preview Failed', err.message || 'Unable to open this file right now.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadSubmission = async (submission) => {
    if (!submission?._id) return;
    try {
      setLoading(true);

      const token = sessionStorage.getItem('token') || localStorage.getItem('token');
      const headers = token ? { Authorization: 'Bearer ' + token } : {};
      const apiBaseUrl = import.meta.env.VITE_API_URL || '/api';
      const fullUrl = `${apiBaseUrl}/student/requirements/${submission._id}/download`;
      const response = await fetch(fullUrl, { method: 'GET', headers });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to download file');
      }

      const contentDisposition = response.headers.get('content-disposition');
      let filename = submission.fileName || 'uploaded-file';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"\s]+)"?/);
        if (match) filename = match[1];
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      notify('success', 'Download Successful', `✅ ${filename} downloaded successfully!`);
    } catch (err) {
      console.error('❌ Download error:', err);
      notify('error', 'Download Failed', err.message || 'Unable to download this file right now.');
    } finally {
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
            By submitting these requirements, you agree to the system’s Terms of Service and Privacy Policy and confirm that the information and documents provided are accurate.
          </span>
        </span>
      </label>
    </div>
  );

  return (
    <div className="requirements-page gymstat-page">
      {/* Notification Bell Icon */}
      <div className="notification-bell-container" onClick={() => setShowAnnouncements(true)}>
        <div className="notification-bell">
          <span className="bell-icon"><Icon name="bell" /></span>
          {getUrgentCount() > 0 && (
            <span className="notification-badge">{getUrgentCount()}</span>
          )}
        </div>
      </div>

      {/* Announcements Modal */}
      {showAnnouncements && (
        <AnnouncementsModal 
          onClose={() => setShowAnnouncements(false)} 
          onSelectAnnouncement={handleSelectAnnouncement}
          announcements={announcements}
        />
      )}

      {/* Announcement Detail Modal */}
      {selectedAnnouncement && (
        <AnnouncementDetailModal 
          announcement={selectedAnnouncement}
          onClose={() => setSelectedAnnouncement(null)}
        />
      )}

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
          <div className="announcement-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{previewModal.filename || 'File Preview'}</h2>
              <button className="modal-close-btn" onClick={closePreviewModal}><Icon name="close" /></button>
            </div>
            <div className="detail-modal-body">
              {previewModal.fileType?.startsWith('image/') ? (
                <img src={previewModal.url} alt="Preview" style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', display: 'block', margin: '0 auto' }} />
              ) : previewModal.fileType?.includes('pdf') ? (
                <iframe title="file-preview" src={previewModal.url} style={{ width: '100%', height: '70vh', border: 'none' }} />
              ) : (
                <div style={{ padding: '1rem', color: '#666' }}>Preview is not supported for this file type. You can still download it.</div>
              )}
              <div className="detail-actions" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button className="detail-close-btn" onClick={closePreviewModal}>Close</button>
                <button className="upload-action-btn" onClick={() => handleDownloadSubmission(previewModal.submission)} disabled={loading}>
                  {loading ? 'Downloading...' : 'Download'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {customRequirementModal && (
        <div className="modal-overlay" onClick={() => setCustomRequirementModal(null)}>
          <div className="announcement-detail-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '430px' }}>
            <div className="modal-header">
              <h2>Add Requirement</h2>
              <button className="modal-close-btn" onClick={() => setCustomRequirementModal(null)}><Icon name="close" /></button>
            </div>
            <div className="detail-modal-body">
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="custom-requirement-name" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#3d1e1e' }}>
                  Requirement Name
                </label>
                <input
                  id="custom-requirement-name"
                  type="text"
                  value={customRequirementModal.requirementName}
                  onChange={(e) => setCustomRequirementModal((prev) => ({ ...prev, requirementName: e.target.value }))}
                  placeholder="Enter requirement name"
                  style={{
                    width: '100%',
                    padding: '0.8rem 0.9rem',
                    border: '1px solid #d5d7db',
                    borderRadius: '8px',
                    fontSize: '0.98rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  autoFocus
                />
              </div>

              <div className="detail-actions" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button className="detail-close-btn" onClick={() => setCustomRequirementModal(null)}>
                  Cancel
                </button>
                <button
                  className="upload-action-btn"
                  onClick={addCustomRequirementCard}
                  disabled={!customRequirementModal.requirementName?.trim()}
                >
                  Continue
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
                <p>Click on any form to view details or download</p>
              </div>

              {publishedRequirements.length > 0 ? (
                <div className="requirements-boxes-grid">
                  {publishedRequirements.map((req) => (
                    <div 
                      key={req._id} 
                      className="requirement-box"
                      onClick={() => handleOpenModal(req)}
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
                        </div>
                      </div>
                      <div className="requirement-box-arrow">
                        <span className="arrow-icon"><Icon name="chevronRight" /></span>
                      </div>
                    </div>
                  ))}
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
                  <div className="student-requirements-table-wrapper">
                    <table className="student-requirements-table">
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
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
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
                <div className="student-requirements-table-wrapper">
                  <table className="student-requirements-table">
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
                              <span className={`badge ${submission.requirementStatus === 'reusable' ? 'badge-completed' : submission.requirementStatus === 'expired' ? 'badge-declined' : submission.requirementStatus === 'archived' ? 'badge-pending' : 'badge-pending'}`}>
                                {submission.requirementStatus || submission.status || 'active'}
                              </span>
                            </td>
                            <td className="student-requirements-table-cell">{submission.academicYear || 'N/A'}</td>
                            <td className="student-requirements-table-cell">{formatUploadDateTime(submission.uploadDate || submission.uploadedAt || submission.createdAt)}</td>
                            <td className="student-requirements-table-cell">
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <button className="submit-single-btn" onClick={() => handleViewSubmission(submission)} aria-label={`View ${submission.fileName || 'uploaded document'}`}>
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
                if (req.isAddCard) {
                  return (
                    <div key={req.id} className="upload-card" style={{ cursor: 'pointer' }}>
                      <div className="upload-icon"><Icon name={req.icon} /></div>
                      <span className="upload-label">{req.label}</span>
                      <button className="upload-action-btn" onClick={() => setCustomRequirementModal({ requirementName: '' })}>
                        Add Requirement
                      </button>
                    </div>
                  );
                }

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
                const rejectionReason = submission?.remarks || submission?.feedback || 'The screener marked this file as rejected. Please upload a corrected copy.';
                const rejectionDate = submission?.reviewedAt ? new Date(submission.reviewedAt).toLocaleDateString() : 'Recently';
                const reviewerName = submission?.reviewedBy?.fullname || 'Screener';
                const savedFileName = uploadedFiles[req.id]?.name || submission?.fileName || req.savedFileName || '';

                return (
                  <div key={req.id} className={`upload-card ${isRejected ? 'rejected-state' : ''}`}>
                    <div className="upload-icon"><Icon name={req.icon} /></div>
                    <span className="upload-label">{req.label}</span>

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
                      disabled={uploading || locked}
                    />
                    <button
                      className="upload-action-btn"
                      onClick={() => triggerFileInput(req.id)}
                      disabled={uploading || (locked && !canReplaceReusable)}
                    >
                      {locked && !canReplaceReusable ? '✓ Approved' : canReplaceReusable ? 'Replace / Update' : isSubmitted ? (isRejected ? 'Re-upload' : 'Submitted') : 'Upload'}
                    </button>
                    {isRejected && (
                      <div className="rejection-note">
                        <span className="rejection-pill"><Icon name="xCircle" size={16} /> Rejected</span>
                        <p className="rejection-reason"><strong>Reason:</strong> {rejectionReason}</p>
                        <p className="rejection-detail" style={{ fontSize: '0.75rem', color: '#6b1c1c', marginTop: '0.35rem' }}>
                          Reviewed by {reviewerName} on {rejectionDate}
                        </p>
                      </div>
                    )}
                    {savedFileName && (
                      <div className="file-preview">
                        <div className="file-name" title={savedFileName}>
                          <Icon name="paperclip" size={16} /> {savedFileName}
                        </div>
                        {!uploadedFiles[req.id] && submission && (
                          <button
                            className="submit-single-btn"
                            onClick={() => triggerFileInput(req.id)}
                            disabled={uploading}
                          >
                            {uploading ? 'Uploading...' : 'Replace File'}
                          </button>
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

            <button className="submit-all-btn" onClick={handleSubmitAll} disabled={uploading || !requirementsAssuranceAccepted}>
              {uploading ? 'Uploading...' : 'Submit Requirements'}
            </button>

          </section>
        )}
      </div>
    </div>
  );
}




