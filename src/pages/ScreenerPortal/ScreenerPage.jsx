import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LogoutConfirmModal from '../../components/LogoutConfirmModal';
import ConfirmModal from '../../components/ConfirmModal';
import RejectModal from '../../components/RejectModal';
import { useNotifications } from '../../components/NotificationProvider';
import DocumentViewer from '../../components/DocumentViewer';
import completedStamp from '../../assets/GymstatStamps/Completed.png';
import incompleteStamp from '../../assets/GymstatStamps/Incomplete.png';
import * as api from '../../services/api';
import { DEPARTMENT_OPTIONS, SPORT_OPTIONS, YEAR_LEVEL_OPTIONS } from '../../constants/studentRegistrationOptions';
import './ScreenerPage.css';

const configuredApiUrl = import.meta.env.VITE_API_URL || '/api';

const resolveAttachmentUrl = (fileUrl) => {
  if (!fileUrl) return '';
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl;
  return `${configuredApiUrl.replace(/\/$/, '')}/${fileUrl.replace(/^\//, '')}`;
};

const getFileExtension = (fileName = '') => {
  const normalizedName = String(fileName).toLowerCase();
  return normalizedName.includes('.') ? normalizedName.slice(normalizedName.lastIndexOf('.')) : '';
};

const isImageFile = (entry) => (
  String(entry?.fileType || '').toLowerCase().startsWith('image/')
  || ['.png', '.jpg', '.jpeg', '.gif'].includes(getFileExtension(entry?.fileName))
);

const isPdfFile = (entry) => (
  String(entry?.fileType || '').toLowerCase() === 'application/pdf'
  || getFileExtension(entry?.fileName) === '.pdf'
);

const loadAttachmentBlobUrl = async (fileUrl) => {
  const token = sessionStorage.getItem('token') || localStorage.getItem('token');
  const response = await fetch(resolveAttachmentUrl(fileUrl), {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Your Screener session has expired. Please log in again.');
    }
    if (response.status === 403) {
      throw new Error('You are not authorized to view this document.');
    }
    if (response.status === 404) {
      throw new Error('The uploaded document is no longer available in storage.');
    }
    throw new Error('Unable to load uploaded file. Please try again.');
  }

  return URL.createObjectURL(await response.blob());
};

const ScreenerPage = () => {
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const navigate = useNavigate();
  
  // Navigation State: 'list' or 'view-details'
  const [currentView, setCurrentView] = useState('list');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [previewUrls, setPreviewUrls] = useState({});
  const [previewLoading, setPreviewLoading] = useState({});
  const [, setRequirementStatus] = useState({});
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ totalStudents: 0, pendingRequirements: 0, verifiedRequirements: 0 });

  // Modal states
  const [approveTarget, setApproveTarget] = useState(null); // req id being approved
  const [rejectTarget, setRejectTarget] = useState(null); // req id being rejected
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerSrc, setViewerSrc] = useState(null);
  const [viewerName, setViewerName] = useState(null);
  const [viewerType, setViewerType] = useState('');

  const { notify } = useNotifications();
  const hasNotifiedLoadErrorRef = useRef(false);
  const hasLoadedSuccessfullyRef = useRef(false);

  useEffect(() => {
    const sessionToken = sessionStorage.getItem('token');
    const localToken = localStorage.getItem('token');
    const token = sessionToken || localToken;
    const role = (sessionToken ? sessionStorage.getItem('role') : localStorage.getItem('role')) || sessionStorage.getItem('role') || localStorage.getItem('role') || '';
    const normalizedRole = role.toString().trim().toLowerCase();

    // Allow both screener and admin (backend also permits admin). Normalize role.
    if (!token || (normalizedRole !== 'screener' && normalizedRole !== 'admin')) {
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      localStorage.removeItem('user');
      try { sessionStorage.removeItem('token'); sessionStorage.removeItem('role'); sessionStorage.removeItem('user'); } catch { /* storage may be unavailable */ }
      navigate('/login', { replace: true });
    }
  }, [navigate]);
  
  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [sportFilter, setSportFilter] = useState('All');
  const [yearLevelFilter, setYearLevelFilter] = useState('All');
  const [participationType, setParticipationType] = useState('Intrams');

  const loadRequirements = async (silent = false) => {
    try {
      setLoading(true);
      const response = await api.getScreenerRequirements(participationType);
      const data = response?.data || [];
      // Ensure data is always an array to avoid rendering crashes
      const safeData = Array.isArray(data) ? data : [];
      setStudents(safeData);
      setSelectedStudent((current) => {
        if (!current) return current;
        return safeData.find((student) => student.id === current.id) || current;
      });
      const totalStudents = safeData.length;
      const pendingRequirements = safeData.reduce((acc, student) => {
        const statuses = Object.values(student.requirements || {}).filter((item) => !Array.isArray(item));
        return acc + statuses.filter((item) => item && item.status !== 'approved').length;
      }, 0);
      const verifiedRequirements = safeData.reduce((acc, student) => {
        const statuses = Object.values(student.requirements || {}).filter((item) => !Array.isArray(item));
        return acc + statuses.filter((item) => item && item.status === 'approved').length;
      }, 0);
      setStats({ totalStudents, pendingRequirements, verifiedRequirements });
      hasLoadedSuccessfullyRef.current = true;
      hasNotifiedLoadErrorRef.current = false;
    } catch (error) {
      console.error('Failed to load screener requirements', error);
      // Friendly handling for authorization errors so UI doesn't crash
      const msg = error?.message || '';
      if (!silent && !hasNotifiedLoadErrorRef.current) {
        if (msg.toLowerCase().includes('not authorized') || msg.toLowerCase().includes('is not authorized')) {
          notify('screener-error', 'Unable to load requirements', 'You are not authorized to view this resource. Please login with a Screener account.');
        } else {
          notify('screener-error', 'Unable to load requirements', msg || 'Please try again.');
        }
        hasNotifiedLoadErrorRef.current = true;
      }
    } finally {
      setLoading(false);
    }
  };

  const markResubmissionViewed = async (submissionId) => {
    if (!submissionId) return;

    try {
      await api.markScreenerRequirementViewed(submissionId, participationType);
      setStudents((current) => current.map((student) => {
        const updatedRequirements = { ...student.requirements };
        Object.keys(updatedRequirements).forEach((key) => {
          if (Array.isArray(updatedRequirements[key])) {
            updatedRequirements[key] = updatedRequirements[key].map((entry) => entry?.submissionId === submissionId
              ? { ...entry, resubmitted: false }
              : entry);
          } else if (updatedRequirements[key]?.submissionId === submissionId) {
            updatedRequirements[key] = {
              ...updatedRequirements[key],
              resubmitted: false
            };
          }
        });
        return { ...student, requirements: updatedRequirements };
      }));

      setSelectedStudent((student) => {
        if (!student) return student;
        const updatedRequirements = { ...student.requirements };
        Object.keys(updatedRequirements).forEach((key) => {
          if (Array.isArray(updatedRequirements[key])) {
            updatedRequirements[key] = updatedRequirements[key].map((entry) => entry?.submissionId === submissionId
              ? { ...entry, resubmitted: false }
              : entry);
          } else if (updatedRequirements[key]?.submissionId === submissionId) {
            updatedRequirements[key] = {
              ...updatedRequirements[key],
              resubmitted: false
            };
          }
        });
        return { ...student, requirements: updatedRequirements };
      });
    } catch (error) {
      console.warn('Unable to clear resubmission badge', error);
    }
  };

  useEffect(() => {
    loadRequirements();
  }, [notify, participationType]);

  useEffect(() => {
    const refreshInterval = window.setInterval(() => {
      loadRequirements(true);
    }, 10000);

    return () => window.clearInterval(refreshInterval);
  }, [notify, participationType]);

  useEffect(() => {
    const handleRequirementUpdate = () => {
      loadRequirements(true);
    };

    const handleStorageUpdate = (event) => {
      if (event.key === 'gymstat-requirement-updated') {
        handleRequirementUpdate();
      }
    };

    window.addEventListener('gymstat-requirement-updated', handleRequirementUpdate);
    window.addEventListener('storage', handleStorageUpdate);

    return () => {
      window.removeEventListener('gymstat-requirement-updated', handleRequirementUpdate);
      window.removeEventListener('storage', handleStorageUpdate);
    };
  }, [notify, participationType]);

  useEffect(() => {
    let cancelled = false;
    const createdUrls = [];
    const entries = (selectedStudent?.requirements?.documents || [])
      .filter((entry) => entry?.fileUrl)
      .map((entry) => [entry.submissionId, entry]);

    setPreviewUrls({});
    setPreviewLoading(Object.fromEntries(entries.map(([key]) => [key, true])));

    if (entries.length === 0) {
      return () => {};
    }

    Promise.all(entries.map(async ([key, entry]) => {
      try {
        const blobUrl = await loadAttachmentBlobUrl(entry.fileUrl);
        createdUrls.push(blobUrl);
        return [key, blobUrl];
      } catch {
        notify('screener-error', 'Preview Unavailable', `${entry.fileName || 'Document'} could not be previewed.`);
        return [key, ''];
      }
    })).then((results) => {
      if (cancelled) {
        createdUrls.forEach((url) => URL.revokeObjectURL(url));
        return;
      }
      setPreviewUrls(Object.fromEntries(results));
      setPreviewLoading(Object.fromEntries(entries.map(([key]) => [key, false])));
    });

    return () => {
      cancelled = true;
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [notify, selectedStudent]);

  // Requirement labels are display metadata only; previews come from MongoDB file records.
  const requirementsTemplates = [
    { id: "cor", title: "CERTIFICATE OF REGISTRATION" },
    { id: "med", title: "MEDICAL CERTIFICATE" },
    { id: "psa", title: "PSA" },
    { id: "insurance", title: "INSURANCE" },
    { id: "profile", title: "STUDENT PROFILE" },
    { id: "consent", title: "PARENT CONSENT" }
  ];

  const handleSelectStudent = (student) => {
    setSelectedStudent(student);
    setCurrentView('view-details');
    const initial = {};
    ['cor','med','psa','insurance','profile','consent'].forEach((key) => {
      const entry = student.requirements?.[key];
      if (!entry) {
        initial[key] = 'No Documents Attached';
        return;
      }
      initial[key] = entry.status || 'Pending';
    });
    setRequirementStatus(initial);
  };

  const handleBackToList = () => {
    setCurrentView('list');
    setSelectedStudent(null);
  };

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = () => {
    setShowLogoutModal(false);
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const cancelLogout = () => {
    setShowLogoutModal(false);
  };

  // Filter students based on search query and filters
  const filteredStudents = students.filter((student) => {
    const matchesSearch = (student.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = departmentFilter === 'All' || student.department === departmentFilter;
    const matchesSport = sportFilter === 'All' || student.sport === sportFilter;
    const matchesYear = yearLevelFilter === 'All' || student.yearLevel === yearLevelFilter;
    
    return matchesSearch && matchesDept && matchesSport && matchesYear;
  }).sort((studentA, studentB) => {
    const getSurname = (student) => {
      const name = String(student.lastName || student.surname || student.name || '').trim();
      if (name.includes(',')) return name.split(',')[0].trim().toLocaleLowerCase();
      return name.split(/\s+/).filter(Boolean).pop()?.toLocaleLowerCase() || '';
    };

    return getSurname(studentA).localeCompare(getSurname(studentB), undefined, { sensitivity: 'base' });
  });

  const renderStatusBadge = (status) => {
    if (status === 'approved' || status === 'Completed') return <span className="badge badge-completed">Completed</span>;
    if (status === 'pending' || status === 'Pending') return <span className="badge badge-pending">Pending</span>;
    if (status === 'rejected' || status === 'Declined') return <span className="badge badge-declined">Declined</span>;
    if (status === 'Incomplete') return <span className="badge badge-incomplete">Incomplete</span>;
    return <span className="text-muted-italic">No Documents Attached</span>;
  };

  const resubmissionCount = students.reduce((acc, student) => {
    return acc + Object.values(student.requirements || {})
      .filter((item) => !Array.isArray(item))
      .filter((item) => item?.resubmitted).length;
  }, 0);

  const renderStatusCell = (entry) => (
    <td className="status-cell">
      {entry?.resubmitted && (
        <div className="resubmitted-status-wrapper">
          <span className="resubmitted-table-indicator" title="Resubmitted requirement awaiting review">!</span>
          <span className="resubmitted-table-label">Resubmitted</span>
        </div>
      )}
      {renderStatusBadge(entry?.status)}
    </td>
  );

  const getDocumentStamp = (entry) => {
    if (entry?.status === 'approved') return completedStamp;
    if (entry?.status === 'rejected') return incompleteStamp;
    return null;
  };

  const handleOpenRequirementViewer = async (entry, fallbackSrc = '', fallbackName = 'Requirement Document') => {
    if (entry?.resubmitted && entry.submissionId) {
      await markResubmissionViewed(entry.submissionId);
    }
    try {
      const attachmentUrl = entry?.fileUrl
        ? await loadAttachmentBlobUrl(entry.fileUrl)
        : fallbackSrc;
      setViewerSrc(attachmentUrl);
    } catch (error) {
      notify('screener-error', 'Unable to open file', error.message);
      return;
    }
    setViewerName(entry?.fileName || fallbackName);
    setViewerType(entry?.fileType || '');
    setViewerOpen(true);
  };

  // --- VIEW 1: REQUIREMENTS SCREENING PORTAL DASHBOARD LIST ---
  if (currentView === 'list') {
    return (
      <div className="screener-container">
        <header className="screener-header">
          <div className="header-left">
            <div className="header-title-row">
              <h1>Requirements Screening Portal</h1>
              {resubmissionCount > 0 && (
                <span className="header-badge" title="Resubmitted requirement(s) awaiting review">{resubmissionCount}</span>
              )}
            </div>
            <p>Validate and verify submitted documents from student-athletes.</p>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            Log Out 
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="logout-icon">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </header>

        <div className="metrics-row">
          <div className="metric-card">
            <h2>{stats.totalStudents}</h2>
            <p>Total Student</p>
          </div>
          <div className="metric-card">
            <h2>{stats.pendingRequirements}</h2>
            <p>Pending Requirements</p>
          </div>
          <div className="metric-card">
            <h2>{stats.verifiedRequirements}</h2>
            <p>Verified Requirements</p>
          </div>
        </div>

        <div className="filters-row">
          <div className="search-container">
            <input 
              type="text" 
              placeholder="Search by name..." 
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <span className="search-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </span>
          </div>

          <div className="filter-group">
            <label>Department:</label>
            <select 
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
            >
              <option value="All">All</option>
              {DEPARTMENT_OPTIONS.map((department) => (
                <option key={department} value={department}>{department}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Sport :</label>
            <select 
              value={sportFilter}
              onChange={(e) => setSportFilter(e.target.value)}
            >
              <option value="All">All</option>
              {SPORT_OPTIONS.map((sport) => (
                <option key={sport} value={sport}>{sport}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Year Level:</label>
            <select 
              value={yearLevelFilter}
              onChange={(e) => setYearLevelFilter(e.target.value)}
            >
              <option value="All">All</option>
              {YEAR_LEVEL_OPTIONS.map((yearLevel) => (
                <option key={yearLevel} value={yearLevel}>{yearLevel}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Participation Type:</label>
            <select
              value={participationType}
              onChange={(event) => {
                setParticipationType(event.target.value);
                setCurrentView('list');
                setSelectedStudent(null);
              }}
            >
              <option value="Intrams">Intrams</option>
              <option value="STRASUC">STRASUC</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">Loading submitted requirements…</div>
        ) : (
          <div className="table-container">
            <table className="screener-table">
              <thead>
                <tr>
                  <th>Athlete Name</th>
                  <th>Department</th>
                  <th>COR</th>
                  <th>MED</th>
                  <th>PSA</th>
                  <th>INSURANCE</th>
                  <th className="two-line-header">STUDENT<br/>PROFILE</th>
                  <th className="two-line-header">PARENTS<br/>CONSENT</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student.id}>
                    <td 
                      className="athlete-name click-nav-target" 
                      onClick={() => handleSelectStudent(student)}
                      title="Click to view requirements"
                    >
                      {student.name}
                    </td>
                    <td className="dept-code">{student.department}</td>
                    {renderStatusCell(student.requirements?.cor)}
                    {renderStatusCell(student.requirements?.med)}
                    {renderStatusCell(student.requirements?.psa)}
                    {renderStatusCell(student.requirements?.insurance)}
                    {renderStatusCell(student.requirements?.profile)}
                    {renderStatusCell(student.requirements?.consent)}
                    <td>{renderStatusBadge(student.overallStatus)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <LogoutConfirmModal
          isOpen={showLogoutModal}
          onClose={cancelLogout}
          onConfirm={confirmLogout}
        />
      </div>
    );
  }

  // --- VIEW 2: VIEW STUDENT ATHLETE REQUIREMENTS MAIN GRID ---
  if (currentView === 'view-details' && selectedStudent) {
    const requirementDocuments = selectedStudent.requirements?.documents || [];
    const standardRequirementKeys = new Set(requirementsTemplates.map((req) => req.id === 'med' ? 'med' : req.id));
    const requirementCards = requirementsTemplates.flatMap((req) => {
      const requirementKey = req.id === 'med' ? 'med' : req.id;
      const entries = (selectedStudent.requirements?.documents || [])
        .filter((entry) => (entry.requirementType === 'medical' ? 'med' : entry.requirementType) === requirementKey);
      const cards = entries.length > 0 ? entries : [null];

      return cards.map((entry, index) => ({
        ...req,
        entry,
        cardKey: entry?.submissionId || `${req.id}-empty-${index}`,
        viewerName: entry?.fileName || req.title,
        previewUrl: entry?.submissionId ? previewUrls[entry.submissionId] || '' : ''
      }));
    }).concat(requirementDocuments
      .filter((entry) => {
        const requirementKey = entry.requirementType === 'medical' ? 'med' : entry.requirementType;
        return !standardRequirementKeys.has(requirementKey);
      })
      .map((entry) => ({
        id: entry.requirementType,
        title: entry.label || entry.requirementType || 'REQUIREMENT',
        entry,
        cardKey: entry.submissionId,
        viewerName: entry.fileName || entry.label || 'Requirement Document',
        previewUrl: previewUrls[entry.submissionId] || ''
      })));

    return (
      <div className="view-req-container">
        <div className="view-req-header-row">
          <h1 className="view-req-title">View Student Athlete Requirements</h1>
          <button className="back-portal-btn" onClick={handleBackToList}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            Back to Dashboard
          </button>
        </div>

        <div className="view-req-card-wrapper">
          <div className="student-info-banner">
            <h2>{selectedStudent.name}</h2>
            <p><strong>Department :</strong> {selectedStudent.department || selectedStudent.dept || 'Not specified'}</p>
            <p><strong>Sport :</strong> {selectedStudent.sport || 'Not specified'}</p>
          </div>

          <div className="req-documents-grid">
            {requirementCards.map((req) => (
              <div className={`document-card ${req.entry?.resubmitted ? 'document-card--resubmitted' : ''} ${req.entry?.status === 'rejected' ? 'document-card--rejected' : ''}`} key={req.cardKey}>
                <h3>{req.title}</h3>
                {req.entry?.resubmitted && <span className="document-card-resubmitted-label">Resubmitted</span>}
                <div className={`document-preview-box${req.entry?.fileUrl ? '' : ' document-preview-box--empty'}`}>
                  {req.entry?.fileUrl ? (
                    <>
                      {req.previewUrl && isImageFile(req.entry) && (
                        <img src={req.previewUrl} alt={req.entry.fileName || req.title} className="document-img" />
                      )}
                      {req.previewUrl && isPdfFile(req.entry) && (
                        <iframe
                          src={req.previewUrl}
                          title={req.entry.fileName || req.title}
                          className="document-frame"
                        />
                      )}
                      {!req.previewUrl && previewLoading[req.entry.submissionId] && (
                        <span className="document-loading-label">Loading document...</span>
                      )}
                      {!req.previewUrl && !previewLoading[req.entry.submissionId] && (
                        <div className="document-file-label">{req.entry.fileName || 'Uploaded document'}</div>
                      )}
                      {req.entry?.resubmitted && (
                        <div className="document-resubmitted-indicator" title="Resubmitted requirement awaiting review">!</div>
                      )}
                      {getDocumentStamp(req.entry) && (
                        <img
                          src={getDocumentStamp(req.entry)}
                          alt={req.entry?.status === 'approved' ? 'Completed stamp' : 'Incomplete stamp'}
                          className="document-status-stamp"
                        />
                      )}
                      <button
                        type="button"
                        className="document-view-overlay-btn"
                        onClick={async () => {
                          await handleOpenRequirementViewer(req.entry, '', req.viewerName);
                        }}
                      >
                        View Documents
                      </button>
                    </>
                  ) : (
                    <span className="no-document-label">NO DOCUMENTS</span>
                  )}
                </div>
                {req.entry?.status === 'rejected' && req.entry?.remarks && (
                  <div className="document-rejection-note">
                    <strong>Reject Reason / Note:</strong> {req.entry.remarks}
                  </div>
                )}

                {req.entry?.submissionId && (
                  <div className="document-action-row">
                    <button
                      className="action-btn approve-btn"
                      onClick={() => setApproveTarget(req.entry.submissionId)}
                      aria-label={`Approve ${req.title}`}
                    >
                      Approve
                    </button>
                    <button
                      className="action-btn reject-btn"
                      onClick={() => setRejectTarget(req.entry.submissionId)}
                      aria-label={`Reject ${req.title}`}
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        {/* Confirmation modals for approve/reject */}
        <ConfirmModal
          isOpen={!!approveTarget}
          title="Approve Requirement"
          message="Are you sure you want to approve this requirement?"
          confirmText="Approve"
          cancelText="Cancel"
          onCancel={() => setApproveTarget(null)}
          onConfirm={async () => {
            try {
              const submissionId = approveTarget;
              await api.reviewScreenerRequirement(submissionId, {
                status: 'approved',
                feedback: 'Approved by screener',
                participationType,
                studentId: selectedStudent?.id
              });
              await markResubmissionViewed(submissionId);
              setRequirementStatus((s) => ({ ...s, [submissionId]: 'approved' }));
              notify('screener-success', 'Requirement Approved', 'Requirement is complete.');
              setApproveTarget(null);
              try {
                localStorage.setItem('gymstat-requirement-updated', String(Date.now()));
                window.dispatchEvent(new Event('gymstat-requirement-updated'));
              } catch (error) {
                console.warn('Unable to broadcast requirement update', error);
              }
              const response = await api.getScreenerRequirements(participationType);
              const data = response?.data || [];
              setStudents(data);
              const refreshedSelectedStudent = data.find((student) => student.id === selectedStudent?.id) || null;
              setSelectedStudent(refreshedSelectedStudent);
            } catch (err) {
              notify('screener-error', 'Approval Failed', err.message || 'Failed to approve requirement.');
            }
          }}
        />

        <RejectModal
          isOpen={!!rejectTarget}
          onCancel={() => setRejectTarget(null)}
          onConfirm={async (payload) => {
            try {
              const submissionId = rejectTarget;
              await api.reviewScreenerRequirement(submissionId, {
                status: 'rejected',
                feedback: payload.reason,
                remarks: payload.remarks,
                studentId: selectedStudent?.id,
                participationType
              });
              setRejectTarget(null);
              setRequirementStatus((s) => ({ ...s, [submissionId]: 'removed' }));
              const message = `Requirement deleted and student can re-upload. Reason: ${payload.reason}${payload.remarks ? ' — ' + payload.remarks : ''}`;
              notify('screener-error', 'Requirement Rejected', message);
              try {
                localStorage.setItem('gymstat-requirement-updated', String(Date.now()));
                window.dispatchEvent(new Event('gymstat-requirement-updated'));
              } catch (error) {
                console.warn('Unable to broadcast requirement update', error);
              }
              const response = await api.getScreenerRequirements(participationType);
              const data = response?.data || [];
              setStudents(data);
              const refreshedSelectedStudent = data.find((student) => student.id === selectedStudent?.id) || null;
              setSelectedStudent(refreshedSelectedStudent);
            } catch (err) {
              notify('screener-error', 'Rejection Failed', err.message || 'Failed to reject requirement.');
            }
          }}
        />
        <DocumentViewer
          key={viewerOpen ? viewerSrc : 'closed'}
          isOpen={viewerOpen}
          src={viewerSrc}
          fileName={viewerName}
          fileType={viewerType}
          onClose={() => { setViewerOpen(false); setViewerSrc(null); setViewerName(null); setViewerType(''); }}
        />
      </div>
    );
  }
};

export default ScreenerPage;