import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as api from '../../services/api';
import { useNotifications } from '../../components/useNotifications';
import Icon from '../../components/Icon';
import {
  buildStudentNotifications,
  filterStudentNotifications,
  getUnreadStudentNotificationCount
} from './studentNotificationUtils';

const isStudentAnnouncementList = (announcements) => (
  Array.isArray(announcements)
  && announcements.every((announcement) => (
    announcement
    && (announcement._id || announcement.id)
    && typeof announcement.isRead === 'boolean'
  ))
);

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

const AnnouncementDetailModal = ({ announcement, onClose }) => {
  if (!announcement) return null;

  const getIconForAnnouncement = (title) => {
    if (!title) return 'megaphone';
    if (title.includes('Sport Event')) return 'trophy';
    if (title.includes('Athlete Records')) return 'barChart';
    if (title.includes('Sports Clearance')) return 'checkCircle';
    if (title.includes('Medical Evaluation')) return 'stethoscope';
    if (title.includes('Records Verification')) return 'search';
    if (title.includes('Requirement')) return 'clipboard';
    return 'megaphone';
  };

  const getStatusStyle = (type) => {
    switch (type) {
      case 'requirement':
        return { backgroundColor: '#fee2e2', color: '#991b1b' };
      case 'event':
      case 'training':
        return { backgroundColor: '#dbeafe', color: '#1e40af' };
      default:
        return { backgroundColor: '#fef3c7', color: '#92400e' };
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="announcement-detail-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div className="header-icon"><Icon name={getIconForAnnouncement(announcement.title)} /></div>
          <h2>{announcement.title || 'Announcement'}</h2>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close announcement details">
            <Icon name="close" />
          </button>
        </div>
        <div className="detail-modal-body">
          <div className="detail-status">
            <span
              className="detail-status-badge"
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '9999px',
                fontSize: '0.875rem',
                fontWeight: '700',
                textTransform: 'uppercase',
                ...getStatusStyle(announcement.type)
              }}
            >
              {announcement.type || 'general'}
            </span>
            <span className="detail-date">
              <Icon name="calendar" size={16} />
              Posted: {announcement.date ? new Date(announcement.date).toLocaleDateString() : 'Recently'}
            </span>
          </div>
          <div className="detail-description">
            <p>{announcement.description || 'No description available'}</p>
          </div>
          <div className="detail-actions">
            <button className="detail-close-btn" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function StudentNotifications() {
  const navigate = useNavigate();
  const location = useLocation();
  const { notify } = useNotifications();
  const [requirements, setRequirements] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [publishedRequirements, setPublishedRequirements] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const markingNotificationIds = useRef(new Set());

  useEffect(() => {
    let active = true;

    const refreshNotifications = async () => {
      const results = await Promise.allSettled([
        api.getStudentRequirements(),
        api.getStudentRequirementAnnouncements(),
        api.getPublishedRequirements()
      ]);
      const errors = [];

      if (results[0].status === 'fulfilled' && Array.isArray(results[0].value?.data)) {
        if (active) setRequirements(results[0].value.data);
      } else {
        const error = results[0].status === 'rejected'
          ? results[0].reason
          : new Error('The requirement notification response was invalid.');
        console.error('Failed to refresh student requirement updates:', error);
        errors.push('Requirement updates could not be loaded.');
      }

      if (results[1].status === 'fulfilled' && isStudentAnnouncementList(results[1].value?.data)) {
        if (active) setAnnouncements(results[1].value.data);
      } else {
        const error = results[1].status === 'rejected'
          ? results[1].reason
          : new Error('The announcement notification response was invalid.');
        console.error('Failed to refresh student announcements:', error);
        errors.push('Other notifications could not be loaded.');
      }

      if (results[2].status === 'fulfilled' && Array.isArray(results[2].value?.data)) {
        if (active) setPublishedRequirements(results[2].value.data);
      } else {
        const error = results[2].status === 'rejected'
          ? results[2].reason
          : new Error('The published requirement response was invalid.');
        console.error('Failed to refresh published student requirements:', error);
        errors.push('Requirement updates could not be loaded.');
      }

      if (active) {
        setLoadError(errors.join(' '));
        setLoading(false);
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshNotifications();
    };

    refreshNotifications();
    const intervalId = window.setInterval(refreshNotifications, 30000);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  const notifications = useMemo(
    () => buildStudentNotifications(requirements, announcements, publishedRequirements),
    [requirements, announcements, publishedRequirements]
  );
  const visibleNotifications = filterStudentNotifications(notifications, category);
  const unreadCount = getUnreadStudentNotificationCount(notifications);

  const handleNotifications = () => {
    setNotificationsOpen((open) => !open);
  };

  const handleNotificationClick = async (notification) => {
    if (markingNotificationIds.current.has(notification.notificationId)) return;

    markingNotificationIds.current.add(notification.notificationId);
    try {
      if (notification.notificationSource === 'requirement') {
        if (notification.notificationUnread) {
          await api.markStudentRequirementNotificationRead(
            notification._id || notification.id,
            notification.participationType
          );
          const readAt = new Date().toISOString();
          setRequirements((current) => current.map((requirement) => (
            String(requirement._id || requirement.id) === String(notification._id || notification.id)
              ? { ...requirement, notificationReadAt: readAt }
              : requirement
          )));
        }
        setNotificationsOpen(false);
        navigate('/student/requirements');
        return;
      }

      if (notification.notificationUnread) {
        const announcementId = notification._id || notification.id;
        await api.markStudentAnnouncementRead(announcementId);
        setAnnouncements((current) => current.map((announcement) => (
          String(announcement._id || announcement.id) === String(announcementId)
            ? { ...announcement, isRead: true }
            : announcement
        )));
      }

      setNotificationsOpen(false);
      setSelectedAnnouncement({ ...notification, isRead: true, notificationUnread: false });
    } catch (error) {
      console.error('Failed to mark student notification as read:', error);
      notify('error', 'Notification Update Failed', error.message || 'Unable to mark this notification as read.');
    } finally {
      markingNotificationIds.current.delete(notification.notificationId);
    }
  };

  if (location.pathname !== '/student/home') {
    return null;
  }

  return (
    <>
      <div className="portal-topbar">
        <div className="topbar-right">
          <div className="sh-notification-wrap">
            <button
              type="button"
              className="topbar-icon-btn sh-topbar-document"
              onClick={handleNotifications}
              title="View notifications"
              aria-label="View notifications"
              aria-expanded={notificationsOpen}
              aria-haspopup="dialog"
            >
              <Icon name="bell" className="sh-notification-bell" />
              {unreadCount > 0 && <span className="sh-notification-badge">{unreadCount}</span>}
            </button>
            {notificationsOpen && (
              <div className="sh-notification-panel" role="dialog" aria-label="Student notifications">
                <div className="sh-notification-panel__header">
                  <strong>Notifications</strong>
                  <button type="button" onClick={() => setNotificationsOpen(false)} aria-label="Close notifications">
                    <Icon name="close" size={16} />
                  </button>
                </div>
                <label className="sh-notification-filter">
                  <span>Filter notifications</span>
                  <select value={category} onChange={(event) => setCategory(event.target.value)}>
                    <option value="all">All Notifications</option>
                    <option value="document">Document Updates</option>
                    <option value="requirement">Requirement Updates</option>
                  </select>
                </label>
                {loadError && <p className="sh-notification-error" role="alert">{loadError}</p>}
                {loading ? (
                  <p className="sh-notification-empty">Loading notifications...</p>
                ) : visibleNotifications.length === 0 ? (
                  <p className="sh-notification-empty">
                    {notifications.length === 0 ? 'No notifications.' : 'No notifications in this category.'}
                  </p>
                ) : (
                  visibleNotifications.map((notification) => {
                    const isRequirementSubmission = notification.notificationSource === 'requirement';
                    const rejected = isRequirementSubmission
                      && String(notification.status).toLowerCase() === 'rejected';
                    const notificationTitle = isRequirementSubmission
                      ? `${getRequirementLabel(notification)} - ${rejected ? 'Returned' : 'Approved'}`
                      : notification.title || 'Announcement';
                    const notificationDate = notification.notificationDate;

                    return (
                      <button
                        type="button"
                        className={`sh-notification-item ${notification.notificationUnread ? 'sh-notification-item--unread' : 'sh-notification-item--read'}`}
                        key={notification.notificationId}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <Icon
                          name={isRequirementSubmission ? (rejected ? 'xCircle' : 'checkCircle') : 'megaphone'}
                          size={18}
                        />
                        <span>
                          <strong>{notificationTitle}</strong>
                          <small className={`sh-notification-status ${notification.notificationUnread ? 'sh-notification-status--unread' : ''}`}>
                            {notification.notificationUnread ? 'Unread' : 'Read'}
                          </small>
                          {isRequirementSubmission && rejected && (notification.remarks || notification.feedback) && (
                            <small>Reason: {notification.remarks || notification.feedback}</small>
                          )}
                          {!isRequirementSubmission && notification.description && (
                            <small>{notification.description}</small>
                          )}
                          {notificationDate && <time>{new Date(notificationDate).toLocaleString()}</time>}
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
      <AnnouncementDetailModal
        announcement={selectedAnnouncement?.notificationSource === 'announcement' ? selectedAnnouncement : null}
        onClose={() => setSelectedAnnouncement(null)}
      />
    </>
  );
}
