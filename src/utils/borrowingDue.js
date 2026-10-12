const parseStoredDateParts = (value) => {
  const dateText = value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value || '').trim().slice(0, 10);
  const match = dateText.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const parts = match.slice(1).map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  if (date.getFullYear() !== parts[0] || date.getMonth() !== parts[1] - 1 || date.getDate() !== parts[2]) return null;
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

export const getBorrowingDueDateTime = (record) => {
  const dateParts = parseStoredDateParts(record.returnDate || record.borrowTimestamp?.date || record.borrowDate);
  const timeParts = parseStoredEndTime(record.endTime);
  if (!dateParts || !timeParts) return null;

  return {
    value: new Date(dateParts.year, dateParts.month - 1, dateParts.day, timeParts.hours, timeParts.minutes),
    date: dateParts.text,
  };
};

export const isBorrowingDeadlineApproaching = (record, now = new Date()) => {
  const status = String(record.status || '').trim().toLowerCase();
  if (
    ['returned', 'completed'].includes(status)
    || record.returnedAt
    || record.returnedTimestamp
  ) return false;

  const dueDateTime = getBorrowingDueDateTime(record);
  if (!dueDateTime) return false;

  const remainingMs = dueDateTime.value.getTime() - now.getTime();
  return remainingMs > 0 && remainingMs <= 60 * 60 * 1000;
};

export const getDueBorrowings = (records, now = new Date()) => records
  .filter((record) => {
    const status = String(record.status || '').trim().toLowerCase();
    if (['returned', 'completed'].includes(status) || record.returnedAt || record.returnedTimestamp) return false;

    const dueDateTime = getBorrowingDueDateTime(record);
    return Boolean(dueDateTime && dueDateTime.value <= now);
  })
  .map((record) => ({ ...record, dueDate: getBorrowingDueDateTime(record).date }))
  .sort((first, second) => getBorrowingDueDateTime(first).value - getBorrowingDueDateTime(second).value);
