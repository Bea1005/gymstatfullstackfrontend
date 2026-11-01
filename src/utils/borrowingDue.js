const BORROWING_TIME_ZONE = 'Asia/Manila';
const manilaDateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BORROWING_TIME_ZONE,
  calendar: 'gregory',
  numberingSystem: 'latn',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const parseStoredDateParts = (value) => {
  if (value instanceof Date && Number.isNaN(value.getTime())) return null;
  const dateText = value instanceof Date ? value.toISOString().slice(0, 10) : String(value || '').trim().slice(0, 10);
  const match = dateText.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const parts = match.slice(1).map(Number);
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  if (date.getUTCFullYear() !== parts[0] || date.getUTCMonth() !== parts[1] - 1 || date.getUTCDate() !== parts[2]) return null;
  return { year: parts[0], month: parts[1], day: parts[2], text: dateText };
};

const parseStoredEndTime = (value) => {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (minutes > 59) return null;
  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    hours = (hours % 12) + (meridiem === 'PM' ? 12 : 0);
  } else if (hours > 23) {
    return null;
  }
  return { hours, minutes };
};

const getManilaDateTime = ({ year, month, day }, { hours, minutes }) => {
  const utcGuess = Date.UTC(year, month - 1, day, hours, minutes);
  const manilaParts = Object.fromEntries(
    manilaDateTimeFormatter.formatToParts(new Date(utcGuess))
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value }) => [type, Number(value)])
  );
  const manilaTimeAsUtc = Date.UTC(
    manilaParts.year,
    manilaParts.month - 1,
    manilaParts.day,
    manilaParts.hour,
    manilaParts.minute,
    manilaParts.second
  );
  return new Date(utcGuess - (manilaTimeAsUtc - utcGuess));
};

const hasReturnedTimestamp = (timestamp) => {
  if (!timestamp) return false;
  if (typeof timestamp === 'string') return Boolean(timestamp.trim());
  if (typeof timestamp !== 'object') return true;
  return Boolean(String(timestamp.date || '').trim() || String(timestamp.time || '').trim());
};

export const isBorrowingReturned = (record) => (
  ['returned', 'completed'].includes(String(record.status || '').trim().toLowerCase())
  || Boolean(record.returnedAt)
  || hasReturnedTimestamp(record.returnedTimestamp)
);

export const getBorrowingDueDateTime = (record) => {
  const dateParts = parseStoredDateParts(
    record.returnDate || record.endDate || record.borrowTimestamp?.date || record.borrowDate
  );
  const timeParts = parseStoredEndTime(record.endTime);
  if (!dateParts || !timeParts) return null;

  return {
    value: getManilaDateTime(dateParts, timeParts),
    date: dateParts.text,
  };
};

export const isBorrowingDeadlineApproaching = (record, now = new Date()) => {
  if (isBorrowingReturned(record)) return false;

  const dueDateTime = getBorrowingDueDateTime(record);
  if (!dueDateTime) return false;

  const remainingMs = dueDateTime.value.getTime() - now.getTime();
  return remainingMs > 0 && remainingMs <= 60 * 60 * 1000;
};

export const isBorrowingDue = (record, now = new Date()) => {
  if (isBorrowingReturned(record)) return false;

  const dueDateTime = getBorrowingDueDateTime(record);
  return Boolean(dueDateTime && dueDateTime.value <= now);
};

export const getDueBorrowings = (records, now = new Date()) => records
  .filter((record) => isBorrowingDue(record, now))
  .map((record) => ({ ...record, dueDate: getBorrowingDueDateTime(record).date }))
  .sort((first, second) => getBorrowingDueDateTime(first).value - getBorrowingDueDateTime(second).value);
