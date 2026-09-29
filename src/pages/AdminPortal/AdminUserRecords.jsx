import { useState, useEffect, useEffectEvent, useRef } from 'react';
import NotificationToast from '../../components/NotificationToast';
import ConfirmModal from '../../components/ConfirmModal';
import { getAdminStudents, getAdminScreeners, createUser, updateUserArchiveStatus, archiveUsers } from '../../services/api';
import { DEPARTMENT_OPTIONS } from '../../constants/studentRegistrationOptions';
import { isPasswordValid, PASSWORD_POLICY_MESSAGE } from '../../constants/passwordPolicy';
import Icon from '../../components/Icon';
import './AdminPortal.css';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getUserActivityStatus = (user) => {
  const explicitStatus = user?.status;
  if (explicitStatus === 'Active' || explicitStatus === 'Inactive') {
    return explicitStatus;
  }

  const lastActiveAt = user?.lastActiveAt || user?.lastLoginAt || user?.lastSeenAt;
  if (!lastActiveAt) return 'Inactive';

  const lastActiveDate = new Date(lastActiveAt);
  if (Number.isNaN(lastActiveDate.getTime())) return 'Inactive';

  const activeWindowMs = 15 * 60 * 1000;
  return Date.now() - lastActiveDate.getTime() <= activeWindowMs ? 'Active' : 'Inactive';
};

const normalizeUserRow = (user) => {
  const raw = user || {};

  // Department may be stored as `department`, `dept`, or nested object
  const deptFromObj = (val) => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object') return val.name || val.label || val.value || '';
    return '';
  };

  const deptVal = deptFromObj(raw.department) || deptFromObj(raw.dept) || deptFromObj(raw?.department?.name) || deptFromObj(raw?.department?.label) || '';

  // Sport may be stored as `sport`, `sports` (array/object), or inside sportParticipation
  const sportFromObj = (val) => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object') return val.name || val.label || val.value || '';
    return '';
  };

  let sportVal = sportFromObj(raw.sport);
  if (!sportVal && Array.isArray(raw.sports) && raw.sports.length) {
    sportVal = sportFromObj(raw.sports[0]);
  }
  if (!sportVal && Array.isArray(raw.sportParticipation) && raw.sportParticipation.length) {
    const sp = raw.sportParticipation[0];
    sportVal = sportFromObj(sp?.sport) || sportFromObj(sp?.role) || sportFromObj(sp?.level) || '';
  }
  if (!sportVal && raw?.sportParticipation && typeof raw.sportParticipation === 'string') {
    sportVal = raw.sportParticipation;
  }

  return {
    ...raw,
    id: raw?.id || raw?._id || raw?.username || '',
    name: raw?.fullname || raw?.name || raw?.username || '',
    fullname: raw?.fullname || raw?.name || raw?.username || '',
    username: raw?.username || '',
    email: raw?.email || '',
    dept: deptVal,
    department: deptVal,
    sport: sportVal || '',
    status: getUserActivityStatus(raw),
    role: raw?.role || 'student',
    accountStatus: raw?.accountStatus === 'archived' ? 'archived' : 'active'
  };
};

const parseUserListResponse = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.users)) return data.users;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const getSurname = (fullname) => {
  const name = String(fullname || '').trim();
  if (name.includes(',')) return name.split(',')[0].trim();

  const parts = name.split(/\s+/).filter(Boolean);
  const suffixes = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv']);
  if (parts.length > 1 && suffixes.has(parts[parts.length - 1].toLowerCase())) {
    return parts[parts.length - 2];
  }
  return parts[parts.length - 1] || '';
};

const reportNameCollator = new Intl.Collator(undefined, { sensitivity: 'base' });
const sortUsersBySurname = (users) => [...users].sort((first, second) => (
  reportNameCollator.compare(getSurname(first.name), getSurname(second.name))
  || reportNameCollator.compare(first.name, second.name)
));

/* ── Constants ── */
const DEPARTMENTS = DEPARTMENT_OPTIONS;
const SPORTS      = ['Basketball','Volleyball','Swimming','Track & Field','Badminton','Softball','Boxing','Archery','Chess','Mobile Legends'];

const COLORS   = ['#7b1e1e','#1565c0','#2e7d32','#6a1b9a','#e65100','#00695c','#4527a0','#ad1457'];
const getColor = (name) => COLORS[name.charCodeAt(0) % COLORS.length];
const getInit  = (name) => name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();

/* ── Reusable avatar ── */
const Avatar = ({ name }) => (
  <div className="ur-avatar" style={{ background: getColor(name) }}>{getInit(name)}</div>
);

/* ── Reusable status badge ── */
const StatusBadge = ({ status }) => (
  <span className={`ur-status-badge ur-status-badge--${status === 'Active' ? 'active' : 'inactive'}`}>
    <span className="ur-status-dot" /> {status}
  </span>
);

export default function AdminUserRecords() {
  // 'student' | 'screener'
  const [tab, setTab] = useState('student');

  /* ── Student state ── */
  const [students,       setStudents]       = useState([]);
  const [studentSearch,  setStudentSearch]  = useState('');
  const [studentDept,    setStudentDept]    = useState('All');
  const [studentAccountStatus, setStudentAccountStatus] = useState('active');
  const [selStudents,    setSelStudents]    = useState([]);

  /* ── Screener state ── */
  const [screeners,      setScreeners]      = useState([]);
  const [screenerSearch, setScreenerSearch] = useState('');
  const [screenerDept,   setScreenerDept]   = useState('All');
  const [screenerAccountStatus, setScreenerAccountStatus] = useState('active');
  const [selScreeners,   setSelScreeners]   = useState([]);
  const [scrForm,        setScrForm]        = useState({ id: '', email: '', dept: DEPARTMENT_OPTIONS[0], password: '' });
  const [scrPwShow,      setScrPwShow]      = useState(false);
  const [scrError,       setScrError]       = useState('');
  const [toast,          setToast]          = useState({ message: '', type: 'success' });
  const [confirmDialog,  setConfirmDialog]  = useState({ open: false, message: '', action: null });
  const reportInProgressRef = useRef(false);

  const showToast = (message, type = 'success') => setToast({ message, type });
  const closeToast = () => setToast({ message: '', type: 'success' });
  const openConfirmDialog = (message, action) => setConfirmDialog({ open: true, message, action });
  const closeConfirmDialog = () => setConfirmDialog({ open: false, message: '', action: null });
  const handleConfirmDialog = () => {
    if (confirmDialog.action) confirmDialog.action();
    closeConfirmDialog();
  };

  /* ── Fetch students from MongoDB ── */
  const fetchStudents = async () => {
    try {
      const data = await getAdminStudents(studentAccountStatus);
      const studentsData = parseUserListResponse(data)
        .filter((user) => (user?.role || 'student').toLowerCase() === 'student')
        .map(normalizeUserRow);
      setStudents(studentsData);
    } catch (error) {
      console.error('Error fetching students:', error);
      showToast('Failed to load students', 'error');
      setStudents([]);
    }
  };

  /* ── Fetch screeners from MongoDB ── */
  const fetchScreeners = async () => {
    try {
      const data = await getAdminScreeners(screenerAccountStatus);
      const screenersData = parseUserListResponse(data)
        .filter((user) => (user?.role || 'screener').toLowerCase() === 'screener')
        .map(normalizeUserRow);
      setScreeners(screenersData);
    } catch (error) {
      console.error('Error fetching screeners:', error);
      showToast('Failed to load screeners', 'error');
      setScreeners([]);
    }
  };

  const fetchStudentsEvent = useEffectEvent(fetchStudents);
  const fetchScreenersEvent = useEffectEvent(fetchScreeners);

  useEffect(() => {
    fetchStudentsEvent();
    fetchScreenersEvent();
  }, [studentAccountStatus, screenerAccountStatus]);

  /* ── Generic checkbox helpers ── */
  const toggle    = (id, setter) => setter(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleAll = (rows, sel, setter) => setter(sel.length === rows.length ? [] : rows.map(r => r.id));

  /* ── Filtered lists ── */
  const filtStudents = sortUsersBySurname(students.filter(s =>
    (studentDept === 'All' || s.dept === studentDept) &&
    (s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
     s.email.toLowerCase().includes(studentSearch.toLowerCase()) ||
     s.sport.toLowerCase().includes(studentSearch.toLowerCase()))
  ));
  const filtScreeners = sortUsersBySurname(screeners.filter(s =>
    (screenerDept === 'All' || s.dept === screenerDept) &&
    (s.name.toLowerCase().includes(screenerSearch.toLowerCase()) ||
     s.email.toLowerCase().includes(screenerSearch.toLowerCase()))
  ));

  /* ── Register screener ── */
  const registerScreener = async (e) => {
    e.preventDefault();

    const id = scrForm.id.trim();
    const email = scrForm.email.trim();
    const showRegisterError = (message) => {
      setScrError(message);
      showToast(message, 'error');
    };

    if (!id) {
      showRegisterError('ID is required.');
      return;
    }

    if (!email) {
      showRegisterError('Email is required.');
      return;
    }

    if (!EMAIL_PATTERN.test(email)) {
      showRegisterError('Please provide a valid email address.');
      return;
    }

    if (!scrForm.password) {
      showRegisterError('Password is required.');
      return;
    }

    if (!isPasswordValid(scrForm.password)) {
      showRegisterError(PASSWORD_POLICY_MESSAGE);
      return;
    }

    if (!scrForm.dept || !DEPARTMENT_OPTIONS.includes(scrForm.dept)) {
      showRegisterError('Department is required.');
      return; 
    }

    try {
      const screenerData = {
        id,
        email,
        password: scrForm.password,
        department: scrForm.dept,
        role: 'screener'
      };

      const result = await createUser(screenerData);
      const newScreener = normalizeUserRow(result?.user || result);
      setScreeners(p => [newScreener, ...p]);
      setScrForm({ id: '', email: '', dept: DEPARTMENT_OPTIONS[0], password: '' });
      setScrError('');
      showToast(`Screener account created for ${scrForm.email}`, 'success');
    } catch (error) {
      console.error('Error creating screener:', error);
      setScrError(error.message);
      showToast(error.message || 'Failed to create screener', 'error');
    }
  };

  /* ── Download current User Records as PDF ── */
  const download = async () => {
    if (reportInProgressRef.current) return;
    reportInProgressRef.current = true;

    try {
      const isStudentTab = tab === 'student';
      const role = isStudentTab ? 'student' : 'screener';
      const accountStatus = isStudentTab ? studentAccountStatus : screenerAccountStatus;
      const response = isStudentTab
        ? await getAdminStudents(accountStatus)
        : await getAdminScreeners(accountStatus);
      const records = parseUserListResponse(response)
        .filter((user) => (
          String(user?.role || '').trim().toLowerCase() === role
          && (user?.accountStatus === 'archived' ? 'archived' : 'active') === accountStatus
        ))
        .map(normalizeUserRow);
      const department = isStudentTab ? studentDept : screenerDept;
      const search = (isStudentTab ? studentSearch : screenerSearch).trim().toLowerCase();
      let reportUsers = records.filter((user) => (
        (department === 'All' || user.dept === department)
        && (
          user.name.toLowerCase().includes(search)
          || user.email.toLowerCase().includes(search)
          || (isStudentTab && user.sport.toLowerCase().includes(search))
        )
      ));

      reportUsers = sortUsersBySurname(reportUsers);

      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'in', format: [8.5, 11] });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 0.5;
      const tableWidth = pageWidth - margin * 2;
      const fontSize = 8;
      const lineHeight = fontSize / 72 * 1.4;
      const cellPaddingX = 0.07;
      const cellPaddingY = 0.06;
      const bottomLimit = pageHeight - margin - 0.28;
      const columns = isStudentTab
        ? [
          { label: 'NAME', width: 1.8, value: (user) => user.name },
          { label: 'STATUS', width: 0.8, value: (user) => user.status },
          { label: 'SPORT', width: 1, value: (user) => user.sport },
          { label: 'DEPARTMENT', width: 1.3, value: (user) => user.dept },
          { label: 'EMAIL ADDRESS', width: 2.6, value: (user) => user.email },
        ]
        : [
          { label: 'NAME', width: 2, value: (user) => user.name },
          { label: 'EMAIL ADDRESS', width: 3, value: (user) => user.email },
          { label: 'DEPARTMENT', width: 1.5, value: (user) => user.dept },
          { label: 'STATUS', width: 1, value: (user) => user.status },
        ];
      const headerHeight = 0.3;

      const drawTableHeader = (firstPage) => {
        let y;
        if (firstPage) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(123, 30, 30);
          doc.setFontSize(18);
          doc.text('GYMSTAT', margin, 0.78);
          doc.setFontSize(13);
          doc.text('USER RECORDS REPORT', margin, 1.08);
          doc.setFontSize(9);
          doc.text(isStudentTab ? 'STUDENT-ATHLETE USER RECORDS' : 'SCREENER USER RECORDS', margin, 1.32);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(90, 90, 90);
          doc.setFontSize(8);
          doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 1.53);
          doc.setDrawColor(255, 220, 0);
          doc.setLineWidth(0.025);
          doc.line(margin, 1.65, pageWidth - margin, 1.65);
          y = 1.76;
        } else {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(123, 30, 30);
          doc.setFontSize(9);
          doc.text('GYMSTAT  |  USER RECORDS REPORT', margin, 0.34);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.text(isStudentTab ? 'STUDENT-ATHLETE USER RECORDS' : 'SCREENER USER RECORDS', margin, 0.5);
          doc.setDrawColor(255, 220, 0);
          doc.setLineWidth(0.02);
          doc.line(margin, 0.58, pageWidth - margin, 0.58);
          y = 0.68;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(255, 255, 255);
        doc.setFillColor(123, 30, 30);
        doc.rect(margin, y, tableWidth, headerHeight, 'F');
        let x = margin;
        for (const column of columns) {
          doc.text(column.label, x + cellPaddingX, y + 0.19, { maxWidth: column.width - cellPaddingX * 2 });
          x += column.width;
        }
        doc.setDrawColor(255, 220, 0);
        doc.setLineWidth(0.018);
        doc.line(margin, y + headerHeight, pageWidth - margin, y + headerHeight);
        return y + headerHeight;
      };

      let y = drawTableHeader(true);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(fontSize);
      doc.setTextColor(45, 45, 45);

      const tableRows = reportUsers.length
        ? reportUsers.map((user) => columns.map((column) => String(column.value(user) || '—')))
        : [['No records found for the selected filters.', ...columns.slice(1).map(() => '')]];

      tableRows.forEach((row, rowIndex) => {
        const wrappedCells = row.map((value, index) => (
          doc.splitTextToSize(value, columns[index].width - cellPaddingX * 2)
        ));
        const rowHeight = Math.max(0.32, Math.max(...wrappedCells.map((lines) => lines.length)) * lineHeight + cellPaddingY * 2);

        if (y + rowHeight > bottomLimit) {
          doc.addPage();
          y = drawTableHeader(false);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(fontSize);
          doc.setTextColor(45, 45, 45);
        }

        if (rowIndex % 2 === 1) {
          doc.setFillColor(250, 248, 245);
          doc.rect(margin, y, tableWidth, rowHeight, 'F');
        }

        let x = margin;
        wrappedCells.forEach((lines, index) => {
          const column = columns[index];
          doc.setDrawColor(225, 220, 215);
          doc.setLineWidth(0.006);
          doc.rect(x, y, column.width, rowHeight);
          doc.text(lines, x + cellPaddingX, y + cellPaddingY + lineHeight * 0.78, {
            maxWidth: column.width - cellPaddingX * 2,
            lineHeightFactor: 1.4,
          });
          x += column.width;
        });
        y += rowHeight;
      });

      const pageCount = doc.internal.getNumberOfPages();
      for (let page = 1; page <= pageCount; page += 1) {
        doc.setPage(page);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(`Page ${page} of ${pageCount}`, pageWidth / 2, pageHeight - 0.2, { align: 'center' });
      }

      const date = new Date().toISOString().slice(0, 10);
      doc.save(`GYMSTAT_${role}_user_records_${date}.pdf`);
      showToast('PDF report downloaded successfully', 'success');
    } catch (error) {
      console.error('Failed to generate user records PDF:', error);
      showToast(error?.message || 'Failed to generate user records PDF', 'error');
    } finally {
      reportInProgressRef.current = false;
    }
  };

  /* ── Delete selected students ── */
  const archiveSelectedStudents = async () => {
    if (!selStudents.length) return;
    const validIds = selStudents.filter(id => id && String(id).trim().length > 0);
    if (!validIds.length) {
      showToast('No valid student IDs selected', 'error');
      return;
    }
    openConfirmDialog(`Archive ${validIds.length} student(s)?`, async () => {
      try {
        await archiveUsers(validIds);
        setStudents(p => p.filter(s => !validIds.includes(s.id)));
        setSelStudents([]);
        showToast(`Successfully archived ${validIds.length} student(s)`, 'success');
      } catch (error) {
        console.error('❌ Error deleting students:', error);
        console.error('Error details:', {
          message: error?.message,
          stack: error?.stack,
          response: error?.response
        });
        showToast(error?.message || 'Failed to delete students', 'error');
      }
    });
  };

  /* ── Delete selected screeners ── */
  const archiveSelectedScreeners = async () => {
    if (!selScreeners.length) return;
    const validIds = selScreeners.filter(id => id && String(id).trim().length > 0);
    if (!validIds.length) {
      showToast('No valid screener IDs selected', 'error');
      return;
    }
    openConfirmDialog(`Archive ${validIds.length} screener(s)?`, async () => {
      try {
        await archiveUsers(validIds);
        setScreeners(p => p.filter(s => !validIds.includes(s.id)));
        setSelScreeners([]);
        showToast(`Successfully archived ${validIds.length} screener(s)`, 'success');
      } catch (error) {
        console.error('❌ Error deleting screeners:', error);
        console.error('Error details:', {
          message: error?.message,
          stack: error?.stack,
          response: error?.response
        });
        showToast(error?.message || 'Failed to delete screeners', 'error');
      }
    });
  };

  /* ── Delete single student ── */
  const archiveStudent = async (id) => {
    if (!id || String(id).trim().length === 0) {
      showToast('Invalid student ID', 'error');
      return;
    }
    openConfirmDialog('Archive this student account?', async () => {
      try {
        await updateUserArchiveStatus(id, 'archived');
        setStudents(p => p.filter(x => x.id !== id));
        showToast('Student account archived successfully.', 'success');
      } catch (error) {
        console.error('❌ Error deleting student:', error);
        console.error('Error details:', {
          message: error?.message,
          stack: error?.stack,
          response: error?.response
        });
        showToast(error?.message || 'Failed to delete student account', 'error');
      }
    });
  };

  /* ── Delete single screener ── */
  const archiveScreener = async (id) => {
    if (!id || String(id).trim().length === 0) {
      showToast('Invalid screener ID', 'error');
      return;
    }
    openConfirmDialog('Archive this screener account?', async () => {
      try {
        await updateUserArchiveStatus(id, 'archived');
        setScreeners(p => p.filter(x => x.id !== id));
        showToast('Screener account archived successfully.', 'success');
      } catch (error) {
        console.error('❌ Error deleting screener:', error);
        console.error('Error details:', {
          message: error?.message,
          stack: error?.stack,
          response: error?.response
        });
        showToast(error?.message || 'Failed to delete screener account', 'error');
      }
    });
  };

  const restoreUser = async (id, type) => {
    openConfirmDialog(`Restore this ${type} account?`, async () => {
      try {
        await updateUserArchiveStatus(id, 'active');
        if (type === 'student') setStudents((rows) => rows.filter((row) => row.id !== id));
        else setScreeners((rows) => rows.filter((row) => row.id !== id));
        showToast(`${type === 'student' ? 'Student' : 'Screener'} account restored successfully.`, 'success');
      } catch (error) {
        showToast(error?.message || `Failed to restore ${type} account`, 'error');
      }
    });
  };

  /* ── Current search value for the input ── */
  const searchVal = tab === 'student' ? studentSearch : screenerSearch;
  const setSearch = tab === 'student' ? setStudentSearch : setScreenerSearch;

  return (
    <div className="ur-root">

      {/* ── Page header ── */}
      <div className="ur-header">
        <h1 className="ur-title">Registered Student-Athletes,<br />Screeners List</h1>
        <div className="ur-header-actions">
          <div className="ur-search-box">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="ur-search-input"
              placeholder={tab === 'student' ? 'Search Students…' : 'Search Screeners…'}
              value={searchVal}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className="ur-download-btn" onClick={download}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download Records
          </button>
        </div>
      </div>

      {/* ── Tab switcher ── */}
      <div className="ur-tabs">
        <button className={`ur-tab${tab === 'student'  ? ' ur-tab--active' : ''}`} onClick={() => setTab('student')}>Student-Athlete</button>
        <button className={`ur-tab${tab === 'screener' ? ' ur-tab--active' : ''}`} onClick={() => setTab('screener')}>Screener</button>
      </div>

      {/* ══════════ STUDENT-ATHLETE TAB ══════════ */}
      {tab === 'student' && (
        <div className="ur-section">
          <div className="ur-table-topbar">
            <div className="ur-table-topbar__left">
              <span className="ur-section-label">Students</span>
              <span className="ur-count-badge">{filtStudents.length} users</span>
              {studentAccountStatus === 'active' && selStudents.length > 0 && (
                <button className="ur-delete-sel-btn" onClick={archiveSelectedStudents}>Archive ({selStudents.length})</button>
              )}
            </div>
            <div className="ur-table-topbar__right">
              <select className="ur-dept-filter" value={studentAccountStatus} onChange={e => setStudentAccountStatus(e.target.value)}>
                <option value="active">Active</option><option value="archived">Archived</option>
              </select>
              <select className="ur-dept-filter" value={studentDept} onChange={e => setStudentDept(e.target.value)}>
                <option value="All">Department</option>
                {DEPARTMENT_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div className="ur-table-wrap">
            <table className="ur-table">
              <thead>
                <tr>
                  <th className="ur-th-check">
                    <input type="checkbox"
                      checked={selStudents.length === filtStudents.length && filtStudents.length > 0}
                      onChange={() => toggleAll(filtStudents, selStudents, setSelStudents)}
                    />
                  </th>
                  <th>Name</th><th>Status</th><th>Sport</th><th>Department</th><th>Email address</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtStudents.map(s => (
                  <tr key={s.id} className={selStudents.includes(s.id) ? 'ur-row--selected' : ''}>
                    <td className="ur-td-check">
                      <input type="checkbox" checked={selStudents.includes(s.id)} onChange={() => toggle(s.id, setSelStudents)} />
                    </td>
                    <td>
                      <div className="ur-name-cell">
                        <Avatar name={s.name} />
                        <div><div className="ur-name">{s.name}</div><div className="ur-username">@{s.username}</div></div>
                      </div>
                    </td>
                    <td><StatusBadge status={s.status} /></td>
                    <td className="ur-sport">{s.sport || '—'}</td>
                    <td className="ur-dept-tag">{s.dept || '—'}</td>
                    <td className="ur-email">{s.email || '—'}</td>
                    <td>
                      {s.accountStatus === 'archived' ? <button className="ur-row-del" onClick={() => restoreUser(s.id, 'student')}>Restore</button> : <button className="ur-row-del" onClick={() => archiveStudent(s.id)}><Icon name="trash" size={16} /></button>}
                    </td>
                  </tr>
                ))}
                {filtStudents.length === 0 && <tr><td colSpan="7" className="ur-empty">No students found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════ SCREENER TAB ══════════ */}
      {tab === 'screener' && (
        <div className="ur-section">
          {/* Register form */}
          <div className="ur-register-card">
            <h2 className="ur-register-card__title">REGISTER NEW SCREENER</h2>
            <form className="ur-reg-form" onSubmit={registerScreener} noValidate>
              <div className="ur-reg-row">
                <div className="ur-reg-group">
                  <label className="ur-reg-label">ID *</label>
                  <input 
                    type="text" 
                    className="ur-reg-input" 
                    placeholder="Enter ID"
                    value={scrForm.id} 
                    onChange={e => setScrForm(f => ({ ...f, id: e.target.value }))} 
                    required
                  />
                </div>
                <div className="ur-reg-group">
                  <label className="ur-reg-label">Email *</label>
                  <input 
                    type="email" 
                    className="ur-reg-input" 
                    placeholder="Enter email"
                    value={scrForm.email} 
                    onChange={e => setScrForm(f => ({ ...f, email: e.target.value }))} 
                    required
                  />
                </div>
              </div>
              <div className="ur-reg-row">
                <div className="ur-reg-group">
                  <label className="ur-reg-label">Department *</label>
                  <select className="ur-reg-input ur-reg-select" value={scrForm.dept}
                    onChange={e => setScrForm(f => ({ ...f, dept: e.target.value }))}>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div className="ur-reg-row ur-reg-row--center">
                <div className="ur-reg-group ur-reg-group--pw">
                  <label className="ur-reg-label">Password *</label>
                  <div className="ur-pw-wrap">
                    <input 
                      type={scrPwShow ? 'text' : 'password'} 
                      className="ur-reg-input"
                      placeholder="Enter password"
                      value={scrForm.password} 
                      onChange={e => setScrForm(f => ({ ...f, password: e.target.value }))} 
                      required
                    />
                    <button
                      type="button"
                      className="ur-pw-toggle"
                      onClick={() => setScrPwShow(p => !p)}
                      aria-label={scrPwShow ? 'Hide password' : 'Show password'}
                      aria-pressed={scrPwShow}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                        <circle cx="12" cy="12" r="3" />
                        {scrPwShow && <path d="m4 4 16 16" />}
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
              {scrError && <p className="ur-reg-error">{scrError}</p>}
              <div className="ur-reg-row ur-reg-row--center">
                <button type="submit" className="ur-reg-submit">Register</button>
              </div>
            </form>
          </div>

          {/* Screener table */}
          <div className="ur-table-topbar">
            <div className="ur-table-topbar__left">
              <span className="ur-section-label">Screeners</span>
              <span className="ur-count-badge">{filtScreeners.length} users</span>
              <span className="ur-academic-label">Active Registry for Academic Year 2025-2026</span>
              {screenerAccountStatus === 'active' && selScreeners.length > 0 && (
                <button className="ur-delete-sel-btn" onClick={archiveSelectedScreeners}>Archive ({selScreeners.length})</button>
              )}
            </div>
            <div className="ur-table-topbar__right">
              <select className="ur-dept-filter" value={screenerAccountStatus} onChange={e => setScreenerAccountStatus(e.target.value)}>
                <option value="active">Active</option><option value="archived">Archived</option>
              </select>
              <select className="ur-dept-filter" value={screenerDept} onChange={e => setScreenerDept(e.target.value)}>
                <option value="All">Department</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div className="ur-table-wrap">
            <table className="ur-table">
              <thead>
                <tr>
                  <th className="ur-th-check">
                    <input type="checkbox"
                      checked={selScreeners.length === filtScreeners.length && filtScreeners.length > 0}
                      onChange={() => toggleAll(filtScreeners, selScreeners, setSelScreeners)}
                    />
                  </th>
                  <th>Name</th><th>Email address</th><th>Department</th><th>Status ↕</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtScreeners.map(s => (
                  <tr key={s.id} className={selScreeners.includes(s.id) ? 'ur-row--selected' : ''}>
                    <td className="ur-td-check">
                      <input type="checkbox" checked={selScreeners.includes(s.id)} onChange={() => toggle(s.id, setSelScreeners)} />
                    </td>
                    <td>
                      <div className="ur-name-cell">
                        <Avatar name={s.name} />
                        <div><div className="ur-name">{s.name}</div><div className="ur-username">@{s.username}</div></div>
                      </div>
                    </td>
                    <td className="ur-email">{s.email || '—'}</td>
                    <td className="ur-dept-tag">{s.dept || '—'}</td>
                    <td><StatusBadge status={s.status} /></td>
                    <td>
                      {s.accountStatus === 'archived' ? <button className="ur-row-del" onClick={() => restoreUser(s.id, 'screener')}>Restore</button> : <button className="ur-row-del" onClick={() => archiveScreener(s.id)}><Icon name="trash" size={16} /></button>}
                    </td>
                  </tr>
                ))}
                {filtScreeners.length === 0 && <tr><td colSpan="6" className="ur-empty">No screeners found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={confirmDialog.open}
        title="Confirm Action"
        message={confirmDialog.message}
        confirmText="Yes, Proceed"
        cancelText="Cancel"
        onConfirm={handleConfirmDialog}
        onCancel={closeConfirmDialog}
      />
      <NotificationToast message={toast.message} type={toast.type} onClose={closeToast} />
    </div>
  );
}