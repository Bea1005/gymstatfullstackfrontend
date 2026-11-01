import { TIMES } from '../constants/scheduleTimes';

const CALENDAR_TIME_ZONE = 'Asia/Manila';
const DAY_MS = 24 * 60 * 60 * 1000;

const getCalendarParts = (date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CALENDAR_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
};

export const getCalendarDateString = (date = new Date()) => {
  const parts = getCalendarParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export const parseScheduleTime = (value) => {
  const match = String(value || '').trim().match(/^(\d{1,2}):([0-5]\d)\s*(AM|PM)$/i);
  if (!match) return null;

  const hour = Number(match[1]);
  if (hour < 1 || hour > 12) return null;
  return (hour % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0)) * 60 + Number(match[2]);
};

export const isPastScheduleDate = (dateString, now = new Date()) =>
  Boolean(dateString) && dateString < getCalendarDateString(now);

export const isPastScheduleTime = (dateString, time, now = new Date()) => {
  if (!dateString || !time) return false;
  const today = getCalendarDateString(now);
  if (dateString < today) return true;
  if (dateString > today) return false;

  const minutes = parseScheduleTime(time);
  if (minutes === null) return false;
  const parts = getCalendarParts(now);
  const nowMs = (
    Number(parts.hour) * 60 * 60
    + Number(parts.minute) * 60
    + Number(parts.second)
  ) * 1000 + now.getMilliseconds();
  return minutes * 60 * 1000 < nowMs;
};

const dateOrdinal = (dateString) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateString || ''))) return null;
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return Math.floor(date.getTime() / DAY_MS);
};

export const isDateFullyOccupied = (dateString, schedules, excludeScheduleId = null) => {
  const ordinal = dateOrdinal(dateString);
  const openingTime = parseScheduleTime(TIMES[0]);
  const closingTime = parseScheduleTime(TIMES[TIMES.length - 1]);
  if (ordinal === null || openingTime === null || closingTime === null) return false;

  const dayStart = ordinal * DAY_MS + openingTime * 60 * 1000;
  const dayEnd = ordinal * DAY_MS + closingTime * 60 * 1000;
  const intervals = [];

  (Array.isArray(schedules) ? schedules : []).forEach((schedule) => {
    if (String(schedule?.status || 'active').toLowerCase() !== 'active') return;
    const scheduleId = schedule?.id || schedule?._id;
    if (excludeScheduleId !== null && String(scheduleId) === String(excludeScheduleId)) return;

    const startOrdinal = dateOrdinal(schedule?.startDate);
    const endOrdinal = dateOrdinal(schedule?.endDate);
    const startMinutes = parseScheduleTime(schedule?.startTime);
    const endMinutes = parseScheduleTime(schedule?.endTime);
    if (startOrdinal === null || endOrdinal === null || startMinutes === null || endMinutes === null) return;

    const prepDays = Math.max(0, Number(schedule.prepDays || 0) || 0);
    const start = (startOrdinal - prepDays) * DAY_MS + startMinutes * 60 * 1000;
    const end = endOrdinal * DAY_MS + endMinutes * 60 * 1000;
    if (start < dayEnd && end > dayStart) intervals.push([Math.max(start, dayStart), Math.min(end, dayEnd)]);
  });

  intervals.sort((first, second) => first[0] - second[0]);
  let coveredUntil = dayStart;
  for (const [start, end] of intervals) {
    if (start > coveredUntil) return false;
    coveredUntil = Math.max(coveredUntil, end);
    if (coveredUntil >= dayEnd) return true;
  }
  return false;
};
