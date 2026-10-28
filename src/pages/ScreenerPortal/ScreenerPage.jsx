import React, { useEffect, useEffectEvent, useRef, useState } from 'react';
import ConfirmModal from '../../components/ConfirmModal';
import RejectModal from '../../components/RejectModal';
import { useNotifications } from '../../components/useNotifications';
import DocumentViewer from '../../components/DocumentViewer';
import completedStamp from '../../assets/GymstatStamps/Completed.png';
import incompleteStamp from '../../assets/GymstatStamps/Incomplete.png';
import * as api from '../../services/api';
import usePortalSession, { PortalSessionError } from '../../hooks/usePortalSession';
import {
  DEPARTMENT_OPTIONS,
  SPORT_OPTIONS,
  YEAR_LEVEL_OPTIONS
} from '../../constants/studentRegistrationOptions';
import './ScreenerPage.css';

const normalizeYearLevel = (value) => {
  const compactValue = String(value || '')
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]/g, '');
  if (!compactValue) return '';

  const aliases = {
    i: 'I',
    '1': 'I',
    '1st': 'I',
    first: 'I',
    firstyear: 'I',
    firstyearlevel: 'I',
    '1styear': 'I',
    '1styearlevel': 'I',
    year1: 'I',
    yeari: 'I',
    yearleveli: 'I',
    yearlevel1: 'I',
    ii: 'II',
    '2': 'II',
    '2nd': 'II',
    second: 'II',
    secondyear: 'II',
    secondyearlevel: 'II',
    '2ndyear': 'II',
    '2ndyearlevel': 'II',
    year2: 'II',
    yearii: 'II',
    yearlevelii: 'II',
    yearlevel2: 'II',
    iii: 'III',
    '3': 'III',
    '3rd': 'III',
    third: 'III',
    thirdyear: 'III',
    thirdyearlevel: 'III',
    '3rdyear': 'III',
    '3rdyearlevel': 'III',
    year3: 'III',
    yeariii: 'III',
    yearleveliii: 'III',
    yearlevel3: 'III',
    iv: 'IV',
    '4': 'IV',
    '4th': 'IV',
    fourth: 'IV',
    fourthyear: 'IV',
    fourthyearlevel: 'IV',
    '4thyear': 'IV',
    '4thyearlevel': 'IV',
    year4: 'IV',
    yeariv: 'IV',
    yearleveliv: 'IV',
    yearlevel4: 'IV'
  };

  return aliases[compactValue] || '';
};

const normalizeDepartment = (value) => String(value ?? '')
  .normalize('NFKC')
  .trim()
  .replace(/\s+/g, ' ')
  .toLocaleLowerCase();

const normalizeSportValue = (value) => {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) return '';

  return rawValue
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase();
};

const getStudentSportValues = (student = {}) => {
  const sports = Array.isArray(student.sports) ? student.sports : [];
  return Array.from(new Map(
    sports
      .filter((sport) => typeof sport === 'string')
      .map((sport) => [normalizeSportValue(sport), sport.trim()])
      .filter(([normalizedSport, sport]) => Boolean(normalizedSport && sport))
  ).values());
};

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
  if (entry?.fileUrl && fileIndex === 0) return entry.fileUrl;
  if (!entry?.submissionId) return '';
  const participation = encodeURIComponent(entry.participationType || 'Intrams');
  return `/coach/requirements/${String(entry.submissionId)}/preview?participationType=${participation}&fileIndex=${fileIndex}`;
};

const getRequirementPreviewKey = (entry, fileIndex = 0) => `${entry.submissionId}:${fileIndex}`;

const loadAttachmentBlobUrl = async (fileUrl) => {
  return api.getProtectedImageObjectUrl(fileUrl, { cache: 'no-store' });
};

export const RequirementScreeningInterface = () => {
  // Navigation State: 'list' or 'view-details'
  const [currentView, setCurrentView] = useState('list');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [previewUrls, setPreviewUrls] = useState({});
  const [previewLoading, setPreviewLoading] = useState({});
  const [previewErrors, setPreviewErrors] = useState({});
  const [, setRequirementStatus] = useState({});
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const { authReady, authError } = usePortalSession(['coach'], 'Coach');
  const [stats, setStats] = useState({ totalStudents: 0, pendingRequirements: 0, verifiedRequirements: 0 });

  // Modal states
  const [approveTarget, setApproveTarget] = useState(null); // req id being approved
  const [rejectTarget, setRejectTarget] = useState(null); // req id being rejected
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerSrc, setViewerSrc] = useState(null);
  const [viewerName, setViewerName] = useState(null);
  const [viewerType, setViewerType] = useState('');
  const [viewerFiles, setViewerFiles] = useState([]);
  const [viewerFileIndex, setViewerFileIndex] = useState(0);
  const [viewerNavigationLoading, setViewerNavigationLoading] = useState(false);
  const [downloadingFileKey, setDownloadingFileKey] = useState('');

  const { notify } = useNotifications();
  const hasNotifiedLoadErrorRef = useRef(false);
  const requirementsRequestInProgressRef = useRef(false);
  const selectedStudentRef = useRef(selectedStudent);
  selectedStudentRef.current = selectedStudent;

  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [sportFilter, setSportFilter] = useState('All');
  const [yearLevelFilter, setYearLevelFilter] = useState('All');
  const departmentFilterOptions = Array.from(new Map(
    [...DEPARTMENT_OPTIONS, ...students.map((student) => student.department)]
      .filter((department) => typeof department === 'string' && department.trim())
      .map((department) => [normalizeDepartment(department), department.trim()])
  ).values());
  const loadRequirements = async (silent = false) => {
    if (requirementsRequestInProgressRef.current) return;
    requirementsRequestInProgressRef.current = true;

    try {
      if (!silent) setLoading(true);
      const response = await api.getCoachDocumentRequirements();
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
      hasNotifiedLoadErrorRef.current = false;
    } catch (error) {
      console.error('Failed to load coach requirements', error);
      // Friendly handling for authorization errors so UI doesn't crash
      const msg = error?.message || '';
      if (!silent && !hasNotifiedLoadErrorRef.current) {
        if (msg.toLowerCase().includes('not authorized') || msg.toLowerCase().includes('is not authorized')) {
          notify('coach-error', 'Unable to load requirements', 'You are not authorized to view these requirements.');
        } else {
          notify('coach-error', 'Unable to load requirements', msg || 'Please try again.');
        }
        hasNotifiedLoadErrorRef.current = true;
      }
    } finally {
      requirementsRequestInProgressRef.current = false;
      if (!silent) setLoading(false);
    }
  };

  const loadRequirementsEvent = useEffectEvent(loadRequirements);

  const markResubmissionViewed = async (submissionId, submissionParticipationType = 'Intrams') => {
    if (!submissionId) return;

    try {
      await api.markCoachRequirementViewed(submissionId, submissionParticipationType);
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
    if (!authReady) return undefined;

    loadRequirementsEvent();
    const refreshInterval = window.setInterval(() => {
      loadRequirementsEvent(true);
    }, 10000);

    const handleRequirementUpdate = () => {
      loadRequirementsEvent(true);
    };

    const handleStorageUpdate = (event) => {
      if (event.key === 'gymstat-requirement-updated') {
        handleRequirementUpdate();
      }
    };

    window.addEventListener('gymstat-requirement-updated', handleRequirementUpdate);
    window.addEventListener('storage', handleStorageUpdate);
    return () => {
      window.clearInterval(refreshInterval);
      window.removeEventListener('gymstat-requirement-updated', handleRequirementUpdate);
      window.removeEventListener('storage', handleStorageUpdate);
    };
  }, [authReady]);

  const previewEntriesKey = JSON.stringify([
    selectedStudent?.id || '',
    (selectedStudent?.requirements?.documents || []).map((entry) => [
      entry.submissionId,
      (entry.files || [{ fileUrl: getRequirementFileUrl(entry), fileName: entry.fileName, fileType: entry.fileType }])
        .map((file) => [file.fileUrl, file.fileName, file.fileType])
    ])
  ]);

  useEffect(() => {
    let cancelled = false;
    const createdUrls = [];
    const previewStudent = selectedStudentRef.current;
    const entries = (previewStudent?.requirements?.documents || [])
      .flatMap((entry) => (entry.files?.length ? entry.files : [entry])
        .map((file, index) => [
          getRequirementPreviewKey(entry, index),
          { ...entry, ...file },
          getRequirementFileUrl(entry, index)
        ]))
      .filter(([submissionId, entry, fileUrl]) => (
        submissionId && entry?.hasUpload === true && Boolean(fileUrl)
      ));

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
        notify('coach-error', 'Preview Unavailable', `${entry.fileName || 'Document'} could not be previewed.`);
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
  }, [notify, previewEntriesKey]);

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

  // Filter students based on search query and filters
  const filteredStudents = students.filter((student) => {
    const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
    const matchesSearch = String(student.name || '').toLocaleLowerCase().includes(normalizedSearchQuery);
    const matchesDept = departmentFilter === 'All'
      || normalizeDepartment(student.department) === normalizeDepartment(departmentFilter);
    const matchesSport = sportFilter === 'All'
      || getStudentSportValues(student)
        .some((sport) => normalizeSportValue(sport) === normalizeSportValue(sportFilter));
    const matchesYear = yearLevelFilter === 'All'
      || normalizeYearLevel(student.yearLevel) === normalizeYearLevel(yearLevelFilter);
    
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

  const renderOverallStatusBadge = (status) => {
    if (status === 'Approved') return <span className="badge badge-completed">Approved</span>;
    return renderStatusBadge(status);
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
      await markResubmissionViewed(entry.submissionId, entry.participationType || 'Intrams');
    }
    try {
      const files = entry?.files?.length
        ? entry.files
        : [{ fileName: entry?.fileName || fallbackName, fileType: entry?.fileType || '', fileUrl: getRequirementFileUrl(entry) }];
      const fileUrl = getRequirementFileUrl(entry, 0);
      const attachmentUrl = fileUrl
        ? await loadAttachmentBlobUrl(fileUrl)
        : fallbackSrc;
      setViewerSrc(attachmentUrl);
      setViewerFiles(files);
      setViewerFileIndex(0);
      setViewerName(files[0]?.fileName || fallbackName);
      setViewerType(files[0]?.fileType || entry?.fileType || '');
      setViewerOpen(true);
    } catch (error) {
      notify('coach-error', 'Unable to open file', error.message);
      return;
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
      notify('coach-error', 'Unable to open file', error.message);
    } finally {
      setViewerNavigationLoading(false);
    }
  };

  const handleDownloadRequirement = async (entry, fileIndex, file) => {
    const key = `${entry.submissionId}:${fileIndex}`;
    setDownloadingFileKey(key);
    try {
      await api.downloadCoachRequirement(
        entry.submissionId,
        file?.fileName || entry.fileName || 'requirement',
        entry.participationType || 'Intrams',
        fileIndex
      );
      notify('coach-success', 'Download Started', `${getDisplayFileName(file?.fileName || entry.fileName)} is ready.`);
    } catch (error) {
      notify('coach-error', 'Download Failed', error.message || 'Unable to download this document.');
    } finally {
      setDownloadingFileKey('');
    }
  };

  // --- VIEW 1: REQUIREMENTS SCREENING PORTAL DASHBOARD LIST ---
  if (!authReady) return authError ? <PortalSessionError /> : null;

  if (currentView === 'list') {
    return (
      <div className="screener-container">
        <header className="screener-header">
          <div className="header-left">
            <div className="header-title-row">
              <h1>Document Screening</h1>
              {resubmissionCount > 0 && (
                <span className="header-badge" title="Resubmitted requirement(s) awaiting review">{resubmissionCount}</span>
              )}
            </div>
            <p>Review submitted student-athlete requirements assigned to your sports.</p>
          </div>
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
            <label>Program:</label>
            <select 
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
            >
              <option value="All">All</option>
              {departmentFilterOptions.map((department) => (
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

        </div>

        {loading ? (
          <div className="loading-state">Loading submitted requirements…</div>
        ) : filteredStudents.length === 0 ? (
          <div className="loading-state">No student requirements match your assigned sports.</div>
        ) : (
          <div className="table-container">
            <table className="screener-table">
              <thead>
                <tr>
                  <th>Athlete Name</th>
                  <th>Program</th>
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
                    <td>{renderOverallStatusBadge(student.overallStatus)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // --- VIEW 2: VIEW STUDENT ATHLETE REQUIREMENTS MAIN GRID ---
  if (currentView === 'view-details' && selectedStudent) {
    const requirementDocuments = (selectedStudent.requirements?.documents || [])
      .filter((entry) => entry?.submissionId && entry.hasUpload === true);
    const standardRequirementKeys = new Set(requirementsTemplates.map((req) => req.id === 'med' ? 'med' : req.id));
    const requirementCards = requirementsTemplates.flatMap((req) => {
      const requirementKey = req.id === 'med' ? 'med' : req.id;
      const entries = requirementDocuments
        .filter((entry) => (entry.requirementType === 'medical' ? 'med' : entry.requirementType) === requirementKey);

      return entries.map((entry) => ({
        ...req,
        entry,
        cardKey: entry.submissionId,
        viewerName: entry?.fileName || req.title,
        previewUrl: previewUrls[getRequirementPreviewKey(entry)] || ''
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
        previewUrl: previewUrls[getRequirementPreviewKey(entry)] || ''
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
                <div className={`document-preview-box${getRequirementFileUrl(req.entry) ? '' : ' document-preview-box--empty'}`}>
                  {getRequirementFileUrl(req.entry) ? (
                    <>
                      {req.previewUrl && isImageFile(req.entry) && (
                        !previewErrors[getRequirementPreviewKey(req.entry)] && (
                          <img
                            src={req.previewUrl}
                            alt={req.entry.fileName || req.title}
                            className="document-img"
                            onError={() => setPreviewErrors((current) => ({
                              ...current,
                              [getRequirementPreviewKey(req.entry)]: true
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
                      {!req.previewUrl && previewLoading[getRequirementPreviewKey(req.entry)] && (
                        <span className="document-loading-label">Loading document...</span>
                      )}
                      {req.previewUrl && isImageFile(req.entry) && !previewErrors[getRequirementPreviewKey(req.entry)] && (
                        <div className="document-file-label">{getDisplayFileName(req.entry.fileName)}</div>
                      )}
                      {(!req.previewUrl || previewErrors[getRequirementPreviewKey(req.entry)] || (!isImageFile(req.entry) && !isPdfFile(req.entry)))
                        && !previewLoading[getRequirementPreviewKey(req.entry)] && (
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
                  <>
                    <div className="document-download-list" aria-label={`Download files for ${req.title}`}>
                      {(req.entry.files?.length ? req.entry.files : [{ fileName: req.entry.fileName }]).map((file, fileIndex) => {
                        const downloadKey = `${req.entry.submissionId}:${fileIndex}`;
                        return (
                          <button
                            key={downloadKey}
                            type="button"
                            className="document-download-btn"
                            onClick={() => handleDownloadRequirement(req.entry, fileIndex, file)}
                            disabled={downloadingFileKey === downloadKey}
                          >
                            {downloadingFileKey === downloadKey ? 'Downloading…' : `Download ${getDisplayFileName(file.fileName, `File ${fileIndex + 1}`)}`}
                          </button>
                        );
                      })}
                    </div>
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
                  </>
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
              const submission = selectedStudent?.requirements?.documents?.find((entry) => entry.submissionId === submissionId);
              const reviewParticipationType = submission?.participationType || 'Intrams';
              await api.reviewCoachRequirement(submissionId, {
                status: 'approved',
                feedback: 'Approved by coach',
                participationType: reviewParticipationType,
                studentId: selectedStudent?.id
              });
              await markResubmissionViewed(submissionId, reviewParticipationType);
              setRequirementStatus((s) => ({ ...s, [submissionId]: 'approved' }));
              notify('coach-success', 'Requirement Approved', 'Requirement is complete.');
              setApproveTarget(null);
              try {
                localStorage.setItem('gymstat-requirement-updated', String(Date.now()));
              } catch (error) {
                console.warn('Unable to broadcast requirement update', error);
              }
              const response = await api.getCoachDocumentRequirements();
              const data = response?.data || [];
              setStudents(data);
              const refreshedSelectedStudent = data.find((student) => student.id === selectedStudent?.id) || null;
              setSelectedStudent(refreshedSelectedStudent);
            } catch (err) {
              notify('coach-error', 'Approval Failed', err.message || 'Failed to approve requirement.');
            }
          }}
        />

        <RejectModal
          isOpen={!!rejectTarget}
          onCancel={() => setRejectTarget(null)}
          onConfirm={async (payload) => {
            try {
              const submissionId = rejectTarget;
              const submission = selectedStudent?.requirements?.documents?.find((entry) => entry.submissionId === submissionId);
              const reviewParticipationType = submission?.participationType || 'Intrams';
              await api.reviewCoachRequirement(submissionId, {
                status: 'rejected',
                feedback: payload.reason,
                remarks: payload.remarks,
                studentId: selectedStudent?.id,
                participationType: reviewParticipationType
              });
              setRejectTarget(null);
              setRequirementStatus((s) => ({ ...s, [submissionId]: 'removed' }));
              const message = `Requirement rejected and retained for re-upload. Reason: ${payload.reason}${payload.remarks ? ' — ' + payload.remarks : ''}`;
              notify('coach-error', 'Requirement Rejected', message);
              try {
                localStorage.setItem('gymstat-requirement-updated', String(Date.now()));
              } catch (error) {
                console.warn('Unable to broadcast requirement update', error);
              }
              const response = await api.getCoachDocumentRequirements();
              const data = response?.data || [];
              setStudents(data);
              const refreshedSelectedStudent = data.find((student) => student.id === selectedStudent?.id) || null;
              setSelectedStudent(refreshedSelectedStudent);
            } catch (err) {
              notify('coach-error', 'Rejection Failed', err.message || 'Failed to reject requirement.');
            }
          }}
        />
        <DocumentViewer
          key={viewerOpen ? 'screener-viewer' : 'closed'}
          isOpen={viewerOpen}
          src={viewerSrc}
          fileName={viewerName}
          fileType={viewerType}
          onClose={() => {
            if (viewerSrc?.startsWith('blob:')) URL.revokeObjectURL(viewerSrc);
            setViewerOpen(false);
            setViewerSrc(null);
            setViewerName(null);
            setViewerType('');
            setViewerFiles([]);
            setViewerFileIndex(0);
          }}
          navigationVisible={viewerFiles.length > 1}
          navigationLabel={`${viewerFileIndex + 1} / ${viewerFiles.length}`}
          navigationLoading={viewerNavigationLoading}
          onPrevious={() => handleViewerNavigation(-1)}
          onNext={() => handleViewerNavigation(1)}
        />
      </div>
    );
  }
};

const ScreenerPage = () => {
  const { authReady, authError } = usePortalSession(['screener', 'admin'], 'Screener');
  if (!authReady) return authError ? <PortalSessionError /> : null;

  return (
    <div className="screener-container">
      <header className="screener-header">
        <div className="header-left">
          <h1>Student Document Screening</h1>
          <p>Student-athlete document screening is now handled in the Coach Portal.</p>
        </div>
      </header>
    </div>
  );
};

export default ScreenerPage;