export const getRequirementNotificationUnread = (notification) => {
  const reviewedAt = new Date(notification.reviewedAt || notification.updatedAt || 0).getTime();
  const readAt = new Date(notification.notificationReadAt || 0).getTime();
  return !readAt || readAt < reviewedAt;
};

export const buildStudentNotifications = (requirements, announcements, publishedRequirements = []) => {
  const notificationsById = new Map();
  const publishedRequirementIds = new Set(
    (Array.isArray(publishedRequirements) ? publishedRequirements : [])
      .filter((requirement) => (
        requirement
        && requirement.status === 'published'
        && requirement.isActive !== false
      ))
      .map((requirement) => String(requirement._id || requirement.id))
  );

  (Array.isArray(requirements) ? requirements : [])
    .filter((requirement) => ['approved', 'rejected'].includes(String(requirement.status || '').toLowerCase()))
    .forEach((requirement) => {
      const id = requirement._id || requirement.id;
      if (!id) return;

      notificationsById.set('requirement:' + id, {
        ...requirement,
        notificationId: 'requirement:' + id,
        notificationSource: 'requirement',
        notificationCategory: 'document',
        notificationDate: requirement.reviewedAt || requirement.updatedAt || requirement.createdAt,
        notificationUnread: getRequirementNotificationUnread(requirement)
      });
    });

  (Array.isArray(announcements) ? announcements : []).forEach((announcement) => {
    const relatedRequirementId = announcement.relatedRequirementId?._id
      || announcement.relatedRequirementId;
    if (
      String(announcement.type || '').toLowerCase() !== 'requirement'
      || announcement.isActive === false
      || !relatedRequirementId
      || !publishedRequirementIds.has(String(relatedRequirementId))
    ) {
      return;
    }

    const id = announcement._id || announcement.id;
    if (!id) return;

    notificationsById.set('announcement:' + id, {
      ...announcement,
      notificationId: 'announcement:' + id,
      notificationSource: 'announcement',
      notificationCategory: 'requirement',
      notificationDate: announcement.date || announcement.updatedAt || announcement.createdAt,
      notificationUnread: announcement.isRead === false
    });
  });

  return Array.from(notificationsById.values()).sort((first, second) => (
    new Date(second.notificationDate || 0) - new Date(first.notificationDate || 0)
  ));
};

export const filterStudentNotifications = (notifications, category) => (
  notifications.filter((notification) => (
    category === 'all' || notification.notificationCategory === category
  ))
);

export const getUnreadStudentNotificationCount = (notifications) => (
  notifications.filter((notification) => notification.notificationUnread).length
);
