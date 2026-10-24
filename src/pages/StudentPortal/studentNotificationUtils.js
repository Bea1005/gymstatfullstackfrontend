const DOCUMENT_KEYWORDS = /\b(documents?|files?|downloads?|availability)\b/i;

export const getRequirementNotificationUnread = (notification) => {
  const reviewedAt = new Date(notification.reviewedAt || notification.updatedAt || 0).getTime();
  const readAt = new Date(notification.notificationReadAt || 0).getTime();
  return !readAt || readAt < reviewedAt;
};

const getAnnouncementCategory = (announcement) => {
  if (String(announcement.type || '').toLowerCase() === 'requirement' || announcement.relatedRequirementId) {
    return 'requirement';
  }

  const announcementText = `${announcement.title || ''} ${announcement.description || ''}`;
  return DOCUMENT_KEYWORDS.test(announcementText) ? 'document' : 'other';
};

export const buildStudentNotifications = (requirements, announcements) => {
  const notificationsById = new Map();

  (Array.isArray(requirements) ? requirements : [])
    .filter((requirement) => ['approved', 'rejected'].includes(String(requirement.status || '').toLowerCase()))
    .forEach((requirement) => {
      const id = requirement._id || requirement.id;
      if (!id) return;

      notificationsById.set(`requirement:${id}`, {
        ...requirement,
        notificationId: `requirement:${id}`,
        notificationSource: 'requirement',
        notificationCategory: 'requirement',
        notificationDate: requirement.reviewedAt || requirement.updatedAt || requirement.createdAt,
        notificationUnread: getRequirementNotificationUnread(requirement)
      });
    });

  (Array.isArray(announcements) ? announcements : []).forEach((announcement) => {
    const id = announcement._id || announcement.id;
    if (!id) return;

    notificationsById.set(`announcement:${id}`, {
      ...announcement,
      notificationId: `announcement:${id}`,
      notificationSource: 'announcement',
      notificationCategory: getAnnouncementCategory(announcement),
      notificationDate: announcement.date || announcement.updatedAt || announcement.createdAt,
      notificationUnread: announcement.isRead === false
    });
  });

  return Array.from(notificationsById.values()).sort((first, second) => (
    new Date(second.notificationDate || 0) - new Date(first.notificationDate || 0)
  ));
};

export const filterStudentNotifications = (notifications, category) => (
  category === 'all'
    ? notifications
    : notifications.filter((notification) => notification.notificationCategory === category)
);

export const getUnreadStudentNotificationCount = (notifications) => (
  notifications.filter((notification) => notification.notificationUnread).length
);
