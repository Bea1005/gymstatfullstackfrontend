import { useState, useEffect } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import * as api from "../../services/api";
import Icon from "../../components/Icon";
import "./StudentPortal.css";

const UPDATES = [
  { id: 1, title: "Team 1 Basketball Team Training", date: "January 23, 2026", time: "8AM�10AM", type: "training" },
  { id: 2, title: "Intramural Requirements 2026", date: "January 14, 2026", time: "All Day", type: "requirement" },
];

export default function StudentHomePage() {
  const navigate = useNavigate();
  const { user: authenticatedUser } = useOutletContext();
  const user = {
    name: authenticatedUser?.fullname || "Athlete",
    email: authenticatedUser?.email || "student@marsu.edu",
  };
  const [stats, setStats] = useState({ pending: 0, approved: 0 });
  const [documentNotifications, setDocumentNotifications] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  async function fetchData() {
    try {
      await api.getAnnouncements({ limit: 5 });
      const statsData = await api.getStudentStats();
      setStats(statsData.data);
      const requirementsData = await api.getStudentRequirements();
      const reviewedRequirements = (requirementsData.data || [])
        .filter((requirement) => ['approved', 'rejected'].includes(String(requirement.status || '').toLowerCase()))
        .sort((first, second) => new Date(second.reviewedAt || second.updatedAt || 0) - new Date(first.reviewedAt || first.updatedAt || 0));
      setDocumentNotifications(reviewedRequirements);
    } catch (error) {
      console.error("Error fetching data:", error);
      setStats({ pending: 0, approved: 0 });
      setDocumentNotifications([]);
    }
  }

  useEffect(() => {
    const fetchTimeout = setTimeout(fetchData, 0);
    return () => clearTimeout(fetchTimeout);
  }, [navigate]);

  const handleNav = (key) => {
    navigate(`/student/${key}`);
  };

  const isNotificationUnread = (notification) => {
    const reviewedAt = new Date(notification.reviewedAt || notification.updatedAt || 0).getTime();
    const readAt = new Date(notification.notificationReadAt || 0).getTime();
    return !readAt || readAt < reviewedAt;
  };

  const unreadNotifications = documentNotifications.filter(isNotificationUnread);

  const markNotificationsRead = async (notifications) => {
    const unread = notifications.filter(isNotificationUnread);
    if (!unread.length) return;

    const results = await Promise.allSettled(unread.map((notification) => (
      api.markStudentRequirementNotificationRead(notification._id, notification.participationType)
    )));

    if (results.some((result) => result.status === 'fulfilled')) {
      const readAt = new Date().toISOString();
      const readIds = new Set(unread.map((notification) => notification._id));
      setDocumentNotifications((current) => current.map((notification) => (
        readIds.has(notification._id) ? { ...notification, notificationReadAt: readAt } : notification
      )));
    }
  };

  const handleNotifications = () => {
    const nextOpen = !notificationsOpen;
    setNotificationsOpen(nextOpen);
    if (nextOpen) markNotificationsRead(documentNotifications);
  };

  const handleNotificationClick = () => {
    setNotificationsOpen(false);
    handleNav("requirements");
  };

  const getRequirementLabel = (requirement) => {
    if (requirement.customRequirementLabel) return requirement.customRequirementLabel;
    const labels = {
      medical: 'Medical Certificate',
      cor: 'COR',
      psa: 'PSA',
      insurance: 'Insurance',
      profile: 'Profile',
      consent: 'Parent Consent',
      tor: 'TOR'
    };
    return labels[requirement.requirementType] || requirement.fileName || 'Requirement document';
  };

  return (
    <div className="portal-page-content">
      <div className="portal-topbar">
        <div className="topbar-right">
          <div className="sh-notification-wrap">
            <button
              className="topbar-icon-btn sh-topbar-document"
              onClick={handleNotifications}
              title="View document notifications"
              aria-label="View document notifications"
              aria-expanded={notificationsOpen}
              aria-haspopup="dialog"
            >
              <Icon name="bell" className="sh-notification-bell" />
              {unreadNotifications.length > 0 && <span className="sh-notification-badge">{unreadNotifications.length}</span>}
            </button>
            {notificationsOpen && (
              <div className="sh-notification-panel" role="dialog" aria-label="Document updates">
                <div className="sh-notification-panel__header">
                  <strong>Document Updates</strong>
                  <button type="button" onClick={() => setNotificationsOpen(false)} aria-label="Close notifications">
                    <Icon name="close" size={16} />
                  </button>
                </div>
                {documentNotifications.length === 0 ? (
                  <p className="sh-notification-empty">No reviewed document updates.</p>
                ) : (
                  documentNotifications.map((notification) => {
                    const rejected = String(notification.status).toLowerCase() === 'rejected';
                    const reviewedDate = notification.reviewedAt || notification.updatedAt;
                    return (
                      <button
                        type="button"
                        className="sh-notification-item"
                        key={notification._id}
                        onClick={handleNotificationClick}
                      >
                        <Icon name={rejected ? 'xCircle' : 'checkCircle'} size={18} />
                        <span>
                          <strong>{getRequirementLabel(notification)} - {rejected ? 'Rejected' : 'Approved'}</strong>
                          {rejected && (notification.remarks || notification.feedback) && (
                            <small>Reason: {notification.remarks || notification.feedback}</small>
                          )}
                          {reviewedDate && <time>{new Date(reviewedDate).toLocaleString()}</time>}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="portal-content sh-content">
        <div className="sh-welcome-card">
          <div className="sh-welcome-content">
            <p className="sh-welcome-sub">WELCOME BACK, ATHLETE!</p>
            <h1 className="sh-welcome-name" style={{ color: 'white' }}>{user.name}</h1>
          </div>
          <div className="sh-person-container">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div className="sh-decor-circle"></div>
        </div>

         <p className="sh-section-label">Quick Action</p>
         <div className="sh-quick-card">
           <p className="sh-quick-title">Sport Requirements</p>
           <p className="sh-quick-desc">{stats.pending} pending • {stats.approved} approved</p>
           <button className="sh-upload-btn" onClick={() => handleNav("requirements")}> 
             <span>View & Upload</span>
             <span className="upload-icon"></span>
           </button>
         </div>

      </div>
    </div>
  );
}
