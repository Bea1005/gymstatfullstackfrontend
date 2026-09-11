import React, { useState, useEffect } from 'react';
import NotificationToast from '../../components/NotificationToast';
import ConfirmModal from '../../components/ConfirmModal';
import DocumentViewer from '../../components/DocumentViewer';
import * as api from '../../services/api';
import './AdminPortal.css';

// Define TIMES array for time selection
const TIMES = [
  '12:00 AM','01:00 AM','02:00 AM','03:00 AM','04:00 AM','05:00 AM',
  '06:00 AM','07:00 AM','08:00 AM','09:00 AM','10:00 AM','11:00 AM',
  '12:00 PM','01:00 PM','02:00 PM','03:00 PM','04:00 PM','05:00 PM',
  '06:00 PM','07:00 PM','08:00 PM','09:00 PM','10:00 PM','11:00 PM',
];

const AdminSchedules = () => {
  const [reservations, setReservations] = useState([
    { id: 1, event: 'Acquaintance Party', startDate: '2026-03-25', endDate: '2026-03-25', startTime: '01:00 PM', endTime: '05:00 PM' },
    { id: 2, event: 'CICS WEEK 2026', startDate: '2026-04-10', endDate: '2026-04-10', startTime: '08:00 AM', endTime: '12:00 PM' },
  ]);

  const [showModal, setShowModal] = useState(false);
  const [showNotAvailableModal, setShowNotAvailableModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedEventDetails, setSelectedEventDetails] = useState(null);
  const [formData, setFormData] = useState({
    event: '',
    startDate: '',
    endDate: '',
    startTime: '08:00 AM',
    endTime: '12:00 PM',
    prepDays: 0
  });

  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay();
  };

  const currentDate = new Date();
  const [currentYear, setCurrentYear] = useState(currentDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(currentDate.getMonth());
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const [confirmCancelId, setConfirmCancelId] = useState(null);
  const [scheduleRequests, setScheduleRequests] = useState([]);
  const [requestPanelOpen, setRequestPanelOpen] = useState(false);
  const [expandedRequestId, setExpandedRequestId] = useState(null);
  const [previewFile, setPreviewFile] = useState({ url: '', name: '', type: '' });
  const APPROVED_KEY = 'gymstatApprovedSchedules';
  const REQUESTS_KEY = 'gymstatScheduleRequests';
  const [confirmAction, setConfirmAction] = useState(null);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [selectedRejectReason, setSelectedRejectReason] = useState('');
  const [additionalRejectReason, setAdditionalRejectReason] = useState('');
  const [deletingRequestId, setDeletingRequestId] = useState(null);
  const REJECTION_REASONS = [
    'Schedule conflict',
    'Gymnasium already reserved',
    'Requested time is unavailable',
    'Requested date is unavailable',
    'Incomplete request information',
    'Request does not meet scheduling requirements',
    'Maintenance or facility unavailable',
    'Other'
  ];

  const normalizeScheduleEntry = (schedule) => ({
    id: schedule?.id || schedule?._id || Date.now(),
    event: schedule?.event || schedule?.eventName || '',
    startDate: schedule?.startDate,
    endDate: schedule?.endDate,
    startTime: schedule?.startTime,
    endTime: schedule?.endTime,
    prepDays: Number(schedule?.prepDays || 0) || 0,
    ...schedule,
  });

  const loadApprovedSchedules = () => {
    if (typeof window === 'undefined') return;
    try {
      const stored = JSON.parse(localStorage.getItem(APPROVED_KEY) || 'null');
      if (Array.isArray(stored) && stored.length) {
        setReservations(stored.map(normalizeScheduleEntry));
      } else if (stored && stored.length === 0) {
        setReservations([]);
      } else if (!stored || stored.length === 0) {
        setReservations([]);
      }
    } catch (err) {
      console.error('Error loading approved schedules:', err);
    }
  };

  const notifyScheduleRefresh = () => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('gymstat-schedule-updated', String(Date.now()));
      window.dispatchEvent(new Event('gymstat-schedule-updated'));
      window.dispatchEvent(new CustomEvent('gymstatStorageUpdate', { detail: { key: APPROVED_KEY } }));
    } catch (err) {
      console.warn('Unable to notify dashboard of schedule refresh', err);
    }
  };

  const saveApprovedSchedules = (list, broadcast = true) => {
    if (typeof window === 'undefined') return;
    try {
      const normalizedList = (Array.isArray(list) ? list : []).map(normalizeScheduleEntry);
      localStorage.setItem(APPROVED_KEY, JSON.stringify(normalizedList));
      setReservations(normalizedList);
      if (broadcast) {
        window.dispatchEvent(new CustomEvent('gymstatStorageUpdate', { detail: { key: APPROVED_KEY } }));
        notifyScheduleRefresh();
      }
    } catch (err) {
      console.error('Error saving approved schedules:', err);
    }
  };

  const loadSchedulesFromServer = async () => {
    try {
      const response = await api.getSchedules();
      if (response?.success && Array.isArray(response.data)) {
        const normalizedSchedules = response.data.map(normalizeScheduleEntry);
        const sortedSchedules = [...normalizedSchedules].sort((a, b) => {
          const aDate = new Date(`${a.startDate}T00:00:00`);
          const bDate = new Date(`${b.startDate}T00:00:00`);
          return aDate - bDate;
        });
        saveApprovedSchedules(sortedSchedules, false);
        return sortedSchedules;
      }
    } catch (err) {
      console.error('Error loading schedules from server:', err);
      loadApprovedSchedules();
    }
    return null;
  };

  // Load schedule requests from MongoDB
  const loadScheduleRequests = async () => {
    try {
      setLoadingRequests(true);
      const response = await api.getScheduleRequests();
      
      if (response.success && response.data) {
        const normalized = response.data.map(normalizeScheduleRequest);
        const sortedRequests = [...normalized].sort((a, b) => 
          new Date(a.createdAt) - new Date(b.createdAt)
        );
        setScheduleRequests(sortedRequests);
        localStorage.setItem(REQUESTS_KEY, JSON.stringify(sortedRequests));
      } else {
        const stored = JSON.parse(localStorage.getItem(REQUESTS_KEY) || '[]');
        if (Array.isArray(stored)) {
          const normalizedStored = stored.map(normalizeScheduleRequest);
          const sortedStored = [...normalizedStored].sort((a, b) => 
            new Date(a.createdAt) - new Date(b.createdAt)
          );
          setScheduleRequests(sortedStored);
        }
      }
    } catch (err) {
      console.error('Error loading schedule requests:', err);
      try {
        const stored = JSON.parse(localStorage.getItem(REQUESTS_KEY) || '[]');
        if (Array.isArray(stored)) {
          const sortedStored = [...stored].sort((a, b) => 
            new Date(a.createdAt) - new Date(b.createdAt)
          );
          setScheduleRequests(sortedStored);
        }
      } catch (fallbackErr) {
        console.error('Fallback error loading requests:', fallbackErr);
        setScheduleRequests([]);
      }
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    loadScheduleRequests();
    loadSchedulesFromServer();
    
    const handleStorage = (e) => {
      if (e.key === REQUESTS_KEY) loadScheduleRequests();
      if (e.key === APPROVED_KEY) loadSchedulesFromServer();
    };
    
    const handleCustomStorage = (e) => {
      if (e.detail?.key === REQUESTS_KEY) loadScheduleRequests();
      if (e.detail?.key === APPROVED_KEY) loadSchedulesFromServer();
    };
    
    window.addEventListener('storage', handleStorage);
    window.addEventListener('gymstatStorageUpdate', handleCustomStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('gymstatStorageUpdate', handleCustomStorage);
    };
  }, []);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key !== 'Escape') return;
      if (confirmAction) return;
      if (showModal) setShowModal(false);
      else if (showNotAvailableModal) setShowNotAvailableModal(false);
      else if (requestPanelOpen) closeRequestPanel();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [confirmAction, requestPanelOpen, showModal, showNotAvailableModal]);

  const saveScheduleRequests = async (requests) => {
    try {
      localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));
      setScheduleRequests(requests);
      window.dispatchEvent(new CustomEvent('gymstatStorageUpdate', { detail: { key: REQUESTS_KEY } }));
    } catch (err) {
      console.error('Error saving schedule requests:', err);
      setToast({ message: 'Unable to update schedule requests. Please try again.', type: 'error' });
    }
  };

  const openRequestPanel = () => {
    loadScheduleRequests();
    setRequestPanelOpen(true);
  };

  const closeRequestPanel = () => {
    setRequestPanelOpen(false);
    setExpandedRequestId(null);
    if (previewFile.url) {
      URL.revokeObjectURL(previewFile.url);
      setPreviewFile({ url: '', name: '', type: '' });
    }
  };

  const toggleRequestExpand = (id) => {
    setExpandedRequestId(expandedRequestId === id ? null : id);
  };

  const getFileUrl = (file) => {
    if (!file || !file.data) return '';
    try {
      const byteString = atob(file.data);
      const buffer = new Uint8Array(byteString.length);
      for (let i = 0; i < byteString.length; i += 1) buffer[i] = byteString.charCodeAt(i);
      const blob = new Blob([buffer], { type: file.type || file.mimetype || 'application/octet-stream' });
      return URL.createObjectURL(blob);
    } catch (err) {
      console.error('Error creating file URL:', err);
      return '';
    }
  };

  const openRequestAttachment = (file) => {
    if (!file) return;
    if (previewFile.url) URL.revokeObjectURL(previewFile.url);
    const url = getFileUrl(file);
    if (url) {
      setPreviewFile({
        url,
        name: file.name || file.originalname || file.filename || 'attachment',
        type: file.type || file.mimetype || 'application/octet-stream'
      });
    } else {
      setToast({ message: 'Unable to open file attachment', type: 'error' });
    }
  };

  const closeAttachment = () => {
    if (previewFile.url) URL.revokeObjectURL(previewFile.url);
    setPreviewFile({ url: '', name: '', type: '' });
  };

  const normalizeScheduleRequest = (request) => {
    if (!request) return request;
    return {
      ...request,
      id: request.id || request._id || (request._id ? String(request._id) : undefined),
      file: request.file || request.attachment || null,
      description: request.description || request.details || ''
    };
  };

  const handleCreateNewSchedule = () => {
    setShowNotAvailableModal(false);
    setShowModal(true);
  };

  const sendMailToRequester = (email, subject, body) => {
    try {
      const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(mailto, '_blank');
    } catch (err) {
      console.error('Error sending email:', err);
    }
  };

  const promptApproveRequest = (id) => setConfirmAction({ type: 'approve', id });
  const promptRejectRequest = (id) => {
    setSelectedRejectReason('');
    setAdditionalRejectReason('');
    setConfirmAction({ type: 'reject', id });
  };

  const getFinalRejectionReason = () => {
    const selected = (confirmAction?.selectedReason || selectedRejectReason || '').trim();
    const extra = (confirmAction?.additionalReason || additionalRejectReason || '').trim();

    if (!selected) return '';
    if (selected === 'Other') {
      return extra ? `Other: ${extra}` : '';
    }
    return extra ? `${selected} - ${extra}` : selected;
  };

  const performConfirmAction = async () => {
    if (!confirmAction) return;
    if (deletingRequestId) return;
    const { type, id } = confirmAction;
    const requests = [...scheduleRequests];
    const idx = requests.findIndex(r => r.id === id);
    if (idx === -1) {
      setConfirmAction(null);
      setSelectedRejectReason('');
      setAdditionalRejectReason('');
      return;
    }
    const req = { ...requests[idx] };
    const finalReason = type === 'reject' ? getFinalRejectionReason() : '';

    if (type === 'reject' && !finalReason) {
      setToast({ message: 'Please select a valid rejection reason before continuing.', type: 'error' });
      return;
    }

    try {
      if (type === 'delete') {
        setDeletingRequestId(id);
        await api.deleteScheduleRequest(id);
        const remainingRequests = requests.filter((request) => request.id !== id);
        setScheduleRequests(remainingRequests);
        localStorage.setItem(REQUESTS_KEY, JSON.stringify(remainingRequests));
        setToast({ message: 'Approved schedule request deleted successfully.', type: 'success' });
      } else if (type === 'approve') {
        req.status = 'approved';
        req.reviewedAt = new Date().toISOString();
        
        await api.updateScheduleRequest(id, { status: 'approved', reviewedAt: req.reviewedAt });
        
        requests[idx] = req;
        await saveScheduleRequests(requests);
        setToast({ message: 'Request approved and schedule created successfully', type: 'success' });
        
        sendMailToRequester(
          req.requesterEmail, 
          `Your schedule request for ${req.eventName} was approved`, 
          `Hello ${req.requesterName},\n\nYour schedule request for "${req.eventName}" on ${req.startDate} (${req.startTime} - ${req.endTime}) has been approved.\n\nRegards,\nAdmin`
        );
        
        await loadSchedulesFromServer();
      } else if (type === 'reject') {
        req.status = 'rejected';
        req.reviewedAt = new Date().toISOString();
        req.rejectionReason = finalReason;
        
        await api.updateScheduleRequest(id, {
          status: 'rejected',
          reviewedAt: req.reviewedAt,
          rejectionReason: finalReason
        });
        
        requests[idx] = req;
        await saveScheduleRequests(requests);
        setToast({ message: 'Request rejected and requester notified', type: 'error' });
        
        sendMailToRequester(
          req.requesterEmail, 
          `Your schedule request for ${req.eventName} was rejected`, 
          `Hello ${req.requesterName},\n\nYour schedule request for "${req.eventName}" on ${req.startDate} has been rejected.\n\nReason: ${finalReason}\n\nRegards,\nAdmin`
        );
      }
    } catch (err) {
      console.error('Error performing action:', err);
      setToast({
        message: type === 'delete' ? 'Failed to delete schedule request. Please try again.' : 'Failed to update request. Please try again.',
        type: 'error'
      });
    }
    
    setConfirmAction(null);
    setSelectedRejectReason('');
    setAdditionalRejectReason('');
    setDeletingRequestId(null);
    await loadScheduleRequests();
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const handleDateClick = (day) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const eventsOnDate = getEventsForDate(dateStr);
    
    if (eventsOnDate.length > 0) {
      setSelectedDate(dateStr);
      setSelectedEventDetails(eventsOnDate);
      setShowNotAvailableModal(true);
    } else {
      setSelectedDate(dateStr);
      setFormData({
        event: '',
        startDate: dateStr,
        endDate: dateStr,
        startTime: '08:00 AM',
        endTime: '12:00 PM',
        prepDays: 0
      });
      setShowModal(true);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.event) {
      setToast({ message: 'Error: Please enter an event name.', type: 'error' });
      return;
    }
    if (!formData.startDate) {
      setToast({ message: 'Error: Please select a start date.', type: 'error' });
      return;
    }
    if (!formData.endDate) {
      setToast({ message: 'Error: Please select an end date.', type: 'error' });
      return;
    }

    const timeToMinutes = (t) => {
      if (!t) return 0;
      const [time, meridian] = t.split(' ');
      const [hh, mm] = time.split(':').map(Number);
      let h = hh % 12;
      if (meridian === 'PM') h += 12;
      return h * 60 + mm;
    };

    const dateToDayStart = (dateString) => {
      const date = new Date(dateString);
      date.setHours(0, 0, 0, 0);
      return date;
    };

    const newStartDate = dateToDayStart(formData.startDate);
    const newEndDate = dateToDayStart(formData.endDate);
    const newStartMin = timeToMinutes(formData.startTime);
    const newEndMin = timeToMinutes(formData.endTime);
    const newPrep = Number(formData.prepDays || 0) || 0;

    const hasConflict = reservations.some((res) => {
      if (res.id === formData.id) return false;

      const existingStart = dateToDayStart(res.startDate);
      const existingEnd = dateToDayStart(res.endDate);
      const existingPrep = Number(res.prepDays || 0) || 0;
      const prepAdjustedStart = new Date(existingStart);
      prepAdjustedStart.setDate(prepAdjustedStart.getDate() - existingPrep);

      if (newEndDate < prepAdjustedStart || newStartDate > existingEnd) return false;

      const exStartMin = timeToMinutes(res.startTime);
      const exEndMin = timeToMinutes(res.endTime);
      const newStartMs = newStartDate.getTime() + newStartMin * 60000;
      const newEndMs = newEndDate.getTime() + newEndMin * 60000;
      const exStartMs = existingStart.getTime() + exStartMin * 60000;
      const exEndMs = existingEnd.getTime() + exEndMin * 60000;

      if (newStartMs >= newEndMs || exStartMs >= exEndMs) return true;
      return newStartMs < exEndMs && newEndMs > exStartMs;
    });

    if (hasConflict) {
      setToast({ message: 'Error: This schedule conflicts with an existing schedule. Please choose different times or dates.', type: 'error' });
      return;
    }

    const payload = {
      event: formData.event,
      startDate: formData.startDate,
      endDate: formData.endDate,
      prepDays: newPrep,
      startTime: formData.startTime,
      endTime: formData.endTime,
      status: 'active',
    };

    try {
      const response = formData.id
        ? await api.updateSchedule(formData.id, payload)
        : await api.createSchedule(payload);

      if (!response?.success) {
        throw new Error(response?.message || 'Unable to save schedule');
      }

      const savedSchedule = response.data || payload;
      const newEntry = normalizeScheduleEntry({
        ...savedSchedule,
        id: savedSchedule.id || savedSchedule._id || formData.id || Date.now(),
        event: savedSchedule.event || formData.event,
        startDate: savedSchedule.startDate || formData.startDate,
        endDate: savedSchedule.endDate || formData.endDate,
        prepDays: Number(savedSchedule.prepDays ?? newPrep) || 0,
        startTime: savedSchedule.startTime || formData.startTime,
        endTime: savedSchedule.endTime || formData.endTime,
      });

      const updatedReservations = formData.id
        ? reservations.map((res) => (res.id === formData.id ? newEntry : res))
        : [newEntry, ...reservations];

      saveApprovedSchedules(updatedReservations);
      await loadSchedulesFromServer();
      notifyScheduleRefresh();
      setToast({ message: formData.id ? 'Schedule Successfully Updated' : 'Schedule Successfully Created and Saved to MongoDB', type: 'success' });
      setShowModal(false);
      resetForm();
    } catch (err) {
      console.error('Error saving schedule:', err);
      setToast({ message: 'Unable to save schedule to MongoDB. Please try again.', type: 'error' });
    }
  };

  const resetForm = () => {
    setFormData({
      id: null,
      event: '',
      startDate: '',
      endDate: '',
      startTime: '08:00 AM',
      endTime: '12:00 PM',
      prepDays: 0
    });
  };

  const handleDelete = (id) => {
    setConfirmCancelId(id);
  };

  const confirmDelete = () => {
    const updated = reservations.filter(res => res.id !== confirmCancelId);
    saveApprovedSchedules(updated);
    setToast({ message: 'Schedule Successfully Cancelled', type: 'success' });
    setConfirmCancelId(null);
  };

  const cancelDelete = () => {
    setConfirmCancelId(null);
  };

  const handleEdit = (reservation) => {
    setFormData({ ...reservation });
    setSelectedDate(reservation.startDate);
    setShowModal(true);
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const getEventsForDate = (dateStr) => {
    return reservations.filter(r => {
      const eventStart = new Date(r.startDate);
      const eventEnd = new Date(r.endDate);
      const prep = Number(r.prepDays || 0) || 0;
      const eventStartWithPrep = new Date(eventStart);
      eventStartWithPrep.setDate(eventStartWithPrep.getDate() - prep);
      const currentDate = new Date(dateStr);
      
      eventStartWithPrep.setHours(0, 0, 0, 0);
      eventEnd.setHours(0, 0, 0, 0);
      currentDate.setHours(0, 0, 0, 0);
      
      return currentDate >= eventStartWithPrep && currentDate <= eventEnd;
    });
  };

  const formatTimeDisplay = (startTime, endTime) => {
    return `${startTime} - ${endTime}`;
  };

  const handleDownloadCalendar = () => {
    const monthLabel = `${monthNames[currentMonth]} ${currentYear}`;
    const pageWidth = 1100;
    const pageHeight = 700;
    const marginX = 56;
    const marginY = 48;
    const headerHeight = 72;
    const weekdayHeight = 36;
    const rows = Math.max(5, Math.ceil((firstDay + daysInMonth) / 7));
    const cellWidth = (pageWidth - marginX * 2) / 7;
    const cellHeight = (pageHeight - marginY * 2 - headerHeight - weekdayHeight) / rows;

    const escapeXml = (value) => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    const wrapText = (text, maxChars) => {
      const words = String(text).split(' ');
      const lines = [];
      let line = '';

      words.forEach((word) => {
        const candidate = line ? `${line} ${word}` : word;
        if (candidate.length <= maxChars) {
          line = candidate;
        } else {
          if (line) lines.push(line);
          line = word;
        }
      });

      if (line) lines.push(line);
      return lines.slice(0, 3);
    };

    const cells = [];
    for (let i = 0; i < firstDay; i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({ day, dateStr, events: sortEventsByTime(getEventsForDate(dateStr)) });
    }
    while (cells.length % 7 !== 0) cells.push(null);

    const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pageWidth}" height="${pageHeight}" viewBox="0 0 ${pageWidth} ${pageHeight}">`;
    svg += `<rect width="100%" height="100%" fill="#ffffff"/>`;
    svg += `<rect x="40" y="28" width="${pageWidth - 80}" height="${pageHeight - 56}" rx="18" fill="#ffffff" stroke="#e0e0e0" stroke-width="1.2"/>`;
    svg += `<text x="${marginX}" y="${marginY + 24}" font-family="Segoe UI, Arial, sans-serif" font-size="26" font-weight="700" fill="#7b1e1e">${escapeXml(monthLabel)}</text>`;
    svg += `<text x="${marginX}" y="${marginY + 50}" font-family="Segoe UI, Arial, sans-serif" font-size="12" fill="#777">Short Bond Paper • Landscape</text>`;

    weekdayLabels.forEach((dayName, index) => {
      const x = marginX + index * cellWidth;
      svg += `<rect x="${x}" y="${marginY + headerHeight}" width="${cellWidth}" height="${weekdayHeight}" fill="#f8f9fa" stroke="#e6e6e6" stroke-width="1"/>`;
      svg += `<text x="${x + cellWidth / 2}" y="${marginY + headerHeight + 24}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="600" fill="#7b1e1e">${escapeXml(dayName)}</text>`;
    });

    cells.forEach((cell, index) => {
      const row = Math.floor(index / 7);
      const col = index % 7;
      const x = marginX + col * cellWidth;
      const y = marginY + headerHeight + weekdayHeight + row * cellHeight;
      const hasDay = Boolean(cell);

      svg += `<rect x="${x}" y="${y}" width="${cellWidth}" height="${cellHeight}" rx="8" fill="${hasDay ? '#ffffff' : '#fafafa'}" stroke="#e6e6e6" stroke-width="1"/>`;

      if (hasDay) {
        svg += `<text x="${x + 8}" y="${y + 18}" font-family="Segoe UI, Arial, sans-serif" font-size="12" font-weight="700" fill="#333">${cell.day}</text>`;

        const visibleEvents = cell.events.slice(0, 3);
        visibleEvents.forEach((event, eventIndex) => {
          const eventY = y + 34 + eventIndex * 20;
          const shortTitle = wrapText(event.event, 18);
          const timeLine = wrapText(formatTimeDisplay(event.startTime, event.endTime), 18);
          const lines = [...shortTitle, ...timeLine];
          const color = '#2e7d32';

          svg += `<rect x="${x + 7}" y="${eventY - 12}" width="${cellWidth - 14}" height="${12 + lines.length * 11}" rx="4" fill="#eef7ee"/>`;
          lines.forEach((line, lineIndex) => {
            const lineY = eventY + lineIndex * 10;
            svg += `<text x="${x + 12}" y="${lineY}" font-family="Segoe UI, Arial, sans-serif" font-size="9" fill="${color}">${escapeXml(line)}</text>`;
          });
        });
      }
    });

    svg += `</svg>`;

    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `gymnasium-schedule-${currentYear}-${String(currentMonth + 1).padStart(2, '0')}.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
  };

  const normalizeScheduleSource = (schedule) => {
    if (!schedule) return 'internal';
    if (schedule.fromRequest || schedule.source === 'public' || schedule.source === 'request' || schedule.requesterName || schedule.requesterEmail) {
      return 'public';
    }
    return 'internal';
  };

  const sortEventsByTime = (events) => {
    const toMinutes = (t) => {
      if (!t) return 0;
      const [time, meridian] = t.split(' ');
      const [hh, mm] = time.split(':').map(Number);
      let h = hh % 12;
      if (meridian === 'PM') h += 12;
      return h * 60 + mm;
    };
    return [...events].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  };

  // Generate calendar days
  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const eventsOnDate = sortEventsByTime(getEventsForDate(dateStr));
    const hasEvent = eventsOnDate.length > 0;
    const multipleEvents = eventsOnDate.length > 1;
    const hasPublic = eventsOnDate.some((event) => normalizeScheduleSource(event) === 'public');
    const hasInternal = eventsOnDate.some((event) => normalizeScheduleSource(event) === 'internal');
    const sourceClass = hasEvent
      ? hasPublic && hasInternal
        ? 'has-event--mixed'
        : hasPublic
          ? 'has-event--public'
          : 'has-event--internal'
      : '';

    calendarDays.push(
      <div 
        key={day} 
        className={`calendar-day ${hasEvent ? 'has-event' : ''} ${sourceClass}`.trim()}
        onClick={() => handleDateClick(day)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleDateClick(day);
          }
        }}
        role="button"
        tabIndex="0"
        aria-label={`${dateStr}${hasEvent ? `, ${eventsOnDate.length} scheduled event${eventsOnDate.length === 1 ? '' : 's'}` : ', available for scheduling'}`}
      >
        <span className="day-number">{day}</span>
        {hasEvent && (
          <div className={`calendar-event-info ${eventsOnDate.length >= 3 ? 'calendar-event-info--scroll' : ''}`}>
            {eventsOnDate.map((event, idx) => {
              const isContinuedLeft = new Date(dateStr) > new Date(event.startDate);
              const isContinuedRight = new Date(dateStr) < new Date(event.endDate);
              const cls = `mini-event ${isContinuedLeft ? 'cont-left' : ''} ${isContinuedRight ? 'cont-right' : ''}`;
              const sourceTone = normalizeScheduleSource(event) === 'public' ? 'mini-event--public' : 'mini-event--internal';
              const dotTone = normalizeScheduleSource(event) === 'public' ? 'event-dot--public' : 'event-dot--internal';
              return (
                <div key={idx} className={`${cls} ${sourceTone}`} title={`${event.event}\n${formatTimeDisplay(event.startTime, event.endTime)}`}>
                  <span className={`event-dot ${dotTone}`}>●</span>
                  <span className="event-name">{event.event.length > 20 ? event.event.substring(0, 18) + '...' : event.event}</span>
                  <span className="event-time">{multipleEvents ? event.startTime : formatTimeDisplay(event.startTime, event.endTime)}</span>
                </div>
              );
            })}
            {eventsOnDate.length > 3 && (
              <div className="more-events">+{eventsOnDate.length - 3} more</div>
            )}
          </div>
        )}
      </div>
    );
  }

  const sortedReservations = [...reservations].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

  return (
    <div className="admin-page-content">
      <div className="page-header-container">
        <div className="header-text">
          <h1 className="main-title">Gymnasium Scheduling</h1>
          <p className="sub-title-desc">Schedule and manage all gymnasium activities and reservations in one place.</p>
        </div>
        <div className="header-actions">
          <button className="request-badge-btn" onClick={openRequestPanel} aria-label="View schedule requests">
            <span className="envelope-icon"> 
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <circle cx="12" cy="15" r="1" />
                <circle cx="16" cy="15" r="1" />
                <circle cx="8" cy="15" r="1" />
              </svg>
            </span>
            Schedule Requests
            {scheduleRequests.filter(r => r.status === 'pending').length > 0 && (
              <span className="request-count">{scheduleRequests.filter(r => r.status === 'pending').length}</span>
            )}
          </button>
        </div>
      </div>

      <hr className="divider" />

      {/* Calendar Section */}
      <div className="calendar-container">
        <div className="calendar-header">
          <button type="button" onClick={handlePrevMonth} className="calendar-nav-btn" aria-label="View previous month">◀ Previous</button>
          <div className="calendar-title-group">
            <h2>{monthNames[currentMonth]} {currentYear}</h2>
            <button type="button" onClick={handleDownloadCalendar} className="download-calendar-btn">Download Calendar</button>
          </div>
          <button type="button" onClick={handleNextMonth} className="calendar-nav-btn" aria-label="View next month">Next ▶</button>
        </div>
        
        <div className="calendar-weekdays">
          {dayNames.map(day => (
            <div key={day} className="weekday">{day}</div>
          ))}
        </div>
        
        <div className="calendar-grid">
          {calendarDays}
        </div>
        
        <div className="calendar-legend">
          <span className="legend-dot legend-dot--internal"></span> Internal
          <span className="legend-dot legend-dot--public" style={{ marginLeft: 10 }}></span> Public
        </div>
      </div>

      {/* Schedule List */}
      <div className="schedule-list-container">
        <div className="yellow-table-wrapper">
          <div className="list-header">
            <h3 className="table-title">Upcoming Schedules</h3>
            <span className="count-badge">{reservations.length} Schedules Found</span>
          </div>
          <div className="table-responsive">
            <table className="admin-schedule-table">
              <thead>
                <tr>
                  <th>Event Title</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Time Slot</th>
                  <th style={{textAlign: 'center'}}>Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedReservations.length > 0 ? (
                  sortedReservations.map((res) => (
                    <tr key={res.id}>
                      <td className="bold-maroon">{res.event}</td>
                      <td>{res.startDate}</td>
                      <td>{res.endDate}</td>
                      <td>{res.startTime} - {res.endTime}</td>
                      <td style={{textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap'}}>
                        <button type="button" className="btn-edit-action" onClick={() => handleEdit(res)}>Edit schedule</button>
                        <button type="button" className="btn-cancel-action" onClick={() => handleDelete(res.id)}>Cancel schedule</button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="no-data">No schedules found. Click on a date to create one.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create Schedule Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content schedule-modal" role="dialog" aria-modal="true" aria-labelledby="schedule-modal-title" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 id="schedule-modal-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                  <circle cx="12" cy="15" r="1" />
                  <circle cx="16" cy="15" r="1" />
                  <circle cx="8" cy="15" r="1" />
                </svg>
                {formData.id ? 'Edit Schedule' : 'Create Schedule'} for {selectedDate}
              </h3>
              <button type="button" className="close-modal" onClick={() => setShowModal(false)} aria-label="Close schedule form">×</button>
            </div>
            
            <form onSubmit={handleSave} className="modal-form">
              <div className="form-group full-width">
                <label htmlFor="schedule-event">Event name <span aria-hidden="true">*</span><span className="sr-only"> required</span></label>
                <input 
                  id="schedule-event"
                  type="text" 
                  placeholder="e.g., Basketball Tournament" 
                  value={formData.event} 
                  onChange={(e) => setFormData({...formData, event: e.target.value})} 
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="schedule-start-date">Start date <span aria-hidden="true">*</span><span className="sr-only"> required</span></label>
                  <input 
                    id="schedule-start-date"
                    type="date" 
                    value={formData.startDate} 
                    onChange={(e) => setFormData({...formData, startDate: e.target.value})} 
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="schedule-start-time">Start time <span aria-hidden="true">*</span><span className="sr-only"> required</span></label>
                  <select 
                    id="schedule-start-time"
                    value={formData.startTime} 
                    onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                    required
                  >
                    {TIMES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="schedule-end-date">End date <span aria-hidden="true">*</span><span className="sr-only"> required</span></label>
                  <input 
                    id="schedule-end-date"
                    type="date" 
                    value={formData.endDate} 
                    onChange={(e) => setFormData({...formData, endDate: e.target.value})} 
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="schedule-end-time">End time <span aria-hidden="true">*</span><span className="sr-only"> required</span></label>
                  <select 
                    id="schedule-end-time"
                    value={formData.endTime} 
                    onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                    required
                  >
                    {TIMES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="schedule-prep-days">Preparation days</label>
                  <input
                    id="schedule-prep-days"
                    type="number"
                    min="0"
                    value={formData.prepDays || 0}
                    onChange={(e) => setFormData({ ...formData, prepDays: Number(e.target.value) })}
                  />
                  <small>Days before event for setup</small>
                </div>
                <div className="form-group">
                  <span aria-hidden="true" />
                </div>
              </div>

              <div className="modal-buttons">
                <button type="button" className="cancel-btn" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="confirm-btn">{formData.id ? 'Update Schedule' : 'Confirm Schedule'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Not Available Modal */}
      {showNotAvailableModal && (
        <div className="modal-overlay" onClick={() => setShowNotAvailableModal(false)}>
          <div className="modal-content not-available-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header not-available-header">
              <h3>⚠️ Date Not Available</h3>
              <button className="close-modal" onClick={() => setShowNotAvailableModal(false)}>×</button>
            </div>
            
            <div className="not-available-content">
              <p className="not-available-message">
                <strong>{selectedDate}</strong> is already reserved for the following event(s):
              </p>
              
              <div className="event-details-list">
                {selectedEventDetails && selectedEventDetails.map((event, idx) => (
                  <div key={idx} className="reserved-event-card" style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                    <div style={{display: 'flex', gap: 12, alignItems: 'center'}}>
                      <div className="event-icon">📅</div>
                      <div className="event-info">
                        <div className="event-title">{event.event}</div>
                        <div className="event-datetime">
                          <span>📆 {event.startDate} - {event.endDate}</span>
                          <span>⏰ {event.startTime} - {event.endTime}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{marginLeft: 16}}>
                      <button
                        className="btn-cancel-action"
                        onClick={() => handleDelete(event.id)}
                        title="Cancel schedule"
                      >
                        Cancel Schedule
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              <p className="not-available-footer">
                Please choose another date or contact the admin for schedule changes.
              </p>
            </div>
            
            <div className="modal-buttons modal-buttons--spaced">
              <button className="cancel-btn" onClick={handleCreateNewSchedule}>Create New Schedule</button>
              <button className="confirm-btn" onClick={() => setShowNotAvailableModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

     {/* Schedule Requests Overlay Panel (Matches UI Screenshot) */}
      {requestPanelOpen && (
        <div className="modal-overlay" onClick={closeRequestPanel}>
          <div className="modal-content requests-modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="requests-panel-title">Schedule Requests</h2>
              <button className="close-modal-large" onClick={closeRequestPanel} aria-label="Close panel">×</button>
            </div>

            <div className="requests-list-container">
              {loadingRequests ? (
                <div className="loading-placeholder">Loading requests...</div>
              ) : scheduleRequests.length > 0 ? (
                scheduleRequests.map((req) => {
                  const isExpanded = expandedRequestId === req.id;
                  return (
                    <div key={req.id} className={`request-card-item ${req.status}`}>
                      <div className="request-card-summary">
                        <div className="request-main-info">
                          <span className="request-title-bold">
                            {req.requesterName} <span className="title-separator">–</span> {req.eventName}
                          </span>
                          <span className="request-date-duration">
                            {req.startDate} - {req.endDate} • Start: {req.startTime}
                          </span>
                        </div>
                        <div className="request-status-actions">
                          <span className={`status-badge text-${req.status}`}>
                            {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                          </span>
                          <button 
                            className="btn-details-toggle" 
                            onClick={() => toggleRequestExpand(req.id)}
                          >
                            {isExpanded ? 'Hide Details' : 'Details'}
                          </button>
                          {req.status === 'approved' && (
                            <button
                              type="button"
                              className="btn-delete-approved-request"
                              title="Delete approved schedule request"
                              aria-label={`Delete approved request for ${req.eventName}`}
                              onClick={() => setConfirmAction({ type: 'delete', id: req.id })}
                              disabled={deletingRequestId === req.id}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <line x1="10" y1="11" x2="10" y2="17" />
                                <line x1="14" y1="11" x2="14" y2="17" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expanded View with Actions and File Attachments */}
                      {isExpanded && (
                        <div className="request-card-details-expanded">
                          <hr className="inner-divider" />
                          <div className="details-grid">
                            <p><strong>Email:</strong> {req.requesterEmail}</p>
                            <p><strong>Start Time:</strong> {req.startTime}</p>
                            <p><strong>End Time:</strong> {req.endTime}</p>
                            <p><strong>Prep Days:</strong> {req.prepDays || 0} Day(s)</p>
                            {req.description && <p className="full-row"><strong>Description:</strong> {req.description}</p>}
                          </div>
                          
                          {req.file && (
                            <div className="attachment-section">
                              <button 
                                type="button" 
                                className="btn-view-attachment" 
                                onClick={() => openRequestAttachment(req.file)}
                              >
                                View Attachment ({req.file.originalname || req.file.name || req.file.filename || 'attachment'})
                              </button>
                              <button
                                type="button"
                                className="btn-download-attachment"
                                onClick={() => {
                                  const url = getFileUrl(req.file);
                                  if (!url) {
                                    setToast({ message: 'Unable to download attachment', type: 'error' });
                                    return;
                                  }
                                  const link = document.createElement('a');
                                  link.href = url;
                                  link.download = req.file.originalname || req.file.name || req.file.filename || 'attachment';
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                  URL.revokeObjectURL(url);
                                }}
                              >
                                Download
                              </button>
                            </div>
                          )}

                          {req.status === 'pending' && (
                            <div className="action-buttons-group">
                              <button 
                                className="btn-reject" 
                                onClick={() => promptRejectRequest(req.id)}
                              >
                                Reject
                              </button>
                              <button 
                                className="btn-approve" 
                                onClick={() => promptApproveRequest(req.id)}
                              >
                                Approve
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="no-data-placeholder">No schedule requests found.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Global Confirmation Modal */}
      {confirmAction && (
        <ConfirmModal
          isOpen={!!confirmAction}
          title={confirmAction.type === 'approve' ? 'Approve Request' : confirmAction.type === 'delete' ? 'Delete Approved Request' : 'Reject Request'}
          message={confirmAction.type === 'approve' ? 'Are you sure you want to approve this schedule request?' : confirmAction.type === 'delete' ? 'Are you sure you want to permanently delete this approved schedule request and its linked calendar schedule?' : 'Please select a valid reason for rejection before continuing.'}
          onConfirm={performConfirmAction}
          onCancel={() => {
            setConfirmAction(null);
            setSelectedRejectReason('');
            setAdditionalRejectReason('');
          }}
          confirmDisabled={deletingRequestId !== null || (confirmAction.type === 'reject' && !getFinalRejectionReason())}
        >
          {confirmAction.type === 'reject' && (
            <div style={{ marginTop: 16 }}>
              <label htmlFor="reject-reason-select" style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>Reason for Rejection</label>
              <select
                id="reject-reason-select"
                value={confirmAction.selectedReason || selectedRejectReason}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedRejectReason(value);
                  setConfirmAction((current) => current ? { ...current, selectedReason: value } : current);
                  if (value !== 'Other') {
                    setAdditionalRejectReason('');
                    setConfirmAction((current) => current ? { ...current, additionalReason: '' } : current);
                  }
                }}
                style={{ width: '100%', borderRadius: 8, border: '1px solid #d0d7de', padding: '10px 12px', fontSize: 14, marginBottom: 12 }}
              >
                <option value="">Select a reason</option>
                {REJECTION_REASONS.map((reason) => (
                  <option key={reason} value={reason}>{reason}</option>
                ))}
              </select>

              {(confirmAction.selectedReason || selectedRejectReason) === 'Other' && (
                <div>
                  <label htmlFor="additional-reject-reason" style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>Additional Reason</label>
                  <textarea
                    id="additional-reject-reason"
                    rows={4}
                    value={confirmAction.additionalReason || additionalRejectReason}
                    onChange={(e) => {
                      const value = e.target.value;
                      setAdditionalRejectReason(value);
                      setConfirmAction((current) => current ? { ...current, additionalReason: value } : current);
                    }}
                    placeholder="Provide the custom reason for this rejection"
                    style={{ width: '100%', resize: 'vertical', borderRadius: 8, border: '1px solid #d0d7de', padding: 10, fontSize: 14 }}
                  />
                </div>
              )}
            </div>
          )}
        </ConfirmModal>
      )}

      {/* Cancel Approved Schedule Confirmation Modal */}
      {confirmCancelId && (
        <ConfirmModal
          isOpen={!!confirmCancelId}
          title="Cancel Schedule"
          message="Are you sure you want to cancel this approved schedule entry?"
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      )}

      {/* Document Viewer Attachment Modal */}
      {previewFile.url && (
        <DocumentViewer
          url={previewFile.url}
          fileName={previewFile.name}
          fileType={previewFile.type}
          onClose={closeAttachment}
        />
      )}

      {/* Notification Toast System */}
      {toast.message && (
        <NotificationToast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ message: '', type: 'success' })}
        />
      )}
    </div>
  );
};

export default AdminSchedules;