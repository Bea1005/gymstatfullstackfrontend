import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildStudentNotifications,
  filterStudentNotifications,
  getRequirementNotificationUnread,
  getUnreadStudentNotificationCount
} from './studentNotificationUtils.js';

const requirements = [
  { _id: 'approved-1', status: 'approved', reviewedAt: '2026-01-03T00:00:00Z', notificationReadAt: null, fileName: 'COR.pdf' },
  { _id: 'rejected-1', status: 'rejected', reviewedAt: '2026-01-02T00:00:00Z', notificationReadAt: null, fileName: 'PSA.pdf' },
  { _id: 'pending-1', status: 'pending', fileName: 'Insurance.pdf' }
];

const announcements = [
  { _id: 'document-1', type: 'general', title: 'New document available', description: 'Download the updated form.', isRead: false },
  { _id: 'requirement-1', type: 'requirement', title: 'Requirement review update', description: 'Review your submissions.', isRead: true },
  { _id: 'event-1', type: 'event', title: 'Sports day', description: 'Event details.', isRead: false }
];

test('includes both existing notification sources once and excludes pending submissions', () => {
  const notifications = buildStudentNotifications(requirements, announcements);
  assert.equal(notifications.length, 5);
  assert.equal(new Set(notifications.map((notification) => notification.notificationId)).size, 5);
  assert.equal(notifications.some((notification) => notification.notificationId === 'requirement:pending-1'), false);
});

test('deduplicates repeated records from each notification source', () => {
  const notifications = buildStudentNotifications(
    [requirements[0], requirements[0]],
    [announcements[0], announcements[0]]
  );

  assert.equal(notifications.length, 2);
  assert.equal(new Set(notifications.map((notification) => notification.notificationId)).size, 2);
});

test('filters document and requirement updates using existing status and announcement type/text', () => {
  const notifications = buildStudentNotifications(requirements, announcements);
  assert.deepEqual(
    filterStudentNotifications(notifications, 'document').map((notification) => notification.notificationId),
    ['announcement:document-1']
  );
  assert.deepEqual(
    new Set(filterStudentNotifications(notifications, 'requirement').map((notification) => notification.notificationId)),
    new Set(['requirement:approved-1', 'requirement:rejected-1', 'announcement:requirement-1'])
  );
});

test('keeps unrelated notification types in All only', () => {
  const notifications = buildStudentNotifications([], announcements);
  assert.equal(filterStudentNotifications(notifications, 'all').length, 3);
  assert.equal(filterStudentNotifications(notifications, 'document').some((item) => item._id === 'event-1'), false);
  assert.equal(filterStudentNotifications(notifications, 'requirement').some((item) => item._id === 'event-1'), false);
});

test('preserves read state and evaluates requirement notification timestamps', () => {
  assert.equal(getRequirementNotificationUnread({
    reviewedAt: '2026-01-03T00:00:00Z',
    notificationReadAt: '2026-01-04T00:00:00Z'
  }), false);
  assert.equal(getRequirementNotificationUnread({
    reviewedAt: '2026-01-03T00:00:00Z',
    notificationReadAt: '2026-01-02T00:00:00Z'
  }), true);
  assert.equal(buildStudentNotifications(requirements, announcements)
    .find((notification) => notification.notificationId === 'announcement:requirement-1').notificationUnread, false);
});

test('calculates the badge from unread notifications across both data sources', () => {
  const notifications = buildStudentNotifications(requirements, announcements);
  assert.equal(getUnreadStudentNotificationCount(notifications), 4);
});
