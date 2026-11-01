import React, { useState, useEffect, useEffectEvent, useRef } from 'react';
import NotificationToast from '../../components/NotificationToast';
import ConfirmModal from '../../components/ConfirmModal';
import DocumentViewer from '../../components/DocumentViewer';
import TimeInput from '../../components/TimeInput';
import * as api from '../../services/api';
import Icon from '../../components/Icon';
import { TIMES } from '../../constants/scheduleTimes';
import {
  getCalendarDateString,
  isDateFullyOccupied,
  isPastScheduleDate,
  isPastScheduleTime,
} from '../../utils/scheduleAvailability';
import './AdminPortal.css';

const parseScheduleTime = (value) => {
  const match = String(value || '').trim().match(/^(\d{1,2}):([0-5]\d)\s*(AM|PM)$/i);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 1 || hour > 12) return null;

  const normalizedHour = hour % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0);
  return { minutes: normalizedHour * 60 + minute };
};

const timeToMinutes = (value) => parseScheduleTime(value)?.minutes ?? 0;
const isActiveSchedule = (schedule) => String(schedule?.status || 'active').toLowerCase() === 'active';
const sameScheduleId = (firstId, secondId) => String(firstId) === String(secondId);
const sortScheduleRequestsByCreatedAt = (requests) => [...requests].sort((first, second) => {
  const firstCreatedAt = first?.createdAt ? new Date(first.createdAt).getTime() : NaN;
  const secondCreatedAt = second?.createdAt ? new Date(second.createdAt).getTime() : NaN;
  const firstHasTimestamp = Number.isFinite(firstCreatedAt);
  const secondHasTimestamp = Number.isFinite(secondCreatedAt);
  if (!firstHasTimestamp || !secondHasTimestamp) {
    if (firstHasTimestamp === secondHasTimestamp) return 0;
    return firstHasTimestamp ? -1 : 1;
  }
  return secondCreatedAt - firstCreatedAt;
});

const formatScheduleRequestCreatedAt = (createdAt) => {
  const timestamp = new Date(createdAt);
  if (!createdAt || Number.isNaN(timestamp.getTime())) return 'Submission time unavailable';

  return timestamp.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

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
  const [timeErrors, setTimeErrors] = useState({ startTime: '', endTime: '' });

  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay();
  };

  const [now, setNow] = useState(() => new Date());
  const todayString = getCalendarDateString(now);
  const [currentYear, setCurrentYear] = useState(Number(todayString.slice(0, 4)));
  const [currentMonth, setCurrentMonth] = useState(Number(todayString.slice(5, 7)) - 1);
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [downloadingCalendar, setDownloadingCalendar] = useState(false);
  const [openingAttachmentId, setOpeningAttachmentId] = useState(null);
  const saveScheduleInProgressRef = useRef(false);
  const calendarDownloadInProgressRef = useRef(false);
  const [confirmCancelId, setConfirmCancelId] = useState(null);
  const [confirmScheduleDeleteId, setConfirmScheduleDeleteId] = useState(null);
  const [deletingSchedule, setDeletingSchedule] = useState(false);
  const REQUESTS_KEY = 'gymstatScheduleRequests';
  const [scheduleRequests, setScheduleRequests] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(REQUESTS_KEY) || '[]');
      return Array.isArray(stored) ? sortScheduleRequestsByCreatedAt(stored) : [];
    } catch (error) {
      console.warn('Unable to load locally saved schedule requests:', error);
      return [];
    }
  });
  const scheduleRequestsLoadPromiseRef = useRef(null);
  const [requestPanelOpen, setRequestPanelOpen] = useState(false);
  const [expandedRequestId, setExpandedRequestId] = useState(null);
  const [previewFile, setPreviewFile] = useState({ url: '', name: '', type: '' });
  const [imagePreviewScale, setImagePreviewScale] = useState(1);
  const APPROVED_KEY = 'gymstatApprovedSchedules';
  const [confirmAction, setConfirmAction] = useState(null);
  const [selectedRejectReason, setSelectedRejectReason] = useState('');
  const [additionalRejectReason, setAdditionalRejectReason] = useState('');
  const [deletingRequestId, setDeletingRequestId] = useState(null);
  const [processingRequestAction, setProcessingRequestAction] = useState(false);
  const requestActionInProgressRef = useRef(false);
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
  const loadScheduleRequests = async (forceRefresh = false) => {
    if (scheduleRequestsLoadPromiseRef.current) {
      await scheduleRequestsLoadPromiseRef.current;
      if (!forceRefresh || scheduleRequestsLoadPromiseRef.current) return;
    }

    const loadPromise = (async () => {
      try {
        const response = await api.getScheduleRequests();

        if (!response?.success || !Array.isArray(response.data)) {
          const error = new Error('The server returned an invalid schedule request list.');
          error.code = 'INVALID_RESPONSE';
          throw error;
        }

        if (response.data.length === 0) {
          const stored = JSON.parse(localStorage.getItem(REQUESTS_KEY) || '[]');
          if (Array.isArray(stored) && stored.length > 0) {
            const cachedRequests = sortScheduleRequestsByCreatedAt(stored.map(normalizeScheduleRequest));
            setScheduleRequests(cachedRequests);
            setToast({
              message: 'The server returned no schedule requests. Showing locally saved requests; verify the server connection before making changes.',
              type: 'error'
            });
            return;
          }
        }

        const sortedRequests = sortScheduleRequestsByCreatedAt(response.data.map(normalizeScheduleRequest));
        setScheduleRequests(sortedRequests);
        localStorage.setItem(REQUESTS_KEY, JSON.stringify(sortedRequests));
      } catch (err) {
        console.error('Error loading schedule requests:', err);
        if (err?.code !== 'REQUEST_ABORTED') {
          const message = err?.code === 'REQUEST_TIMEOUT'
            ? 'Loading schedule requests timed out. Please try again.'
            : err?.status === 401 || err?.code === 'SESSION_EXPIRED'
              ? 'Your admin session could not be verified. Please sign in again.'
              : 'Failed to load schedule requests. Please try again.';
          setToast({ message, type: 'error' });
        }
        try {
          const stored = JSON.parse(localStorage.getItem(REQUESTS_KEY) || '[]');
          if (Array.isArray(stored)) {
            const sortedStored = sortScheduleRequestsByCreatedAt(stored);
            setScheduleRequests(sortedStored);
          }
        } catch (fallbackErr) {
          console.error('Fallback error loading requests:', fallbackErr);
          setScheduleRequests([]);
        }
      }
    })();

    scheduleRequestsLoadPromiseRef.current = loadPromise;
    try {
      await loadPromise;
    } finally {
      if (scheduleRequestsLoadPromiseRef.current === loadPromise) {
        scheduleRequestsLoadPromiseRef.current = null;
      }
    }
  };

  const saveScheduleRequests = async (requests) => {
    try {
      localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));
      setScheduleRequests(requests);
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
    setImagePreviewScale(1);
    if (previewFile.url) {
      URL.revokeObjectURL(previewFile.url);
      setPreviewFile({ url: '', name: '', type: '' });
    }
  };

  const loadScheduleRequestsEvent = useEffectEvent(loadScheduleRequests);
  const loadSchedulesFromServerEvent = useEffectEvent(loadSchedulesFromServer);
  const closeRequestPanelEvent = useEffectEvent(closeRequestPanel);

  useEffect(() => {
    loadScheduleRequestsEvent();
    loadSchedulesFromServerEvent();

    const handleStorage = (event) => {
      if (event.key === REQUESTS_KEY) loadScheduleRequestsEvent();
      if (event.key === APPROVED_KEY) loadSchedulesFromServerEvent();
    };

    const handleCustomStorage = (event) => {
      if (event.detail?.key === REQUESTS_KEY) loadScheduleRequestsEvent();
      if (event.detail?.key === APPROVED_KEY) loadSchedulesFromServerEvent();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('gymstatStorageUpdate', handleCustomStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('gymstatStorageUpdate', handleCustomStorage);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key !== 'Escape' || confirmAction) return;
      if (previewFile.url) closeAttachmentEvent();
      else if (showModal) setShowModal(false);
      else if (showNotAvailableModal) setShowNotAvailableModal(false);
      else if (requestPanelOpen) closeRequestPanelEvent();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [confirmAction, previewFile, requestPanelOpen, showModal, showNotAvailableModal]);

  const toggleRequestExpand = (id) => {
    setExpandedRequestId(expandedRequestId === id ? null : id);
  };

  const getAttachmentErrorMessage = (error) => {
    if (error?.status === 401 || error?.code === 'SESSION_EXPIRED') {
      return 'Your admin session could not be verified. Please sign in again.';
    }
    if (error?.status === 403) return 'You do not have permission to view this attachment.';
    if (error?.status === 404) return 'This attachment could not be found.';
    if (error?.code === 'UNSUPPORTED_ATTACHMENT') {
      return 'This attachment cannot be previewed. Only PDF, PNG, and JPEG files are supported.';
    }
    if (error?.status >= 500) return 'The server could not load this attachment. Please try again.';
    if (error?.code === 'NETWORK_ERROR' || error?.code === 'REQUEST_TIMEOUT') {
      return 'Network problem while loading the attachment. Please try again.';
    }
    return 'Unable to view this attachment.';
  };

  const getFileUrl = async (file) => {
    if (!file) return null;
    let blob;
    let responseFilename = '';
    let responseContentType = '';

    if (file.data) {
      const base64Data = String(file.data).replace(/^data:[^,]*,/, '');
      const byteString = atob(base64Data);
      const buffer = new Uint8Array(byteString.length);
      for (let i = 0; i < byteString.length; i += 1) buffer[i] = byteString.charCodeAt(i);
      blob = new Blob([buffer], { type: file.type || file.mimetype || 'application/octet-stream' });
    } else {
      if (!file.requestId) {
        const error = new Error('Missing attachment request ID');
        error.status = 404;
        throw error;
      }
      const response = await api.getScheduleRequestFile(file.requestId);
      if (!response || typeof response.blob !== 'function') {
        const error = new Error('Invalid attachment response');
        error.code = 'INVALID_FILE_RESPONSE';
        throw error;
      }
      if (!response.ok) {
        const error = new Error('Attachment request failed');
        error.status = response.status;
        throw error;
      }

      const contentDisposition = response.headers?.get('content-disposition') || '';
      const encodedFilename = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
      const regularFilename = contentDisposition.match(/filename\s*=\s*(?:"([^"]+)"|([^;]+))/i);
      if (encodedFilename) {
        try {
          responseFilename = decodeURIComponent(encodedFilename[1].trim());
        } catch {
          responseFilename = '';
        }
      }
      if (!responseFilename && regularFilename) {
        responseFilename = (regularFilename[1] || regularFilename[2]).trim().replace(/^"|"$/g, '');
      }
      responseContentType = response.headers?.get('content-type') || '';
      blob = await response.blob();
    }

    const header = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
    const actualType = header.length >= 5
      && String.fromCharCode(...header.slice(0, 5)) === '%PDF-'
      ? 'application/pdf'
      : header.length >= 8
        && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => header[index] === byte)
        ? 'image/png'
        : header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff
          ? 'image/jpeg'
          : '';
    const declaredType = String(responseContentType || file.type || file.mimetype || '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    const filename = responseFilename || file.originalname || file.name || file.filename || 'attachment';
    const extension = filename.toLowerCase().match(/\.[^.]+$/)?.[0] || '';
    const expectedType = new Map([
      ['.pdf', 'application/pdf'],
      ['.png', 'image/png'],
      ['.jpg', 'image/jpeg'],
      ['.jpeg', 'image/jpeg'],
    ]).get(extension);
    if (!actualType
      || (declaredType && declaredType !== 'application/octet-stream' && declaredType !== actualType)
      || (expectedType && expectedType !== actualType)) {
      const error = new Error('Unsupported or invalid attachment type');
      error.code = 'UNSUPPORTED_ATTACHMENT';
      throw error;
    }

    return {
      url: URL.createObjectURL(blob),
      name: filename,
      type: actualType,
    };
  };

  const openRequestAttachment = async (file) => {
    if (!file) return;
    if (previewFile.url) URL.revokeObjectURL(previewFile.url);
    setOpeningAttachmentId(file.requestId || file.originalname || file.filename || 'attachment');
    try {
      const attachment = await getFileUrl(file);
      if (!attachment) return;
      setImagePreviewScale(1);
      setPreviewFile({
        url: attachment.url,
        name: attachment.name,
        type: attachment.type,
      });
    } catch (error) {
      setToast({ message: getAttachmentErrorMessage(error), type: 'error' });
    } finally {
      setOpeningAttachmentId(null);
    }
  };

  const closeAttachment = () => {
    if (previewFile.url) URL.revokeObjectURL(previewFile.url);
    setPreviewFile({ url: '', name: '', type: '' });
    setImagePreviewScale(1);
  };
  const closeAttachmentEvent = useEffectEvent(closeAttachment);

  const zoomImagePreview = (direction) => {
    setImagePreviewScale((scale) => Math.min(3, Math.max(0.5, +(scale + direction * 0.25).toFixed(2))));
  };

  const toggleImagePreviewZoom = () => {
    setImagePreviewScale((scale) => scale <= 1 ? 2 : 1);
  };

  const normalizeScheduleRequest = (request) => {
    if (!request) return request;
    return {
      ...request,
      id: request.id || request._id || (request._id ? String(request._id) : undefined),
      file: request.file
        ? { ...request.file, requestId: request.id || request._id }
        : request.attachment || null,
      description: request.description || request.details || ''
    };
  };

  const scheduleConflicts = (candidate, existingSchedule) => {
    if (!isActiveSchedule(existingSchedule)) return false;

    const existingStart = new Date(`${existingSchedule.startDate}T00:00:00`);
    const existingEnd = new Date(`${existingSchedule.endDate}T00:00:00`);
    const existingPrep = Number(existingSchedule.prepDays || 0) || 0;
    const prepAdjustedStart = new Date(existingStart);
    prepAdjustedStart.setDate(prepAdjustedStart.getDate() - existingPrep);

    const newStartDate = new Date(`${candidate.startDate}T00:00:00`);
    const newEndDate = new Date(`${candidate.endDate}T00:00:00`);
    if (newEndDate < prepAdjustedStart || newStartDate > existingEnd) return false;

    const newStartMs = newStartDate.getTime() + timeToMinutes(candidate.startTime) * 60000;
    const newEndMs = newEndDate.getTime() + timeToMinutes(candidate.endTime) * 60000;
    const existingStartMs = existingStart.getTime() + timeToMinutes(existingSchedule.startTime) * 60000;
    const existingEndMs = existingEnd.getTime() + timeToMinutes(existingSchedule.endTime) * 60000;
    if (newStartMs >= newEndMs || existingStartMs >= existingEndMs) return true;
    return newStartMs < existingEndMs && newEndMs > existingStartMs;
  };

  const getAvailableEndTimes = (
    startTime = formData.startTime,
    startDate = formData.startDate,
    endDate = formData.endDate,
    excludeScheduleId = formData.id
  ) => {
    if (!startDate || !endDate || endDate < startDate) return [];
    if (isDateFullyOccupied(endDate, reservations, excludeScheduleId)) return [];

    return TIMES.filter((endTime) => {
      if (startDate === endDate && timeToMinutes(endTime) <= timeToMinutes(startTime)) return false;
      if (isPastScheduleTime(endDate, endTime, now)) return false;
      return !reservations.some((schedule) => (
        !sameScheduleId(schedule.id || schedule._id, excludeScheduleId)
        && scheduleConflicts({ startDate, endDate, startTime, endTime }, schedule)
      ));
    });
  };

  const getAvailableStartTimes = (
    startDate = formData.startDate,
    endDate = formData.endDate,
    excludeScheduleId = formData.id
  ) => {
    if (!startDate || !endDate || endDate < startDate) return [];
    if (isDateFullyOccupied(startDate, reservations, excludeScheduleId)) return [];

    return TIMES.filter((startTime) => (
      !isPastScheduleTime(startDate, startTime, now)
      && getAvailableEndTimes(startTime, startDate, endDate, excludeScheduleId).length > 0
    ));
  };

  const handleCreateNewSchedule = () => {
    setShowNotAvailableModal(false);
    setTimeErrors({ startTime: '', endTime: '' });
    const startTimes = getAvailableStartTimes(selectedDate, selectedDate, null);
    const startTime = startTimes[0] || '08:00 AM';
    const endTimes = getAvailableEndTimes(startTime, selectedDate, selectedDate, null);
    const endTime = endTimes.includes('12:00 PM') ? '12:00 PM' : endTimes[0] || '12:00 PM';
    setFormData({
      event: '',
      startDate: selectedDate,
      endDate: selectedDate,
      startTime,
      endTime,
      prepDays: 0,
    });
    setShowModal(true);
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
    if (!confirmAction || requestActionInProgressRef.current) return;
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

    requestActionInProgressRef.current = true;
    setProcessingRequestAction(true);
    try {
      if (type === 'delete') {
        setDeletingRequestId(id);
        await api.deleteScheduleRequest(id);
        const remainingRequests = requests.filter((request) => request.id !== id);
        setScheduleRequests(remainingRequests);
        localStorage.setItem(REQUESTS_KEY, JSON.stringify(remainingRequests));
        await loadSchedulesFromServer();
        notifyScheduleRefresh();
        setToast({ message: 'Schedule request deleted successfully.', type: 'success' });
      } else if (type === 'approve') {
        req.status = 'approved';
        req.reviewedAt = new Date().toISOString();
        
        const response = await api.updateScheduleRequest(id, { status: 'approved', reviewedAt: req.reviewedAt });
        
        requests[idx] = req;
        await saveScheduleRequests(requests);
        setToast({
          message: response?.requesterNotified === false
            ? 'Request approved, but the requester notification could not be sent.'
            : 'Request approved and schedule created successfully',
          type: response?.requesterNotified === false ? 'error' : 'success'
        });

        await loadSchedulesFromServer();
        notifyScheduleRefresh();
      } else if (type === 'reject') {
        req.status = 'rejected';
        req.reviewedAt = new Date().toISOString();
        req.rejectionReason = finalReason;
        
        const response = await api.updateScheduleRequest(id, {
          status: 'rejected',
          reviewedAt: req.reviewedAt,
          rejectionReason: finalReason
        });
        
        requests[idx] = req;
        await saveScheduleRequests(requests);
        setToast({
          message: response?.requesterNotified === false
            ? 'Request rejected, but the requester notification could not be sent.'
            : 'Schedule request rejected.',
          type: response?.requesterNotified === false ? 'error' : 'success'
        });
      }
    } catch (err) {
      console.error('Error performing action:', err);
      setToast({
        message: err?.code === 'REQUEST_TIMEOUT'
          ? 'The action timed out. Refreshing the request status; please confirm before trying again.'
          : err?.status === 401 || err?.code === 'SESSION_EXPIRED'
            ? 'Your admin session could not be verified. Please sign in again.'
            : err?.message || (type === 'delete'
              ? 'Failed to delete schedule request. Please try again.'
              : 'Failed to update request. Please try again.'),
        type: 'error'
      });
      if (err?.code !== 'REQUEST_ABORTED') await loadScheduleRequests(true);
    } finally {
      requestActionInProgressRef.current = false;
      setProcessingRequestAction(false);
      setConfirmAction(null);
      setSelectedRejectReason('');
      setAdditionalRejectReason('');
      setDeletingRequestId(null);
    }
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const handleDateClick = (day) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (isPastScheduleDate(dateStr, now) || isDateFullyOccupied(dateStr, reservations)) return;
    const eventsOnDate = getEventsForDate(dateStr);
    
    if (eventsOnDate.length > 0) {
      setSelectedDate(dateStr);
      setSelectedEventDetails(eventsOnDate);
      setShowNotAvailableModal(true);
    } else {
      setSelectedDate(dateStr);
      setTimeErrors({ startTime: '', endTime: '' });
      const startTime = getAvailableStartTimes(dateStr, dateStr, null)[0] || '08:00 AM';
      const endTimes = getAvailableEndTimes(startTime, dateStr, dateStr, null);
      setFormData({
        event: '',
        startDate: dateStr,
        endDate: dateStr,
        startTime,
        endTime: endTimes.includes('12:00 PM') ? '12:00 PM' : endTimes[0] || '12:00 PM',
        prepDays: 0
      });
      setShowModal(true);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (saveScheduleInProgressRef.current) return;
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
    if (isPastScheduleDate(formData.startDate, now) || isPastScheduleDate(formData.endDate, now)) {
      setToast({ message: 'Past dates cannot be scheduled.', type: 'error' });
      return;
    }
    if (isDateFullyOccupied(formData.startDate, reservations, formData.id)
      || isDateFullyOccupied(formData.endDate, reservations, formData.id)) {
      setToast({ message: 'A selected date is fully booked. Please choose another date.', type: 'error' });
      return;
    }

    const parsedStartTime = parseScheduleTime(formData.startTime);
    const parsedEndTime = parseScheduleTime(formData.endTime);
    const nextTimeErrors = {
      startTime: parsedStartTime ? '' : 'Enter a valid time, such as 1:30 PM.',
      endTime: parsedEndTime ? '' : 'Enter a valid time, such as 2:45 PM.',
    };
    setTimeErrors(nextTimeErrors);
    if (nextTimeErrors.startTime || nextTimeErrors.endTime) {
      setToast({
        message: nextTimeErrors.startTime || nextTimeErrors.endTime,
        type: 'error',
      });
      return;
    }
    if (isPastScheduleTime(formData.startDate, formData.startTime, now)
      || isPastScheduleTime(formData.endDate, formData.endTime, now)) {
      const message = 'Past times cannot be scheduled.';
      setToast({ message, type: 'error' });
      return;
    }

    const dateToDayStart = (dateString) => {
      const date = new Date(dateString);
      date.setHours(0, 0, 0, 0);
      return date;
    };

    const newStartDate = dateToDayStart(formData.startDate);
    const newEndDate = dateToDayStart(formData.endDate);
    const newStartMin = parsedStartTime.minutes;
    const newEndMin = parsedEndTime.minutes;
    const newPrep = Number(formData.prepDays || 0) || 0;

    const scheduledStart = newStartDate.getTime() + newStartMin * 60000;
    const scheduledEnd = newEndDate.getTime() + newEndMin * 60000;
    if (scheduledEnd <= scheduledStart) {
      const message = 'End time must be later than start time.';
      setTimeErrors((current) => ({ ...current, endTime: message }));
      setToast({ message, type: 'error' });
      return;
    }

    const hasConflict = reservations.some((res) => {
      if (!isActiveSchedule(res) || sameScheduleId(res.id, formData.id)) return false;

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

    saveScheduleInProgressRef.current = true;
    setSavingSchedule(true);
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
        ? reservations.map((res) => (sameScheduleId(res.id, formData.id) ? newEntry : res))
        : [newEntry, ...reservations];

      saveApprovedSchedules(updatedReservations);
      await loadSchedulesFromServer();
      notifyScheduleRefresh();
      setShowModal(false);
      resetForm();
    } catch (err) {
      console.error('Error saving schedule:', err);
      setToast({ message: 'Unable to save schedule to MongoDB. Please try again.', type: 'error' });
    } finally {
      saveScheduleInProgressRef.current = false;
      setSavingSchedule(false);
    }
  };

  const resetForm = () => {
    setTimeErrors({ startTime: '', endTime: '' });
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

  const confirmDelete = async () => {
    if (!confirmCancelId) return;

    const scheduleToCancel = reservations.find((schedule) => sameScheduleId(schedule.id, confirmCancelId));
    if (!scheduleToCancel) {
      setToast({ message: 'Unable to find this schedule. Please refresh and try again.', type: 'error' });
      setConfirmCancelId(null);
      return;
    }

    try {
      const response = await api.updateSchedule(confirmCancelId, { status: 'cancelled' });
      if (!response?.success || !response.data) {
        throw new Error(response?.message || 'Unable to cancel schedule');
      }

      const updatedSchedule = normalizeScheduleEntry({
        ...scheduleToCancel,
        ...response.data,
        id: response.data.id || response.data._id || scheduleToCancel.id,
        status: 'cancelled'
      });
      const updatedReservations = reservations.map((schedule) => (
        sameScheduleId(schedule.id, confirmCancelId) ? updatedSchedule : schedule
      ));

      saveApprovedSchedules(updatedReservations);
      await loadSchedulesFromServer();
      notifyScheduleRefresh();
      setToast({ message: 'Schedule Successfully Cancelled', type: 'success' });
    } catch (error) {
      console.error('Error cancelling schedule:', error);
      setToast({ message: 'Unable to cancel schedule. Please try again.', type: 'error' });
    } finally {
      setConfirmCancelId(null);
    }
  };

  const cancelDelete = () => {
    setConfirmCancelId(null);
  };

  const confirmDeleteSchedule = async () => {
    if (!confirmScheduleDeleteId || deletingSchedule) return;
    setDeletingSchedule(true);
    try {
      const response = await api.deleteSchedule(confirmScheduleDeleteId);
      if (!response?.success) {
        throw new Error(response?.message || 'Unable to delete schedule.');
      }

      const updatedReservations = reservations.filter(
        (schedule) => !sameScheduleId(schedule.id, confirmScheduleDeleteId)
      );
      saveApprovedSchedules(updatedReservations);
      await loadSchedulesFromServer();
      notifyScheduleRefresh();
      setToast({ message: 'Schedule deleted successfully.', type: 'success' });
    } catch (error) {
      console.error('Error deleting schedule:', error);
      setToast({
        message: error?.status === 401 || error?.code === 'SESSION_EXPIRED'
          ? 'Your admin session could not be verified. Please sign in again.'
          : error?.message || 'Unable to delete schedule. Please try again.',
        type: 'error',
      });
    } finally {
      setDeletingSchedule(false);
      setConfirmScheduleDeleteId(null);
    }
  };

  const handleEdit = (reservation) => {
    setTimeErrors({ startTime: '', endTime: '' });
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
      if (!isActiveSchedule(r)) return false;
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

  const handleDownloadCalendar = async () => {
    if (calendarDownloadInProgressRef.current) return;
    calendarDownloadInProgressRef.current = true;
    setDownloadingCalendar(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 28;
      const gridTop = 76;
      const gridBottom = pageHeight - 30;
      const availableGridHeight = gridBottom - gridTop;
      const columnWidth = (pageWidth - margin * 2) / 7;
      const contentWidth = columnWidth - 12;
      const dayHeaderHeight = 18;
      const lineHeight = 10;
      const minimumWeekHeight = 48;
      const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const monthLabel = `${monthNames[currentMonth]} ${currentYear}`;
      const generatedAt = new Date().toLocaleString();
      const eventTitleFontSize = 8.2;
      const eventTimeFontSize = 7.4;

      const drawPageHeader = () => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(123, 30, 30);
        doc.text('GYMSTAT CALENDAR', pageWidth / 2, 22, { align: 'center' });
        doc.setFontSize(10);
        doc.text(monthLabel, margin, 45);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(90, 90, 90);
        doc.text(`Generated: ${generatedAt}`, pageWidth - margin, 45, { align: 'right' });

        weekdayLabels.forEach((dayName, index) => {
          const x = margin + index * columnWidth;
          doc.setFillColor(248, 249, 250);
          doc.setDrawColor(220, 224, 228);
          doc.rect(x, 54, columnWidth, 22, 'FD');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(123, 30, 30);
          doc.text(dayName, x + columnWidth / 2, 68, { align: 'center' });
        });
      };

      const buildCell = (day) => {
        if (!day) return null;
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const lines = [];

        sortEventsByTime(getEventsForDate(dateStr)).forEach((event) => {
          const sourceColor = normalizeScheduleSource(event) === 'public'
            ? [155, 30, 75]
            : [46, 125, 50];
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(eventTitleFontSize);
          const titleLines = doc.splitTextToSize(String(event.event || ''), contentWidth - 4);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(eventTimeFontSize);
          const timeLines = doc.splitTextToSize(
            formatTimeDisplay(event.startTime, event.endTime),
            contentWidth - 4
          );
          titleLines.forEach((text) => lines.push({ text, type: 'title', color: sourceColor }));
          timeLines.forEach((text) => lines.push({ text, type: 'time', color: sourceColor }));
        });

        return { day, lines };
      };

      const calendarCells = [];
      for (let index = 0; index < firstDay; index += 1) calendarCells.push(null);
      for (let day = 1; day <= daysInMonth; day += 1) calendarCells.push(buildCell(day));
      while (calendarCells.length % 7 !== 0) calendarCells.push(null);

      const weeks = [];
      for (let index = 0; index < calendarCells.length; index += 7) {
        weeks.push(calendarCells.slice(index, index + 7));
      }

      const getWeekHeight = (week) => Math.max(
        minimumWeekHeight,
        ...week.map((cell) => cell
          ? dayHeaderHeight + 8 + cell.lines.length * lineHeight
          : minimumWeekHeight)
      );

      const drawWeek = (week, y, height, lineOffset = 0, linesPerCell = Infinity) => {
        week.forEach((cell, index) => {
          const x = margin + index * columnWidth;
          doc.setFillColor(cell ? 255 : 250, cell ? 255 : 250, cell ? 255 : 250);
          doc.setDrawColor(220, 224, 228);
          doc.rect(x, y, columnWidth, height, 'FD');
          if (!cell) return;

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(45, 45, 45);
          doc.text(String(cell.day), x + 5, y + 12);

          const visibleLines = cell.lines.slice(lineOffset, lineOffset + linesPerCell);
          visibleLines.forEach((line, lineIndex) => {
            const lineY = y + dayHeaderHeight + 4 + lineIndex * lineHeight;
            const background = line.color[0] === 155 ? [255, 242, 246] : [238, 247, 238];
            doc.setFillColor(...background);
            doc.roundedRect(x + 4, lineY - 7, columnWidth - 8, lineHeight, 2, 2, 'F');
            doc.setFont('helvetica', line.type === 'title' ? 'bold' : 'normal');
            doc.setFontSize(line.type === 'title' ? eventTitleFontSize : eventTimeFontSize);
            doc.setTextColor(...line.color);
            doc.text(line.text, x + 6, lineY);
          });
        });
      };

      const addCalendarPage = () => {
        doc.addPage();
        drawPageHeader();
        return gridTop;
      };

      drawPageHeader();
      let y = gridTop;
      let pageHasCalendarRows = false;
      const maxLinesPerOverflowPage = Math.max(
        1,
        Math.floor((availableGridHeight - dayHeaderHeight - 8) / lineHeight)
      );

      weeks.forEach((week, weekIndex) => {
        const weekHeight = getWeekHeight(week);
        if (weekHeight <= availableGridHeight) {
          if (y + weekHeight > gridBottom) {
            y = addCalendarPage();
            pageHasCalendarRows = false;
          }
          drawWeek(week, y, weekHeight);
          y += weekHeight;
          pageHasCalendarRows = true;
          return;
        }

        if (pageHasCalendarRows || y > gridTop) {
          y = addCalendarPage();
          pageHasCalendarRows = false;
        }

        const overflowPages = Math.max(
          1,
          ...week.map((cell) => cell ? Math.ceil(cell.lines.length / maxLinesPerOverflowPage) : 1)
        );
        for (let pageIndex = 0; pageIndex < overflowPages; pageIndex += 1) {
          if (pageIndex > 0) y = addCalendarPage();
          const lineOffset = pageIndex * maxLinesPerOverflowPage;
          const visibleLineCount = Math.max(
            0,
            ...week.map((cell) => cell
              ? Math.min(maxLinesPerOverflowPage, cell.lines.length - lineOffset)
              : 0)
          );
          const rowHeight = Math.min(
            availableGridHeight,
            Math.max(minimumWeekHeight, dayHeaderHeight + 8 + visibleLineCount * lineHeight)
          );
          drawWeek(week, y, rowHeight, lineOffset, maxLinesPerOverflowPage);
        }

        pageHasCalendarRows = false;
        if (weekIndex < weeks.length - 1) y = addCalendarPage();
      });

      const pageCount = doc.getNumberOfPages();
      for (let page = 1; page <= pageCount; page += 1) {
        doc.setPage(page);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.text('Internal schedules', margin, pageHeight - 12);
        doc.setFillColor(46, 125, 50);
        doc.circle(margin + 62, pageHeight - 14, 2, 'F');
        doc.setTextColor(100, 100, 100);
        doc.text('External schedules', margin + 70, pageHeight - 12);
        doc.setFillColor(155, 30, 75);
        doc.circle(margin + 132, pageHeight - 14, 2, 'F');
        doc.setTextColor(100, 100, 100);
        doc.text(`${page} / ${pageCount}`, pageWidth - margin, pageHeight - 12, {
          align: 'right'
        });
      }

      doc.save(`gymnasium-schedule-${currentYear}-${String(currentMonth + 1).padStart(2, '0')}.pdf`);
    } catch (error) {
      console.error('Failed to export calendar PDF:', error);
      setToast({ message: 'Unable to download the calendar PDF. Please try again.', type: 'error' });
    } finally {
      calendarDownloadInProgressRef.current = false;
      setDownloadingCalendar(false);
    }
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
    const isPastDate = isPastScheduleDate(dateStr, now);
    const isFullyBooked = isDateFullyOccupied(dateStr, reservations);
    const isDisabled = isPastDate || isFullyBooked;
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
        className={`calendar-day ${hasEvent ? 'has-event' : ''} ${sourceClass} ${isFullyBooked ? 'calendar-day--full' : ''} ${isPastDate ? 'calendar-day--past' : ''}`.trim()}
        onClick={isDisabled ? undefined : () => handleDateClick(day)}
        onKeyDown={(event) => {
          if (!isDisabled && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            handleDateClick(day);
          }
        }}
        role="button"
        tabIndex={isDisabled ? -1 : 0}
        aria-disabled={isDisabled}
        aria-label={`${dateStr}${isPastDate ? ', past date' : isFullyBooked ? ', fully booked' : hasEvent ? `, ${eventsOnDate.length} scheduled event${eventsOnDate.length === 1 ? '' : 's'}` : ', available for scheduling'}`}
      >
        <span className="day-number">{day}</span>
        {hasEvent && (
          <div className={`calendar-event-info ${eventsOnDate.length >= 3 ? 'calendar-event-info--scroll' : ''}`}>
            {eventsOnDate.map((event, idx) => {
              const isContinuedLeft = new Date(dateStr) > new Date(event.startDate);
              const isContinuedRight = new Date(dateStr) < new Date(event.endDate);
              const cls = `mini-event ${isContinuedLeft ? 'cont-left' : ''} ${isContinuedRight ? 'cont-right' : ''}`;
              const sourceTone = normalizeScheduleSource(event) === 'public' ? 'mini-event--public' : 'mini-event--internal';
              return (
                <div key={idx} className={`${cls} ${sourceTone}`} title={`${event.event}\n${event.startTime} – ${event.endTime}`}>
                  <span className="event-name">{event.event.length > 20 ? event.event.substring(0, 18) + '...' : event.event}</span>
                  <span className="event-time">{event.startTime} – {event.endTime}</span>
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

  const sortedReservations = [...reservations].sort((a, b) => {
    const dateOrder = String(b.startDate || '').localeCompare(String(a.startDate || ''));
    if (dateOrder !== 0) return dateOrder;

    const aStartTime = parseScheduleTime(a.startTime)?.minutes ?? Number.POSITIVE_INFINITY;
    const bStartTime = parseScheduleTime(b.startTime)?.minutes ?? Number.POSITIVE_INFINITY;
    return aStartTime - bStartTime;
  });
  const pendingRequestCount = scheduleRequests.filter(
    (request) => String(request?.status || '').toLowerCase() === 'pending'
  ).length;

  return (
    <div className="admin-page-content">
      <div className="page-header-container">
        <div className="header-text">
          <h1 className="main-title">Gymnasium Scheduling</h1>
          <p className="sub-title-desc">Schedule and manage all gymnasium activities and reservations in one place.</p>
        </div>
        <div className="header-actions">
          <button
            className={`request-badge-btn${pendingRequestCount > 0 ? ' request-badge-btn--pending' : ''}`}
            onClick={openRequestPanel}
            aria-label="View schedule requests"
          >
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
            {pendingRequestCount > 0 && (
              <span className="request-count">{pendingRequestCount}</span>
            )}
          </button>
        </div>
      </div>

      <hr className="divider" />

      {/* Calendar Section */}
      <div className={`calendar-container${pendingRequestCount > 0 ? ' calendar-container--pending' : ''}`}>
        <div className="calendar-header">
          <button type="button" onClick={handlePrevMonth} className="calendar-nav-btn" aria-label="View previous month">◀ Previous</button>
          <div className="calendar-title-group">
            <h2>{monthNames[currentMonth]} {currentYear}</h2>
            <button type="button" onClick={handleDownloadCalendar} className="download-calendar-btn" disabled={downloadingCalendar}>
              {downloadingCalendar ? 'Preparing Download...' : 'Download Calendar'}
            </button>
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
          <span className="legend-dot legend-dot--public" style={{ marginLeft: 10 }}></span> External
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
                      <td className="schedule-actions-cell">
                        <div className="schedule-action-buttons">
                          <button
                            type="button"
                            className="schedule-action-icon"
                            onClick={() => handleEdit(res)}
                            title="Edit schedule"
                            aria-label={`Edit ${res.event || 'schedule'}`}
                          >
                            <Icon name="pencil" size={17} strokeWidth={1.8} />
                          </button>
                          <button
                            type="button"
                            className="schedule-action-icon"
                            onClick={() => setConfirmScheduleDeleteId(res.id)}
                            disabled={deletingSchedule}
                            title="Delete schedule"
                            aria-label={`Delete ${res.event || 'schedule'}`}
                          >
                            <Icon name="trash" size={17} strokeWidth={1.8} />
                          </button>
                        </div>
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
                    min={todayString}
                    onChange={(e) => {
                      const nextDate = e.target.value;
                      if (isPastScheduleDate(nextDate, now)) {
                        setToast({ message: 'Past dates cannot be scheduled.', type: 'error' });
                        return;
                      }
                      if (isDateFullyOccupied(nextDate, reservations, formData.id)) {
                        setToast({ message: 'This date is fully booked. Please choose another date.', type: 'error' });
                        return;
                      }
                      setFormData((current) => ({
                        ...current,
                        startDate: nextDate,
                        endDate: current.endDate < nextDate ? nextDate : current.endDate,
                      }));
                    }}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="schedule-start-time">Start time <span aria-hidden="true">*</span><span className="sr-only"> required</span></label>
                  <div className="schedule-time-controls">
                    <TimeInput
                      id="schedule-start-time"
                      label="Start time"
                      className="schedule-time-picker"
                      inputClassName="schedule-time-input"
                      value={formData.startTime}
                      onChange={(nextStartTime) => {
                        setFormData((current) => ({ ...current, startTime: nextStartTime }));
                        setTimeErrors((current) => ({ ...current, startTime: '' }));
                      }}
                      onBlur={() => setTimeErrors((current) => ({
                        ...current,
                        startTime: parseScheduleTime(formData.startTime) ? '' : 'Enter a valid time, such as 1:30 PM.',
                      }))}
                      options={TIMES}
                      disabledOptions={TIMES.filter((time) => !getAvailableStartTimes(
                        formData.startDate,
                        formData.endDate
                      ).includes(time))}
                      placeholder="e.g., 1:30 PM"
                      invalid={Boolean(timeErrors.startTime)}
                      describedBy={timeErrors.startTime ? 'schedule-start-time-error' : undefined}
                      required
                    />
                  </div>
                  {timeErrors.startTime && <small id="schedule-start-time-error" className="schedule-time-error" role="alert">{timeErrors.startTime}</small>}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="schedule-end-date">End date <span aria-hidden="true">*</span><span className="sr-only"> required</span></label>
                  <input 
                    id="schedule-end-date"
                    type="date" 
                    value={formData.endDate} 
                    min={formData.startDate > todayString ? formData.startDate : todayString}
                    onChange={(e) => {
                      const nextDate = e.target.value;
                      if (isPastScheduleDate(nextDate, now)) {
                        setToast({ message: 'Past dates cannot be scheduled.', type: 'error' });
                        return;
                      }
                      if (isDateFullyOccupied(nextDate, reservations, formData.id)) {
                        setToast({ message: 'This date is fully booked. Please choose another date.', type: 'error' });
                        return;
                      }
                      if (nextDate < formData.startDate) {
                        setToast({ message: 'End date cannot be before the start date.', type: 'error' });
                        return;
                      }
                      setFormData((current) => ({ ...current, endDate: nextDate }));
                    }}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="schedule-end-time">End time <span aria-hidden="true">*</span><span className="sr-only"> required</span></label>
                  <div className="schedule-time-controls">
                    <TimeInput
                      id="schedule-end-time"
                      label="End time"
                      className="schedule-time-picker"
                      inputClassName="schedule-time-input"
                      value={formData.endTime}
                      onChange={(nextEndTime) => {
                        setFormData((current) => ({ ...current, endTime: nextEndTime }));
                        setTimeErrors((current) => ({ ...current, endTime: '' }));
                      }}
                      onBlur={() => setTimeErrors((current) => ({
                        ...current,
                        endTime: parseScheduleTime(formData.endTime) ? '' : 'Enter a valid time, such as 2:45 PM.',
                      }))}
                      options={TIMES}
                      disabledOptions={TIMES.filter((time) => !getAvailableEndTimes(
                        formData.startTime,
                        formData.startDate,
                        formData.endDate
                      ).includes(time))}
                      placeholder="e.g., 2:45 PM"
                      invalid={Boolean(timeErrors.endTime)}
                      describedBy={timeErrors.endTime ? 'schedule-end-time-error' : undefined}
                      required
                    />
                  </div>
                  {timeErrors.endTime && <small id="schedule-end-time-error" className="schedule-time-error" role="alert">{timeErrors.endTime}</small>}
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
                <button type="submit" className="confirm-btn" disabled={savingSchedule}>
                  {savingSchedule ? 'Saving...' : formData.id ? 'Update Schedule' : 'Confirm Schedule'}
                </button>
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
              <h3><Icon name="warning" size={19} aria-hidden="true" /> Date Not Available</h3>
              <button className="close-modal" onClick={() => setShowNotAvailableModal(false)}><Icon name="close" size={18} aria-hidden="true" /></button>
            </div>
            
            <div className="not-available-content">
              <p className="not-available-message">
                <strong>{selectedDate}</strong> is already reserved for the following event(s):
              </p>
              
              <div className="event-details-list">
                {selectedEventDetails && selectedEventDetails.map((event, idx) => (
                  <div key={idx} className="reserved-event-card" style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                    <div style={{display: 'flex', gap: 12, alignItems: 'center'}}>
                      <div className="event-icon"><Icon name="calendar" /></div>
                      <div className="event-info">
                        <div className="event-title">{event.event}</div>
                        <div className="event-datetime">
                          <span><Icon name="calendar" size={15} aria-hidden="true" /> {event.startDate} - {event.endDate}</span>
                          <span><Icon name="clock" size={15} aria-hidden="true" /> {event.startTime} - {event.endTime}</span>
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
              {scheduleRequests.length > 0 ? (
                scheduleRequests.map((req) => {
                  const isExpanded = expandedRequestId === req.id;
                  return (
                    <div key={req.id} className={`request-card-item ${req.status}`}>
                      <div className="request-card-summary">
                        <div className="request-main-info">
                          <span className="request-title-bold">
                            {req.requesterName} <span className="title-separator">–</span> {req.eventName}
                          </span>
                          <span className="request-created-at">
                            Created at: {formatScheduleRequestCreatedAt(req.createdAt)}
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
                          {(req.status === 'approved' || req.status === 'rejected') && (
                            <button
                              type="button"
                              className="btn-delete-request"
                              title={`Delete ${req.status} schedule request`}
                              aria-label={`Delete ${req.status} request for ${req.eventName}`}
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
                            <p><strong>Event Name:</strong> {req.eventName}</p>
                            <p><strong>Start Date:</strong> {req.startDate}</p>
                            <p><strong>End Date:</strong> {req.endDate}</p>
                            <p><strong>Requester:</strong> {req.requesterName}</p>
                            <p><strong>Email:</strong> {req.requesterEmail || 'Not provided.'}</p>
                            <p><strong>Contact Number:</strong> {req.requesterPhone || 'Not provided.'}</p>
                            <p><strong>Start Time:</strong> {req.startTime}</p>
                            <p><strong>End Time:</strong> {req.endTime}</p>
                            <p><strong>Prep Days:</strong> {req.prepDays || 0} Day(s)</p>
                            {req.organization && <p><strong>Organization:</strong> {req.organization}</p>}
                            {req.purpose && <p className="full-row"><strong>Purpose:</strong> {req.purpose}</p>}
                            {req.description && <p className="full-row"><strong>Description:</strong> {req.description}</p>}
                          </div>
                          
                          {req.file && (
                            <div className="attached-section">
                              <button
                                type="button"
                                className="btn-view-attachment"
                                onClick={() => openRequestAttachment(req.file)}
                                disabled={openingAttachmentId === (req.file.requestId || req.file.originalname || req.file.filename || 'attachment')}
                              >
                                {openingAttachmentId === (req.file.requestId || req.file.originalname || req.file.filename || 'attachment')
                                  ? 'Loading Attachment...'
                                  : `View Attachment (${req.file.originalname || req.file.name || req.file.filename || 'attachment'})`}
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
          title={confirmAction.type === 'approve' ? 'Approve Request' : confirmAction.type === 'delete' ? 'Delete Schedule Request' : 'Reject Request'}
          message={confirmAction.type === 'approve' ? 'Are you sure you want to approve this schedule request?' : confirmAction.type === 'delete' ? 'Are you sure you want to permanently delete this schedule request?' : 'Please select a valid reason for rejection before continuing.'}
          onConfirm={performConfirmAction}
          onCancel={() => {
            setConfirmAction(null);
            setSelectedRejectReason('');
            setAdditionalRejectReason('');
          }}
          confirmText={processingRequestAction ? 'Processing...' : 'Confirm'}
          confirmDisabled={processingRequestAction || deletingRequestId !== null || (confirmAction.type === 'reject' && !getFinalRejectionReason())}
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

      {confirmScheduleDeleteId && (
        <ConfirmModal
          isOpen={!!confirmScheduleDeleteId}
          title="Delete Schedule"
          message="Are you sure you want to permanently delete this schedule?"
          onConfirm={confirmDeleteSchedule}
          onCancel={() => {
            if (!deletingSchedule) setConfirmScheduleDeleteId(null);
          }}
          confirmText={deletingSchedule ? 'Deleting...' : 'Delete'}
          confirmDisabled={deletingSchedule}
        />
      )}

      {/* Keep image previews limited to schedule-request attachments. */}
      {previewFile.url && previewFile.type.startsWith('image/') && (
        <div
          className="schedule-image-preview-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`Image preview: ${previewFile.name}`}
          onClick={closeAttachment}
          onWheel={(event) => {
            if (!event.ctrlKey || event.deltaY === 0) return;
            event.preventDefault();
            zoomImagePreview(event.deltaY < 0 ? 1 : -1);
          }}
        >
          <button
            type="button"
            className="schedule-image-preview-close"
            onClick={closeAttachment}
            aria-label="Close image preview"
          >
            ×
          </button>
          <img
            className="schedule-image-preview"
            src={previewFile.url}
            alt={previewFile.name || 'Schedule request attachment'}
            style={{
              width: `${94 * imagePreviewScale}vw`,
              height: `${92 * imagePreviewScale}vh`,
            }}
            role="button"
            tabIndex={0}
            aria-label="Zoom image"
            onClick={(event) => {
              event.stopPropagation();
              toggleImagePreviewZoom();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleImagePreviewZoom();
              }
            }}
          />
        </div>
      )}

      {/* PDF attachments remain in the embedded document viewer. */}
      {previewFile.url && previewFile.type === 'application/pdf' && (
        <DocumentViewer
          isOpen
          src={previewFile.url}
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