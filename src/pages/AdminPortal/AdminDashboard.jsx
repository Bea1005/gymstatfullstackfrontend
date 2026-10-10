import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as api from '../../services/api';
import Icon from '../../components/Icon';
import "./AdminPortal.css";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalUsers: 12,
    totalEquipments: 5,
    borrowedItems: 5,
    pendingReqs: 5,
  });
  const [activities, setActivities] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [dueBorrowings, setDueBorrowings] = useState([]);
  const [borrowingLoadState, setBorrowingLoadState] = useState('loading');

  useEffect(() => {
    let mounted = true;
    let fetching = false;

    const fetchDashboardData = async () => {
      if (fetching) return;
      fetching = true;

      try {
        const data = await api.getAdminDashboard();
        if (!mounted) return;

        const [scheduleResult, pendingRequestResult, borrowingResult] = await Promise.allSettled([
          api.getSchedules(),
          api.getScheduleRequests({ status: 'pending' }),
          api.getBorrowingRecords(),
        ]);
        if (!mounted) return;

        setStats({
          totalUsers: Number(data.totalUsers) || 0,
          totalEquipments: Number(data.totalEquipments) || 0,
          borrowedItems: Number(data.borrowedItems) || 0,
          pendingReqs: pendingRequestResult.status === 'fulfilled'
            ? getPendingRequestCount(pendingRequestResult.value)
            : Number(data.pendingRequirements) || 0,
        });

        setActivities(Array.isArray(data.activities) && data.activities.length > 0 ? data.activities : DEMO_ACTIVITIES);
        setSchedules(scheduleResult.status === 'fulfilled'
          ? getUpcomingSchedules(scheduleResult.value)
          : []);

        if (borrowingResult.status === 'fulfilled') {
          const borrowingRecords = Array.isArray(borrowingResult.value)
            ? borrowingResult.value
            : (Array.isArray(borrowingResult.value?.data) ? borrowingResult.value.data : []);
          setDueBorrowings(getDueBorrowings(borrowingRecords));
          setBorrowingLoadState('ready');
        } else {
          console.error('Admin dashboard borrowing fetch error:', borrowingResult.reason);
          setDueBorrowings([]);
          setBorrowingLoadState(getBorrowingErrorState(borrowingResult.reason));
        }
      } catch (error) {
        if (!mounted) return;
        console.warn('Admin dashboard fetch error:', error);
        setActivities(DEMO_ACTIVITIES);
        setSchedules([]);
        setDueBorrowings([]);
        setBorrowingLoadState(getBorrowingErrorState(error));
      } finally {
        fetching = false;
      }
    };

    fetchDashboardData();

    const handleRefresh = () => {
      fetchDashboardData();
    };

    const handleStorageRefresh = (event) => {
      if (event.key === 'gymstat-schedule-updated') {
        fetchDashboardData();
      }
    };

    const intervalId = window.setInterval(fetchDashboardData, 30000);
    window.addEventListener('gymstat-schedule-updated', handleRefresh);
    window.addEventListener('storage', handleStorageRefresh);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener('gymstat-schedule-updated', handleRefresh);
      window.removeEventListener('storage', handleStorageRefresh);
    };
  }, []);


  return (
    <div className="db-root">

      {/* ── Welcome Banner ── */}
      <div className="db-banner">
        <div className="db-banner__circles">
          <div className="db-banner__circle db-banner__circle--1" />
          <div className="db-banner__circle db-banner__circle--2" />
        </div>
        <div className="db-banner__text">
          <h1 className="db-banner__title">Welcome<br />Back, Admin!</h1>
          <p className="db-banner__sub">Monitoring the excellence of MarSU Athletes.</p>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="db-stats">
        {[
          { label: "TOTAL USER",       value: stats.totalUsers,      icon: <Icon name="users" size={38} />,    path: "/admin/user-records" },
          { label: "TOTAL EQUIPMENT",  value: stats.totalEquipments, icon: <Icon name="wrench" size={38} />,    path: "/admin/equipments" },
          { label: "BORROWED ITEMS",   value: stats.borrowedItems,   icon: <Icon name="clipboardCheck" size={38} />,   path: "/admin/borrowing" },
          { label: "PENDING REQS",     value: stats.pendingReqs,     icon: <Icon name="fileText" size={38} />,     path: "/admin/schedules" },
        ].map((s) => {
          const isTotalUserCard = s.label === "TOTAL USER";
          const onCardClick = isTotalUserCard ? () => navigate(s.path) : undefined;
          const onCardKeyDown = isTotalUserCard
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  navigate(s.path);
                }
              }
            : undefined;

          return (
            <div
              key={s.label}
              className="db-stat-card"
              onClick={onCardClick}
              onKeyDown={onCardKeyDown}
              role={isTotalUserCard ? "button" : undefined}
              tabIndex={isTotalUserCard ? 0 : undefined}
              style={isTotalUserCard ? { cursor: "pointer" } : undefined}
            >
              <div className="db-stat-card__left">
                <span className="db-stat-card__label">{s.label}</span>
                <span className="db-stat-card__value">{s.value}</span>
              </div>
              <div className="db-stat-card__icon">{s.icon}</div>
            </div>
          );
        })}
      </div>

      {/* ── Bottom Panels ── */}
      <div className="db-panels">

        {/* Latest Activities */}
        <div className="db-panel">
          <h3 className="db-panel__title">User Registrations</h3>
          <div className="db-activity-list">
            {activities.map((a) => (
              <div key={a.id} className="db-activity-item">
                <span className="db-activity-dot" />
                <span className="db-activity-text">{a.action}</span>
                <span className="db-activity-time">{a.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Due Borrowed Items */}
        <div className="db-panel">
          <h3 className="db-panel__title">Due Borrowed Items</h3>
          <div className="db-due-list" aria-live="polite">
            {borrowingLoadState === 'loading' && <p className="db-schedule-date">Loading borrowed items...</p>}
            {borrowingLoadState === 'session-error' && <p className="db-schedule-date">Admin session expired. Please sign in again.</p>}
            {borrowingLoadState === 'authorization-error' && <p className="db-schedule-date">You are not authorized to view borrowing records.</p>}
            {borrowingLoadState === 'route-error' && <p className="db-schedule-date">Borrowing records endpoint is unavailable.</p>}
            {borrowingLoadState === 'server-error' && <p className="db-schedule-date">Borrowing records could not be loaded from the server.</p>}
            {borrowingLoadState === 'error' && <p className="db-schedule-date">Unable to load due borrowed items. Check your connection and retry.</p>}
            {borrowingLoadState === 'ready' && dueBorrowings.length === 0 && (
              <p className="db-schedule-date">No due borrowed items</p>
            )}
            {borrowingLoadState === 'ready' && dueBorrowings.map((record) => (
              <div className="db-due-item" key={record._id || record.id}>
                <div className="db-due-item__info">
                  <span className="db-schedule-title">{record.fullname || record.Name || 'Unknown borrower'}</span>
                  <span className="db-schedule-date">{record.equipment || 'Unknown item'}</span>
                  {record.referenceIds?.length > 0 && (
                    <span className="db-due-reference">Ref: {record.referenceIds.join(', ')}</span>
                  )}
                  <span className="db-schedule-date">Due: {record.dueDate}</span>
                </div>
                <div className="db-due-item__status">
                  <span className="db-schedule-time">{record.endTime}</span>
                  <span className="db-due-status">{record.status}</span>
                </div>
              </div>
            ))}
          </div>
          <button className="db-view-all" onClick={() => navigate('/admin/borrowing')}>
            View Borrowing Records
          </button>
        </div>

        {/* Upcoming Schedules */}
        <div className="db-panel">
          <h3 className="db-panel__title">Upcoming Schedules</h3>
          <div className="db-schedule-list">
            {schedules.length === 0 && <p className="db-schedule-date">No upcoming approved schedules.</p>}
            {schedules.map((s) => {
              const scheduleTitle = s.event || s.title || 'Untitled Schedule';
              const scheduleDate = s.startDate
                ? (s.startDate === s.endDate ? s.startDate : `${s.startDate} - ${s.endDate}`)
                : (s.date || '');
              const scheduleTime = s.startTime && s.endTime
                ? `${s.startTime} - ${s.endTime}`
                : (s.time || '');
              const scheduleStatus = s.status ? s.status : '';

              return (
                <div key={s._id || s.id} className="db-schedule-item">
                  <div className="db-schedule-info">
                    <span className="db-schedule-title">{scheduleTitle}</span>
                    <span className="db-schedule-date">{scheduleDate}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span className="db-schedule-time">{scheduleTime}</span>
                    {scheduleStatus && <span className="db-schedule-status" style={{ fontSize: '0.8rem', color: '#666' }}>{scheduleStatus}</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <button className="db-view-all" onClick={() => navigate("/admin/schedules")}>
            View All Schedules
          </button>
        </div>

      </div>
    </div>
  );
};

const getPendingRequestCount = (response) => {
  const requests = Array.isArray(response?.data) ? response.data : [];
  return requests.filter((request) => String(request.status || '').toLowerCase() === 'pending').length;
};

const getBorrowingErrorState = (error) => {
  if (error?.status === 401 || error?.code === 'SESSION_EXPIRED') return 'session-error';
  if (error?.status === 403) return 'authorization-error';
  if (error?.status === 404) return 'route-error';
  if (error?.status >= 500) return 'server-error';
  return 'error';
};

const parseStoredDateParts = (value) => {
  const dateText = value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value || '').trim().slice(0, 10);
  const match = dateText.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const parts = match.slice(1).map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  if (date.getFullYear() !== parts[0] || date.getMonth() !== parts[1] - 1 || date.getDate() !== parts[2]) return null;
  return { year: parts[0], month: parts[1], day: parts[2], text: dateText };
};

const parseStoredEndTime = (value) => {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (minutes > 59) return null;
  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    hours = (hours % 12) + (meridiem === 'PM' ? 12 : 0);
  } else if (hours > 23) {
    return null;
  }
  return { hours, minutes };
};

const getBorrowingDueDateTime = (record) => {
  const dateParts = parseStoredDateParts(record.returnDate || record.borrowTimestamp?.date || record.borrowDate);
  const timeParts = parseStoredEndTime(record.endTime);
  if (!dateParts || !timeParts) return null;

  return {
    value: new Date(dateParts.year, dateParts.month - 1, dateParts.day, timeParts.hours, timeParts.minutes),
    date: dateParts.text,
  };
};

const getDueBorrowings = (records, now = new Date()) => records
  .filter((record) => {
    const status = String(record.status || '').trim().toLowerCase();
    if (['returned', 'completed'].includes(status) || record.returnedAt || record.returnedTimestamp) return false;

    const dueDateTime = getBorrowingDueDateTime(record);
    return Boolean(dueDateTime && dueDateTime.value <= now);
  })
  .map((record) => ({ ...record, dueDate: getBorrowingDueDateTime(record).date }))
  .sort((first, second) => getBorrowingDueDateTime(first).value - getBorrowingDueDateTime(second).value);

const parseScheduleDateTime = (dateValue, timeValue, endOfDay = false) => {
  if (!dateValue) return null;
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;

  if (!timeValue) {
    date.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, 999);
    return date;
  }

  const timeMatch = String(timeValue).trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!timeMatch) return date;

  let hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  const meridiem = timeMatch[3]?.toUpperCase();
  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  date.setHours(hours, minutes, 0, 0);
  return date;
};

const getUpcomingSchedules = (response) => {
  const schedules = Array.isArray(response?.data) ? response.data : [];
  const now = new Date();

  return schedules
    .filter((schedule) => String(schedule.status || '').toLowerCase() === 'active')
    .filter((schedule) => {
      const endDate = schedule.endDate || schedule.startDate;
      const end = parseScheduleDateTime(endDate, schedule.endTime, true);
      return end && end >= now;
    })
    .sort((first, second) => {
      const firstStart = parseScheduleDateTime(first.startDate, first.startTime) || new Date(0);
      const secondStart = parseScheduleDateTime(second.startDate, second.startTime) || new Date(0);
      return firstStart - secondStart;
    })
    .slice(0, 10);
};

/* ── Demo data ── */
const DEMO_ACTIVITIES = [
  { id: 1, action: "New athlete registered: Juan Dela Cruz",       time: "2 hours ago" },
  { id: 2, action: "Equipment borrowed: 5 Basketballs",            time: "Yesterday"   },
  { id: 3, action: "Schedule updated: Basketball Practice",        time: "Yesterday"   },
  { id: 4, action: "Requirement submitted: Medical Certificate",   time: "2 days ago"  },
];
export default AdminDashboard;

