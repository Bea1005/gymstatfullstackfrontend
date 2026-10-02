import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import LogoutConfirmModal from '../../components/LogoutConfirmModal';
import ConfirmModal from '../../components/ConfirmModal';
import NotificationToast from '../../components/NotificationToast';
import Icon from '../../components/Icon';
import logoImage from '../../assets/logo.png';
import marsuSeal from '../../assets/MarsuLogo.jpg';
// Header logos (uploaded by the user):
//   logoRegion.png -> STRASUC / SCUAA Region IV-A & B circular seal (header, top-left)
//   SCUAA_logo.png -> SCUAA emblem + wordmark, already combined (header, top-right)
import logoRegion from '../../assets/logo region.png';
import scuaaLogo from '../../assets/SCUAA logo.png';
import completedStamp from '../../assets/GymstatStamps/Completed.png';
import incompleteStamp from '../../assets/GymstatStamps/Incomplete.png';
import disqualifiedStamp from '../../assets/GymstatStamps/Disqualified.png';
import noDocumentsStamp from '../../assets/GymstatStamps/NoDocuments.png';
import * as api from '../../services/api';
import './CoachPortal.css';

const CAMPUS_OPTIONS = ['', 'Boac Main', 'Santa Cruz', 'Gasan', 'Torrijos'];

// Both header logos now use the real uploaded assets — see imports above.

const placeholderImg = logoImage;
const formatDateOfBirth = (value) => {
  if (!value) return '';
  const dateText = String(value).trim();
  const dateOnly = dateText.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  const date = dateOnly ? new Date(`${dateOnly}T00:00:00`) : new Date(dateText);
  return Number.isNaN(date.getTime())
    ? dateText
    : date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

const sportCategoryOptions = [
  'Volleyball Women',
  'Volleyball Men',
  'Basketball Women',
  'Basketball Men',
  'Beach Volleyball Women',
  'Beach Volleyball Men',
  'Badminton Women',
  'Badminton Men',
  'Table Tennis Women',
  'Table Tennis Men',
  'Lawn Tennis Women',
  'Lawn Tennis Men',
  'Sepak Takraw Women',
  'Sepak Takraw Men',
  'Athletics Women',
  'Athletics Men',
  'Swimming Women',
  'Swimming Men',
  'Chess Women',
  'Chess Men',
  'Taekwondo Women',
  'Taekwondo Men',
  'Arnis Women',
  'Arnis Men',
  'Dancesport',
  'Futsal Women',
  'Futsal Men',
  'Football Women',
  'Football Men',
  'Softball Women',
  'Softball Men',
  'Mobile Legends Women',
  'Mobile Legends Men',
];

const DEFAULT_STAFF_ROLES = ['COACH', 'ASST. COACH', 'TRAINER', 'CHAPERONE', 'OTHER FACULTY'];

const createDefaultStaffMember = (role = 'COACH') => ({
  role: String(role).toUpperCase(),
  fullname: '',
  age: '',
  phone: '',
  email: '',
  photo: '',
});

const normalizeStaffMembers = (members = []) => {
  const list = Array.isArray(members) ? members : [];
  const normalized = [];
  const seen = new Set();

  for (const role of DEFAULT_STAFF_ROLES) {
    const existing = list.find((member) => String(member?.role || '').toUpperCase() === role);
    if (!existing) {
      const defaultMember = createDefaultStaffMember(role);
      normalized.push(defaultMember);
      seen.add(role);
      continue;
    }

    const nextMember = { ...createDefaultStaffMember(role), ...existing, role };
    normalized.push(nextMember);
    seen.add(role);
  }

  const extraMembers = list.filter((member) => {
    const role = String(member?.role || '').toUpperCase();
    return role && !seen.has(role);
  }).map((member) => ({
    ...createDefaultStaffMember(String(member?.role || 'OTHER FACULTY')),
    ...member,
    role: String(member?.role || 'OTHER FACULTY').toUpperCase(),
  }));

  return [...normalized, ...extraMembers];
};

const normalizeAthleteStatus = (status) => {
  const normalizedStatus = String(status || 'no-documents').toLowerCase().replace(/\s+/g, '-');
  const statusAliases = {
    completed: 'complete',
    approved: 'complete',
    rejected: 'incomplete',
    incompleted: 'incomplete',
  };
  return statusAliases[normalizedStatus] || normalizedStatus;
};

const getAthleteStatusBadge = (status) => {
  const normalizedStatus = normalizeAthleteStatus(status);
  const badges = {
    complete: { label: 'Complete', src: completedStamp },
    incomplete: { label: 'Incomplete', src: incompleteStamp },
    disqualified: { label: 'Disqualified', src: disqualifiedStamp },
    'no-documents': { label: 'No Documents', src: noDocumentsStamp },
  };
  return badges[normalizedStatus] || badges['no-documents'];
};

// Total athlete slots reproduced from the reference form:
//   - 12 slots across the first bordered gallery box (2 rows x 6 columns)
//   - 1 real slot + 5 "not applicable" (X) slots in the second box
const BOX_ONE_SLOTS = 12;
const BOX_ONE_COLS = 6;
const BOX_TWO_ATHLETE_SLOTS = 6; // 1 usable + 5 shown as "X" in the reference

const EditIcon = ({ size = 14, color = '#7b1e1e' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 16 16">
    <path
      fill={color}
      d="M12.6 0c.703 0 1.37.275 1.86.772l.751.751c.497.497.772 1.16.772 1.86c0 .703-.275 1.37-.771 1.86l-10.5 10.6a.5.5 0 0 1-.355.148H.487a.5.5 0 0 1-.5-.5v-3.75a.5.5 0 0 1 .146-.353l10.6-10.6a2.62 2.62 0 0 1 1.86-.772zM9.73 3.2L.99 11.96V15h3.16l8.65-8.73zM12.6 1c-.438 0-.847.17-1.16.48l-1.01 1.01l3.07 3.07l1.01-1.01c.271-.272.435-.619.472-.995l.008-.163c0-.437-.17-.847-.48-1.16l-.75-.75a1.62 1.62 0 0 0-1.16-.48z"
    />
  </svg>
);
const RemoveIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d="M3 4.25h10M6 2.25h4l.75 2H5.25l.75-2ZM4.25 4.25l.5 9.25h6.5l.5-9.25M6.5 6.25v5M9.5 6.25v5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function CoachRecord() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [coachProfile, setCoachProfile] = useState({
    fullname: 'DR. CHRISTOPHER J. REBISTUAL',
    email: 'rebistual.christopher@marsu.edu.ph',
    phone: '09277692943',
    mainSport: '',
    position: 'Coach',
    photo: placeholderImg,
  });

  const [eventMeta, setEventMeta] = useState({
    title: 'STRASUC OLYMPICS 2025',
    schedule: 'November 22-29, 2025 - MARSU, Boac, Marinduque',
    institution: 'MARINDUQUE STATE UNIVERSITY',
  });

  const [athletes, setAthletes] = useState([]);
  const [studentDirectorySearch, setStudentDirectorySearch] = useState('');
  const [studentSearchResults, setStudentSearchResults] = useState([]);
  const [studentSearchLoading, setStudentSearchLoading] = useState(false);
  const [studentSearchError, setStudentSearchError] = useState('');
  const studentSearchCacheRef = useRef(new Map());
  const studentSearchInFlightRef = useRef(new Map());
  const studentSearchRequestRef = useRef(0);
  const athleteCacheRef = useRef(new Map());
  const athleteRequestRef = useRef(new Map());
  const studentPhotoCacheRef = useRef(new Map());
  const activeSportRef = useRef('');
  const [announcements, setAnnouncements] = useState([]);
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const [editingAthlete, setEditingAthlete] = useState(null);
  const [isAddingAthlete, setIsAddingAthlete] = useState(false);
  const [hasActivatedGrid, setHasActivatedGrid] = useState(false);
  const [editingEvent, setEditingEvent] = useState(false);
  const [editingEligibility, setEditingEligibility] = useState(false);
  const [editingDirector, setEditingDirector] = useState(false);
  const [showSportDropdown, setShowSportDropdown] = useState(false);

  const [eligibilityRequirements, setEligibilityRequirements] = useState({
    notes:
      `1.) Official Transcript of Records (TOR) with:\n` +
      `a.) complete scholastic record of athlete.\n` +
      `b.) subjects and grades of 2nd Sem SY 2024-2025.\n` +
      `c.) subjects enrolled for 1st Sem, SY 2025-2026.\n` +
      `d.) scanned Picture of student.\n` +
      `e.) School Dry Seal\n\n` +
      `2.) SCUAA Games Form Numbers: 1, 2, 3.\n` +
      `3.) PSA Birth Certificate\n` +
      `4.) CMO. 63-Certificate of Compliance from HEI.`,
  });

  const [directorInfo, setDirectorInfo] = useState({
    eventLabel: 'STRASUC Olympics 2025',
    name: 'GERALD M. PAJANUSTAN, PhD',
    title: 'SPORTS DIRECTOR',
  });

  const [staff, setStaff] = useState([
    {
      role: 'COACH',
      fullname: 'DR. CHRISTOPHER J. REBISTUAL',
      age: '',
      phone: '09277692943',
      email: 'rebistual.christopher@marsu.edu.ph',
      photo: placeholderImg,
    },
    { role: 'ASST. COACH', fullname: '', age: '', phone: '', email: '', photo: placeholderImg },
    { role: 'TRAINER', fullname: '', age: '', phone: '', email: '', photo: placeholderImg },
    { role: 'CHAPERONE', fullname: '', age: '', phone: '', email: '', photo: placeholderImg },
    { role: 'OTHER FACULTY', fullname: '', age: '', phone: '', email: '', photo: placeholderImg },
  ]);

  const [eligibilityForm, setEligibilityForm] = useState({ notes: '' });
  const [directorForm, setDirectorForm] = useState({ eventLabel: '', name: '', title: '' });
  const [editingStaffIndex, setEditingStaffIndex] = useState(null);
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [staffForm, setStaffForm] = useState({ role: 'CHAPERONE', fullname: '', age: '', phone: '', email: '', photo: placeholderImg });
  const [selectedStaffFile, setSelectedStaffFile] = useState(null);
  const [viewingFacultyMember, setViewingFacultyMember] = useState(null);

  const [editForm, setEditForm] = useState({
    fullname: '',
    dob: '',
    course: '',
    location: '',
    email: '',
    sport: '',
    status: 'incomplete',
    photo: placeholderImg,
  });
  const [isDobEditing, setIsDobEditing] = useState(false);

  const [eventForm, setEventForm] = useState({ title: '', schedule: '', institution: '' });

  const [loading, setLoading] = useState(true);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState({ type: null, id: null, name: '' });
  const staffSaveInProgressRef = useRef(false);

  useEffect(() => {
    fetchCoachData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const normalizeCoachAthletes = (athletesData, selectedSport) => (
    Array.isArray(athletesData)
      ? athletesData.map((athlete) => ({
          id: athlete._id || athlete.studentId || athlete.id,
          userId: athlete._id || athlete.studentId || athlete.id,
          fullname: athlete.fullname || '',
          email: athlete.email || '',
          course: [athlete.department, athlete.yearLevel].filter(Boolean).join(' - '),
          sport: athlete.sport || selectedSport || '',
          location: athlete.branchCampus || '',
          dob: athlete.dateOfBirth || athlete.dob || '',
          photo: '',
          profilePhotoUrl: athlete.profilePhotoUrl || '',
          status: normalizeAthleteStatus(athlete.athleteStatus || athlete.status),
          missingRequirements: [],
          requirementsLoading: true,
          requirementsError: '',
        }))
      : []
  );

  const loadStudentPhoto = (photoUrl) => {
    if (!photoUrl) return Promise.resolve('');
    if (!studentPhotoCacheRef.current.has(photoUrl)) {
      const request = api.getProtectedImageObjectUrl(photoUrl).catch(() => {
        studentPhotoCacheRef.current.delete(photoUrl);
        return '';
      });
      studentPhotoCacheRef.current.set(photoUrl, request);
    }
    return studentPhotoCacheRef.current.get(photoUrl);
  };

  const loadStudentSearchDirectory = (sport) => {
    const selectedSport = String(sport || '').trim();
    if (!selectedSport) return Promise.resolve([]);

    const cachedResults = studentSearchCacheRef.current.get(selectedSport);
    if (cachedResults) return Promise.resolve(cachedResults);

    const existingRequest = studentSearchInFlightRef.current.get(selectedSport);
    if (existingRequest) return existingRequest;

    const request = api.searchCoachStudents('', selectedSport)
      .then((results) => (Array.isArray(results) ? results : []))
      .then((results) => {
        studentSearchCacheRef.current.set(selectedSport, results);
        return results;
      })
      .finally(() => studentSearchInFlightRef.current.delete(selectedSport));

    studentSearchInFlightRef.current.set(selectedSport, request);
    return request;
  };

  const getStudentSearchResults = async (query, sport) => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];
    const directory = await loadStudentSearchDirectory(sport);
    return directory.filter((student) => {
      const studentIdentifiers = [student?.id, student?._id]
        .map((value) => String(value || '').toLowerCase());
      const studentName = String(student?.fullname || '').toLowerCase();
      return studentIdentifiers.some((studentId) => studentId.includes(normalizedQuery))
        || studentName.includes(normalizedQuery);
    });
  };

  const hydrateAthletePhotos = async (sport, athleteList) => {
    const hydratedEntries = await Promise.all(athleteList.map(async (athlete) => {
      const studentId = String(athlete.userId || athlete.id);
      try {
        const requirementState = await api.getCoachStudentRequirements(studentId);
        if (!Array.isArray(requirementState?.missingDocuments)) {
          throw new Error('Invalid student requirement response');
        }
        const missingRequirements = requirementState.missingDocuments;
        const photo = missingRequirements.length ? '' : await loadStudentPhoto(athlete.profilePhotoUrl);
        return [studentId, { photo, missingRequirements, requirementsLoading: false, requirementsError: '' }];
      } catch (error) {
        const errorMessages = {
          401: 'Session expired',
          403: 'Not authorized',
          404: 'Requirements route unavailable',
          500: 'Requirement check failed',
        };
        const errorLabel = errorMessages[error?.status] || 'Requirements unavailable';
        return [studentId, { photo: '', missingRequirements: [], requirementsLoading: false, requirementsError: errorLabel }];
      }
    }));
    const hydratedByStudentId = new Map(hydratedEntries);
    const withRequirements = (athletesToUpdate) => athletesToUpdate.map((athlete) => ({
      ...athlete,
      ...(hydratedByStudentId.get(String(athlete.userId || athlete.id)) || {}),
    }));

    const cachedAthletes = athleteCacheRef.current.get(sport) || athleteList;
    athleteCacheRef.current.set(sport, withRequirements(cachedAthletes));
    if (activeSportRef.current === sport) {
      setAthletes((currentAthletes) => withRequirements(currentAthletes));
    }
  };

  const refreshAthletesForSport = async (selectedSport) => {
    if (athleteRequestRef.current.has(selectedSport)) {
      return athleteRequestRef.current.get(selectedSport);
    }

    const request = api.getCoachAthletes(selectedSport)
      .then((athletesData) => {
        const normalizedAthletes = normalizeCoachAthletes(athletesData, selectedSport);
        athleteCacheRef.current.set(selectedSport, normalizedAthletes);
        void hydrateAthletePhotos(selectedSport, normalizedAthletes);
        return normalizedAthletes;
      })
      .finally(() => athleteRequestRef.current.delete(selectedSport));

    athleteRequestRef.current.set(selectedSport, request);
    return request;
  };

  const fetchCoachData = async (requestedSport) => {
    try {
      if (requestedSport) setCategoryLoading(true);
      else setLoading(true);

      const profileData = await api.getCoachProfile().catch(() => null);
      const selectedSport = String(
        requestedSport || activeSportRef.current || profileData?.mainSport || ''
      ).trim();
      activeSportRef.current = selectedSport;
      setCoachProfile((prev) => ({
        ...prev,
        fullname: profileData?.fullname || prev.fullname,
        email: profileData?.email || prev.email,
        mainSport: selectedSport,
        position: profileData?.position || prev.position,
        phone: profileData?.phone || prev.phone || '09277692943',
        photo: profileData?.photo || prev.photo,
      }));
      if (selectedSport) void loadStudentSearchDirectory(selectedSport).catch(() => {});

      const [athletesData, updatesData, facultyData] = await Promise.all([
        selectedSport ? api.getCoachAthletes(selectedSport).catch(() => []) : Promise.resolve([]),
        api.getCoachUpdates().catch(() => []),
        api.getFacultyMembers().catch(() => []),
      ]);

      if (profileData) {
        setStaff((prev) => {
          const next = [...prev];
          next[0] = {
            ...next[0],
            fullname: profileData.fullname || next[0].fullname,
            phone: profileData.phone || next[0].phone,
            email: profileData.email || next[0].email,
            photo: profileData.photo || next[0].photo,
          };
          return next;
        });
        if (!Array.isArray(facultyData) && Array.isArray(profileData.staffMembers)) {
          setStaff(normalizeStaffMembers(profileData.staffMembers));
        }
      }

      const normalizedAthletes = normalizeCoachAthletes(athletesData, selectedSport);
      if (selectedSport) athleteCacheRef.current.set(selectedSport, normalizedAthletes);
      setAthletes(normalizedAthletes);
      setHasActivatedGrid(
        normalizedAthletes.length > 0
        || Boolean(facultyData.some?.((member) => member.fullname || member.phone || member.email))
        || Boolean(profileData?.staffMembers?.some((member) => member.fullname || member.phone || member.email))
      );
      if (selectedSport) void hydrateAthletePhotos(selectedSport, normalizedAthletes);

      const normalizedFaculty = Array.isArray(facultyData)
        ? await Promise.all(facultyData.map(async (member) => {
            let photo = '';
            if (member.profilePhotoUrl) {
              try {
                photo = await api.getProtectedImageObjectUrl(member.profilePhotoUrl);
              } catch {
                photo = '';
              }
            }
            return { ...member, photo };
          }))
        : [];
      if (Array.isArray(facultyData)) setStaff(normalizeStaffMembers(normalizedFaculty));

      const normalizedUpdates = Array.isArray(updatesData)
        ? updatesData.map((update) => ({
            ...update,
            read: false,
            description: update.description || `Please review ${update.title} for the upcoming sports activities.`,
          }))
        : [];

      setAnnouncements(normalizedUpdates);
    } catch (error) {
      console.error('Failed to fetch coach data:', error);
      setToast({ message: 'Unable to load coach data right now.', type: 'error' });
    } finally {
      setLoading(false);
      setCategoryLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    let refreshInFlight = false;
    let lastRefreshAt = Date.now();
    const refreshIntervalMs = 30 * 1000;

    const refreshAthleteStatuses = async () => {
      if (cancelled || document.hidden || refreshInFlight || Date.now() - lastRefreshAt < refreshIntervalMs) return;
      refreshInFlight = true;
      lastRefreshAt = Date.now();

      try {
        const latestAthletes = await api.getCoachAthletes(coachProfile.mainSport).catch(() => []);
        if (cancelled || !Array.isArray(latestAthletes)) return;

        const normalizedLatestAthletes = normalizeCoachAthletes(latestAthletes, coachProfile.mainSport);
        await hydrateAthletePhotos(coachProfile.mainSport, normalizedLatestAthletes);
        const latestAthletesById = new Map(normalizedLatestAthletes
          .map((athlete) => [String(athlete.userId || athlete.id), athlete]));

        setAthletes((currentAthletes) => currentAthletes.map((athlete) => {
          const studentId = String(athlete.userId || athlete.id);
          const latestAthlete = latestAthletesById.get(studentId);
          if (!latestAthlete) return athlete;
          return {
            ...athlete,
            fullname: latestAthlete.fullname,
            dob: latestAthlete.dob,
            course: latestAthlete.course,
            location: latestAthlete.location,
            sport: latestAthlete.sport,
            status: latestAthlete.status,
          };
        }));
      } finally {
        refreshInFlight = false;
      }
    };

    window.addEventListener('focus', refreshAthleteStatuses);
    document.addEventListener('visibilitychange', refreshAthleteStatuses);
    const refreshTimer = window.setInterval(refreshAthleteStatuses, refreshIntervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
      window.removeEventListener('focus', refreshAthleteStatuses);
      document.removeEventListener('visibilitychange', refreshAthleteStatuses);
    };
  }, [coachProfile.mainSport]);

  // ---------------- File upload ----------------
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setToast({ message: 'Please upload a valid image (JPG, JPEG, PNG, WebP).', type: 'error' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setToast({ message: 'Image size should be less than 5MB.', type: 'error' });
      return;
    }
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleStaffFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setToast({ message: 'Please upload a valid image (JPG, JPEG, PNG, WebP).', type: 'error' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setToast({ message: 'Image size should be less than 5MB.', type: 'error' });
      return;
    }
    setSelectedStaffFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setStaffForm((current) => ({ ...current, photo: reader.result }));
    reader.readAsDataURL(file);
  };

  // ---------------- Download report ----------------
  const handleDownloadReport = async () => {
    let exportRoot;
    let form;
    try {
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;
      form = document.querySelector('.strasuc-form-page');
      if (!form) throw new Error('The student-athlete form is unavailable.');

      const sourceBoxes = Array.from(form.querySelectorAll(':scope > .form-grid-box'));
      const athleteBox = sourceBoxes[0];
      const sourceAthleteCards = Array.from(
        athleteBox?.querySelectorAll('.form-grid-row:not(.staff-grid-row) > .grid-col') || [],
      ).slice(0, 5);
      const athleteTemplate = sourceAthleteCards[0];
      const facultySourceBox = sourceBoxes[1];
      const facultySourceRow = facultySourceBox?.querySelector('.staff-grid-row');
      const facultyLogoTemplate = facultySourceRow?.querySelector('.grid-logo-col');
      const facultyCardTemplate = facultySourceRow?.querySelector('.grid-col:not(.staff-add-col):not(.grid-placeholder-col)') || athleteTemplate;
      const eligibilityTemplate = facultySourceBox?.querySelector('.grid-freeform-col.eligibility-col');
      const directorTemplate = facultySourceBox?.querySelector('.grid-freeform-col.director-col');
      const athleteChunks = [];
      for (let index = 0; index < athletes.length; index += 10) athleteChunks.push(athletes.slice(index, index + 10));
      if (athleteChunks.length === 0) athleteChunks.push([]);
      const facultyPageMembers = staff.slice(0, 5);
      const additionalAthleteChunks = [athletes.slice(0, 10), athletes.slice(10, 15)];
      for (let index = 15; index < athletes.length; index += 10) {
        additionalAthleteChunks.push(athletes.slice(index, index + 10));
      }
      const totalPages = additionalAthleteChunks.length;

      const createAthleteCard = (template, athlete) => {
        const card = (template || athleteTemplate)?.cloneNode(true);
        if (!card) return null;
        card.querySelectorAll('.cell-plus, .grid-remove-btn, .edit-icon-btn, .freeform-edit-icon').forEach((control) => control.remove());
        const photo = card.querySelector('.col-photo');
        const statusBadge = getAthleteStatusBadge(athlete.status);
        const badgeElement = photo?.querySelector('.athlete-status-badge') || document.createElement('img');
        badgeElement.className = 'athlete-status-badge';
        badgeElement.src = statusBadge.src;
        badgeElement.alt = statusBadge.label;
        badgeElement.setAttribute('aria-label', `Status: ${statusBadge.label}`);
        badgeElement.title = `Status: ${statusBadge.label}`;
        photo?.querySelectorAll('img:not(.grid-status-stamp):not(.athlete-status-badge)').forEach((image) => image.remove());
        if (athlete.photo && photo) {
          const image = document.createElement('img');
          image.src = athlete.photo;
          image.alt = athlete.fullname || 'Student athlete';
          photo.insertBefore(image, badgeElement);
        } else if (photo) {
          const emptyMark = document.createElement('span');
          emptyMark.className = 'cell-x';
          emptyMark.textContent = 'X';
          photo.appendChild(emptyMark);
        }
        photo?.appendChild(badgeElement);
        const infoRows = card.querySelectorAll('.col-info-row');
        const values = [
          athlete.fullname || '',
          formatDateOfBirth(athlete.dob),
          athlete.course || '',
          athlete.location || '',
        ];
        values.forEach((value, index) => {
          if (infoRows[index]) {
            infoRows[index].textContent = value;
            infoRows[index].setAttribute('title', value);
          }
        });
        return card;
      };

      const createEmptyAthleteCard = () => {
        const card = athleteTemplate?.cloneNode(true);
        if (!card) return null;
        card.classList.remove('clickable-col');
        card.querySelectorAll('.cell-plus, .grid-remove-btn, .edit-icon-btn, .freeform-edit-icon, .grid-status-stamp, .athlete-status-badge').forEach((control) => control.remove());
        card.querySelectorAll('.col-info-row').forEach((row) => {
          row.textContent = '';
          row.removeAttribute('title');
        });
        const photo = card.querySelector('.col-photo');
        photo?.querySelectorAll('img').forEach((image) => image.remove());
        const emptyMark = document.createElement('span');
        emptyMark.className = 'cell-x';
        emptyMark.textContent = 'X';
        photo?.appendChild(emptyMark);
        return card;
      };

      const createFacultyCard = (template, member) => {
        const card = template?.cloneNode(true);
        if (!card) return null;
        card.classList.remove('clickable-col');
        card.querySelectorAll('.cell-plus, .grid-remove-btn, .edit-icon-btn, .freeform-edit-icon, .faculty-photo-viewer-trigger, .athlete-status-badge').forEach((control) => control.remove());
        const label = card.querySelector('.col-label');
        const infoRows = card.querySelectorAll('.col-info-row');
        if (label) label.textContent = member?.role || 'FACULTY';
        [member?.fullname, member?.age, member?.phone, member?.email].forEach((value, index) => {
          if (infoRows[index]) infoRows[index].textContent = value || '';
        });
        const photo = card.querySelector('.col-photo');
        photo?.querySelectorAll('img').forEach((image) => image.remove());
        if (member?.photo) {
          const image = document.createElement('img');
          image.src = member.photo;
          image.alt = member.fullname || member.role || 'Faculty member';
          photo?.appendChild(image);
        } else {
          const emptyMark = document.createElement('span');
          emptyMark.className = 'cell-x';
          emptyMark.textContent = 'X';
          photo?.appendChild(emptyMark);
        }
        return card;
      };

      const createFacultyRow = (members) => {
        const row = facultySourceRow?.cloneNode(false) || document.createElement('div');
        row.className = 'form-grid-row staff-grid-row';
        const logo = facultyLogoTemplate?.cloneNode(true);
        if (logo) row.appendChild(logo);
        for (let index = 0; index < 5; index += 1) {
          row.appendChild(createFacultyCard(facultyCardTemplate, members[index] || null));
        }
        if (eligibilityTemplate) row.appendChild(eligibilityTemplate.cloneNode(true));
        if (directorTemplate) row.appendChild(directorTemplate.cloneNode(true));
        return row;
      };

      exportRoot = document.createElement('div');
      exportRoot.className = 'coach-pdf-export-root';
      exportRoot.style.width = `${Math.max(form.getBoundingClientRect().width, 1800)}px`;
      document.body.appendChild(exportRoot);

      const doc = new jsPDF({ orientation: 'landscape', unit: 'in', format: [13, 8.5] });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const pageMargin = 0.08;
      const waitForImages = async (element) => {
        await Promise.all(Array.from(element.querySelectorAll('img')).map((image) => (
          image.complete ? Promise.resolve() : new Promise((resolve) => {
            image.addEventListener('load', resolve, { once: true });
            image.addEventListener('error', resolve, { once: true });
          })
        )));
      };

      for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
        const page = form.cloneNode(true);
        page.classList.add('coach-pdf-export');
        page.style.width = exportRoot.style.width;
        const pageBoxes = Array.from(page.querySelectorAll(':scope > .form-grid-box'));
        const pageAthleteBox = pageBoxes[0];
        const sourceRows = pageAthleteBox ? Array.from(pageAthleteBox.querySelectorAll(':scope > .form-grid-row')) : [];
        const sourceLogo = sourceRows[0]?.querySelector('.grid-logo-col');
        const cards = additionalAthleteChunks[pageIndex] || [];
        const isFacultyPage = pageIndex === 1;

        sourceRows.forEach((row) => {
          row.replaceChildren(sourceLogo?.cloneNode(true));
        });
        cards.forEach((athlete, cardIndex) => {
          const row = sourceRows[Math.floor(cardIndex / 5)];
          const card = createAthleteCard(sourceAthleteCards[cardIndex % 5], athlete);
          if (row && card) row.appendChild(card);
        });
        if (isFacultyPage) {
          const athleteRow = sourceRows[0];
          while (athleteRow?.querySelectorAll(':scope > .grid-col').length < 5) athleteRow.appendChild(createEmptyAthleteCard());
          sourceRows[1]?.replaceWith(createFacultyRow(facultyPageMembers));
        } else {
          sourceRows.forEach((row) => {
            while (row.querySelectorAll(':scope > .grid-col').length < 5) row.appendChild(createEmptyAthleteCard());
          });
        }
        pageBoxes.slice(1).forEach((box) => box.remove());
        page.querySelectorAll('.grid-remove-btn, .faculty-photo-viewer-trigger, .staff-add-col, .cell-plus, .edit-icon-btn, .freeform-edit-icon').forEach((control) => control.remove());

        const pageNumber = document.createElement('div');
        pageNumber.className = 'form-page-number';
        pageNumber.textContent = `Page ${pageIndex + 1} of ${totalPages}`;
        page.appendChild(pageNumber);
        exportRoot.replaceChildren(page);
        await waitForImages(page);

        const canvas = await html2canvas(page, {
          backgroundColor: '#ffffff',
          scale: Math.min(2, window.devicePixelRatio || 1),
          useCORS: true,
          allowTaint: false,
          logging: false,
          windowWidth: page.scrollWidth,
          windowHeight: page.scrollHeight,
        });
        if (pageIndex > 0) doc.addPage([13, 8.5], 'landscape');
        const scale = Math.min(
          (pageWidth - pageMargin * 2) / canvas.width,
          (pageHeight - pageMargin * 2) / canvas.height,
        );
        const imageWidth = canvas.width * scale;
        const imageHeight = canvas.height * scale;
        doc.addImage(canvas.toDataURL('image/png'), 'PNG', (pageWidth - imageWidth) / 2, (pageHeight - imageHeight) / 2, imageWidth, imageHeight, undefined, 'FAST');
      }

      doc.save(`STRASUC_${(coachProfile.mainSport || 'Report').replace(/[^a-z0-9]+/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
      setToast({ message: 'Report downloaded successfully!', type: 'success' });
    } catch (error) {
      console.error('Failed to generate report:', error);
      setToast({ message: 'Failed to generate report. Please try again.', type: 'error' });
    } finally {
      exportRoot?.remove();
    }
  };

  // ---------------- Athlete actions ----------------
  const handleEditAthlete = (athlete) => {
    setEditingAthlete(athlete);
    setIsAddingAthlete(false);
    setEditForm({
      fullname: athlete.fullname || '',
      dob: athlete.dob || '',
      course: athlete.course || '',
      location: athlete.location || '',
      email: athlete.email || '',
      sport: athlete.sport || coachProfile.mainSport,
      status: athlete.status || 'incomplete',
      photo: athlete.photo || placeholderImg,
    });
    setIsDobEditing(false);
    setImagePreview(athlete.photo || placeholderImg);
    setSelectedFile(null);
  };

  const handleOpenAddAthlete = () => {
    setHasActivatedGrid(true);
    setIsAddingAthlete(true);
    setEditingAthlete(null);
    setStudentDirectorySearch('');
    setStudentSearchResults([]);
    setStudentSearchError('');
    const searchRequestId = studentSearchRequestRef.current + 1;
    studentSearchRequestRef.current = searchRequestId;
    const selectedSport = coachProfile.mainSport;
    setStudentSearchLoading(!studentSearchCacheRef.current.has(selectedSport));
    void loadStudentSearchDirectory(selectedSport)
      .then(() => {
        if (studentSearchRequestRef.current === searchRequestId && activeSportRef.current === selectedSport) {
          setStudentSearchLoading(false);
        }
      })
      .catch(() => {
        if (studentSearchRequestRef.current === searchRequestId && activeSportRef.current === selectedSport) {
          setStudentSearchError('Unable to load students. Please try again.');
          setStudentSearchLoading(false);
        }
      });
    setEditForm({
      studentId: '',
      fullname: '',
      dob: '',
      course: '',
      location: '',
      email: '',
      sport: coachProfile.mainSport,
      status: 'incomplete',
      photo: placeholderImg,
    });
    setIsDobEditing(false);
    setImagePreview(placeholderImg);
    setSelectedFile(null);
  };

  const handleSelectDirectoryStudent = async (student) => {
    const studentId = student?._id || student?.id;
    if (!studentId || athletes.some((athlete) => String(athlete.userId || athlete.id) === String(studentId))) {
      setToast({ message: 'This student is already in the grid.', type: 'error' });
      return;
    }

    const selectedSport = coachProfile.mainSport;
    setIsSaving(true);
    api.createCoachAthlete({ studentId, sport: selectedSport })
      .then(async (response) => {
        const savedStudent = response?.data || student;
        const savedStudentId = String(savedStudent._id || savedStudent.studentId || studentId);
        const selectedAthlete = {
          id: savedStudentId,
          userId: savedStudentId,
          fullname: savedStudent.fullname || '',
          course: [savedStudent.department, savedStudent.yearLevel].filter(Boolean).join(' - '),
          sport: savedStudent.sport || '',
          location: savedStudent.branchCampus || '',
          dob: savedStudent.dateOfBirth || savedStudent.dob || '',
          photo: '',
          profilePhotoUrl: savedStudent.profilePhotoUrl || '',
          status: normalizeAthleteStatus(savedStudent.athleteStatus || savedStudent.status),
          missingRequirements: [],
          requirementsLoading: true,
          requirementsError: '',
        };
        const nextAthletes = [...athletes, selectedAthlete];
        athleteCacheRef.current.set(selectedSport, nextAthletes);
        if (activeSportRef.current === selectedSport) setAthletes(nextAthletes);
        setHasActivatedGrid(true);
        void hydrateAthletePhotos(selectedSport, [selectedAthlete]);
        setEditingAthlete(null);
        setIsAddingAthlete(false);
        setStudentDirectorySearch('');
        setStudentSearchResults([]);
        setToast({ message: 'Student added successfully.', type: 'success' });
      })
      .catch((error) => {
        setToast({ message: error.message || 'Unable to add student.', type: 'error' });
      })
      .finally(() => setIsSaving(false));
  };

  const openRemoveModal = (type, id, name) => (e) => {
    e.stopPropagation();
    setRemoveTarget({ type, id, name: name || '' });
    setRemoveModalOpen(true);
  };

  const handleCancelRemove = () => {
    setRemoveModalOpen(false);
    setRemoveTarget({ type: null, id: null, name: '' });
  };

  const handleConfirmRemove = async () => {
    try {
      const { type, id } = removeTarget;
      if (type === 'athlete') {
        await api.deleteCoachAthlete(id);
        const nextAthletes = athletes.filter((athlete) => String(athlete.id) !== String(id));
        athleteCacheRef.current.set(coachProfile.mainSport, nextAthletes);
        setAthletes(nextAthletes);
        setToast({ message: 'Student removed.', type: 'success' });
      } else if (type === 'faculty') {
        await api.deleteFacultyMember(id);
        await fetchCoachData(activeSportRef.current);
        setToast({ message: 'Faculty member removed.', type: 'success' });
      }
    } catch (err) {
      console.error('Remove error:', err);
      setToast({ message: 'Failed to remove item.', type: 'error' });
    } finally {
      handleCancelRemove();
    }
  };

  const handleSaveAthlete = async (event) => {
    event.preventDefault();
    if (!editForm.fullname.trim()) {
      setToast({ message: 'Please provide the student full name.', type: 'error' });
      return;
    }
    try {
      setIsSaving(true);
      const photoUrl = selectedFile ? imagePreview : editForm.photo;
      const athleteData = { ...editForm, photo: photoUrl };

      if (isAddingAthlete) {
        if (!editForm.studentId) {
          setToast({ message: 'Please select an existing student.', type: 'error' });
          return;
        }
        try {
          await api.createCoachAthlete({ studentId: editForm.studentId, sport: athleteData.sport });
          await fetchCoachData(activeSportRef.current);
          setToast({ message: 'Student profile added successfully.', type: 'success' });
          setIsAddingAthlete(false);
        } catch (error) {
          const message = error?.message || 'Unable to add the selected student.';
          setToast({ message, type: 'error' });
          return;
        }
      } else if (editingAthlete) {
        const { status, ...profileData } = athleteData;
        const savedStatus = normalizeAthleteStatus(status);
        const badgeResponse = await api.updateCoachAthleteStatus(editingAthlete.id, savedStatus);
        const persistedAthletes = await api.getCoachAthletes(activeSportRef.current);
        const persistedAthlete = Array.isArray(persistedAthletes)
          ? persistedAthletes.find((athlete) => String(athlete._id || athlete.studentId || athlete.id) === String(editingAthlete.id))
          : null;
        const persistedStatus = normalizeAthleteStatus(persistedAthlete?.athleteStatus || persistedAthlete?.status);
        if (!persistedAthlete || persistedStatus !== savedStatus) {
          throw new Error('The badge update could not be confirmed from the server. Please try again.');
        }
        setAthletes((currentAthletes) => currentAthletes.map((athlete) => (
          String(athlete.userId || athlete.id) === String(editingAthlete.id)
            ? { ...athlete, status: persistedStatus }
            : athlete
        )));
        const profileUpdates = {};
        ['fullname', 'email', 'course', 'dob', 'location', 'sport'].forEach((field) => {
          if (profileData[field] !== editingAthlete[field]) {
            profileUpdates[field] = profileData[field];
          }
        });
        if (selectedFile) profileUpdates.photo = photoUrl;
        if (Object.keys(profileUpdates).length > 0) {
          try {
            await api.updateCoachAthlete(editingAthlete.id, profileUpdates);
          } catch (profileError) {
            await fetchCoachData(activeSportRef.current);
            setToast({
              message: `Status badge updated, but other profile changes failed: ${profileError.message || 'Please try again.'}`,
              type: 'error',
            });
            setEditingAthlete(null);
            return;
          }
        }
        await fetchCoachData(activeSportRef.current);
        setToast({
          message: badgeResponse?.athleteStatus === persistedStatus
            ? 'Student status badge updated successfully.'
            : 'Student status badge saved and confirmed from the server.',
          type: 'success',
        });
        setEditingAthlete(null);
      }
    } catch (error) {
      setToast({ message: error.message || 'Unable to save student profile.', type: 'error' });
    } finally {
      setIsSaving(false);
      setSelectedFile(null);
    }
  };

  // ---------------- Eligibility / Director ----------------
  const handleEditEligibility = () => {
    setEditingEligibility(true);
    setEligibilityForm({ notes: eligibilityRequirements.notes });
  };

  const handleSaveEligibility = (e) => {
    e.preventDefault();
    setEligibilityRequirements({ notes: eligibilityForm.notes });
    setEditingEligibility(false);
    setToast({ message: 'Eligibility requirements updated.', type: 'success' });
  };

  const handleEditDirector = () => {
    setEditingDirector(true);
    setDirectorForm({ eventLabel: directorInfo.eventLabel, name: directorInfo.name, title: directorInfo.title });
  };

  const handleSaveDirector = (e) => {
    e.preventDefault();
    setDirectorInfo({ ...directorForm });
    setEditingDirector(false);
    setToast({ message: 'Director information updated.', type: 'success' });
  };

  // ---------------- Staff (Coach / Asst. Coach / Trainer / Chaperone / Other Faculty) ----------------
  const handleEditStaff = (index) => {
    setEditingStaffIndex(index);
    setIsAddingStaff(false);
    setStaffForm({ ...staff[index], role: String(staff[index]?.role || 'CHAPERONE').toUpperCase() });
    setSelectedStaffFile(null);
  };

  const handleAddStaff = () => {
    setIsAddingStaff(true);
    setEditingStaffIndex(null);
    setStaffForm({ ...createDefaultStaffMember('CHAPERONE'), fullname: '', age: '', phone: '', email: '', photo: placeholderImg });
    setSelectedStaffFile(null);
  };

  const handleSaveStaff = async (e) => {
    e.preventDefault();
    if (staffSaveInProgressRef.current) return;
    const role = String(staffForm.role || 'OTHER FACULTY').toUpperCase();
    if (!staffForm.fullname.trim()) {
      setToast({ message: 'Please provide the faculty member name.', type: 'error' });
      return;
    }
    staffSaveInProgressRef.current = true;
    setIsSaving(true);
    try {
      const currentMember = editingStaffIndex !== null ? staff[editingStaffIndex] : null;
      const facultyData = new FormData();
      facultyData.append('role', role);
      facultyData.append('name', staffForm.fullname.trim());
      facultyData.append('age', staffForm.age || '');
      facultyData.append('contactNumber', staffForm.phone || '');
      facultyData.append('email', staffForm.email || '');
      if (selectedStaffFile) facultyData.append('profilePhoto', selectedStaffFile);
      let savedMember;
      if (isAddingStaff || !(currentMember?.facultyId || currentMember?.id)) {
        savedMember = await api.createFacultyMember(facultyData);
      } else {
        savedMember = await api.updateFacultyMember(currentMember.facultyId || currentMember.id, facultyData);
      }

      const normalizedMember = {
        ...(currentMember || createDefaultStaffMember(role)),
        ...savedMember,
        id: savedMember?.id || savedMember?.facultyId || currentMember?.id,
        facultyId: savedMember?.facultyId || savedMember?.id || currentMember?.facultyId || currentMember?.id,
        role: savedMember?.role || role,
        fullname: savedMember?.fullname || savedMember?.name || staffForm.fullname.trim(),
        age: savedMember?.age || staffForm.age || '',
        phone: savedMember?.phone || savedMember?.contactNumber || staffForm.phone || '',
        email: savedMember?.email || staffForm.email || '',
        photo: selectedStaffFile ? staffForm.photo : (savedMember?.photo || currentMember?.photo || placeholderImg),
      };

      setStaff((currentStaff) => {
        if (isAddingStaff) {
          const emptyIndex = currentStaff.findIndex((member) => !member.fullname && !member.phone && !member.email);
          if (emptyIndex >= 0) {
            return currentStaff.map((member, index) => (index === emptyIndex ? normalizedMember : member));
          }
          return [...currentStaff, normalizedMember];
        }
        return currentStaff.map((member, index) => (index === editingStaffIndex ? normalizedMember : member));
      });

      if (savedMember?.profilePhotoUrl && !selectedStaffFile) {
        api.getProtectedImageObjectUrl(savedMember.profilePhotoUrl).then((photo) => {
          setStaff((currentStaff) => currentStaff.map((member) => (
            String(member.facultyId || member.id) === String(normalizedMember.facultyId)
              ? { ...member, photo }
              : member
          )));
        }).catch(() => {});
      }

      setEditingStaffIndex(null);
      setIsAddingStaff(false);
      setSelectedStaffFile(null);
      setToast({ message: isAddingStaff ? 'Faculty member added.' : 'Staff information updated.', type: 'success' });
    } catch (error) {
      setToast({ message: error.message || 'Unable to save staff information.', type: 'error' });
    } finally {
      staffSaveInProgressRef.current = false;
      setIsSaving(false);
    }
  };

  // ---------------- Event meta ----------------
  const handleEditEvent = () => {
    setEditingEvent(true);
    setEventForm({ title: eventMeta.title, schedule: eventMeta.schedule, institution: eventMeta.institution });
  };

  const handleSaveEvent = (e) => {
    e.preventDefault();
    setEventMeta({ ...eventForm });
    setEditingEvent(false);
    setToast({ message: 'Event details updated.', type: 'success' });
  };

  const handleSelectSport = async (sport) => {
    activeSportRef.current = sport;
    studentSearchRequestRef.current += 1;
    setCoachProfile((prev) => ({ ...prev, mainSport: sport }));
    setShowSportDropdown(false);
    setStudentDirectorySearch('');
    setStudentSearchResults([]);
    void loadStudentSearchDirectory(sport).catch(() => {});
    const cachedAthletes = athleteCacheRef.current.get(sport);
    const athletesToShow = cachedAthletes?.map((athlete) => ({
      ...athlete,
      photo: '',
      requirementsLoading: true,
      requirementsError: '',
    })) || [];
    setAthletes(athletesToShow);
    setHasActivatedGrid(true);
    setCategoryLoading(false);

    if (cachedAthletes) {
      athleteCacheRef.current.set(sport, athletesToShow);
      void hydrateAthletePhotos(sport, athletesToShow);
      return;
    }

    refreshAthletesForSport(sport)
      .then((normalizedAthletes) => {
        if (sport === activeSportRef.current) {
          setAthletes(normalizedAthletes);
          setHasActivatedGrid(true);
        }
      })
      .catch(() => {});
  };

  const handleLogout = () => setShowLogoutModal(true);

  const confirmLogout = async () => {
    setShowLogoutModal(false);
    await api.logout();
    localStorage.removeItem('role');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  // =========================================================================
  // Render helpers for the printed-form grid
  // =========================================================================

  // A single stacked "ATHLETE" column: label / photo / name / dob / course / school
  // `variant` controls what renders in the photo slot:
  //   'data'  -> real athlete photo + info, clickable to edit
  //   'add'   -> the next open roster slot, clickable to add a new athlete
  //   'blank' -> an empty, non-interactive cell (roster slot not yet reached)
  //   'x'     -> a fixed "not applicable" template slot (always shows an X,
  //              matching the reference form's second gallery box)
  const AthleteCell = ({ athlete, variant }) => {
    const statusBadge = athlete ? getAthleteStatusBadge(athlete.status) : null;

    if (variant === 'x') {
      return (
        <div className="grid-col">
          <div className="col-label">ATHLETE</div>
          <div className="col-photo">
            <span className="cell-x">X</span>
          </div>
          <div className="col-info-row" />
          <div className="col-info-row" />
          <div className="col-info-row" />
        </div>
      );
    }

    if (variant === 'blank') {
      return (
        <div className="grid-col">
          <div className="col-label">ATHLETE</div>
          <div className="col-photo" />
          <div className="col-info-row" />
          <div className="col-info-row" />
          <div className="col-info-row" />
          <div className="col-info-row" />
        </div>
      );
    }

    if (variant === 'add') {
      return (
        <div className="grid-col clickable-col" onClick={handleOpenAddAthlete} role="button" tabIndex={0}>
          <div className="col-label">ATHLETE</div>
          <div className="col-photo clickable">
            <span className="cell-plus">+</span>
          </div>
          <div className="col-info-row" />
          <div className="col-info-row" />
          <div className="col-info-row" />
          <div className="col-info-row" />
        </div>
      );
    }

    return (
      <div
        className="grid-col clickable-col"
        onClick={() => handleEditAthlete(athlete)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleEditAthlete(athlete);
        }}
        aria-label={`Edit ${athlete.fullname}`}
      >
        <div className="col-label">ATHLETE</div>
        <div className="col-photo clickable student-photo">
          {athlete.requirementsLoading && <span className="student-photo-status">Checking requirements...</span>}
          {!athlete.requirementsLoading && athlete.requirementsError && <span className="student-photo-status">{athlete.requirementsError}</span>}
          {!athlete.requirementsLoading && !athlete.requirementsError && athlete.missingRequirements?.length > 0 && (
            <div className="student-photo-missing" aria-label={`Missing requirements: ${athlete.missingRequirements.join(', ')}`}>
              {athlete.missingRequirements.map((documentName) => <span key={documentName}>{documentName}</span>)}
            </div>
          )}
          {!athlete.requirementsLoading && !athlete.requirementsError && !athlete.missingRequirements?.length && athlete.photo && (
            <img src={athlete.photo} alt={athlete.fullname} />
          )}
          <img
            className="athlete-status-badge"
            src={statusBadge.src}
            alt={statusBadge.label}
            aria-label={`Status: ${statusBadge.label}`}
            title={`Status: ${statusBadge.label}`}
          />
          <button type="button" className="grid-remove-btn" onClick={openRemoveModal('athlete', athlete.id, athlete.fullname)} title="Remove">
            <RemoveIcon />
          </button>
        </div>
        <div className="col-info-row" title={athlete.fullname}>{athlete.fullname}</div>
        <div className="col-info-row" title={formatDateOfBirth(athlete.dob)}>{formatDateOfBirth(athlete.dob)}</div>
        <div className="col-info-row" title={athlete.course}>{athlete.course}</div>
        <div className="col-info-row" title={athlete.location}>{athlete.location}</div>
      </div>
    );
  };

  const ATHLETE_ROW_LABELS = ['Name', 'Date of Birth', 'Course & Year', 'School/Campus'];
  const STAFF_ROW_LABELS = ['Name', 'Age', 'Contact no#/Mobile no#', 'Email Address'];

  // Institution seal on top + a stacked row-label rail beneath it — reused
  // for both the athlete rows and the staff row (only the label text differs).
  const LogoCell = ({ labels }) => (
    <div className="grid-logo-col">
      <div className="logo-photo-block">
        <img src={marsuSeal} alt="Institution seal" />
      </div>
      {labels.map((label) => (
        <div key={label} className="row-label-cell">{label}</div>
      ))}
    </div>
  );

  const StaffCell = ({ member, index }) => {
    const hasStaffData = Boolean(member.fullname || member.age || member.phone || member.email || member.facultyId || member.id);
    if (!hasStaffData && !hasActivatedGrid) return null;

    return (
    <div className="grid-col clickable-col" onClick={() => handleEditStaff(index)} role="button" tabIndex={0}>
      <div className="col-label">{member.role}</div>
      <div className="col-photo">
        <button type="button" className="faculty-photo-viewer-trigger" onClick={(e) => { e.stopPropagation(); setViewingFacultyMember(member); }} title="View profile photo">
          {member.photo ? <img src={member.photo} alt={member.role} /> : <span className="cell-x" aria-label="No profile photo">X</span>}
        </button>
        <button type="button" className="grid-remove-btn" onClick={openRemoveModal('faculty', member.facultyId || member.id, member.fullname)} title="Delete faculty member" aria-label={`Delete ${member.fullname || 'faculty member'}`}>
          <RemoveIcon />
        </button>
      </div>
      <div className="col-info-row" title={member.fullname}>{member.fullname}</div>
      <div className="col-info-row" title={member.age}>{member.age}</div>
      <div className="col-info-row" title={member.phone}>{member.phone}</div>
      <div className="col-info-row" title={member.email}>{member.email}</div>
    </div>
    );
  };

  // Build the flat athlete slot list used by box one and box two.
  // Total roster slots reproduced from the reference: 12 in box one + 1
  // usable slot in box two (the other 5 columns in box two are fixed
  // template "X" placeholders, not tied to roster data).
  const boxOneAthletes = athletes.slice(0, BOX_ONE_SLOTS);
  const boxOneNextEmptyIndex = boxOneAthletes.length; // index (within box one) of the "+" slot, if any
  const boxTwoAthlete = athletes[BOX_ONE_SLOTS]; // the single usable slot in box two
  const boxTwoIsNextEmptySlot = !boxTwoAthlete && boxOneNextEmptyIndex >= BOX_ONE_SLOTS && !loading;

  const slotVariant = (athlete, isNextEmptySlot) => {
    if (athlete) return 'data';
    if (isNextEmptySlot) return 'add';
    return 'blank';
  };

  const renderBoxOneRow = (rowIndex) => {
    const start = rowIndex * BOX_ONE_COLS;
    const cols = [];
    for (let i = 0; i < BOX_ONE_COLS; i += 1) {
      const slotIndex = start + i;
      const athlete = boxOneAthletes[slotIndex];
      const isNextEmptySlot = !athlete && slotIndex === boxOneNextEmptyIndex && !loading;
      cols.push(<AthleteCell key={`box1-${slotIndex}`} athlete={athlete} variant={slotVariant(athlete, isNextEmptySlot)} />);
    }
    return cols;
  };

  return (
    <div className="strasuc-doc-wrapper">
      {/* ---------------- Portal toolbar (kept for app functionality) ---------------- */}
      <div className="form-toolbar">
        <div className="form-toolbar-left">
          <img src={logoImage} alt="School logo" />
        </div>
        <div className="form-toolbar-right">
          <button className="toolbar-btn ghost" type="button" onClick={handleDownloadReport}>
            Download Report
          </button>
          <button className="toolbar-btn" type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>

      {/* ---------------- Printable document ---------------- */}
      <div className="strasuc-form-page">
        {/* HEADER */}
        <div className="form-header-row">
          <div className="form-header-logo-left">
            <img src={logoRegion} alt="STRASUC Region IV-A & B seal" />
          </div>

          <div className="form-header-center">
            <div className="form-title-editable" onClick={handleEditEvent} role="button" tabIndex={0}>
              <h1 className="form-title">{eventMeta.title}</h1>
              <span className="edit-icon-btn">
                <EditIcon size={18} />
              </span>
            </div>
            <p className="form-subtitle">{eventMeta.schedule}</p>
          </div>

          <div className="form-header-logo-right">
            <img className="scuaa-combined-logo" src={scuaaLogo} alt="SCUAA" />
          </div>

          <div className="form-header-right-text">
            <span className="form-number-box">SCUAA Form 2</span>
            <p className="entry-form-title">OFFICIAL ENTRY FORM AND GALLERY OF</p>
            <p className="entry-form-event">{(coachProfile.mainSport || '').replace(/\s+(Women|Men)$/i, '').toUpperCase()}</p>
            <p className="entry-form-event-label">(Event)</p>
          </div>
        </div>

        <hr className="form-header-divider" />

        {/* INFO ROW */}
        <div className="form-info-row">
          <div className="form-info-left">
            <span className="info-label">INSTITUTION:</span>
            <span className="info-value" onClick={handleEditEvent}>
              {eventMeta.institution}
            </span>

            <span className="info-label" style={{ marginLeft: 40 }}>CATEGORY:</span>
            <button
              className="info-value sport-category-select"
              type="button"
              onClick={() => setShowSportDropdown((show) => !show)}
              aria-haspopup="dialog"
              aria-expanded={showSportDropdown}
            >
              {coachProfile.mainSport || 'Select Sport Category'}
            </button>
          </div>
          <div className="form-info-right">Date of Screening: (please refer to the STRASUC Olympics Manual)</div>
        </div>

        {/* BOX ONE: 2 rows x 6 athlete columns, one institution logo + row-label rail per row */}
        <div className="form-grid-box">
          <div className="form-grid-row">
            <LogoCell labels={ATHLETE_ROW_LABELS} />
            {renderBoxOneRow(0)}
          </div>
          <div className="form-grid-row">
            <LogoCell labels={ATHLETE_ROW_LABELS} />
            {renderBoxOneRow(1)}
          </div>
        </div>

        {/* BOX TWO: athlete row (1 usable slot + 5 fixed "X" template slots) + staff row */}
        <div className="form-grid-box">
          <div className="form-grid-row">
            <LogoCell labels={ATHLETE_ROW_LABELS} />
            <AthleteCell athlete={boxTwoAthlete} variant={slotVariant(boxTwoAthlete, boxTwoIsNextEmptySlot)} />
            {Array.from({ length: BOX_TWO_ATHLETE_SLOTS - 1 }).map((_, i) => (
              <AthleteCell key={`box2-x-${i}`} variant="x" />
            ))}
          </div>

          <div className="form-grid-row staff-grid-row">
            <LogoCell labels={STAFF_ROW_LABELS} />
            {staff.map((member, index) => (
              <StaffCell key={`${member.role}-${index}`} member={member} index={index} />
            ))}
            <div className="grid-col clickable-col staff-add-col" onClick={handleAddStaff} role="button" tabIndex={0}>
              <div className="col-label">ADD</div>
              <div className="col-photo clickable">
                <span className="cell-plus">+</span>
              </div>
              <div className="col-info-row">Faculty</div>
              <div className="col-info-row">Role</div>
              <div className="col-info-row">Contact</div>
              <div className="col-info-row">Email</div>
            </div>
            <div className="grid-placeholder-col">
              <span className="cell-x">X</span>
            </div>
            <div className="grid-freeform-col eligibility-col" onClick={handleEditEligibility} role="button" tabIndex={0}>
              <span className="freeform-edit-icon">
                <EditIcon size={13} />
              </span>
              <h4>Elligibility Requirements:</h4>
              <pre>{eligibilityRequirements.notes}</pre>
            </div>
            <div className="grid-freeform-col director-col" onClick={handleEditDirector} role="button" tabIndex={0}>
              <span className="freeform-edit-icon">
                <EditIcon size={13} />
              </span>
              <p className="director-heading">{directorInfo.eventLabel}</p>
              <img src={marsuSeal} alt="Institution seal" />
              <p className="director-name">{directorInfo.name}</p>
              <p className="director-title">{directorInfo.title}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ================= MODALS ================= */}

      {showSportDropdown && (
        <div className="coach-modal-overlay" onClick={() => setShowSportDropdown(false)}>
          <div className="coach-modal-card coach-category-modal" onClick={(event) => event.stopPropagation()}>
            <div className="coach-modal-header">
              <h3 className="coach-modal-title">Select Category</h3>
              <button className="coach-modal-close" type="button" onClick={() => setShowSportDropdown(false)}><Icon name="close" /></button>
            </div>
            <div className="coach-category-options">
              {sportCategoryOptions.map((sport) => (
                <button key={sport} type="button" className={`coach-category-option${coachProfile.mainSport === sport ? ' is-selected' : ''}`} onClick={() => handleSelectSport(sport)} disabled={categoryLoading}>
                  {sport}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showAnnouncements && (
        <div className="coach-modal-overlay" onClick={() => setShowAnnouncements(false)}>
          <div className="coach-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="coach-modal-header">
              <h3 className="coach-modal-title">Announcements</h3>
              <button className="coach-modal-close" type="button" onClick={() => setShowAnnouncements(false)}><Icon name="close" /></button>
            </div>
            <div className="coach-announcement-list">
              {announcements.length ? (
                announcements.map((item) => (
                  <div key={item.id} className="coach-announcement-item">
                    <h4>{item.title}</h4>
                    <p>{item.date} • {item.time}</p>
                    <p>{item.description}</p>
                  </div>
                ))
              ) : (
                <p>No announcements available right now.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {(editingAthlete || isAddingAthlete) && (
        <div className="coach-modal-overlay" onClick={() => { setEditingAthlete(null); setIsAddingAthlete(false); }}>
          <div className="coach-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="coach-modal-header">
              <h3 className="coach-modal-title">{isAddingAthlete ? 'Add Student Athlete' : 'Edit Student Profile'}</h3>
              <button className="coach-modal-close" type="button" onClick={() => { setEditingAthlete(null); setIsAddingAthlete(false); }}><Icon name="close" /></button>
            </div>
            <form className="coach-edit-form" onSubmit={handleSaveAthlete}>
              {isAddingAthlete && (
                <label>
                  Select Existing Student
                  <input
                    type="search"
                    value={studentDirectorySearch}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        event.stopPropagation();
                      }
                    }}
                    onChange={(event) => {
                      const val = event.target.value;
                      const trimmed = val.trim();
                      const selectedSport = coachProfile.mainSport;
                      const requestId = studentSearchRequestRef.current + 1;
                      studentSearchRequestRef.current = requestId;
                      setStudentDirectorySearch(val);
                      setStudentSearchError('');

                      if (!trimmed) {
                        setStudentSearchResults([]);
                        setStudentSearchLoading(studentSearchInFlightRef.current.has(selectedSport));
                        return;
                      }

                      const cachedResults = studentSearchCacheRef.current.get(selectedSport);
                      if (cachedResults) {
                        setStudentSearchResults(cachedResults.filter((student) => {
                          const studentIdentifiers = [student?.id, student?._id]
                            .map((value) => String(value || '').toLowerCase());
                          const studentName = String(student?.fullname || '').toLowerCase();
                          return studentIdentifiers.some((studentId) => studentId.includes(trimmed.toLowerCase()))
                            || studentName.includes(trimmed.toLowerCase());
                        }));
                        setStudentSearchLoading(false);
                        return;
                      }

                      setStudentSearchResults([]);
                      setStudentSearchLoading(true);
                      getStudentSearchResults(trimmed, selectedSport)
                        .then((results) => {
                          if (studentSearchRequestRef.current === requestId && activeSportRef.current === selectedSport) {
                            setStudentSearchResults(results);
                          }
                        })
                        .catch(() => {
                          if (studentSearchRequestRef.current === requestId) {
                            setStudentSearchResults([]);
                            setStudentSearchError('Unable to load students. Please try again.');
                          }
                        })
                        .finally(() => {
                          if (studentSearchRequestRef.current === requestId) setStudentSearchLoading(false);
                        });
                    }}
                    placeholder="Search by Student ID or Full Name"
                    autoComplete="off"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      margin: '5px 0 4px',
                      fontSize: '12px',
                      boxSizing: 'border-box',
                    }}
                  />
                  {studentSearchLoading && (
                    <p style={{ fontSize: '11px', color: '#888', margin: '2px 0 4px' }}>Loading students...</p>
                  )}
                  {!studentSearchLoading && studentSearchError && (
                    <p style={{ fontSize: '11px', color: '#888', margin: '2px 0 4px' }}>{studentSearchError}</p>
                  )}
                  {!studentSearchLoading && !studentSearchError && studentDirectorySearch.trim() && studentSearchResults.length === 0 && (
                    <p style={{ fontSize: '11px', color: '#888', margin: '2px 0 4px' }}>
                      {coachProfile.mainSport ? 'No matching students found.' : 'Select a Sport category first.'}
                    </p>
                  )}
                  {studentSearchResults.length > 0 && (
                    <div className="coach-category-options">
                      {studentSearchResults
                        .filter((student) => {
                          const studentId = String(student?._id || student?.id || '');
                          return !athletes.some((athlete) => String(athlete.userId || athlete.id) === String(studentId));
                        })
                        .map((student) => (
                          <button
                            key={String(student?._id || student?.id || student?.studentId)}
                            type="button"
                            className="coach-category-option"
                            onClick={() => handleSelectDirectoryStudent(student)}
                            disabled={isSaving}
                          >
                            {student.id || String(student._id)} - {student.fullname || ''}
                          </button>
                        ))}
                      {studentSearchResults.every((student) => {
                        const studentId = String(student?._id || student?.id || '');
                        return athletes.some((athlete) => String(athlete.userId || athlete.id) === String(studentId));
                      }) && (
                        <p style={{ fontSize: '11px', color: '#888', padding: '4px 8px' }}>All matching students are already in the grid.</p>
                      )}
                    </div>
                  )}
                </label>
              )}
              <label>
                Full Name
                <input value={editForm.fullname} onChange={(event) => setEditForm({ ...editForm, fullname: event.target.value })} style={{ width: '100%', padding: '6px', margin: '5px 0', fontSize: '12px' }} />
              </label>
              <label>
                Date of Birth
                <input value={isDobEditing ? editForm.dob : formatDateOfBirth(editForm.dob)} onFocus={() => setIsDobEditing(true)} onBlur={() => setIsDobEditing(false)} onChange={(event) => setEditForm({ ...editForm, dob: event.target.value })} style={{ width: '100%', padding: '6px', margin: '5px 0', fontSize: '12px' }} />
              </label>
              <label>
                Course & Year
                <input value={editForm.course} onChange={(event) => setEditForm({ ...editForm, course: event.target.value })} style={{ width: '100%', padding: '6px', margin: '5px 0', fontSize: '12px' }} />
              </label>
              <label>
                School/Campus
                <input value={editForm.location} onChange={(event) => setEditForm({ ...editForm, location: event.target.value })} style={{ width: '100%', padding: '6px', margin: '5px 0', fontSize: '12px' }} />
              </label>
              <label>
                <select value={editForm.location} onChange={(event) => setEditForm({ ...editForm, location: event.target.value })} style={{ width: '100%', padding: '6px', margin: '5px 0', fontSize: '12px' }}>
                  {editForm.location && !CAMPUS_OPTIONS.includes(editForm.location) && <option value={editForm.location}>{editForm.location}</option>}
                  {CAMPUS_OPTIONS.map((campus) => <option key={campus || 'unspecified'} value={campus}>{campus || 'Select campus'}</option>)}
                </select>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
                  <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handleFileSelect} ref={fileInputRef} style={{ flex: 1 }} />
                  {imagePreview && <img src={imagePreview} alt="Preview" style={{ width: '50px', height: '50px', objectFit: 'cover', border: '1px solid #ddd' }} />}
                </div>
              </label>
              <label>
                Status Badge
                <select value={editForm.status} onChange={(event) => setEditForm({ ...editForm, status: event.target.value })} style={{ width: '100%', padding: '6px', margin: '5px 0', fontSize: '12px' }}>
                  <option value="complete">Complete</option>
                  <option value="incomplete">Incomplete</option>
                  <option value="disqualified">Disqualified</option>
                  <option value="no-documents">No Documents</option>
                </select>
              </label>
              <label>
                Email Reference
                <input value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} style={{ width: '100%', padding: '6px', margin: '5px 0', fontSize: '12px' }} />
              </label>
              <div className="coach-edit-actions">
                <button className="secondary-btn" type="button" onClick={() => { setEditingAthlete(null); setIsAddingAthlete(false); }} disabled={isSaving}>Cancel</button>
                <button className="primary-btn" type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingEligibility && (
        <div className="coach-modal-overlay" onClick={() => setEditingEligibility(false)}>
          <div className="coach-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="coach-modal-header">
              <h3 className="coach-modal-title">Edit Eligibility Requirements</h3>
              <button className="coach-modal-close" type="button" onClick={() => setEditingEligibility(false)}><Icon name="close" /></button>
            </div>
            <form className="coach-edit-form" onSubmit={handleSaveEligibility}>
              <label>
                Requirements Notes
                <textarea value={eligibilityForm.notes} onChange={(e) => setEligibilityForm({ ...eligibilityForm, notes: e.target.value })} rows="12" style={{ width: '100%', padding: '8px', margin: '5px 0', fontFamily: 'inherit', fontSize: '13px' }} />
              </label>
              <div className="coach-edit-actions">
                <button className="secondary-btn" type="button" onClick={() => setEditingEligibility(false)}>Cancel</button>
                <button className="primary-btn" type="submit">Save Requirements</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingDirector && (
        <div className="coach-modal-overlay" onClick={() => setEditingDirector(false)}>
          <div className="coach-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="coach-modal-header">
              <h3 className="coach-modal-title">Edit Sports Director Info</h3>
              <button className="coach-modal-close" type="button" onClick={() => setEditingDirector(false)}><Icon name="close" /></button>
            </div>
            <form className="coach-edit-form" onSubmit={handleSaveDirector}>
              <label>
                Event Label
                <input value={directorForm.eventLabel} onChange={(e) => setDirectorForm({ ...directorForm, eventLabel: e.target.value })} style={{ width: '100%', padding: '6px', margin: '5px 0', fontSize: '12px' }} />
              </label>
              <label>
                Director Name
                <input value={directorForm.name} onChange={(e) => setDirectorForm({ ...directorForm, name: e.target.value })} style={{ width: '100%', padding: '6px', margin: '5px 0', fontSize: '12px' }} />
              </label>
              <label>
                Director Title
                <input value={directorForm.title} onChange={(e) => setDirectorForm({ ...directorForm, title: e.target.value })} style={{ width: '100%', padding: '6px', margin: '5px 0', fontSize: '12px' }} />
              </label>
              <div className="coach-edit-actions">
                <button className="secondary-btn" type="button" onClick={() => setEditingDirector(false)}>Cancel</button>
                <button className="primary-btn" type="submit">Save Director Info</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {(editingStaffIndex !== null || isAddingStaff) && (
        <div className="coach-modal-overlay" onClick={() => { setEditingStaffIndex(null); setIsAddingStaff(false); }}>
          <div className="coach-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="coach-modal-header">
              <h3 className="coach-modal-title">{isAddingStaff ? 'Add Faculty Member' : `Edit ${String(staff[editingStaffIndex]?.role || 'Faculty')}`}</h3>
              <button className="coach-modal-close" type="button" onClick={() => { setEditingStaffIndex(null); setIsAddingStaff(false); }}><Icon name="close" /></button>
            </div>
            <form className="coach-edit-form" onSubmit={handleSaveStaff}>
              <label>
                Role
                <select value={staffForm.role} onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })} style={{ width: '100%', padding: '6px', margin: '5px 0', fontSize: '12px' }}>
                  {DEFAULT_STAFF_ROLES.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </label>
              <label>
                Full Name
                <input value={staffForm.fullname} onChange={(e) => setStaffForm({ ...staffForm, fullname: e.target.value })} style={{ width: '100%', padding: '6px', margin: '5px 0', fontSize: '12px' }} />
              </label>
              <label>
                Age
                <input value={staffForm.age} onChange={(e) => setStaffForm({ ...staffForm, age: e.target.value })} style={{ width: '100%', padding: '6px', margin: '5px 0', fontSize: '12px' }} />
              </label>
              <label>
                Contact no# / Mobile no#
                <input value={staffForm.phone} onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })} style={{ width: '100%', padding: '6px', margin: '5px 0', fontSize: '12px' }} />
              </label>
              <label>
                Email Address
                <input value={staffForm.email} onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })} style={{ width: '100%', padding: '6px', margin: '5px 0', fontSize: '12px' }} />
              </label>
              <label className="coach-photo-upload">
                Upload Photo
                <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handleStaffFileSelect} />
                {staffForm.photo && <img src={staffForm.photo} alt="Preview" style={{ width: '60px', height: '60px', objectFit: 'cover', marginTop: '6px', border: '1px solid #ddd' }} />}
              </label>
              <div className="coach-edit-actions">
                <button className="secondary-btn" type="button" onClick={() => { setEditingStaffIndex(null); setIsAddingStaff(false); }}>Cancel</button>
                <button className="primary-btn" type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingFacultyMember && (
        <div className="coach-modal-overlay" onClick={() => setViewingFacultyMember(null)}>
          <div className="coach-modal-card faculty-photo-viewer" onClick={(e) => e.stopPropagation()}>
            <div className="coach-modal-header">
              <h3 className="coach-modal-title">{viewingFacultyMember.fullname || 'Faculty Member'} Photo</h3>
              <button className="coach-modal-close" type="button" onClick={() => setViewingFacultyMember(null)}><Icon name="close" /></button>
            </div>
            <div className="faculty-photo-viewer__image">
              <img src={viewingFacultyMember.photo || placeholderImg} alt={viewingFacultyMember.fullname || viewingFacultyMember.role} />
            </div>
          </div>
        </div>
      )}

      {editingEvent && (
        <div className="coach-modal-overlay" onClick={() => setEditingEvent(false)}>
          <div className="coach-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="coach-modal-header">
              <h3 className="coach-modal-title">Modify Sheet Headers</h3>
              <button className="coach-modal-close" type="button" onClick={() => setEditingEvent(false)}><Icon name="close" /></button>
            </div>
            <form className="coach-edit-form" onSubmit={handleSaveEvent}>
              <label>
                Olympics Title
                <input value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} style={{ width: '100%', padding: '6px', margin: '5px 0', fontSize: '12px' }} />
              </label>
              <label>
                Schedule & Location Line
                <input value={eventForm.schedule} onChange={(e) => setEventForm({ ...eventForm, schedule: e.target.value })} style={{ width: '100%', padding: '6px', margin: '5px 0', fontSize: '12px' }} />
              </label>
              <label>
                Institution
                <input value={eventForm.institution} onChange={(e) => setEventForm({ ...eventForm, institution: e.target.value })} style={{ width: '100%', padding: '6px', margin: '5px 0', fontSize: '12px' }} />
              </label>
              <div className="coach-edit-actions">
                <button className="secondary-btn" type="button" onClick={() => setEditingEvent(false)}>Cancel</button>
                <button className="primary-btn" type="submit">Save Headers</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <LogoutConfirmModal isOpen={showLogoutModal} onClose={() => setShowLogoutModal(false)} onConfirm={confirmLogout} />
      <ConfirmModal
        isOpen={removeModalOpen}
        title={removeTarget.type === 'faculty' ? 'Remove Faculty Member' : 'Remove Student'}
        message={`Are you sure you want to remove "${removeTarget.name || ''}"? This action cannot be undone.`}
        confirmText="Remove"
        cancelText="Cancel"
        onConfirm={handleConfirmRemove}
        onCancel={handleCancelRemove}
      />
      <NotificationToast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />
    </div>
  );
}