import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as api from '../../services/api';
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchDashboardData = async () => {
      try {
        const data = await api.getAdminDashboard();
        if (!mounted) return;

        setStats({
          totalUsers: Number(data.totalUsers) || 0,
          totalEquipments: Number(data.totalEquipments) || 0,
          borrowedItems: Number(data.borrowedItems) || 0,
          pendingReqs: Number(data.pendingRequirements) || 0,
        });

        setActivities(Array.isArray(data.activities) && data.activities.length > 0 ? data.activities : DEMO_ACTIVITIES);
        setSchedules(Array.isArray(data.upcomingSchedules) && data.upcomingSchedules.length > 0 ? data.upcomingSchedules : DEMO_SCHEDULES);
      } catch (error) {
        if (!mounted) return;
        console.warn('Admin dashboard fetch error:', error);
        setActivities(DEMO_ACTIVITIES);
        setSchedules(DEMO_SCHEDULES);
      } finally {
        if (mounted) setLoading(false);
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


  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <p>Loading dashboard…</p>
      </div>
    );
  }

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
          { label: "TOTAL USER",       value: stats.totalUsers,      icon: <IconUsers />,    path: "/admin/student-athletes" },
          { label: "TOTAL EQUIPMENT",  value: stats.totalEquipments, icon: <IconEquip />,    path: "/admin/equipments" },
          { label: "BORROWED ITEMS",   value: stats.borrowedItems,   icon: <IconBorrow />,   path: "/admin/borrowing" },
          { label: "PENDING REQS",     value: stats.pendingReqs,     icon: <IconReqs />,     path: "/admin/requirements" },
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

/* ── Demo data ── */
const DEMO_ACTIVITIES = [
  { id: 1, action: "New athlete registered: Juan Dela Cruz",       time: "2 hours ago" },
  { id: 2, action: "Equipment borrowed: 5 Basketballs",            time: "Yesterday"   },
  { id: 3, action: "Schedule updated: Basketball Practice",        time: "Yesterday"   },
  { id: 4, action: "Requirement submitted: Medical Certificate",   time: "2 days ago"  },
];
const DEMO_SCHEDULES = [
  { id: 1, title: "Basketball Practice", date: "2026-03-28", time: "08:00 AM" },
  { id: 2, title: "Swimming Tryouts",    date: "2026-03-29", time: "10:00 AM" },
  { id: 3, title: "Coaches Meeting",     date: "2026-03-30", time: "02:00 PM" },
];

/* ── Inline SVG icons ── */
function IconUsers() {
  return (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
    </svg>
  );
}
function IconEquip() {
  return (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29l-1.43-1.43z"/>
    </svg>
  );
}
function IconBorrow() {
  return (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l7.59-7.59L21 8l-9 9z"/>
    </svg>
  );
}
function IconReqs() {
  return (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
    </svg>
  );
}

export default AdminDashboard;

