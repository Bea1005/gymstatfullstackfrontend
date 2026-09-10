import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NotificationToast from '../../components/NotificationToast';
import * as api from '../../services/api';
import './PublicCalendar.css';
import gymBackground from '../../assets/gym-background.jpg';

const TIMES = [
  '12:00 AM','01:00 AM','02:00 AM','03:00 AM','04:00 AM','05:00 AM',
  '06:00 AM','07:00 AM','08:00 AM','09:00 AM','10:00 AM','11:00 AM',
  '12:00 PM','01:00 PM','02:00 PM','03:00 PM','04:00 PM','05:00 PM',
  '06:00 PM','07:00 PM','08:00 PM','09:00 PM','10:00 PM','11:00 PM',
];

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function PublicCalendar() {
  const navigate = useNavigate();
  const today    = new Date();

  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const APPROVED_KEY = 'gymstatApprovedSchedules';
  const REQUESTS_KEY = 'gymstatScheduleRequests';
  const [approvedSchedules, setApprovedSchedules] = useState([]);
  const [scheduleRequests, setScheduleRequests] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(REQUESTS_KEY) || '[]');
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fileLoadPending, setFileLoadPending] = useState(false);

  const loadApprovedSchedules = async () => {
    try {
      const response = await api.getSchedules({ status: 'active' });
      const schedules = Array.isArray(response?.data) ? response.data : [];
      setApprovedSchedules(schedules);
    } catch {
      setApprovedSchedules([]);
    }
  };

  const loadScheduleRequests = () => {
    try {
      const stored = JSON.parse(localStorage.getItem(REQUESTS_KEY) || '[]');
      if (Array.isArray(stored)) setScheduleRequests(stored);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadApprovedSchedules();

    const storageHandler = (e) => {
      if (e.key === APPROVED_KEY) loadApprovedSchedules();
      if (e.key === REQUESTS_KEY) loadScheduleRequests();
    };

    const customHandler = (e) => {
      if (e.detail?.key === APPROVED_KEY) loadApprovedSchedules();
      if (e.detail?.key === REQUESTS_KEY) loadScheduleRequests();
    };

    window.addEventListener('storage', storageHandler);
    window.addEventListener('gymstatStorageUpdate', customHandler);
    return () => {
      window.removeEventListener('storage', storageHandler);
      window.removeEventListener('gymstatStorageUpdate', customHandler);
    };
  }, []);

  // Modal
  const [modal, setModal] = useState(false);
  const [clickedDate, setClickedDate] = useState('');
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState({});
  const [requestFile, setRequestFile] = useState({ name: '', type: '', data: '' });
  const [fileError, setFileError] = useState('');
  const [notification, setNotification] = useState({ message: '', type: 'success' });
  const [form, setForm] = useState({
    eventName: '',
    requesterName: '',
    requesterEmail: '',
    requesterPhone: '',
    purpose: '',
    details: '',
    startDate: '',
    startTime: '08:00 AM',
    endDate: '',
    endTime: '12:00 PM',
    prepDays: '',
  });

  /* ── calendar helpers ── */
  const totalDays  = new Date(year, month + 1, 0).getDate();
  const firstDay   = new Date(year, month, 1).getDay();

  const toStr = (d) =>
    `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

  const toMinutes = (t) => {
    if (!t) return 0;
    const [time, meridian] = String(t).split(' ');
    const [hh, mm] = time.split(':').map(Number);
    let h = hh % 12;
    if (meridian === 'PM') h += 12;
    return h * 60 + mm;
  };

  const normalizeScheduleSource = (schedule) => {
    if (!schedule) return 'internal';
    if (schedule.status === 'rejected') return 'rejected';
    if (schedule.fromRequest || schedule.source === 'public' || schedule.source === 'request' || schedule.requesterName) {
      return 'public';
    }
    return 'internal';
  };

  const rejectedRequestEntriesForDate = (dateStr) => {
    return scheduleRequests
      .filter((request) => String(request.status || '').toLowerCase() === 'rejected')
      .filter((request) => isDateWithinScheduleWindow(
        {
          startDate: request.startDate,
          endDate: request.endDate,
          prepDays: request.prepDays || 0,
        },
        dateStr
      ))
      .map((request) => ({
        ...request,
        id: request.id || request._id,
        event: request.eventName || request.event || 'Disapproved Request',
        startTime: request.startTime || '08:00 AM',
        endTime: request.endTime || '12:00 PM',
        status: 'rejected',
        source: 'public',
        fromRequest: true,
        rejectionReason: request.rejectionReason || 'Rejected by admin',
      }));
  };

  const getScheduleConflict = (candidate, existing) => {
    if (!candidate || !existing) return false;

    const candidateStartDate = new Date(`${candidate.startDate}T00:00:00`);
    const candidateEndDate = new Date(`${candidate.endDate}T00:00:00`);
    const existingStartDate = new Date(`${existing.startDate}T00:00:00`);
    const existingEndDate = new Date(`${existing.endDate}T00:00:00`);
    const existingPrepDays = Number(existing.prepDays || 0) || 0;
    const prepStartDate = new Date(existingStartDate);
    prepStartDate.setDate(prepStartDate.getDate() - existingPrepDays);

    if (candidateEndDate < prepStartDate || candidateStartDate > existingEndDate) return false;

    const candidateStartMs = candidateStartDate.getTime() + toMinutes(candidate.startTime) * 60000;
    const candidateEndMs = candidateEndDate.getTime() + toMinutes(candidate.endTime) * 60000;
    const existingStartMs = existingStartDate.getTime() + toMinutes(existing.startTime) * 60000;
    const existingEndMs = existingEndDate.getTime() + toMinutes(existing.endTime) * 60000;

    const basisStart = candidateStartMs < existingStartMs ? candidateStartMs : existingStartMs;
    const basisEnd = candidateEndMs > existingEndMs ? candidateEndMs : existingEndMs;
    const overlapMs = basisEnd - basisStart;
    if (candidateStartMs >= candidateEndMs || existingStartMs >= existingEndMs) return false;
    return candidateStartMs < existingEndMs && candidateEndMs > existingStartMs && overlapMs > 0;
  };

  const sortEventsByTime = (events) => {
    return [...events].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  };

  const isDateWithinScheduleWindow = (schedule, dateStr) => {
    if (!schedule) return false;

    const currentDate = new Date(`${dateStr}T00:00:00`);
    const startDate = new Date(`${schedule.startDate}T00:00:00`);
    const endDate = new Date(`${schedule.endDate}T00:00:00`);
    const prepDays = Number(schedule.prepDays || 0) || 0;
    const prepStartDate = new Date(startDate);
    prepStartDate.setDate(prepStartDate.getDate() - prepDays);

    return currentDate >= prepStartDate && currentDate <= endDate;
  };

  const eventsOn = (dateStr) =>
    sortEventsByTime([
      ...approvedSchedules.filter((schedule) => isDateWithinScheduleWindow(schedule, dateStr)),
      ...rejectedRequestEntriesForDate(dateStr),
    ]);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y-1); } else setMonth(m => m-1); };
  const nextMonth = () => { if (month === 11) { setMonth(0);  setYear(y => y+1); } else setMonth(m => m+1); };

  /* ── open modal ── */
  const openModal = (d) => {
    const ds = toStr(d);
    setClickedDate(ds);
    setForm({
      eventName: '',
      requesterName: '',
      requesterEmail: '',
      requesterPhone: '',
      purpose: '',
      details: '',
      startDate: ds,
      startTime: '08:00 AM',
      endDate: ds,
      endTime: '12:00 PM',
      prepDays: '',
    });
    setRequestFile({ name: '', type: '', data: '' });
    setFileError('');
    setErrors({});
    setDone(false);
    setModal(true);
  };

  /* ── form ── */
  const set = (k, v) => { 
    if (k === 'prepDays') {
      if (v === '' || /^\d+$/.test(v)) {
        setForm(f => ({ ...f, [k]: v }));
        setErrors(e => ({ ...e, [k]: '' }));
      }
    } else {
      setForm(f => ({ ...f, [k]: v }));
      setErrors(e => ({ ...e, [k]: '' }));
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      setRequestFile({ name: '', type: '', data: '' });
      setFileError('');
      return;
    }
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    const allowedExt = ['.pdf', '.doc', '.docx'];

    const nameLower = (file.name || '').toLowerCase();
    const extOk = allowedExt.some(e => nameLower.endsWith(e));

    if (!allowedTypes.includes(file.type) && !extOk) {
      setRequestFile({ name: '', type: '', data: '' });
      setFileError('Request letter must be a PDF, DOC, or DOCX file.');
      return;
    }

    const reader = new FileReader();
    setFileLoadPending(true);
    reader.onload = () => {
      try {
        const result = reader.result || '';
        const base64 = typeof result === 'string' && result.includes(',') ? result.split(',')[1] : btoa(result);
        setRequestFile({ name: file.name, type: file.type || '', data: base64 });
        setFileError('');
      } catch (err) {
        console.error('File read error:', err);
        setRequestFile({ name: '', type: '', data: '' });
        setFileError('Unable to read the attached file. Please try a different file.');
      } finally {
        setFileLoadPending(false);
      }
    };
    reader.onerror = (err) => {
      console.error('FileReader error:', err);
      setRequestFile({ name: '', type: '', data: '' });
      setFileError('Unable to read the attached file. Please try a different file.');
      setFileLoadPending(false);
    };
    reader.readAsDataURL(file);
  };

  const validate = () => {
    const e = {};
    if (!form.eventName.trim()) e.eventName = 'Event name is required.';
    if (!form.requesterName.trim()) e.requesterName = 'Requester name is required.';
    if (!form.requesterEmail.trim()) e.requesterEmail = 'Requester email is required.';
    if (!form.requesterPhone.trim()) e.requesterPhone = 'Requester phone number is required.';
    if (!form.startDate) e.startDate = 'Required.';
    if (!form.endDate) e.endDate = 'Required.';
    if (form.startDate && form.endDate && form.endDate < form.startDate)
      e.endDate = 'End date cannot be before start date.';
    if (!requestFile.name) e.requestLetter = 'Request letter is required. Please attach a PDF, DOC, or DOCX file.';
    else if (!requestFile.data) e.requestLetter = 'File is still processing. Please wait a moment or re-attach the file.';

    if (form.prepDays && !/^\d+$/.test(form.prepDays)) {
      e.prepDays = 'Please enter a valid whole number.';
    } else if (form.prepDays && parseInt(form.prepDays) < 0) {
      e.prepDays = 'Prep days cannot be negative.';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (form.requesterEmail && !emailRegex.test(form.requesterEmail))
      e.requesterEmail = 'Please enter a valid email address.';

    const cleanedPhone = form.requesterPhone.replace(/[\s()-]/g, '');
    if (form.requesterPhone && !cleanedPhone.match(/^[0-9]{7,15}$/))
      e.requesterPhone = 'Please enter a valid phone number (7-15 digits).';

    if (form.startDate && form.endDate && form.startTime && form.endTime) {
      const candidate = {
        startDate: form.startDate,
        endDate: form.endDate,
        startTime: form.startTime,
        endTime: form.endTime,
      };

      const conflict = approvedSchedules.some((schedule) => getScheduleConflict(candidate, schedule));
      if (conflict) {
        e.startDate = 'This time range overlaps a booked schedule on this date.';
        e.endDate = 'Please choose another available time window.';
      }
    }

    return e;
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    if (fileLoadPending) {
      setNotification({ message: 'Please wait for the attachment to finish uploading.', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      const prepDaysValue = form.prepDays ? parseInt(form.prepDays) : 0;
      
      const requestData = {
        eventName: form.eventName,
        requesterName: form.requesterName,
        requesterEmail: form.requesterEmail,
        requesterPhone: form.requesterPhone,
        purpose: form.purpose,
        details: form.details,
        startDate: form.startDate,
        startTime: form.startTime,
        endDate: form.endDate,
        endTime: form.endTime,
        prepDays: prepDaysValue,
        file: requestFile
      };

      // Use the API function from api.js (PUBLIC endpoint - no auth needed)
      const response = await api.createScheduleRequest(requestData);

      // Also save to localStorage for backward compatibility
      const storedRequests = JSON.parse(localStorage.getItem('gymstatScheduleRequests') || '[]');
      const newRequest = {
        id: response.data?.id || Date.now(),
        ...requestData,
        createdAt: new Date().toISOString(),
        status: 'pending'
      };
      const updatedRequests = [...storedRequests, newRequest];
      localStorage.setItem('gymstatScheduleRequests', JSON.stringify(updatedRequests));
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('gymstatStorageUpdate', { 
          detail: { key: 'gymstatScheduleRequests' } 
        }));
      }

      setNotification({ 
        message: 'Schedule Request Successfully Submitted and Sent to Admin.', 
        type: 'success' 
      });
      setDone(true);
      
      setTimeout(() => {
        setModal(false);
        setDone(false);
      }, 3000);
    } catch (error) {
      console.error('❌ Request submission failed:', error);
      const msg = error?.message || String(error) || 'Failed to submit request. Please try again.';
      setNotification({ message: msg, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── build cells ── */
  const cells = [];
  for (let i = 0; i < firstDay; i++)
    cells.push(<div key={`e${i}`} className="pc-day pc-day--empty" />);

  for (let d = 1; d <= totalDays; d++) {
    const ds     = toStr(d);
    const evs    = eventsOn(ds);
    const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    const hasEvents = evs.length > 0;

    cells.push(
      <div
        key={d}
        className={`pc-day${hasEvents ? ' pc-day--booked' : ''}${isToday ? ' pc-day--today' : ''}`}
        onClick={() => openModal(d)}
      >
        <span className="pc-day__num">{d}</span>
        {hasEvents && (
          <div className={`pc-event-list ${evs.length >= 3 ? 'pc-event-list--scroll' : ''}`}>
            {evs.map((ev, i) => {
              const sourceClass = `pc-event-chip--${normalizeScheduleSource(ev)}`;
              const sourceLabel = normalizeScheduleSource(ev) === 'rejected' ? 'Disapproved' : normalizeScheduleSource(ev) === 'public' ? 'Public' : 'Internal';
              const chipTitle = normalizeScheduleSource(ev) === 'rejected'
                ? `${ev.event}\n${ev.rejectionReason || 'Rejected by admin'}\n${ev.startTime} - ${ev.endTime}`
                : `${ev.event}\n${ev.startTime} - ${ev.endTime}`;
              return (
                <div key={i} className={`pc-event-chip ${sourceClass}`} title={chipTitle}>
                  <span className="pc-event-chip__name">{ev.event.length > 18 ? ev.event.slice(0, 16)+'…' : ev.event}</span>
                  <span className="pc-event-chip__source">{sourceLabel}</span>
                  <span className="pc-event-chip__time">{ev.startTime}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const modalEvs = clickedDate ? eventsOn(clickedDate) : [];
  const [md, mm, my] = clickedDate ? [
    parseInt(clickedDate.split('-')[2]),
    parseInt(clickedDate.split('-')[1]) - 1,
    parseInt(clickedDate.split('-')[0]),
  ] : [0,0,0];

  return (
    <div className="pc-root">
      <div className="pc-bg" style={{ backgroundImage: `url(${gymBackground})` }} />
      <div className="pc-overlay" />

      <button className="pc-back-btn" onClick={() => navigate('/onboarding')}>← Back</button>

      <div className="pc-card">
        <div className="pc-card__header">
          <h1 className="pc-card__title">Marinduque State University Gymnasium Event Calendar</h1>
          <p className="pc-card__subtitle">
            Check daily schedules, upcoming tournaments, and facility availability.
            Keep track of varsity practices and campus events in one place.
          </p>
          <div className="pc-location-pill">
            <span>📍</span> Panfilo M. Manguera, Sr. Rd., Tanza, Boac, Marinduque
          </div>
        </div>

        <div className="pc-calendar">
          <div className="pc-cal-nav">
            <button className="pc-nav-btn" onClick={prevMonth}>◀ Previous</button>
            <h2 className="pc-cal-month">{MONTHS[month]} {year}</h2>
            <button className="pc-nav-btn" onClick={nextMonth}>Next ▶</button>
          </div>
          <div className="pc-cal-weekdays">
            {DAYS.map(d => <div key={d} className="pc-weekday">{d}</div>)}
          </div>
          <div className="pc-cal-grid">{cells}</div>
          <div className="pc-legend">
            <span className="pc-legend__dot pc-legend__dot--internal" /> Internal booking
            <span className="pc-legend__dot pc-legend__dot--public" style={{marginLeft:14}} /> Public request
            <span className="pc-legend__dot pc-legend__dot--rejected" style={{marginLeft:14}} /> Disapproved
            <span className="pc-legend__dot pc-legend__dot--today" style={{marginLeft:14}} /> Today
            <span className="pc-legend__hint">· Click a day to request a schedule for an open time slot</span>
          </div>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="pcm-backdrop" onClick={() => setModal(false)}>
          <div className="pcm-box" onClick={e => e.stopPropagation()}>
            <div className="pcm-header">
              <div>
                <h2 className="pcm-title">Request Gym Schedule</h2>
                <p className="pcm-sub">📅 {MONTHS[mm]} {md}, {my}</p>
              </div>
              <button className="pcm-close" onClick={() => setModal(false)}>✕</button>
            </div>

            {modalEvs.filter((ev) => ev.status !== 'rejected').length > 0 && (
              <div className="pcm-warn">
                <p className="pcm-warn__label">⚠️ Existing bookings for this day:</p>
                {modalEvs.filter((ev) => ev.status !== 'rejected').map(ev => (
                  <div key={ev.id} className={`pcm-warn__item pcm-warn__item--${normalizeScheduleSource(ev)}`}>
                    <span className="pcm-warn__name">{ev.event}</span>
                    <span className="pcm-warn__meta">{normalizeScheduleSource(ev) === 'public' ? 'Public Request' : 'Internal Event'}</span>
                    <span className="pcm-warn__time">{ev.startTime} – {ev.endTime}</span>
                  </div>
                ))}
              </div>
            )}

            {modalEvs.filter((ev) => ev.status === 'rejected').length > 0 && (
              <div className="pcm-warn pcm-warn--rejected">
                <p className="pcm-warn__label">❌ Disapproved request(s):</p>
                {modalEvs.filter((ev) => ev.status === 'rejected').map(ev => (
                  <div key={ev.id} className="pcm-warn__item pcm-warn__item--rejected">
                    <span className="pcm-warn__name">{ev.event}</span>
                    <span className="pcm-warn__meta">Disapproved</span>
                    <span className="pcm-warn__time">{ev.rejectionReason || 'Rejected by admin'}</span>
                  </div>
                ))}
              </div>
            )}

            {done ? (
              <div className="pcm-success">
                <div className="pcm-success__icon">✅</div>
                <h3 className="pcm-success__title">Request Submitted!</h3>
                <p className="pcm-success__msg">
                  Your request for <strong>{form.eventName}</strong> has been submitted.
                  Please wait for admin review.
                </p>
                <div className="pcm-success__details">
                  <div><strong>Requester:</strong> {form.requesterName}</div>
                  <div><strong>Event Date:</strong> {form.startDate} {form.startTime} – {form.endDate} {form.endTime}</div>
                  {form.prepDays && <div><strong>Prep Days:</strong> {form.prepDays} day{form.prepDays !== '1' ? 's' : ''}</div>}
                  {requestFile.name && <div><strong>Letter:</strong> {requestFile.name}</div>}
                </div>
                <button className="pcm-btn pcm-btn--primary" onClick={() => setModal(false)}>Close</button>
              </div>
            ) : (
              <form className="pcm-form" onSubmit={submit} noValidate>
                {/* Event Name */}
                <div className="pcm-group pcm-group--full">
                  <label className="pcm-label">Event Name *</label>
                  <input
                    type="text"
                    className={`pcm-input${errors.eventName ? ' pcm-input--err' : ''}`}
                    placeholder="e.g., Basketball Tournament"
                    value={form.eventName}
                    onChange={e => set('eventName', e.target.value)}
                  />
                  {errors.eventName && <span className="pcm-err">{errors.eventName}</span>}
                </div>

                <div className="pcm-row">
                  <div className="pcm-group">
                    <label className="pcm-label">Requester Name *</label>
                    <input
                      type="text"
                      className={`pcm-input${errors.requesterName ? ' pcm-input--err' : ''}`}
                      placeholder="Your name"
                      value={form.requesterName}
                      onChange={e => set('requesterName', e.target.value)}
                    />
                    {errors.requesterName && <span className="pcm-err">{errors.requesterName}</span>}
                  </div>
                  <div className="pcm-group">
                    <label className="pcm-label">Requester Email *</label>
                    <input
                      type="email"
                      className={`pcm-input${errors.requesterEmail ? ' pcm-input--err' : ''}`}
                      placeholder="you@example.com"
                      value={form.requesterEmail}
                      onChange={e => set('requesterEmail', e.target.value)}
                    />
                    {errors.requesterEmail && <span className="pcm-err">{errors.requesterEmail}</span>}
                  </div>
                </div>

                <div className="pcm-row">
                  <div className="pcm-group">
                    <label className="pcm-label">Requester Phone *</label>
                    <input
                      type="tel"
                      className={`pcm-input${errors.requesterPhone ? ' pcm-input--err' : ''}`}
                      placeholder="e.g., 0917 123 4567"
                      value={form.requesterPhone}
                      onChange={e => set('requesterPhone', e.target.value)}
                    />
                    {errors.requesterPhone && <span className="pcm-err">{errors.requesterPhone}</span>}
                  </div>
                  <div className="pcm-group">
                    <label className="pcm-label">Prep Day(s)</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className={`pcm-input${errors.prepDays ? ' pcm-input--err' : ''}`}
                      placeholder="0"
                      value={form.prepDays}
                      onChange={e => set('prepDays', e.target.value)}
                    />
                    <span className="pcm-helper">Days before the event for setup.</span>
                    {errors.prepDays && <span className="pcm-err">{errors.prepDays}</span>}
                  </div>
                </div>

                {/* Start Date + Start Time */}
                <div className="pcm-row">
                  <div className="pcm-group">
                    <label className="pcm-label">Start Date *</label>
                    <input
                      type="date"
                      className={`pcm-input${errors.startDate ? ' pcm-input--err' : ''}`}
                      value={form.startDate}
                      onChange={e => set('startDate', e.target.value)}
                    />
                    {errors.startDate && <span className="pcm-err">{errors.startDate}</span>}
                  </div>
                  <div className="pcm-group">
                    <label className="pcm-label">Start Time *</label>
                    <select className="pcm-input pcm-select" value={form.startTime} onChange={e => set('startTime', e.target.value)}>
                      {TIMES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                {/* End Date + End Time */}
                <div className="pcm-row">
                  <div className="pcm-group">
                    <label className="pcm-label">End Date *</label>
                    <input
                      type="date"
                      className={`pcm-input${errors.endDate ? ' pcm-input--err' : ''}`}
                      value={form.endDate}
                      onChange={e => set('endDate', e.target.value)}
                    />
                    {errors.endDate && <span className="pcm-err">{errors.endDate}</span>}
                  </div>
                  <div className="pcm-group">
                    <label className="pcm-label">End Time *</label>
                    <select className="pcm-input pcm-select" value={form.endTime} onChange={e => set('endTime', e.target.value)}>
                      {TIMES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                <div className="pcm-group pcm-group--full">
                  <label className="pcm-label">Additional Details</label>
                  <textarea
                    className="pcm-input pcm-textarea"
                    rows="4"
                    placeholder="Tell us more about your event or special instructions"
                    value={form.details}
                    onChange={e => set('details', e.target.value)}
                  />
                </div>

                <div className="pcm-group pcm-group--full">
                  <label className="pcm-label">Request Letter *</label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className={`pcm-input pcm-file-input${fileError || errors.requestLetter ? ' pcm-input--err' : ''}`}
                    onChange={handleFileChange}
                  />
                  {(fileError || errors.requestLetter) && <span className="pcm-err">{fileError || errors.requestLetter}</span>}
                  {requestFile.name && !fileError && <span className="pcm-file-help">Attached: {requestFile.name}</span>}
                </div>

                <div className="pcm-actions">
                  <button type="button" className="pcm-btn pcm-btn--cancel" onClick={() => setModal(false)}>Cancel</button>
                  <button type="submit" className="pcm-btn pcm-btn--primary" disabled={isSubmitting || fileLoadPending}>
                    {isSubmitting ? 'Submitting...' : fileLoadPending ? 'Processing attachment...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      <NotificationToast
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification({ message: '', type: 'success' })}
      />
    </div>
  );
}