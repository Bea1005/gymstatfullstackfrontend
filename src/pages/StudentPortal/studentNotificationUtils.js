export const getRequirementNotificationUnread = (notification) => {
  const reviewedAt = new Date(
    notification.notificationReviewAt
    || notification.coachReviewedAt
    || notification.reviewedAt
    || notification.updatedAt
    || 0
  ).getTime();
  const readAt = new Date(notification.notificationReadAt || 0).getTime();
  return !readAt || readAt < reviewedAt;
};

const getLatestRequirementReview = (requirement) => {
  const status = String(requirement.status || '').toLowerCase();
  const coachStatus = String(requirement.coachStatus || '').toLowerCase();
  const statusReview = ['approved', 'rejected'].includes(status)
    ? {
        status,
        reviewedAt: requirement.reviewedAt || requirement.approvalDate || requirement.updatedAt || requirement.createdAt,
        remarks: requirement.remarks
      }
    : null;
  const coachReview = ['approved', 'rejected'].includes(coachStatus)
    ? {
        status: coachStatus,
        reviewedAt: requirement.coachReviewedAt || requirement.updatedAt || requirement.createdAt,
        remarks: requirement.coachRemarks
      }
    : null;

  if (!statusReview) return coachReview;
  if (!coachReview) return statusReview;

  return new Date(coachReview.reviewedAt || 0).getTime()
    >= new Date(statusReview.reviewedAt || 0).getTime()
    ? coachReview
    : statusReview;
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
    .forEach((requirement) => {
      const id = requirement._id || requirement.id;
      if (!id) return;
      const review = getLatestRequirementReview(requirement);
      if (!review) return;

      notificationsById.set('requirement:' + id, {
        ...requirement,
        status: review.status,
        remarks: review.remarks || '',
        notificationReviewAt: review.reviewedAt,
        notificationId: 'requirement:' + id,
        notificationSource: 'requirement',
        notificationCategory: 'document',
        notificationDate: review.reviewedAt,
        notificationUnread: getRequirementNotificationUnread({
          ...requirement,
          notificationReviewAt: review.reviewedAt
        })
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
