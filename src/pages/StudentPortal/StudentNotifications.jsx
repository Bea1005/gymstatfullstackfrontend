import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
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

const isRequirementNotification = (notification) => notification?.notificationSource === 'requirement';
const isRejectedRequirementNotification = (notification) => (
  isRequirementNotification(notification)
  && String(notification.status || '').toLowerCase() === 'rejected'
);
const getNotificationTitle = (notification) => (
  isRequirementNotification(notification)
    ? `${getRequirementLabel(notification)} - ${isRejectedRequirementNotification(notification) ? 'Returned' : 'Approved'}`
    : notification?.title || 'Announcement'
);
const formatNotificationDateTime = (value) => {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' });
};

export default function StudentNotifications() {
  const location = useLocation();
  const { notify } = useNotifications();
  const [requirements, setRequirements] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [publishedRequirements, setPublishedRequirements] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedNotification, setSelectedNotification] = useState(null);
  const markingNotificationIds = useRef(new Set());
  const notificationPanelRef = useRef(null);
  const notificationListScrollTopRef = useRef(0);

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
  const selectedIsRequirement = isRequirementNotification(selectedNotification);
  const selectedIsRejected = isRejectedRequirementNotification(selectedNotification);
  const selectedTitle = selectedNotification ? getNotificationTitle(selectedNotification) : '';
  const selectedRequirementId = selectedNotification?.customRequirementId
    || selectedNotification?.relatedRequirementId?._id
    || selectedNotification?.relatedRequirementId?.id
    || selectedNotification?.relatedRequirementId;
  const linkedRequirement = selectedRequirementId
    ? publishedRequirements.find((requirement) => (
      String(requirement._id || requirement.id) === String(selectedRequirementId)
    ))
    : null;
  const selectedMessage = selectedNotification
    ? selectedIsRequirement
      ? selectedNotification.remarks
        || selectedNotification.feedback
        || `Your ${getRequirementLabel(selectedNotification).toLowerCase()} was ${selectedIsRejected ? 'returned for correction' : 'approved'}.`
      : selectedNotification.description || selectedNotification.message || 'No additional details are available.'
    : '';

  const handleNotifications = () => {
    if (notificationsOpen) {
      setSelectedNotification(null);
      setNotificationsOpen(false);
      return;
    }

    setNotificationsOpen(true);
  };

  const handleCloseNotifications = () => {
    setSelectedNotification(null);
    setNotificationsOpen(false);
  };

  const handleBackToNotifications = () => {
    setSelectedNotification(null);
    window.requestAnimationFrame(() => {
      if (notificationPanelRef.current) {
        notificationPanelRef.current.scrollTop = notificationListScrollTopRef.current;
      }
    });
  };

  const handleNotificationClick = async (notification) => {
    if (markingNotificationIds.current.has(notification.notificationId)) return;

    markingNotificationIds.current.add(notification.notificationId);
    notificationListScrollTopRef.current = notificationPanelRef.current?.scrollTop || 0;
    try {
      let detailNotification = { ...notification };

      if (isRequirementNotification(notification)) {
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
          detailNotification = {
            ...detailNotification,
            notificationReadAt: readAt,
            notificationUnread: false,
          };
        }
      } else if (notification.notificationUnread) {
        const announcementId = notification._id || notification.id;
        await api.markStudentAnnouncementRead(announcementId);
        setAnnouncements((current) => current.map((announcement) => (
          String(announcement._id || announcement.id) === String(announcementId)
            ? { ...announcement, isRead: true }
            : announcement
        )));
        detailNotification = {
          ...detailNotification,
          isRead: true,
          notificationUnread: false,
        };
      }

      setSelectedNotification(detailNotification);
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
              <div
                className="sh-notification-panel"
                role="dialog"
                aria-label={selectedNotification ? 'Notification details' : 'Student notifications'}
                ref={notificationPanelRef}
              >
                <div className="sh-notification-panel__header">
                  <strong>{selectedNotification ? 'Notification details' : 'Notifications'}</strong>
                  <button type="button" onClick={handleCloseNotifications} aria-label="Close notifications">
                    <Icon name="close" size={16} />
                  </button>
                </div>
                {selectedNotification ? (
                  <div className="sh-notification-detail" key={selectedNotification.notificationId} aria-live="polite">
                    <button
                      type="button"
                      className="sh-notification-back"
                      onClick={handleBackToNotifications}
                    >
                      <Icon name="arrowLeft" size={16} />
                      Back to notifications
                    </button>
                    <div className="sh-notification-detail__heading">
                      <span className={`sh-notification-detail__icon ${selectedIsRejected ? 'sh-notification-detail__icon--returned' : ''}`}>
                        <Icon
                          name={selectedIsRequirement
                            ? (selectedIsRejected ? 'xCircle' : 'checkCircle')
                            : 'megaphone'}
                          size={20}
                        />
                      </span>
                      <div>
                        <p className="sh-notification-detail__eyebrow">
                          {selectedIsRequirement ? 'Document update' : 'Requirement update'}
                        </p>
                        <h3>{selectedTitle}</h3>
                      </div>
                    </div>
                    <div className="sh-notification-detail__badges">
                      {selectedIsRequirement && (
                        <span className={`sh-notification-detail__status ${selectedIsRejected ? 'sh-notification-detail__status--returned' : 'sh-notification-detail__status--approved'}`}>
                          {selectedIsRejected ? 'Returned' : 'Approved'}
                        </span>
                      )}
                      <span className="sh-notification-detail__read-state">
                        {selectedNotification.notificationUnread ? 'Unread' : 'Read'}
                      </span>
                    </div>
                    <dl className="sh-notification-detail__meta">
                      <div>
                        <dt>Date and time</dt>
                        <dd>{formatNotificationDateTime(selectedNotification.notificationDate)}</dd>
                      </div>
                      {selectedIsRequirement && (
                        <>
                          {selectedNotification.fileName && (
                            <div>
                              <dt>File</dt>
                              <dd>{selectedNotification.fileName}</dd>
                            </div>
                          )}
                          {selectedNotification.participationType && (
                            <div>
                              <dt>Participation</dt>
                              <dd>{selectedNotification.participationType}</dd>
                            </div>
                          )}
                          {selectedNotification.uploadDate && (
                            <div>
                              <dt>Submitted</dt>
                              <dd>{formatNotificationDateTime(selectedNotification.uploadDate)}</dd>
                            </div>
                          )}
                        </>
                      )}
                      {!selectedIsRequirement && selectedNotification.type && (
                        <div>
                          <dt>Category</dt>
                          <dd>{selectedNotification.type}</dd>
                        </div>
                      )}
                      {selectedNotification.sport && (
                        <div>
                          <dt>Sport</dt>
                          <dd>{selectedNotification.sport}</dd>
                        </div>
                      )}
                    </dl>
                    <section className="sh-notification-detail__message">
                      <h4>{selectedIsRequirement && selectedIsRejected ? 'Review feedback' : 'Message'}</h4>
                      <p>{selectedMessage}</p>
                    </section>
                    {linkedRequirement && (linkedRequirement.title || linkedRequirement.description || linkedRequirement.instructions) && (
                      <section className="sh-notification-detail__message">
                        <h4>Requirement details</h4>
                        {linkedRequirement.title && <p><strong>{linkedRequirement.title}</strong></p>}
                        {linkedRequirement.description && <p>{linkedRequirement.description}</p>}
                        {linkedRequirement.instructions && <p>{linkedRequirement.instructions}</p>}
                      </section>
                    )}
                  </div>
                ) : (
                  <div className="sh-notification-view" key="notification-list">
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
                        const isRequirement = isRequirementNotification(notification);
                        const rejected = isRejectedRequirementNotification(notification);

                        return (
                          <button
                            type="button"
                            className={`sh-notification-item ${notification.notificationUnread ? 'sh-notification-item--unread' : 'sh-notification-item--read'}`}
                            key={notification.notificationId}
                            onClick={() => handleNotificationClick(notification)}
                          >
                            <Icon
                              name={isRequirement ? (rejected ? 'xCircle' : 'checkCircle') : 'megaphone'}
                              size={18}
                            />
                            <span>
                              <strong>{getNotificationTitle(notification)}</strong>
                              <small className={`sh-notification-status ${notification.notificationUnread ? 'sh-notification-status--unread' : ''}`}>
                                {notification.notificationUnread ? 'Unread' : 'Read'}
                              </small>
                              {isRequirement && rejected && (notification.remarks || notification.feedback) && (
                                <small>Reason: {notification.remarks || notification.feedback}</small>
                              )}
                              {!isRequirement && notification.description && (
                                <small>{notification.description}</small>
                              )}
                              {notification.notificationDate && (
                                <time>{formatNotificationDateTime(notification.notificationDate)}</time>
                              )}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
