import React, { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LogoutConfirmModal from '../../components/LogoutConfirmModal';
import ConfirmModal from '../../components/ConfirmModal';
import RejectModal from '../../components/RejectModal';
import { useNotifications } from '../../components/useNotifications';
import usePortalSession, { PortalSessionError } from '../../hooks/usePortalSession';
import completedStamp from '../../assets/GymstatStamps/Completed.png';
import incompleteStamp from '../../assets/GymstatStamps/Incomplete.png';
import * as api from '../../services/api';
import { YEAR_LEVEL_OPTIONS } from '../../constants/studentRegistrationOptions';
import { REGISTRATION_SPORT_EVENT_OPTIONS } from '../../constants/registrationCategories';
import {
  areDisplayedRequirementsComplete,
  buildRequirementColumns,
  getRequirementColumnEntry,
  getSportScopedRequirements
} from '../requirementScreeningUtils';
import './ScreenerPage.css';

const getFileExtension = (fileName = '') => {
  const normalizedName = String(fileName).toLowerCase();
  return normalizedName.includes('.') ? normalizedName.slice(normalizedName.lastIndexOf('.')) : '';
};

const getDisplayFileName = (fileName, fallback = 'Uploaded document') => {
  const name = String(fileName || '').split(/[\\/]/).pop()?.trim();
  return name || fallback;
};

const isImageFile = (entry) => (
  String(entry?.fileType || '').toLowerCase().startsWith('image/')
  || ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(getFileExtension(entry?.fileName))
);

const isPdfFile = (entry) => (
  String(entry?.fileType || '').toLowerCase() === 'application/pdf'
  || getFileExtension(entry?.fileName) === '.pdf'
);

const getRequirementFileUrl = (entry, fileIndex = 0) => {
  if (entry?.files?.[fileIndex]?.fileUrl) return entry.files[fileIndex].fileUrl;
  if (fileIndex === 0 && entry?.fileUrl) return entry.fileUrl;
  if (!entry?.submissionId) return '';
  const participation = encodeURIComponent(entry.participationType || 'Intrams');
  return `/screener/requirements/${String(entry.submissionId)}/preview?participationType=${participation}&fileIndex=${fileIndex}`;
};

const getRequirementFiles = (entry) => (
  entry?.files?.length
    ? entry.files
    : entry
      ? [{ fileName: entry.fileName, fileType: entry.fileType }]
      : []
);

const getMatchingPublishedRequirement = (entry, publishedColumns) => {
  const requirementType = String(entry?.requirementType || '').trim().toLocaleLowerCase();
  return publishedColumns.find((column) => (
    column.type === 'other'
      ? String(entry?.customRequirementId || '') === column.requirementId
      : column.id === `type:${requirementType === 'medical' ? 'med' : requirementType}`
  ));
};

const getRequirementPreviewKey = (entry, fileIndex = 0) => `${entry.submissionId}:${fileIndex}`;

const loadAttachmentBlobUrl = async (fileUrl) => {
  return api.getProtectedImageObjectUrl(fileUrl, { cache: 'no-store' });
};

const normalizeDepartmentValue = (value) => String(value ?? '')
  .normalize('NFKC')
  .replace(/\s+/g, ' ')
  .trim()
  .toLocaleLowerCase();

const ScreenerPage = () => {
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const navigate = useNavigate();
  const { authReady, authError, user } = usePortalSession(['screener', 'admin'], 'Screener');
  const isScreener = String(user?.role || '').toLowerCase() === 'screener';
  
  // Navigation State: 'list' or 'view-details'
  const [currentView, setCurrentView] = useState('list');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [previewUrls, setPreviewUrls] = useState({});
  const [previewLoading, setPreviewLoading] = useState({});
  const [previewErrors, setPreviewErrors] = useState({});
  const [students, setStudents] = useState([]);
  const [publishedRequirements, setPublishedRequirements] = useState([]);
  const [reviewingSubmissionIds, setReviewingSubmissionIds] = useState(() => new Set());
  const [assignedDepartment, setAssignedDepartment] = useState('');
  const [departmentUnassigned, setDepartmentUnassigned] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingSportReload, setPendingSportReload] = useState(false);
  const [stats, setStats] = useState({ totalStudents: 0, pendingRequirements: 0, verifiedRequirements: 0 });

  // Modal states
  const [approveTarget, setApproveTarget] = useState(null); // req id being approved
  const [rejectTarget, setRejectTarget] = useState(null); // req id being rejected
  const [showOverallApprovalConfirmation, setShowOverallApprovalConfirmation] = useState(false);
  const [overallApprovalInProgress, setOverallApprovalInProgress] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerSrc, setViewerSrc] = useState(null);
  const [viewerName, setViewerName] = useState(null);
  const [viewerType, setViewerType] = useState('');
  const [viewerFiles, setViewerFiles] = useState([]);
  const [viewerFileIndex, setViewerFileIndex] = useState(0);
  const [viewerNavigationLoading, setViewerNavigationLoading] = useState(false);

  const { notify } = useNotifications();
  const hasNotifiedLoadErrorRef = useRef(false);
  const requirementsRequestInProgressRef = useRef(false);
  const activeRequestSportRef = useRef('');
  const pendingSportReloadRef = useRef(false);
  const requirementsPollingStoppedRef = useRef(false);
  const reviewingSubmissionIdsRef = useRef(new Set());

  useEffect(() => {
    const role = String(user?.role || '').trim().toLowerCase();
    if (role === 'screener' || role === 'admin') {
      sessionStorage.setItem('role', role);
    }
    if (role === 'screener') {
      const department = String(user?.department || user?.dept || '').trim();
      setAssignedDepartment(department);
    }
  }, [user]);
  
  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [sportFilter, setSportFilter] = useState('All');
  const [yearLevelFilter, setYearLevelFilter] = useState('All');
  const selectedSport = sportFilter === 'All' ? '' : sportFilter;
  const selectedSportRef = useRef(selectedSport);
  selectedSportRef.current = selectedSport;
  const sportFilterOptions = Array.from(new Map(
    [...REGISTRATION_SPORT_EVENT_OPTIONS, ...students.flatMap((student) => Array.isArray(student.sports) ? student.sports : [])]
      .filter((sport) => typeof sport === 'string' && sport.trim())
      .map((sport) => [String(sport).trim(), String(sport).trim()])
  ).values());
  const requirementColumns = buildRequirementColumns(publishedRequirements, sportFilter);

  const loadRequirements = async (silent = false) => {
    if (requirementsPollingStoppedRef.current) return;
    if (requirementsRequestInProgressRef.current) {
      if (activeRequestSportRef.current !== selectedSport) pendingSportReloadRef.current = true;
      return;
    }
    requirementsRequestInProgressRef.current = true;
    activeRequestSportRef.current = selectedSport;
    const requestedSport = selectedSport;

    try {
      if (!silent && !students.length) setLoading(true);
      const [response, publishedRequirementsResponse] = await Promise.all([
        api.getScreenerRequirements(undefined, requestedSport),
        api.getPublishedRequirements()
      ]);
      if (requestedSport !== selectedSportRef.current) return;
      const data = response?.data || [];
      // Ensure data is always an array to avoid rendering crashes
      const safeData = Array.isArray(data) ? data : [];
      setPublishedRequirements(Array.isArray(publishedRequirementsResponse?.data)
        ? publishedRequirementsResponse.data
        : []);
      if (isScreener) {
        const nextAssignedDepartment = String(response?.assignedDepartment || '').trim();
        setAssignedDepartment((currentDepartment) => {
          if (normalizeDepartmentValue(currentDepartment) !== normalizeDepartmentValue(nextAssignedDepartment)) {
            return nextAssignedDepartment;
          }
          return currentDepartment;
        });
        setDepartmentUnassigned(false);
      }
      setStudents(safeData);
      setSelectedStudent((current) => {
        if (!current) return current;
        const refreshedStudent = safeData.find((student) => student.id === current.id);
        if (!refreshedStudent) setCurrentView('list');
        return refreshedStudent || null;
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
      setDepartmentUnassigned(false);
      hasNotifiedLoadErrorRef.current = false;
    } catch (error) {
      if (requestedSport !== selectedSportRef.current) return;
      console.error('Failed to load screener requirements', error);
      if (isScreener && error?.status === 403
        && /department is not configured/i.test(error?.message || '')) {
        setAssignedDepartment('');
        setDepartmentUnassigned(true);
        setStudents([]);
        setSelectedStudent(null);
        setCurrentView('list');
        setStats({ totalStudents: 0, pendingRequirements: 0, verifiedRequirements: 0 });
        requirementsPollingStoppedRef.current = false;
        if (!silent && !hasNotifiedLoadErrorRef.current) {
          notify(
            'screener-error',
            'Department Assignment Required',
            'Your account has no assigned department. Contact an Admin to receive access to student-athlete records.'
          );
          hasNotifiedLoadErrorRef.current = true;
        }
        return;
      }
      requirementsPollingStoppedRef.current = true;
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
      requirementsRequestInProgressRef.current = false;
      activeRequestSportRef.current = '';
      if (!silent) setLoading(false);
      if (pendingSportReloadRef.current) {
        pendingSportReloadRef.current = false;
        setPendingSportReload(true);
      }
    }
  };
  const loadRequirementsEvent = useEffectEvent(loadRequirements);

  useEffect(() => {
    if (!pendingSportReload) return;
    setPendingSportReload(false);
    loadRequirementsEvent(true);
  }, [pendingSportReload]);

  const markResubmissionViewed = async (submissionId, participationType = 'Intrams') => {
    if (!submissionId) return;

    try {
      await api.markScreenerRequirementViewed(
        submissionId,
        participationType,
        sportFilter === 'All' ? '' : sportFilter
      );
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

  const setSubmissionReviewInProgress = (submissionId, inProgress) => {
    const nextSubmissionIds = new Set(reviewingSubmissionIdsRef.current);
    if (inProgress) {
      nextSubmissionIds.add(submissionId);
    } else {
      nextSubmissionIds.delete(submissionId);
    }
    reviewingSubmissionIdsRef.current = nextSubmissionIds;
    setReviewingSubmissionIds(nextSubmissionIds);
  };

  const updateSelectedSubmission = (submissionId, savedSubmission) => {
    const updateStudent = (student) => {
      if (!student) return student;
      const documents = Array.isArray(student.requirements?.documents)
        ? student.requirements.documents.map((entry) => (
          String(entry?.submissionId) === String(submissionId)
            ? {
              ...entry,
              status: savedSubmission.status,
              remarks: savedSubmission.remarks || '',
            }
            : entry
        ))
        : [];
      return {
        ...student,
        requirements: {
          ...student.requirements,
          documents,
        },
      };
    };

    setStudents((currentStudents) => currentStudents.map((student) => (
      student.id === selectedStudent?.id ? updateStudent(student) : student
    )));
    setSelectedStudent((currentStudent) => (
      currentStudent?.id === selectedStudent?.id
        ? updateStudent(currentStudent)
        : currentStudent
    ));
  };

  const refreshSelectedStudent = async () => {
    const response = await api.getScreenerRequirements(
      undefined,
      sportFilter === 'All' ? '' : sportFilter
    );
    const data = Array.isArray(response?.data) ? response.data : [];
    setStudents(data);
    setSelectedStudent(data.find((student) => student.id === selectedStudent?.id) || null);
  };

  const broadcastRequirementUpdate = () => {
    try {
      localStorage.setItem('gymstat-requirement-updated', String(Date.now()));
      window.dispatchEvent(new Event('gymstat-requirement-updated'));
    } catch (error) {
      console.warn('Unable to broadcast requirement update', error);
    }
  };

  useEffect(() => {
    if (!authReady) return;
    setStudents([]);
    setSelectedStudent(null);
    setCurrentView('list');
    setLoading(true);
    loadRequirementsEvent();
  }, [authReady, sportFilter]);

  useEffect(() => {
    if (!authReady) return undefined;
    const refreshInterval = window.setInterval(() => {
      if (!requirementsPollingStoppedRef.current) loadRequirementsEvent(true);
    }, 10000);

    return () => window.clearInterval(refreshInterval);
  }, [authReady]);

  useEffect(() => {
    if (!authReady) return undefined;
    const handleRequirementUpdate = () => {
      if (!requirementsPollingStoppedRef.current) loadRequirementsEvent(true);
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
  }, [authReady]);

  useEffect(() => {
    let cancelled = false;
    const createdUrls = [];
    const previewSport = sportFilter === 'All' ? selectedStudent?.sport : sportFilter;
    const publishedColumns = buildRequirementColumns(publishedRequirements, previewSport);
    const entries = (selectedStudent?.requirements?.documents || [])
      .filter((entry) => (
        entry?.submissionId
        && entry.hasUpload === true
        && entry.screenerForwardedAt
        && entry.coachStatus === 'approved'
        && getMatchingPublishedRequirement(entry, publishedColumns)
      ))
      .flatMap((entry) => getRequirementFiles(entry)
        .map((file, index) => [
          getRequirementPreviewKey(entry, index),
          { ...entry, ...file },
          getRequirementFileUrl(entry, index)
        ]))
      .filter(([, , fileUrl]) => Boolean(fileUrl));

    setPreviewUrls({});
    setPreviewLoading(Object.fromEntries(entries.map(([key]) => [key, true])));
    setPreviewErrors({});

    if (entries.length === 0) {
      return () => {};
    }

    Promise.all(entries.map(async ([key, entry, fileUrl]) => {
      try {
        const blobUrl = await loadAttachmentBlobUrl(fileUrl);
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
  }, [notify, publishedRequirements, selectedStudent, sportFilter]);

  const handleSelectStudent = (student) => {
    setSelectedStudent(student);
    setCurrentView('view-details');
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
    // The Screener API already scopes records by the forwarding coach's department.
    const hasAssignedDepartment = !isScreener
      || Boolean(assignedDepartment);
    const matchesSport = sportFilter === 'All'
      || student.sport === sportFilter
      || student.sports?.includes(sportFilter);
    const matchesYear = yearLevelFilter === 'All' || student.yearLevel === yearLevelFilter;
    
    return hasAssignedDepartment && matchesSearch && matchesSport && matchesYear;
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
      <div className="requirement-status-list">
        {entry?.resubmitted && (
          <div className="resubmitted-status-wrapper">
            <span className="resubmitted-table-indicator" title="Resubmitted requirement awaiting review">!</span>
            <span className="resubmitted-table-label">Resubmitted</span>
          </div>
        )}
        {renderStatusBadge(entry?.status)}
      </div>
    </td>
  );

  const getDocumentStamp = (entry) => {
    if (entry?.status === 'approved') return completedStamp;
    if (entry?.status === 'rejected') return incompleteStamp;
    return null;
  };

  const handleOpenRequirementViewer = async (entry, fallbackSrc = '', fallbackName = 'Requirement Document') => {
    if (entry?.resubmitted && entry.submissionId) {
      await markResubmissionViewed(entry.submissionId, entry.participationType);
    }
    try {
      const files = getRequirementFiles(entry).map((file, index) => ({
        ...file,
        fileUrl: getRequirementFileUrl(entry, index)
      }));
      const selectedFile = files[0];
      if (viewerSrc?.startsWith('blob:')) URL.revokeObjectURL(viewerSrc);
      setViewerFiles(files);
      setViewerFileIndex(0);
      setViewerName(selectedFile?.fileName || entry?.fileName || fallbackName);
      setViewerType(selectedFile?.fileType || entry?.fileType || '');
      setViewerSrc(null);
      setViewerOpen(true);
      setViewerNavigationLoading(true);
      const fileUrl = selectedFile?.fileUrl;
      const attachmentUrl = fileUrl
        ? await loadAttachmentBlobUrl(fileUrl)
        : fallbackSrc;
      setViewerSrc(attachmentUrl);
    } catch (error) {
      setViewerOpen(false);
      notify('screener-error', 'Unable to open file', error.message);
    } finally {
      setViewerNavigationLoading(false);
    }
  };

  const handleViewerNavigation = async (direction) => {
    if (viewerNavigationLoading || viewerFiles.length < 2) return;
    const nextIndex = (viewerFileIndex + direction + viewerFiles.length) % viewerFiles.length;
    const selectedFile = viewerFiles[nextIndex];
    setViewerNavigationLoading(true);
    try {
      const source = await loadAttachmentBlobUrl(selectedFile.fileUrl);
      if (viewerSrc?.startsWith('blob:')) URL.revokeObjectURL(viewerSrc);
      setViewerSrc(source);
      setViewerName(selectedFile.fileName || 'Requirement Document');
      setViewerType(selectedFile.fileType || '');
      setViewerFileIndex(nextIndex);
    } catch (error) {
      notify('screener-error', 'Unable to open file', error.message);
    } finally {
      setViewerNavigationLoading(false);
    }
  };

  const closeRequirementViewer = () => {
    if (viewerSrc?.startsWith('blob:')) URL.revokeObjectURL(viewerSrc);
    setViewerOpen(false);
    setViewerSrc(null);
    setViewerName(null);
    setViewerType('');
    setViewerFiles([]);
    setViewerFileIndex(0);
    setViewerNavigationLoading(false);
  };

  // --- VIEW 1: REQUIREMENTS SCREENING PORTAL DASHBOARD LIST ---
  if (!authReady) return authError ? <PortalSessionError /> : null;

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
            <p>Review documents forwarded by coaches for student-athletes in your assigned department.</p>
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
            <p>Total Athlete</p>
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
            <label>Sport :</label>
            <select 
              value={sportFilter}
              onChange={(e) => setSportFilter(e.target.value)}
            >
              <option value="All">All</option>
              {sportFilterOptions.map((sport) => (
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

        </div>

        {loading ? (
          <div className="loading-state">Loading submitted requirements…</div>
        ) : departmentUnassigned ? (
          <div className="loading-state">No department is assigned to your screener account. Contact an Admin to receive access.</div>
        ) : (
          <div className="table-container">
            <table className="screener-table">
              <thead>
                <tr>
                  <th>Athlete Name</th>
                  <th>Department</th>
                  {requirementColumns.map((column) => (
                    <th key={column.id}>{column.label}</th>
                  ))}
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => {
                  const displayedRequirements = getSportScopedRequirements(
                    student.requirements,
                    sportFilter === 'All' ? '' : sportFilter
                  );

                  return (
                    <tr key={student.id}>
                      <td
                        className="athlete-name click-nav-target"
                        onClick={() => handleSelectStudent(student)}
                        title="Click to view requirements"
                      >
                        {student.name}
                      </td>
                      <td className="dept-code">{student.department}</td>
                      {requirementColumns.map((column) => (
                        <React.Fragment key={column.id}>
                          {renderStatusCell(getRequirementColumnEntry(displayedRequirements, column))}
                        </React.Fragment>
                      ))}
                      <td>
                        {renderStatusBadge(
                          areDisplayedRequirementsComplete(displayedRequirements, requirementColumns)
                            ? 'Completed'
                            : 'Incomplete'
                        )}
                      </td>
                    </tr>
                  );
                })}
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
    const selectedSport = sportFilter === 'All' ? selectedStudent.sport : sportFilter;
    const selectedRequirements = getSportScopedRequirements(selectedStudent.requirements, selectedSport);
    const requirementDocuments = selectedRequirements.documents || [];
    const publishedRequirementColumns = buildRequirementColumns(publishedRequirements, selectedSport);
    const requirementCards = requirementDocuments.flatMap((entry) => {
      if (!entry?.submissionId
        || entry.hasUpload !== true
        || !entry.screenerForwardedAt
        || entry.coachStatus !== 'approved') return [];

      const matchingColumn = getMatchingPublishedRequirement(entry, publishedRequirementColumns);
      if (!matchingColumn) return [];

      const previewKey = getRequirementPreviewKey(entry);
      return [{
        id: matchingColumn.id,
        title: matchingColumn.label,
        entry,
        cardKey: entry.submissionId,
        viewerName: entry.fileName || matchingColumn.label,
        previewKey,
        previewUrl: previewUrls[previewKey] || '',
      }];
    });
    const overallApprovalDocuments = requirementCards.map(({ entry }) => entry).filter((entry) => (
      entry?.submissionId
      && entry.screenerForwardedAt
      && entry.coachStatus === 'approved'
      && entry.hasUpload === true
      && ['pending', 'approved'].includes(String(entry.status || '').trim().toLowerCase())
    ));
    const hasPendingOverallApproval = overallApprovalDocuments.some((entry) => (
      String(entry.status || '').trim().toLowerCase() !== 'approved'
    ));

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
            <div className="student-info-details">
              <h2>{selectedStudent.name}</h2>
              <p><strong>Department :</strong> {selectedStudent.department || selectedStudent.dept || 'Not specified'}</p>
              <p><strong>Sport :</strong> {selectedSport || 'Not specified'}</p>
            </div>
            {hasPendingOverallApproval && (
              <button
                type="button"
                className="action-btn approved-btn overall-approve-btn"
                onClick={() => setShowOverallApprovalConfirmation(true)}
                disabled={overallApprovalInProgress || reviewingSubmissionIds.size > 0}
              >
                {overallApprovalInProgress ? 'Approving...' : 'Overall Approved'}
              </button>
            )}
          </div>

          <div className="req-documents-grid">
            {requirementCards.map((req) => (
              <div className={`document-card ${req.entry?.resubmitted ? 'document-card--resubmitted' : ''} ${req.entry?.status === 'rejected' ? 'document-card--rejected' : ''}`} key={req.cardKey}>
                <h3>{req.title}</h3>
                {req.entry && (
                  <div className="document-review-status">
                    <span className="badge badge-completed">Coach-Approved</span>
                    {renderStatusBadge(req.entry.status)}
                  </div>
                )}
                {req.entry?.resubmitted && <span className="document-card-resubmitted-label">Resubmitted</span>}
                <div className="document-preview-box">
                  {req.entry.hasUpload === true && getRequirementFileUrl(req.entry) ? (
                    <>
                      {req.previewUrl && isImageFile(req.entry) && (
                        !previewErrors[req.previewKey] && (
                          <img
                            src={req.previewUrl}
                            alt={req.entry.fileName || req.title}
                            className="document-img"
                            onError={() => setPreviewErrors((current) => ({
                              ...current,
                              [req.previewKey]: true
                            }))}
                          />
                        )
                      )}
                      {req.previewUrl && isPdfFile(req.entry) && (
                        <iframe
                          src={req.previewUrl}
                          title={req.entry.fileName || req.title}
                          className="document-frame"
                        />
                      )}
                      {!req.previewUrl && previewLoading[req.previewKey] && (
                        <span className="document-loading-label">Loading document...</span>
                      )}
                      {req.previewUrl && isImageFile(req.entry) && !previewErrors[req.previewKey] && (
                        <div className="document-file-label">{getDisplayFileName(req.entry.fileName)}</div>
                      )}
                      {(!req.previewUrl || previewErrors[req.previewKey] || (!isImageFile(req.entry) && !isPdfFile(req.entry)))
                        && !previewLoading[req.previewKey] && (
                        <div className="document-file-label">
                          <div>Document preview unavailable</div>
                          <div>{getDisplayFileName(req.entry.fileName)}</div>
                        </div>
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
                        {req.entry.files?.length > 1
                          ? `View Documents (${req.entry.files.length})`
                          : 'View Documents'}
                      </button>
                    </>
                  ) : null}
                </div>
                {req.entry?.status === 'rejected' && req.entry?.remarks && (
                  <div className="document-rejection-note">
                    <strong>Reject Reason / Note:</strong> {req.entry.remarks}
                  </div>
                )}

                {req.entry?.submissionId && (
                  <div className="document-action-row">
                    <button
                      type="button"
                      className="action-btn approved-btn"
                      onClick={() => setApproveTarget(req.entry.submissionId)}
                      disabled={String(req.entry.status || '').trim().toLowerCase() === 'approved'
                        || overallApprovalInProgress
                        || reviewingSubmissionIds.has(String(req.entry.submissionId))}
                      aria-label={`Approve ${req.title}`}
                    >
                      {reviewingSubmissionIds.has(String(req.entry.submissionId)) ? 'Saving...' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      className="action-btn reject-btn"
                      onClick={() => setRejectTarget(req.entry.submissionId)}
                      disabled={overallApprovalInProgress
                        || reviewingSubmissionIds.has(String(req.entry.submissionId))}
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
            const submissionId = String(approveTarget || '');
            if (!submissionId || reviewingSubmissionIdsRef.current.has(submissionId)) return;
            setSubmissionReviewInProgress(submissionId, true);
            try {
              const submission = selectedStudent?.requirements?.documents?.find((entry) => entry.submissionId === submissionId);
              const reviewParticipationType = submission?.participationType || 'Intrams';
              const response = await api.reviewScreenerRequirement(submissionId, {
                status: 'approved',
                feedback: 'Approved by screener',
                participationType: reviewParticipationType,
                studentId: selectedStudent?.id,
                sport: sportFilter === 'All' ? '' : sportFilter
              });
              if (response?.data?.status !== 'approved') {
                throw new Error('The saved document status could not be confirmed. Refresh and try again.');
              }
              updateSelectedSubmission(submissionId, response.data);
              await markResubmissionViewed(submissionId, reviewParticipationType);
              notify('screener-success', 'Requirement Approved', 'Requirement is complete.');
              setApproveTarget(null);
              broadcastRequirementUpdate();
              try {
                await refreshSelectedStudent();
              } catch (refreshError) {
                console.warn('Approval saved, but the Screener record could not refresh.', refreshError);
                notify('screener-error', 'Approval Saved', 'The saved approval is confirmed, but the record could not refresh. It will update when the list reloads.');
              }
            } catch (err) {
              notify('screener-error', 'Approval Failed', err.message || 'Failed to approve requirement.');
            } finally {
              setSubmissionReviewInProgress(submissionId, false);
            }
          }}
        />

        <ConfirmModal
          isOpen={showOverallApprovalConfirmation}
          title="Approve All Forwarded Documents"
          message={`Approve all eligible forwarded documents for ${selectedStudent.name} in ${selectedSport}?`}
          confirmText="Overall Approved"
          cancelText="Cancel"
          onCancel={() => setShowOverallApprovalConfirmation(false)}
          onConfirm={async () => {
            setShowOverallApprovalConfirmation(false);
            setOverallApprovalInProgress(true);
            try {
              await api.approveForwardedScreenerRequirements({
                studentId: selectedStudent.id,
                sport: selectedSport,
                documents: overallApprovalDocuments.map((entry) => ({
                  submissionId: entry.submissionId,
                  participationType: entry.participationType || 'Intrams',
                })),
              });
              notify('screener-success', 'Documents Approved', 'All eligible forwarded documents were approved.');
              try {
                localStorage.setItem('gymstat-requirement-updated', String(Date.now()));
                window.dispatchEvent(new Event('gymstat-requirement-updated'));
              } catch (error) {
                console.warn('Unable to broadcast requirement update', error);
              }
              await loadRequirements(true);
            } catch (error) {
              notify('screener-error', 'Approval Failed', error.message || 'Unable to approve forwarded documents.');
            } finally {
              setOverallApprovalInProgress(false);
            }
          }}
        />

        <RejectModal
          isOpen={!!rejectTarget}
          onCancel={() => setRejectTarget(null)}
          onConfirm={async (payload) => {
            const submissionId = String(rejectTarget || '');
            if (!submissionId || reviewingSubmissionIdsRef.current.has(submissionId)) return;
            setSubmissionReviewInProgress(submissionId, true);
            try {
              const submission = selectedStudent?.requirements?.documents?.find((entry) => entry.submissionId === submissionId);
              const response = await api.reviewScreenerRequirement(submissionId, {
                status: 'rejected',
                feedback: payload.reason,
                remarks: payload.remarks,
                studentId: selectedStudent?.id,
                participationType: submission?.participationType || 'Intrams',
                sport: sportFilter === 'All' ? '' : sportFilter
              });
              if (response?.data?.status !== 'rejected') {
                throw new Error('The saved document status could not be confirmed. Refresh and try again.');
              }
              updateSelectedSubmission(submissionId, response.data);
              setRejectTarget(null);
              notify('screener-success', 'Requirement Rejected', 'Requirement was rejected and retained for re-upload.');
              broadcastRequirementUpdate();
              try {
                await refreshSelectedStudent();
              } catch (refreshError) {
                console.warn('Rejection saved, but the Screener record could not refresh.', refreshError);
                notify('screener-error', 'Rejection Saved', 'The saved rejection is confirmed, but the record could not refresh. It will update when the list reloads.');
              }
            } catch (err) {
              notify('screener-error', 'Rejection Failed', err.message || 'Failed to reject requirement.');
            } finally {
              setSubmissionReviewInProgress(submissionId, false);
            }
          }}
        />
        {viewerOpen && (
          <div
            className="screener-document-preview-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeRequirementViewer();
            }}
          >
            <section
              className="screener-document-preview"
              role="dialog"
              aria-modal="true"
              aria-label={viewerName || 'Document preview'}
            >
              <header className="screener-document-preview-header">
                <strong title={viewerName}>{viewerName}</strong>
                {viewerFiles.length > 1 && (
                  <nav className="screener-document-preview-navigation" aria-label="Document navigation">
                    <button
                      type="button"
                      onClick={() => handleViewerNavigation(-1)}
                      disabled={viewerNavigationLoading}
                      aria-label="Previous document"
                    >
                      Previous
                    </button>
                    <span>{viewerFileIndex + 1} / {viewerFiles.length}</span>
                    <button
                      type="button"
                      onClick={() => handleViewerNavigation(1)}
                      disabled={viewerNavigationLoading}
                      aria-label="Next document"
                    >
                      Next
                    </button>
                  </nav>
                )}
                <button
                  type="button"
                  className="screener-document-preview-close"
                  onClick={closeRequirementViewer}
                  aria-label="Close document preview"
                >
                  ×
                </button>
              </header>
              <div className="screener-document-preview-content">
                {viewerNavigationLoading ? (
                  <span>Loading document…</span>
                ) : isPdfFile({ fileName: viewerName, fileType: viewerType }) ? (
                  <iframe src={viewerSrc} title={viewerName || 'PDF document preview'} />
                ) : isImageFile({ fileName: viewerName, fileType: viewerType }) ? (
                  <img src={viewerSrc} alt={viewerName || 'Uploaded document'} />
                ) : (
                  <span>Preview is unavailable for this file type.</span>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    );
  }
};

export default ScreenerPage;

export { RequirementScreeningInterface } from './RequirementScreeningInterface';