import React, { useState, useEffect, useEffectEvent, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import NotificationToast from '../../components/NotificationToast';
import Icon from '../../components/Icon';
import TimeInput from '../../components/TimeInput';
import borrowersTemplateDoc from '../../assets/borrowers-template.doc?url';
import { getDueBorrowings, isBorrowingDeadlineApproaching } from '../../utils/borrowingDue';
import { getUniqueBorrowerCount } from './borrowerCount';
import { toggleEquipmentSelection, toggleEquipmentReferenceSelection } from './borrowingEquipmentSelection';
import {
  getEquipment,
  getBorrowingRecords,
  createBorrowingRecord,
  getCurrentUser,
  updateBorrowingRecord,
} from '../../services/api';
import './AdminPortal.css';

const TIME_OPTIONS = [
  '06:00 AM','07:00 AM','08:00 AM','08:30 AM','09:00 AM','09:30 AM',
  '10:00 AM','10:30 AM','11:00 AM','11:30 AM','12:00 PM','01:00 PM',
  '02:00 PM','03:00 PM','04:00 PM','05:00 PM','06:00 PM',
];

const parseBorrowingTime = (value) => {
  const match = String(value || '').trim().match(/^(\d{1,2}):([0-5]\d)\s*(AM|PM)$/i);
  if (!match) return null;

  const hour = Number(match[1]);
  if (hour < 1 || hour > 12) return null;

  return {
    minutes: (hour % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0)) * 60 + Number(match[2]),
  };
};

const CONDITION_OPTIONS = [
  { value: 'Good', label: 'Good', color: '#4caf50' },
  { value: 'Damaged', label: 'Damaged', color: '#ff9800' },
  { value: 'Lost', label: 'Lost', color: '#f44336' },
  { value: 'Under Repair', label: 'Under Repair', color: '#2196f3' },
];

// Editable condition options for the dropdown (only Good, Damaged, Lost)
const EDITABLE_CONDITION_OPTIONS = [
  { value: 'Good', label: 'Good', color: '#4caf50' },
  { value: 'Damaged', label: 'Damaged', color: '#ff9800' },
  { value: 'Lost', label: 'Lost', color: '#f44336' },
];

const todayStr = () => {
  const d = new Date();
  return d.toISOString().split('T')[0];
};

const getCurrentTimestamp = () => {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return { date, time };
};

const getRecordEquipmentItems = (record) => (
  Array.isArray(record.equipmentItems) && record.equipmentItems.length > 0
    ? record.equipmentItems
    : [{ equipment: record.equipment || '', referenceIds: record.referenceIds || [], quantity: record.qty || record.quantity || 1 }]
);

const EMPTY_FORM = { 
  fullname: '', 
  contactNo: '',
  facebookAccount: '',
  selectedEquipment: [],
  selectedReferenceIdsByEquipment: {},
  date: todayStr(), 
  startTime: '09:00 AM',
  endTime: ''
};

export default function AdminBorrowing({ onBorrowingChange }) {
  const location = useLocation();
  const recordsCardRef = useRef(null);
  const equipmentDropdownRef = useRef(null);
  const borrowingCreateInProgressRef = useRef(false);
  const borrowerSaveInProgressRef = useRef(false);
  const conditionUpdatesInProgressRef = useRef(new Set());
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [records, setRecords] = useState([]);
  const [equipmentWithRefs, setEquipmentWithRefs] = useState({});
  const [allEquipment, setAllEquipment] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [timeErrors, setTimeErrors] = useState({ startTime: '', endTime: '' });
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const [isEquipmentDropdownOpen, setIsEquipmentDropdownOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});
  const [selectedBorrowerDetails, setSelectedBorrowerDetails] = useState(null);
  const [isEditingBorrower, setIsEditingBorrower] = useState(false);
  const [borrowerEditForm, setBorrowerEditForm] = useState({
    fullname: '',
    contactNo: '',
    facebookAccount: ''
  });

  const normalizeEquipmentForBorrowing = (item) => {
    const availableQuantity = Math.max(0, Number(item.available ?? item.total ?? item.totalStock ?? 1) || 0);
    return {
      ...item,
      quantity: availableQuantity,
      available: availableQuantity,
      total: Number(item.total ?? item.totalStock ?? availableQuantity) || availableQuantity,
    };
  };

  // Fetch equipment and borrowing data from MongoDB
  const fetchData = async () => {
    try {
      const equipmentResponse = await getEquipment();
      const equipmentPayload = equipmentResponse?.data || equipmentResponse || [];
      const equipmentList = Array.isArray(equipmentPayload)
        ? equipmentPayload.map(normalizeEquipmentForBorrowing)
        : [];

      const equipmentRefsMap = {};
      equipmentList.forEach((item) => {
        if (!item?.name) return;

        const refs = equipmentRefsMap[item.name] || [];
        const fallbackQuantity = Math.max(0, Number(item.quantity ?? item.available ?? item.total ?? 1) || 0);

        if (item.referenceId) {
          const nextRef = {
            id: item.referenceId,
            condition: item.condition || 'Good'
          };

          if (!refs.some((ref) => ref.id === nextRef.id)) {
            refs.push(nextRef);
          }
        } else {
          const baseReferenceId = item.name;
          for (let index = 0; index < fallbackQuantity; index += 1) {
            const suffix = index + 1;
            const nextRef = {
              id: `${baseReferenceId}-${String(suffix).padStart(3, '0')}`,
              condition: item.condition || 'Good'
            };

            if (!refs.some((ref) => ref.id === nextRef.id)) {
              refs.push(nextRef);
            }
          }
        }

        equipmentRefsMap[item.name] = refs;
      });

      setAllEquipment(equipmentList);
      setEquipmentWithRefs(equipmentRefsMap);

      const borrowingsResponse = await getBorrowingRecords();
      const borrowingsData = Array.isArray(borrowingsResponse) ? borrowingsResponse : (borrowingsResponse?.data || []);
      setRecords(Array.isArray(borrowingsData) ? borrowingsData : []);
    } catch (error) {
      console.error('Error fetching data:', error);
      setToast({ message: 'Failed to load data. Please refresh the page.', type: 'error' });
      setRecords([]);
      setEquipmentWithRefs({});
      setAllEquipment([]);
    }
  };

  const fetchDataOnMount = useEffectEvent(fetchData);

  useEffect(() => {
    fetchDataOnMount();
  }, []);

  useLayoutEffect(() => {
    if (location.hash !== '#records') return undefined;

    recordsCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return undefined;
  }, [location.hash]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setCurrentTime(new Date()), 30000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!isEquipmentDropdownOpen) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!equipmentDropdownRef.current?.contains(event.target)) {
        setIsEquipmentDropdownOpen(false);
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsEquipmentDropdownOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isEquipmentDropdownOpen]);

  useEffect(() => {
    if (onBorrowingChange) {
      onBorrowingChange(records);
    }
  }, [records, onBorrowingChange]);

  // Get available reference IDs for selected equipment (not currently borrowed)
  const getAvailableReferenceIds = (equipmentName) => {
    const equipmentRefs = equipmentWithRefs[equipmentName] || [];

    const borrowedRefIds = records
      .filter((record) => record.status === 'Out')
      .flatMap((record) => (
        getRecordEquipmentItems(record)
          .filter((item) => item.equipment === equipmentName)
          .flatMap((item) => item.referenceIds || [])
      ));

    return equipmentRefs.filter(ref => {
      if (!ref || !ref.id) return false;
      if (borrowedRefIds.includes(ref.id)) return false;
      return (ref.condition || 'Good') === 'Good';
    });
  };

  const getAvailableQuantity = (equipmentName) => {
    const availableRefs = getAvailableReferenceIds(equipmentName);
    return availableRefs.length;
  };

  const toggleExpandRow = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Update condition for a specific reference ID - now persists to MongoDB
  const updateReferenceCondition = async (recordId, refIndex, newCondition) => {
    const updateKey = `${recordId}:${refIndex}`;
    if (conditionUpdatesInProgressRef.current.has(updateKey)) return;
    conditionUpdatesInProgressRef.current.add(updateKey);
    try {
      const record = records.find(r => r.id === recordId);
      if (!record) return;
      
      const updatedConditions = [...(record.referenceConditions || [])];
      updatedConditions[refIndex] = newCondition;
      
      setRecords(prev => prev.map(record => {
        if (record.id === recordId) {
          return {
            ...record,
            referenceConditions: updatedConditions
          };
        }
        return record;
      }));
      await updateBorrowingRecord(recordId, { referenceConditions: updatedConditions });
    } catch (error) {
      console.error('Error updating condition:', error);
      setToast({ message: 'Failed to update condition', type: 'error' });
      // Revert local state by refetching
      fetchData();
    } finally {
      conditionUpdatesInProgressRef.current.delete(updateKey);
    }
  };

  const getConditionValues = (record) => {
    const values = [];

    if (record?.condition) {
      values.push(record.condition);
    }

    if (Array.isArray(record?.referenceConditions)) {
      record.referenceConditions.forEach((condition) => {
        if (condition) {
          values.push(condition);
        }
      });
    }

    return values;
  };

  const dueTransactions = getDueBorrowings(records).length;
  const itemsOut = records.filter((record) => ['Out', 'Out Now'].includes(record?.status)).length;
  const borrowerCount = getUniqueBorrowerCount(records);
  const lostItems = records.reduce((count, record) => {
    return count + getConditionValues(record).filter((condition) => condition === 'Lost').length;
  }, 0);

  // Determine if a transaction is ongoing based on status
  const isTransactionOngoing = (record) => {
    const status = String(record.status || '').trim().toLowerCase();
    if (['returned', 'completed'].includes(status) || record.returnedAt || record.returnedTimestamp) {
      return false;
    }
    return true;
  };

  // Sort records with ongoing at top, then by date
  const sortedRecords = () => {
    return [...records].sort((a, b) => {
      const aOngoing = isTransactionOngoing(a);
      const bOngoing = isTransactionOngoing(b);
      
      if (aOngoing !== bOngoing) {
        return aOngoing ? -1 : 1;
      }
      
      // If both are ongoing or both are finished, sort by date
      return new Date(b.borrowDate) - new Date(a.borrowDate);
    });
  };

  const filtered = sortedRecords().filter((record) =>
    String(record.fullname || '').toLowerCase().includes(search.toLowerCase()) ||
    String(record.equipment || '').toLowerCase().includes(search.toLowerCase()) ||
    getRecordEquipmentItems(record).some((item) =>
      item.equipment.toLowerCase().includes(search.toLowerCase())
      || item.referenceIds.some((referenceId) => referenceId.toLowerCase().includes(search.toLowerCase()))
    )
  );

  const handleEquipmentChange = (equipmentName) => {
    setForm((current) => ({
      ...current,
      ...toggleEquipmentSelection(
        current.selectedEquipment,
        current.selectedReferenceIdsByEquipment,
        equipmentName
      ),
    }));
    setError('');
  };

  const handleReferenceIdToggle = (equipmentName, refId) => {
    setForm((current) => ({
      ...current,
      selectedReferenceIdsByEquipment: toggleEquipmentReferenceSelection(
        current.selectedReferenceIdsByEquipment,
        equipmentName,
        refId
      ),
    }));
    setError('');
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    if (borrowingCreateInProgressRef.current) return;
    
    if (!form.fullname.trim()) { 
      setError('Full name is required.'); 
      setToast({ message: 'Full name is required.', type: 'error' }); 
      return; 
    }
    
    if (form.selectedEquipment.length === 0) {
      setError('Please select at least one equipment type.');
      setToast({ message: 'Please select at least one equipment type.', type: 'error' });
      return;
    }

    const equipmentItems = form.selectedEquipment.map((equipmentName) => {
      const selectedReferenceIds = form.selectedReferenceIdsByEquipment[equipmentName] || [];
      const availableIds = new Set(getAvailableReferenceIds(equipmentName).map((ref) => ref.id));
      const invalidReferenceIds = selectedReferenceIds.filter((id) => !availableIds.has(id));
      return { equipment: equipmentName, selectedReferenceIds, invalidReferenceIds };
    });
    const missingEquipmentIds = equipmentItems.filter((item) => item.selectedReferenceIds.length === 0);
    const invalidEquipmentIds = equipmentItems.filter((item) => item.invalidReferenceIds.length > 0);
    const selectedReferenceIds = equipmentItems.flatMap((item) => item.selectedReferenceIds);
    if (missingEquipmentIds.length > 0 || invalidEquipmentIds.length > 0) {
      const validationError = missingEquipmentIds.length > 0
        ? 'Select at least one available Reference ID for every selected equipment type.'
        : 'One or more selected Reference IDs are no longer available. Please review your selections.';
      setError(validationError);
      setToast({ message: validationError, type: 'error' });
      return;
    }
    if (new Set(selectedReferenceIds).size !== selectedReferenceIds.length) {
      const validationError = 'Reference IDs must be unique within the borrowing transaction.';
      setError(validationError);
      setToast({ message: validationError, type: 'error' });
      return;
    }

    const startTime = parseBorrowingTime(form.startTime);
    const endTime = form.endTime.trim() ? parseBorrowingTime(form.endTime) : null;
    const nextTimeErrors = {
      startTime: startTime ? '' : 'Enter a valid time, such as 9:00 AM.',
      endTime: form.endTime.trim() && !endTime ? 'Enter a valid time, such as 5:00 PM.' : '',
    };
    if (startTime && endTime && endTime.minutes <= startTime.minutes) {
      nextTimeErrors.endTime = 'End time must be later than start time.';
    }
    setTimeErrors(nextTimeErrors);
    if (nextTimeErrors.startTime || nextTimeErrors.endTime) {
      const timeError = nextTimeErrors.startTime || nextTimeErrors.endTime;
      setError(timeError);
      setToast({ message: timeError, type: 'error' });
      return;
    }
    
    borrowingCreateInProgressRef.current = true;
    try {
      const calculatedQuantity = selectedReferenceIds.length;
      const borrowTimestamp = {
        date: form.date,
        time: form.startTime
      };
      const savedEquipmentItems = equipmentItems.map((item) => {
        const equipmentRefs = equipmentWithRefs[item.equipment] || [];
        return {
          equipment: item.equipment,
          referenceIds: item.selectedReferenceIds,
          referenceConditions: item.selectedReferenceIds.map((refId) => (
            equipmentRefs.find((ref) => ref.id === refId)?.condition || 'Good'
          )),
          quantity: item.selectedReferenceIds.length,
        };
      });
      const flattenedReferenceIds = savedEquipmentItems.flatMap((item) => item.referenceIds);
      const flattenedReferenceConditions = savedEquipmentItems.flatMap((item) => item.referenceConditions);

      const borrowingData = {
        Name: form.fullname.trim(),
        fullname: form.fullname.trim(),
        contactNo: form.contactNo.trim(),
        facebookAccount: form.facebookAccount.trim(),
        equipment: savedEquipmentItems.map((item) => item.equipment).join(', '),
        equipmentItems: savedEquipmentItems,
        quantity: calculatedQuantity,
        qty: calculatedQuantity,
        referenceIds: flattenedReferenceIds,
        referenceConditions: flattenedReferenceConditions,
        borrowTimestamp,
        endTime: form.endTime.trim(),
        returnedTimestamp: null,
        status: 'Out',
        condition: null,
      };
      
      try {
        await createBorrowingRecord(borrowingData);
      } catch (createError) {
        if (createError.status !== 401) throw createError;

        await getCurrentUser({ force: true });
        await createBorrowingRecord(borrowingData);
      }
      await fetchData();

      setForm(EMPTY_FORM);
      setError('');
      setTimeErrors({ startTime: '', endTime: '' });
    } catch (error) {
      console.error('Error creating borrowing:', error);
      setToast({ message: error.message || 'Failed to save borrowing record', type: 'error' });
    } finally {
      borrowingCreateInProgressRef.current = false;
    }
  };

  // Handle return - generates timestamp immediately without modal
  const handleReturn = async (recordId) => {
    try {
      const record = records.find(r => r.id === recordId) || records.find(r => r._id === recordId);
      const returnedTimestamp = getCurrentTimestamp();
      const validConditions = ['Good', 'Damaged', 'Lost'];
      const referenceConditions = Array.isArray(record?.referenceIds)
        ? record.referenceIds.map((_, index) => {
            const nextCondition = record.referenceConditions?.[index];
            return validConditions.includes(nextCondition) ? nextCondition : 'Good';
          })
        : [];
      const fallbackCondition = referenceConditions.find((condition) => validConditions.includes(condition)) || 'Good';

      await updateBorrowingRecord(recordId, {
        status: 'Returned',
        returnedTimestamp: returnedTimestamp,
        referenceConditions,
        condition: fallbackCondition
      });

      await fetchData();
      setToast({ message: 'Equipment Successfully Returned', type: 'success' });
    } catch (error) {
      console.error('Error returning equipment:', error);
      setToast({ message: error.message || 'Failed to return equipment', type: 'error' });
    }
  };

  // Undo return - removes timestamp and restores Out status
  const handleUndoReturn = async (recordId) => {
    try {
      await updateBorrowingRecord(recordId, {
        status: 'Out',
        returnedTimestamp: null
      });

      await fetchData();
      setToast({ message: 'Return undone. Equipment marked as Out again.', type: 'success' });
    } catch (error) {
      console.error('Error undoing return:', error);
      setToast({ message: 'Failed to undo return', type: 'error' });
    }
  };

  const openBorrowerEdit = (record) => {
    setBorrowerEditForm({
      fullname: record?.fullname || '',
      contactNo: record?.contactNo || '',
      facebookAccount: record?.facebookAccount || ''
    });
    setIsEditingBorrower(true);
  };

  const cancelBorrowerEdit = () => {
    setIsEditingBorrower(false);
    setBorrowerEditForm({ fullname: '', contactNo: '', facebookAccount: '' });
  };

  const saveBorrowerDetails = async () => {
    if (!selectedBorrowerDetails || borrowerSaveInProgressRef.current) {
      return;
    }

    const trimmedName = borrowerEditForm.fullname.trim();
    if (!trimmedName) {
      setToast({ message: 'Borrower name is required.', type: 'error' });
      return;
    }

    borrowerSaveInProgressRef.current = true;
    try {
      const updatedRecord = await updateBorrowingRecord(selectedBorrowerDetails.id || selectedBorrowerDetails._id, {
        Name: trimmedName,
        fullname: trimmedName,
        contactNo: borrowerEditForm.contactNo.trim(),
        facebookAccount: borrowerEditForm.facebookAccount.trim(),
      });

      await fetchData();
      const refreshedRecord = updatedRecord || {
        ...selectedBorrowerDetails,
        fullname: trimmedName,
        contactNo: borrowerEditForm.contactNo.trim(),
        facebookAccount: borrowerEditForm.facebookAccount.trim(),
        Name: trimmedName,
      };

      setSelectedBorrowerDetails(refreshedRecord);
      setIsEditingBorrower(false);
      setBorrowerEditForm({ fullname: '', contactNo: '', facebookAccount: '' });
    } catch (error) {
      console.error('Error updating borrower details:', error);
      setToast({ message: error.message || 'Failed to update borrower details.', type: 'error' });
    } finally {
      borrowerSaveInProgressRef.current = false;
    }
  };

  const getConditionBadge = (condition) => {
    switch(condition) {
      case 'Good': return { class: 'bw-condition-good', label: 'Good' };
      case 'Damaged': return { class: 'bw-condition-damaged', label: 'Damaged' };
      case 'Lost': return { class: 'bw-condition-lost', label: 'Lost' };
      case 'Under Repair': return { class: 'bw-condition-repair', label: 'Under Repair' };
      default: return { class: '', label: '' };
    }
  };

  const getConditionStyle = (condition) => {
    switch(condition) {
      case 'Good': return { backgroundColor: '#d1fae5', color: '#065f46' };
      case 'Damaged': return { backgroundColor: '#fee2e2', color: '#991b1b' };
      case 'Lost': return { backgroundColor: '#fef3c7', color: '#92400e' };
      default: return { backgroundColor: '#f3f4f6', color: '#374151' };
    }
  };

  const uniqueEquipmentOptions = Array.from(
    new Map(
      allEquipment
        .filter(item => item?.name)
        .map(item => [item.name, item])
    ).values()
  ).filter(item => getAvailableQuantity(item.name) > 0 || form.selectedEquipment.includes(item.name));

  // Keep the field in ISO format so the native date picker can display it correctly.
  const formattedDate = form.date || todayStr();

  return (
    <div className="bw-root">
      <div className="bw-page-header">
        <h1 className="bw-title">Equipment Borrowing<br />Management</h1>
        <a
          className="bw-template-download"
          href={borrowersTemplateDoc}
          download="borrowers-template.doc"
          title="Download equipment borrowing request template"
        >
          <Icon name="download" size={16} />
          Download Template
        </a>
      </div>

      <div className="bw-stats">
        <div className="bw-stat-card">
          <span className="bw-stat-label">DUE TRANSACTIONS</span>
          <span className="bw-stat-value">{dueTransactions}</span>
        </div>
        <div className="bw-stat-card">
          <span className="bw-stat-label">ITEMS OUT</span>
          <span className="bw-stat-value">{itemsOut}</span>
        </div>
        <div className="bw-stat-card">
          <span className="bw-stat-label">BORROWERS</span>
          <span className="bw-stat-value">{borrowerCount}</span>
        </div>
        <div className="bw-stat-card">
          <span className="bw-stat-label">LOST</span>
          <span className="bw-stat-value" style={{ color: '#f44336' }}>{lostItems}</span>
        </div>
      </div>

      {/* New Borrower form */}
      <div className="bw-form-card">
        <h2 className="bw-form-title">NEW BORROWER</h2>
        <form className="bw-form" onSubmit={handleConfirm} noValidate>
          <div className="bw-form-group bw-form-group--full">
            <label className="bw-form-label">FULL NAME</label>
            <input
              type="text"
              className="bw-form-input"
              placeholder="Ex. Juan Dela Cruz"
              value={form.fullname}
              onChange={e => { setForm(f => ({ ...f, fullname: e.target.value })); setError(''); }}
            />
          </div>

          <div className="bw-form-group bw-form-group--full">
            <label className="bw-form-label">CONTACT NO.</label>
            <input
              type="text"
              className="bw-form-input"
              placeholder="Ex. +63 912 345 6789"
              value={form.contactNo}
              onChange={e => { setForm(f => ({ ...f, contactNo: e.target.value })); setError(''); }}
            />
          </div>

          <div className="bw-form-group bw-form-group--full">
            <label className="bw-form-label">FACEBOOK ACCOUNT</label>
            <input
              type="text"
              className="bw-form-input"
              placeholder="Ex. https://facebook.com/username or facebook.com/username"
              value={form.facebookAccount}
              onChange={e => { setForm(f => ({ ...f, facebookAccount: e.target.value })); setError(''); }}
            />
          </div>

          <div className="bw-form-group bw-form-group--full">
            <label className="bw-form-label">EQUIPMENT</label>
            <div ref={equipmentDropdownRef} style={{ position: 'relative', zIndex: isEquipmentDropdownOpen ? 2 : 'auto' }}>
              <button
                type="button"
                className="bw-form-input bw-form-select"
                aria-expanded={isEquipmentDropdownOpen}
                aria-controls="borrowing-equipment-options"
                disabled={uniqueEquipmentOptions.length === 0}
                onClick={() => setIsEquipmentDropdownOpen((isOpen) => !isOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  minHeight: '46px',
                  textAlign: 'left',
                  whiteSpace: 'normal',
                }}
              >
                <span style={{ display: 'block', width: '100%', overflowWrap: 'anywhere' }}>
                  {form.selectedEquipment.length > 0
                    ? form.selectedEquipment.join(', ')
                    : 'Select equipment'}
                </span>
              </button>
              {isEquipmentDropdownOpen && (
                <div
                  id="borrowing-equipment-options"
                  aria-label="Equipment options"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    right: 0,
                    maxHeight: '200px',
                    overflowY: 'auto',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    padding: '10px',
                    backgroundColor: '#fff',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.16)',
                  }}
                >
                  {uniqueEquipmentOptions.map((item) => {
                    const available = getAvailableQuantity(item.name);
                    const checked = form.selectedEquipment.includes(item.name);
                    return (
                      <label key={item._id || item.name} style={{ display: 'block', marginBottom: '8px', cursor: 'pointer', color: '#1a1a1a' }}>
                        <input
                          type="checkbox"
                          value={item.name}
                          checked={checked}
                          onChange={() => handleEquipmentChange(item.name)}
                          style={{ marginRight: '8px' }}
                        />
                        <span>{item.name}</span>
                        <span style={{ marginLeft: '8px', fontSize: '11px', color: '#666' }}>
                          (Available: {available})
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            {uniqueEquipmentOptions.length === 0 && (
              <p style={{ color: '#999', fontSize: '12px', margin: 0 }}>
                {allEquipment.length === 0
                  ? 'No equipment available in inventory. Please add equipment first.'
                  : 'No equipment is currently available to borrow.'}
              </p>
            )}
            {form.selectedEquipment.map((equipmentName) => {
              const availableRefIds = getAvailableReferenceIds(equipmentName);
              const selectedReferenceIds = form.selectedReferenceIdsByEquipment[equipmentName] || [];
              return (
                <div key={equipmentName} style={{ marginTop: '12px' }}>
                  <label className="bw-form-label">{equipmentName} REFERENCE IDs</label>
                  <div className="bw-checkbox-group" style={{
                    maxHeight: '160px',
                    overflowY: 'auto',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    padding: '10px',
                    backgroundColor: '#f9f9f9'
                  }}>
                    {availableRefIds.length === 0 ? (
                      <p style={{ color: '#999', textAlign: 'center', margin: 0 }}>
                        No available Reference IDs for this equipment.
                      </p>
                    ) : availableRefIds.map((ref) => (
                      <label key={ref.id} style={{ display: 'block', marginBottom: '8px', cursor: 'pointer', padding: '4px' }}>
                        <input
                          type="checkbox"
                          value={ref.id}
                          checked={selectedReferenceIds.includes(ref.id)}
                          onChange={() => handleReferenceIdToggle(equipmentName, ref.id)}
                          style={{ marginRight: '8px' }}
                        />
                        <span>{ref.id}</span>
                        <span style={{
                          marginLeft: '8px',
                          fontSize: '11px',
                          padding: '2px 6px',
                          borderRadius: '12px',
                          backgroundColor: ref.condition === 'Good' ? '#4caf50' : '#ff9800',
                          color: 'white'
                        }}>
                          {ref.condition}
                        </span>
                      </label>
                    ))}
                  </div>
                  <p style={{ marginTop: '6px', fontSize: '12px', color: '#666' }}>
                    Quantity: {selectedReferenceIds.length}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="bw-form-row">
            <div className="bw-form-group">
              <label className="bw-form-label">DATE</label>
              <div style={{ position: 'relative', width: '100%' }}>
                <input
                  type="date"
                  className="bw-form-input"
                  value={formattedDate}
                  onChange={e => {
                    setForm(f => ({ ...f, date: e.target.value || todayStr() }));
                  }}
                  style={{ 
                    paddingRight: '20px',
                    width: '100%'
                  }}
                />

              </div>
            </div>
            <div className="bw-form-group">
              <label className="bw-form-label" htmlFor="borrowing-start-time">START TIME</label>
              <div className="schedule-time-controls">
                <TimeInput
                  id="borrowing-start-time"
                  label="Start time"
                  className="schedule-time-picker"
                  inputClassName="bw-form-input schedule-time-input"
                  value={form.startTime}
                  onChange={(nextStartTime) => {
                    setForm((current) => ({ ...current, startTime: nextStartTime }));
                    setTimeErrors((current) => ({ ...current, startTime: '' }));
                    setError('');
                  }}
                  onBlur={() => setTimeErrors((current) => ({
                    ...current,
                    startTime: parseBorrowingTime(form.startTime) ? '' : 'Enter a valid time, such as 9:00 AM.',
                  }))}
                  options={TIME_OPTIONS}
                  placeholder="e.g., 9:00 AM"
                  invalid={Boolean(timeErrors.startTime)}
                  describedBy={timeErrors.startTime ? 'borrowing-start-time-error' : undefined}
                  required
                />
              </div>
              {timeErrors.startTime && <small id="borrowing-start-time-error" className="schedule-time-error" role="alert">{timeErrors.startTime}</small>}
            </div>
            <div className="bw-form-group">
              <label className="bw-form-label" htmlFor="borrowing-end-time">END TIME</label>
              <div className="schedule-time-controls">
                <TimeInput
                  id="borrowing-end-time"
                  label="End time"
                  className="schedule-time-picker"
                  inputClassName="bw-form-input schedule-time-input"
                  value={form.endTime}
                  onChange={(nextEndTime) => {
                    setForm((current) => ({ ...current, endTime: nextEndTime }));
                    setTimeErrors((current) => ({ ...current, endTime: '' }));
                    setError('');
                  }}
                  onBlur={() => setTimeErrors((current) => ({
                    ...current,
                    endTime: form.endTime.trim() && !parseBorrowingTime(form.endTime)
                      ? 'Enter a valid time, such as 5:00 PM.'
                      : '',
                  }))}
                  options={TIME_OPTIONS}
                  placeholder="Select End Time..."
                  invalid={Boolean(timeErrors.endTime)}
                  describedBy={timeErrors.endTime ? 'borrowing-end-time-error' : undefined}
                />
              </div>
              {timeErrors.endTime && <small id="borrowing-end-time-error" className="schedule-time-error" role="alert">{timeErrors.endTime}</small>}
            </div>
          </div>

          {error && <p className="bw-form-error">{error}</p>}

          <div className="bw-form-submit-row">
            <button type="submit" className="bw-confirm-btn">CONFIRM REQUEST</button>
          </div>
        </form>
      </div>

      {/* Transaction Records */}
      <div className="bw-records-card" id="records" ref={recordsCardRef}>
        <div className="bw-records-header">
          <h3 className="bw-records-title">Transaction Records</h3>
          <div className="bw-search-box">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="bw-search-input"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="bw-table-wrap">
          <table className="bw-table">
            <thead>
              <tr>
                <th>FULL NAME</th>
                <th>EQUIPMENT</th>
                <th>CONDITION</th>
                <th>QUANTITY</th>
                <th>BORROWED TIMESTAMP</th>
                <th>RETURNED TIMESTAMP</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((record) => {
                const conditionBadge = getConditionBadge(record.condition);
                const isExpanded = expandedRows[record.id];
                const recordEquipmentItems = getRecordEquipmentItems(record);
                const hasMultipleItems = recordEquipmentItems.length > 1
                  || (record.referenceIds && record.referenceIds.length > 1);
                const isOngoing = isTransactionOngoing(record);
                const isDeadlineApproaching = isBorrowingDeadlineApproaching(record, currentTime);
                const status = String(record.status || '').trim().toLowerCase();
                const isDueWarning = isOngoing
                  && !['overdue', 'returned', 'completed'].includes(status)
                  && isDeadlineApproaching;
                
                return (
                  <React.Fragment key={record.id}>
                    {/* Main Transaction Row */}
                    <tr className={`${isOngoing ? 'bw-row--ongoing' : ''} ${isDueWarning ? 'bw-row--due' : ''} ${!isOngoing ? 'bw-row--returned' : ''}`.trim()}>
                      <td className="bw-td-name">
                        <button
                          onClick={() => setSelectedBorrowerDetails(record)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#0066cc',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            padding: 0,
                            fontSize: 'inherit',
                            fontFamily: 'inherit'
                          }}
                          title="Click to view borrower details"
                        >
                          {record.fullname}
                        </button>
                        {isOngoing && (
                          <span style={{
                            marginLeft: '8px',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            padding: '2px 6px',
                            borderRadius: '12px',
                            backgroundColor: isDueWarning ? '#ffdc00' : '#4caf50',
                            color: isDueWarning ? '#5a0000' : 'white'
                          }}>
                            {isDueWarning ? 'DUE' : 'ONGOING'}
                          </span>
                        )}
                      </td>
                      <td className="bw-td-equipment" style={{ whiteSpace: 'nowrap' }}>
                        {record.referenceIds && record.referenceIds.length > 0 && (
                          <button
                            onClick={() => toggleExpandRow(record.id)}
                            className="expand-row-btn"
                            style={{
                              background: 'none',
                              border: 'none',
                              outline: 'none',
                              boxShadow: 'none',
                              cursor: 'pointer',
                              marginRight: '8px',
                              fontSize: '14px',
                              padding: '0',
                              width: '20px',
                              color: '#666'
                            }}
                          >
                            {isExpanded ? '▼' : '▶'}
                          </button>
                        )}
                        {recordEquipmentItems.map((item) => item.equipment).join(', ')}
                        {hasMultipleItems && (
                          <span style={{ marginLeft: '8px', fontSize: '11px', color: '#999' }}>
                            ({record.referenceIds.length} items)
                          </span>
                        )}
                      </td>
                      <td>
                        {record.condition ? (
                          <span className={conditionBadge.class}>{conditionBadge.label}</span>
                        ) : (
                          <span className="bw-condition-pending">—</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>{record.qty}</td>
                      <td style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>
                        {record.borrowTimestamp ? (
                          <>
                            {record.borrowTimestamp.date}<br />
                            <span style={{ fontSize: '11px', color: '#666' }}>{record.borrowTimestamp.time}</span>
                          </>
                        ) : '—'}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>
                        {record.returnedTimestamp ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                            <div>
                              {record.returnedTimestamp.date}<br />
                              <span style={{ fontSize: '11px', color: '#666' }}>{record.returnedTimestamp.time}</span>
                            </div>
                            <button
                              onClick={() => handleUndoReturn(record.id)}
                              className="undo-return-btn"
                              style={{
                                background: 'none',
                                border: '1px solid #ff9800',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '11px',
                                padding: '2px 6px',
                                color: '#ff9800',
                                marginTop: '4px'
                              }}
                              title="Undo return"
                            >
                              ↩ Undo
                            </button>
                          </div>
                        ) : (
                          <button 
                            className={`bw-return-btn${isDeadlineApproaching ? ' bw-return-btn--warning' : ''}`}
                            onClick={() => handleReturn(record.id)}
                            style={{
                              border: 'none',
                              borderRadius: '4px',
                              padding: '6px 12px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            RETURN
                          </button>
                        )}
                      </td>
                    </tr>
                    
                    {/* Expanded Details Row - With Editable Condition Dropdowns */}
                    {isExpanded && record.referenceIds && record.referenceIds.length > 0 && (
                      <tr className="bw-expanded-row">
                        <td style={{ padding: 0, backgroundColor: '#f9f9f9' }}></td>
                        
                        {/* Reference ID values aligned under EQUIPMENT column */}
                        <td style={{ padding: 0, backgroundColor: '#f9f9f9' }}>
                          <div style={{ padding: '8px 0' }}>
                            {recordEquipmentItems.flatMap((item) => item.referenceIds.map((refId) => ({
                              equipment: item.equipment,
                              referenceId: refId,
                            }))).map(({ equipment, referenceId }, idx) => (
                              <div key={`ref-${idx}`} style={{
                                padding: '6px 8px',
                                borderBottom: idx < record.referenceIds.length - 1 ? '1px solid #eee' : 'none',
                                fontFamily: 'monospace',
                                fontSize: '12px'
                              }}>
                                {recordEquipmentItems.length > 1 && <strong>{equipment}: </strong>}{referenceId}
                              </div>
                            ))}
                          </div>
                        </td>
                        
                        {/* Editable Condition dropdowns aligned under CONDITION column */}
                        <td style={{ padding: 0, backgroundColor: '#f9f9f9' }}>
                          <div style={{ padding: '8px 0' }}>
                            {record.referenceIds.map((refId, idx) => {
                              const currentCondition = record.referenceConditions?.[idx] || 'Good';
                              const conditionStyle = getConditionStyle(currentCondition);
                              return (
                                <div key={`cond-${idx}`} style={{ 
                                  padding: '6px 8px',
                                  borderBottom: idx < record.referenceIds.length - 1 ? '1px solid #eee' : 'none'
                                }}>
                                  {record.status === 'Returned' || Boolean(record.returnedTimestamp) ? (
                                    <span style={{
                                      color: conditionStyle.color,
                                      fontWeight: '500',
                                      fontSize: '12px'
                                    }}>
                                      {currentCondition}
                                    </span>
                                  ) : (
                                    <select
                                      value={currentCondition}
                                      onChange={(e) => updateReferenceCondition(record.id, idx, e.target.value)}
                                      disabled={record.status === 'Returned' || Boolean(record.returnedTimestamp)}
                                      style={{
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        border: `1px solid ${conditionStyle.backgroundColor}`,
                                        backgroundColor: conditionStyle.backgroundColor,
                                        color: conditionStyle.color,
                                        fontWeight: '500',
                                        fontSize: '12px',
                                        cursor: record.status === 'Returned' || Boolean(record.returnedTimestamp) ? 'not-allowed' : 'pointer',
                                        outline: 'none',
                                        opacity: record.status === 'Returned' || Boolean(record.returnedTimestamp) ? 0.7 : 1
                                      }}
                                    >
                                      {EDITABLE_CONDITION_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value} style={{ 
                                          backgroundColor: 'white', 
                                          color: '#333' 
                                        }}>
                                          {opt.label}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                        
                        {/* Empty cells for remaining columns - maintains alignment */}
                        <td style={{ padding: 0, backgroundColor: '#f9f9f9' }}></td>
                        <td style={{ padding: 0, backgroundColor: '#f9f9f9' }}></td>
                        <td style={{ padding: 0, backgroundColor: '#f9f9f9' }}></td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="6" className="bw-empty">No records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <NotificationToast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />
      
      {/* Borrower Details Modal */}
      {selectedBorrowerDetails && createPortal(
        <div className="bw-borrower-modal-backdrop" onClick={() => setSelectedBorrowerDetails(null)}>
          <div className="bw-borrower-modal borrowing-details-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="borrower-details-title">
            <div className="modal-header">
              <h3 id="borrower-details-title">Borrower Details</h3>
            </div>
            <div className="modal-body" style={{ padding: '20px' }}>
              {!isEditingBorrower ? (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontWeight: 'bold', color: '#333', display: 'block', marginBottom: '4px' }}>Name</label>
                    <p style={{ margin: 0, color: '#666' }}>{selectedBorrowerDetails.fullname}</p>
                  </div>
                  
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontWeight: 'bold', color: '#333', display: 'block', marginBottom: '4px' }}>Contact No.</label>
                    <p style={{ margin: 0, color: '#666' }}>{selectedBorrowerDetails.contactNo || '—'}</p>
                  </div>
                  
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontWeight: 'bold', color: '#333', display: 'block', marginBottom: '4px' }}>Facebook Account</label>
                    <p style={{ margin: 0, color: '#666' }}>
                      {selectedBorrowerDetails.facebookAccount ? (
                        <a 
                          href={
                            selectedBorrowerDetails.facebookAccount.startsWith('http') 
                              ? selectedBorrowerDetails.facebookAccount 
                              : `https://${selectedBorrowerDetails.facebookAccount}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#0066cc', textDecoration: 'underline' }}
                        >
                          {selectedBorrowerDetails.facebookAccount}
                        </a>
                      ) : '—'}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontWeight: 'bold', color: '#333', display: 'block', marginBottom: '4px' }}>Name</label>
                    <input
                      type="text"
                      value={borrowerEditForm.fullname}
                      onChange={(e) => setBorrowerEditForm(prev => ({ ...prev, fullname: e.target.value }))}
                      className="bw-form-input"
                      style={{ width: '100%' }}
                    />
                  </div>
                  
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontWeight: 'bold', color: '#333', display: 'block', marginBottom: '4px' }}>Contact No.</label>
                    <input
                      type="text"
                      value={borrowerEditForm.contactNo}
                      onChange={(e) => setBorrowerEditForm(prev => ({ ...prev, contactNo: e.target.value }))}
                      className="bw-form-input"
                      style={{ width: '100%' }}
                    />
                  </div>
                  
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontWeight: 'bold', color: '#333', display: 'block', marginBottom: '4px' }}>Facebook Account</label>
                    <input
                      type="text"
                      value={borrowerEditForm.facebookAccount}
                      onChange={(e) => setBorrowerEditForm(prev => ({ ...prev, facebookAccount: e.target.value }))}
                      className="bw-form-input"
                      style={{ width: '100%' }}
                    />
                  </div>
                </>
              )}
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontWeight: 'bold', color: '#333', display: 'block', marginBottom: '4px' }}>Equipment</label>
                <p style={{ margin: 0, color: '#666' }}>{selectedBorrowerDetails.equipment}</p>
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontWeight: 'bold', color: '#333', display: 'block', marginBottom: '4px' }}>Quantity</label>
                <p style={{ margin: 0, color: '#666' }}>{selectedBorrowerDetails.qty}</p>
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontWeight: 'bold', color: '#333', display: 'block', marginBottom: '4px' }}>Borrowed Date</label>
                <p style={{ margin: 0, color: '#666' }}>{selectedBorrowerDetails.borrowTimestamp?.date || '—'}</p>
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontWeight: 'bold', color: '#333', display: 'block', marginBottom: '4px' }}>Start Time</label>
                <p style={{ margin: 0, color: '#666' }}>{selectedBorrowerDetails.borrowTimestamp?.time || '—'}</p>
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontWeight: 'bold', color: '#333', display: 'block', marginBottom: '4px' }}>Returned Time</label>
                <p style={{ margin: 0, color: '#666' }}>{selectedBorrowerDetails.endTime || '—'}</p>
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontWeight: 'bold', color: '#333', display: 'block', marginBottom: '4px' }}>Status</label>
                <p style={{ margin: 0, color: '#666' }}>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    backgroundColor: selectedBorrowerDetails.status === 'Returned' ? '#d1fae5' : '#fff3cd',
                    color: selectedBorrowerDetails.status === 'Returned' ? '#065f46' : '#856404',
                    fontWeight: 'bold',
                    fontSize: '12px'
                  }}>
                    {selectedBorrowerDetails.status === 'Returned' ? 'RETURNED' : 'OUT'}
                  </span>
                </p>
              </div>
              
              {selectedBorrowerDetails.returnedTimestamp && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontWeight: 'bold', color: '#333', display: 'block', marginBottom: '4px' }}>Return Date</label>
                  <p style={{ margin: 0, color: '#666' }}>
                    {selectedBorrowerDetails.returnedTimestamp.date}
                    <br />
                    <span style={{ fontSize: '12px', color: '#999' }}>{selectedBorrowerDetails.returnedTimestamp.time}</span>
                  </p>
                </div>
              )}
            </div>
            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '12px' }}>
              {isTransactionOngoing(selectedBorrowerDetails) && !isEditingBorrower ? (
                <button
                  type="button"
                  onClick={() => openBorrowerEdit(selectedBorrowerDetails)}
                  className="modal-btn modal-confirm"
                >
                  Edit
                </button>
              ) : isTransactionOngoing(selectedBorrowerDetails) ? (
                <>
                  <button
                    type="button"
                    onClick={cancelBorrowerEdit}
                    className="modal-btn modal-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveBorrowerDetails}
                    className="modal-btn modal-confirm"
                  >
                    Save Changes
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setSelectedBorrowerDetails(null);
                  cancelBorrowerEdit();
                }}
                className="modal-btn modal-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}