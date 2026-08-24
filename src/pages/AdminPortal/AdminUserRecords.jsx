import { useState, useEffect } from 'react';
import NotificationToast from '../../components/NotificationToast';
import ConfirmModal from '../../components/ConfirmModal';
import { getAdminStudents, getAdminScreeners, createUser, deleteUser, deleteUsers } from '../../services/api';
import './AdminPortal.css';

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
    role: raw?.role || 'student'
  };
};

const parseUserListResponse = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.users)) return data.users;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

/* ── Constants ── */
const DEPARTMENTS = ['CICS', 'CENG', 'CAS', 'CIT', 'CBA', 'COED'];
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
  const [selStudents,    setSelStudents]    = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(true);

  /* ── Screener state ── */
  const [screeners,      setScreeners]      = useState([]);
  const [screenerSearch, setScreenerSearch] = useState('');
  const [screenerDept,   setScreenerDept]   = useState('All');
  const [selScreeners,   setSelScreeners]   = useState([]);
  const [scrForm,        setScrForm]        = useState({ id: '', email: '', dept: 'CICS', password: '' });
  const [scrPwShow,      setScrPwShow]      = useState(false);
  const [scrError,       setScrError]       = useState('');
  const [loadingScreeners, setLoadingScreeners] = useState(true);
  const [toast,          setToast]          = useState({ message: '', type: 'success' });
  const [confirmDialog,  setConfirmDialog]  = useState({ open: false, message: '', action: null });

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
      setLoadingStudents(true);
      const data = await getAdminStudents();
      const studentsData = parseUserListResponse(data)
        .filter((user) => (user?.role || 'student').toLowerCase() === 'student')
        .map(normalizeUserRow);
      setStudents(studentsData);
    } catch (error) {
      console.error('Error fetching students:', error);
      showToast('Failed to load students', 'error');
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  };

  /* ── Fetch screeners from MongoDB ── */
  const fetchScreeners = async () => {
    try {
      setLoadingScreeners(true);
      const data = await getAdminScreeners();
      const screenersData = parseUserListResponse(data)
        .filter((user) => (user?.role || 'screener').toLowerCase() === 'screener')
        .map(normalizeUserRow);
      setScreeners(screenersData);
    } catch (error) {
      console.error('Error fetching screeners:', error);
      showToast('Failed to load screeners', 'error');
      setScreeners([]);
    } finally {
      setLoadingScreeners(false);
    }
  };

  useEffect(() => {
    fetchStudents();
    fetchScreeners();
  }, []);

  /* ── Generic checkbox helpers ── */
  const toggle    = (id, setter) => setter(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleAll = (rows, sel, setter) => setter(sel.length === rows.length ? [] : rows.map(r => r.id));

  /* ── Filtered lists ── */
  const filtStudents = students.filter(s =>
    (studentDept === 'All' || s.dept === studentDept) &&
    (s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
     s.email.toLowerCase().includes(studentSearch.toLowerCase()) ||
     s.sport.toLowerCase().includes(studentSearch.toLowerCase()))
  );
  const filtScreeners = screeners.filter(s =>
    (screenerDept === 'All' || s.dept === screenerDept) &&
    (s.name.toLowerCase().includes(screenerSearch.toLowerCase()) ||
     s.email.toLowerCase().includes(screenerSearch.toLowerCase()))
  );

  /* ── Register screener ── */
  const registerScreener = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!scrForm.id) {
      setScrError('ID is required.');
      showToast('ID is required.', 'error');
      return;
    }
    
    if (!scrForm.email) {
      setScrError('Email is required.');
      showToast('Email is required.', 'error');
      return;
    }
    
    if (!scrForm.password) { 
      setScrError('Password is required.'); 
      showToast('Password is required.', 'error'); 
      return; 
    }

    try {
      const screenerData = {
        id: scrForm.id.trim(),
        fullname: scrForm.id.trim(),
        username: scrForm.id.trim().toLowerCase(),
        email: scrForm.email.trim(),
        department: scrForm.dept,
        password: scrForm.password,
        sport: '',
        role: 'screener'
      };

      const result = await createUser(screenerData);
      const newScreener = normalizeUserRow(result?.user || result);
      setScreeners(p => [newScreener, ...p]);
      setScrForm({ id: '', email: '', dept: 'CICS', password: '' });
      setScrError('');
      showToast(`Screener account created for ${scrForm.email}`, 'success');
    } catch (error) {
      console.error('Error creating screener:', error);
      setScrError(error.message);
      showToast(error.message || 'Failed to create screener', 'error');
    }
  };

  /* ── Download CSV ── */
  const download = () => {
    let headers, rows;
    if (tab === 'student') {
      headers = ['Name','Username','Sport','Email','Department','Status'];
      rows    = filtStudents.map(r => [r.name, r.username, r.sport, r.email, r.dept, r.status]);
    } else {
      headers = ['Name','Username','Department','Sport','Status'];
      rows    = filtScreeners.map(r => [r.name, r.username, r.dept, r.sport, r.status]);
    }
    const csv  = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `${tab}-records.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Delete selected students ── */
  const deleteSelectedStudents = async () => {
    if (!selStudents.length) return;
    const validIds = selStudents.filter(id => id && String(id).trim().length > 0);
    if (!validIds.length) {
      showToast('No valid student IDs selected', 'error');
      return;
    }
    console.log('🗑️ Bulk delete students - IDs:', validIds);
    openConfirmDialog(`Delete ${validIds.length} student(s)?`, async () => {
      try {
        console.log('📤 Sending delete request for IDs:', validIds);
        const result = await deleteUsers(validIds);
        console.log('✅ Delete successful:', result);
        setStudents(p => p.filter(s => !validIds.includes(s.id)));
        setSelStudents([]);
        showToast(`Successfully deleted ${validIds.length} student(s)`, 'success');
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
  const deleteSelectedScreeners = async () => {
    if (!selScreeners.length) return;
    const validIds = selScreeners.filter(id => id && String(id).trim().length > 0);
    if (!validIds.length) {
      showToast('No valid screener IDs selected', 'error');
      return;
    }
    console.log('🗑️ Bulk delete screeners - IDs:', validIds);
    openConfirmDialog(`Delete ${validIds.length} screener(s)?`, async () => {
      try {
        console.log('📤 Sending delete request for IDs:', validIds);
        const result = await deleteUsers(validIds);
        console.log('✅ Delete successful:', result);
        setScreeners(p => p.filter(s => !validIds.includes(s.id)));
        setSelScreeners([]);
        showToast(`Successfully deleted ${validIds.length} screener(s)`, 'success');
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
  const deleteStudent = async (id) => {
    if (!id || String(id).trim().length === 0) {
      showToast('Invalid student ID', 'error');
      return;
    }
    console.log('🗑️ Single delete student - ID:', id);
    openConfirmDialog('Delete this student account permanently?', async () => {
      try {
        console.log('📤 Sending delete request for ID:', id);
        const result = await deleteUser(id);
        console.log('✅ Delete successful:', result);
        setStudents(p => p.filter(x => x.id !== id));
        showToast('Student account deleted successfully.', 'success');
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
  const deleteScreener = async (id) => {
    if (!id || String(id).trim().length === 0) {
      showToast('Invalid screener ID', 'error');
      return;
    }
    console.log('🗑️ Single delete screener - ID:', id);
    openConfirmDialog('Delete this screener account permanently?', async () => {
      try {
        console.log('📤 Sending delete request for ID:', id);
        const result = await deleteUser(id);
        console.log('✅ Delete successful:', result);
        setScreeners(p => p.filter(x => x.id !== id));
        showToast('Screener account deleted successfully.', 'success');
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

  /* ── Current search value for the input ── */
  const searchVal = tab === 'student' ? studentSearch : screenerSearch;
  const setSearch = tab === 'student' ? setStudentSearch : setScreenerSearch;

  if (loadingStudents || loadingScreeners) {
    return <div className="ur-root"><div className="loading">Loading records...</div></div>;
  }

  return (
    <div className="ur-root">

      {/* ── Page header ── */}
      <div className="ur-header">
        <h1 className="ur-title">Registered Student Athletes,<br />Screeners List</h1>
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
              {selStudents.length > 0 && (
                <button className="ur-delete-sel-btn" onClick={deleteSelectedStudents}>Delete ({selStudents.length})</button>
              )}
            </div>
            <div className="ur-table-topbar__right">
              <select className="ur-dept-filter" value={studentDept} onChange={e => setStudentDept(e.target.value)}>
                <option value="All">Department</option>
                {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
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
                      <button className="ur-row-del" onClick={() => deleteStudent(s.id)}>🗑</button>
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
                    {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
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
                    <button type="button" className="ur-pw-toggle" onClick={() => setScrPwShow(p => !p)}>
                      {scrPwShow ? '🙈' : '👁'}
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
              {selScreeners.length > 0 && (
                <button className="ur-delete-sel-btn" onClick={deleteSelectedScreeners}>Delete ({selScreeners.length})</button>
              )}
            </div>
            <div className="ur-table-topbar__right">
              <select className="ur-dept-filter" value={screenerDept} onChange={e => setScreenerDept(e.target.value)}>
                <option value="All">Department</option>
                {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
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
                  <th>Name</th><th>Email address</th><th>Department</th><th>Status ↕</th><th>Sport</th><th></th>
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
                    <td className="ur-sport">{s.sport || '—'}</td>
                    <td>
                      <button className="ur-row-del" onClick={() => deleteScreener(s.id)}>🗑</button>
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