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
  { _id: 'returned-1', status: 'rejected', reviewedAt: '2026-01-02T00:00:00Z', notificationReadAt: null, fileName: 'PSA.pdf' },
  { _id: 'pending-1', status: 'pending', fileName: 'Insurance.pdf' }
];

const announcements = [
  { _id: 'published-1', type: 'requirement', title: 'New Requirement: Medical Form', relatedRequirementId: 'req-1', isRead: false },
  { _id: 'updated-1', type: 'requirement', title: 'Updated Requirement: COR', relatedRequirementId: 'req-2', isRead: true },
  { _id: 'draft-1', type: 'requirement', title: 'Draft update', relatedRequirementId: 'draft-req', isRead: false },
  { _id: 'event-1', type: 'event', title: 'Sports day', isRead: false },
  { _id: 'document-1', type: 'general', title: 'New document available', isRead: false }
];

const publishedRequirements = [
  { _id: 'req-1', status: 'published', isActive: true },
  { _id: 'req-2', status: 'published', isActive: true },
  { _id: 'draft-req', status: 'draft', isActive: true }
];

test('includes only reviewed submissions and published requirement updates once', () => {
  const notifications = buildStudentNotifications(requirements, announcements, publishedRequirements);
  assert.equal(notifications.length, 4);
  assert.equal(new Set(notifications.map((notification) => notification.notificationId)).size, 4);
  assert.equal(notifications.some((notification) => notification.notificationId === 'requirement:pending-1'), false);
  assert.equal(notifications.some((notification) => notification.notificationId === 'announcement:draft-1'), false);
  assert.equal(notifications.some((notification) => notification.notificationId === 'announcement:event-1'), false);
  assert.equal(notifications.some((notification) => notification.notificationId === 'announcement:document-1'), false);
});

test('deduplicates repeated records from each notification source', () => {
  const notifications = buildStudentNotifications(
    [requirements[0], requirements[0]],
    [announcements[0], announcements[0]],
    publishedRequirements
  );
  assert.equal(notifications.length, 2);
  assert.equal(new Set(notifications.map((notification) => notification.notificationId)).size, 2);
});

test('Document Updates contains only approved and returned student submissions', () => {
  const notifications = buildStudentNotifications(requirements, announcements, publishedRequirements);
  assert.deepEqual(
    filterStudentNotifications(notifications, 'document').map((notification) => notification.notificationId),
    ['requirement:approved-1', 'requirement:returned-1']
  );
});

test('Requirement Updates contains only published requirement announcements', () => {
  const notifications = buildStudentNotifications(requirements, announcements, publishedRequirements);
  assert.deepEqual(
    filterStudentNotifications(notifications, 'requirement').map((notification) => notification.notificationId),
    ['announcement:published-1', 'announcement:updated-1']
  );
});

test('All returns exactly both notification categories without duplicates', () => {
  const notifications = buildStudentNotifications(requirements, announcements, publishedRequirements);
  assert.equal(filterStudentNotifications(notifications, 'all').length, 4);
  assert.equal(new Set(filterStudentNotifications(notifications, 'all').map((item) => item.notificationId)).size, 4);
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
  const notifications = buildStudentNotifications(requirements, announcements, publishedRequirements);
  assert.equal(notifications.find((item) => item.notificationId === 'announcement:updated-1').notificationUnread, false);
  assert.equal(notifications.find((item) => item.notificationId === 'announcement:published-1').notificationUnread, true);
});

test('calculates unread count only from document and requirement notifications', () => {
  const notifications = buildStudentNotifications(requirements, announcements, publishedRequirements);
  assert.equal(getUnreadStudentNotificationCount(notifications), 3);
  assert.equal(getUnreadStudentNotificationCount(filterStudentNotifications(notifications, 'requirement')), 1);
});
