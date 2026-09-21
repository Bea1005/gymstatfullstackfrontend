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

  useEffect(() => {
    let mounted = true;

    const fetchDashboardData = async () => {
      try {
        const data = await api.getAdminDashboard();
        if (!mounted) return;

        const [scheduleResult, pendingRequestResult] = await Promise.allSettled([
          api.getSchedules(),
          api.getScheduleRequests({ status: 'pending' })
        ]);

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
      } catch (error) {
        if (!mounted) return;
        console.warn('Admin dashboard fetch error:', error);
        setActivities(DEMO_ACTIVITIES);
        setSchedules([]);
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

    const intervalId = window.setInterval(fetchDashboardData, 5000);
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
          { label: "TOTAL USER",       value: stats.totalUsers,      icon: <Icon name="users" size={38} />,    path: "/admin/student-athletes" },
          { label: "TOTAL EQUIPMENT",  value: stats.totalEquipments, icon: <Icon name="wrench" size={38} />,    path: "/admin/equipments" },
          { label: "BORROWED ITEMS",   value: stats.borrowedItems,   icon: <Icon name="clipboardCheck" size={38} />,   path: "/admin/borrowing" },
          { label: "PENDING REQS",     value: stats.pendingReqs,     icon: <Icon name="fileText" size={38} />,     path: "/admin/schedules" },
        ].map((s) => (
          <div key={s.label} className="db-stat-card" onClick={() => navigate(s.path)}>
            <div className="db-stat-card__left">
              <span className="db-stat-card__label">{s.label}</span>
              <span className="db-stat-card__value">{s.value}</span>
            </div>
            <div className="db-stat-card__icon">{s.icon}</div>
          </div>
        ))}
      </div>

      {/* ── Bottom Panels ── */}
      <div className="db-panels">

        {/* Latest Activities */}
        <div className="db-panel">
          <h3 className="db-panel__title">Latest Activities</h3>
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

