import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getUpcomingApprovedSchedules,
  sortSchedulesByCreatedAt,
} from './scheduleAvailability.js';

const makeSchedule = (id, values = {}) => ({
  id,
  status: 'active',
  startDate: '2026-03-11',
  endDate: '2026-03-11',
  startTime: '01:00 AM',
  endTime: '02:00 AM',
  ...values,
});

test('upcoming approved schedules use the Manila date and inclusive 14-day window', () => {
  const now = new Date('2026-03-10T16:30:00.000Z');
  const schedules = [
    makeSchedule('today-finished', { startTime: '12:00 AM', endTime: '12:15 AM' }),
    makeSchedule('today-upcoming'),
    makeSchedule('ongoing', {
      startDate: '2026-03-10',
      endDate: '2026-03-11',
      endTime: '01:00 AM',
    }),
    makeSchedule('window-end', { startDate: '2026-03-25', endDate: '2026-03-25' }),
    makeSchedule('outside-window', { startDate: '2026-03-26', endDate: '2026-03-26' }),
    makeSchedule('past', { startDate: '2026-03-10', endDate: '2026-03-10' }),
  ];

  assert.deepEqual(
    getUpcomingApprovedSchedules(schedules, now).map((schedule) => schedule.id),
    ['today-upcoming', 'ongoing', 'window-end']
  );
});

test('upcoming list excludes requests and inactive schedule statuses', () => {
  const now = new Date('2026-03-10T16:30:00.000Z');
  const schedules = [
    makeSchedule('active'),
    makeSchedule('approved', { status: 'Approved' }),
    makeSchedule('pending', { status: 'pending' }),
    makeSchedule('rejected', { status: 'rejected' }),
    makeSchedule('cancelled', { status: 'cancelled' }),
    makeSchedule('completed', { status: 'completed' }),
    makeSchedule('missing-status', { status: '' }),
  ];

  assert.deepEqual(
    getUpcomingApprovedSchedules(schedules, now).map((schedule) => schedule.id),
    ['active', 'approved']
  );
});

test('Manila midnight is the boundary for schedule dates', () => {
  const now = new Date('2025-12-31T16:30:00.000Z');
  const schedules = [
    makeSchedule('previous-day', {
      startDate: '2025-12-31',
      endDate: '2025-12-31',
    }),
    makeSchedule('manila-today', {
      startDate: '2026-01-01',
      endDate: '2026-01-01',
    }),
  ];

  assert.deepEqual(
    getUpcomingApprovedSchedules(schedules, now).map((schedule) => schedule.id),
    ['manila-today']
  );
});

test('upcoming schedules sort oldest to newest by creation timestamp', () => {
  const schedules = [
    { id: 'newest', createdAt: '2026-03-03T10:00:00.000Z', startDate: '2026-03-12' },
    { id: 'missing-first', startDate: '2026-03-11' },
    { id: 'oldest', createdAt: '2026-03-01T10:00:00.000Z', startDate: '2026-03-25' },
    { id: 'missing-second', startDate: '2026-03-10' },
    { id: 'middle', createdAt: '2026-03-02T10:00:00.000Z', startDate: '2026-03-15' },
  ];

  assert.deepEqual(
    sortSchedulesByCreatedAt(schedules).map((schedule) => schedule.id),
    ['oldest', 'middle', 'newest', 'missing-first', 'missing-second']
  );
});
