import React, { useState, useEffect, useRef } from 'react';
import NotificationToast from '../../components/NotificationToast';
import ConfirmModal from '../../components/ConfirmModal';
import {
  getEquipment,
  getBorrowingRecords,
  createBorrowingRecord,
  updateBorrowingRecord,
  returnBorrowedEquipment,
  deleteBorrowingRecord,
} from '../../services/api';
import './AdminPortal.css';

const TIME_OPTIONS = [
  '06:00 AM','07:00 AM','08:00 AM','08:30 AM','09:00 AM','09:30 AM',
  '10:00 AM','10:30 AM','11:00 AM','11:30 AM','12:00 PM','01:00 PM',
  '02:00 PM','03:00 PM','04:00 PM','05:00 PM','06:00 PM',
];

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

const EMPTY_FORM = { 
  fullname: '', 
  contactNo: '',
  facebookAccount: '',
  equipment: '', 
  selectedReferenceIds: [],
  date: todayStr(), 
  startTime: '09:00 AM',
  endTime: ''
};

export default function AdminBorrowing({ equipmentInventory = [], onBorrowingChange }) {
  const [records, setRecords] = useState([]);
  const [equipmentWithRefs, setEquipmentWithRefs] = useState({});
  const [allEquipment, setAllEquipment] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedBorrowerDetails, setSelectedBorrowerDetails] = useState(null);
  const [isEditingBorrower, setIsEditingBorrower] = useState(false);
  const [borrowerEditForm, setBorrowerEditForm] = useState({
    fullname: '',
    contactNo: '',
    facebookAccount: ''
  });
  const dateInputRef = useRef(null);

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
      setLoading(true);

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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (onBorrowingChange) {
      onBorrowingChange(records);
    }
  }, [records, onBorrowingChange]);

  // Get available reference IDs for selected equipment (not currently borrowed)
  const getAvailableReferenceIds = (equipmentName) => {
    const equipmentRefs = equipmentWithRefs[equipmentName] || [];

    const borrowedRefIds = records
      .filter(r => r.status === 'Out' && r.equipment === equipmentName)
      .flatMap(r => r.referenceIds || []);

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

  const getCalculatedQuantity = () => {
    return form.selectedReferenceIds ? form.selectedReferenceIds.length : 0;
  };

  const toggleExpandRow = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Update condition for a specific reference ID - now persists to MongoDB
  const updateReferenceCondition = async (recordId, refIndex, newCondition) => {
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
      setToast({ message: `Condition updated to ${newCondition}`, type: 'success' });
    } catch (error) {
      console.error('Error updating condition:', error);
      setToast({ message: 'Failed to update condition', type: 'error' });
      // Revert local state by refetching
      fetchData();
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

  const totalEquipments = records.length;
  const itemsOut = records.filter((record) => ['Out', 'Out Now'].includes(record?.status)).length;
  const damagedItems = records.reduce((count, record) => {
    return count + getConditionValues(record).filter((condition) => condition === 'Damaged').length;
  }, 0);
  const lostItems = records.reduce((count, record) => {
    return count + getConditionValues(record).filter((condition) => condition === 'Lost').length;
  }, 0);

  // Determine if a transaction is ongoing based on status
  const isTransactionOngoing = (record) => {
    if (record.status === 'Returned' || record.returnedTimestamp) {
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

  const filtered = sortedRecords().filter(r =>
    r.fullname.toLowerCase().includes(search.toLowerCase()) ||
    r.equipment.toLowerCase().includes(search.toLowerCase()) ||
    (r.referenceIds && r.referenceIds.some(ref => ref.toLowerCase().includes(search.toLowerCase())))
  );

  const handleEquipmentChange = (equipmentName) => {
    setForm(prev => ({
      ...prev,
      equipment: equipmentName,
      selectedReferenceIds: []
    }));
    setError('');
  };

  const handleReferenceIdToggle = (refId) => {
    setForm(prev => {
      const currentSelected = prev.selectedReferenceIds || [];
      if (currentSelected.includes(refId)) {
        return {
          ...prev,
          selectedReferenceIds: currentSelected.filter(id => id !== refId)
        };
      } else {
        return {
          ...prev,
          selectedReferenceIds: [...currentSelected, refId]
        };
      }
    });
    setError('');
  };

  // Function to open date picker when calendar icon is clicked
  const openDatePicker = () => {
    if (dateInputRef.current) {
      dateInputRef.current.showPicker();
    }
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    
    if (!form.fullname.trim()) { 
      setError('Full name is required.'); 
      setToast({ message: 'Full name is required.', type: 'error' }); 
      return; 
    }
    
    if (!form.equipment) { 
      setError('Please select an equipment.'); 
      setToast({ message: 'Please select an equipment.', type: 'error' }); 
      return; 
    }
    
    if (!form.selectedReferenceIds || form.selectedReferenceIds.length === 0) { 
      setError('Please select at least one Reference ID.'); 
      setToast({ message: 'Please select at least one Reference ID.', type: 'error' }); 
      return; 
    }
    
    try {
      const calculatedQuantity = form.selectedReferenceIds.length;
      const borrowTimestamp = { 
        date: form.date, 
        time: form.startTime 
      };
      
      const equipmentRefs = equipmentWithRefs[form.equipment] || [];
      const referenceConditions = form.selectedReferenceIds.map(refId => {
        const ref = equipmentRefs.find(r => r.id === refId);
        return ref ? ref.condition : 'Good';
      });
      
      const borrowingData = {
        Name: form.fullname.trim(),
        fullname: form.fullname.trim(),
        contactNo: form.contactNo.trim(),
        facebookAccount: form.facebookAccount.trim(),
        equipment: form.equipment,
        quantity: calculatedQuantity,
        qty: calculatedQuantity,
        referenceIds: form.selectedReferenceIds,
        referenceConditions: referenceConditions,
        borrowTimestamp: borrowTimestamp,
        endTime: form.endTime.trim(),
        returnedTimestamp: null,
        status: 'Out',
        condition: null,
      };
      
      await createBorrowingRecord(borrowingData);
      await fetchData();

      setForm(EMPTY_FORM);
      setError('');
      setToast({ message: `Borrowed ${calculatedQuantity} item(s) successfully`, type: 'success' });
    } catch (error) {
      console.error('Error creating borrowing:', error);
      setToast({ message: error.message || 'Failed to save borrowing record', type: 'error' });
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
    if (!selectedBorrowerDetails) {
      return;
    }

    const trimmedName = borrowerEditForm.fullname.trim();
    if (!trimmedName) {
      setToast({ message: 'Borrower name is required.', type: 'error' });
      return;
    }

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
      setToast({ message: 'Borrower details updated successfully.', type: 'success' });
    } catch (error) {
      console.error('Error updating borrower details:', error);
      setToast({ message: error.message || 'Failed to update borrower details.', type: 'error' });
    }
  };

  const handleDelete = (id) => {
    setConfirmDeleteId(id);
  };

  const confirmDelete = async () => {
    try {
      await deleteBorrowingRecord(confirmDeleteId);
      await fetchData();
      setToast({ message: 'Borrowing record deleted successfully.', type: 'success' });
      setConfirmDeleteId(null);
    } catch (error) {
      console.error('Error deleting borrowing:', error);
      setToast({ message: 'Failed to delete borrowing record', type: 'error' });
    }
  };

  const cancelDelete = () => {
    setConfirmDeleteId(null);
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

  const availableRefIds = form.equipment ? getAvailableReferenceIds(form.equipment) : [];
  const uniqueEquipmentOptions = Array.from(
    new Map(
      allEquipment
        .filter(item => item?.name)
        .map(item => [item.name, item])
    ).values()
  ).filter(item => getAvailableQuantity(item.name) > 0);

  // Keep the field in ISO format so the native date picker can display it correctly.
  const formattedDate = form.date || todayStr();

  if (loading) {
    return <div className="bw-root"><div className="loading">Loading borrowing records...</div></div>;
  }

  return (
    <div className="bw-root">
      <div className="bw-page-header">
        <h1 className="bw-title">Equipment Borrowing<br />Management</h1>
      </div>

      <div className="bw-stats">
        <div className="bw-stat-card">
          <span className="bw-stat-label">TOTAL TRANSACTIONS</span>
          <span className="bw-stat-value">{totalEquipments}</span>
        </div>
        <div className="bw-stat-card">
          <span className="bw-stat-label">ITEMS OUT</span>
          <span className="bw-stat-value">{itemsOut}</span>
        </div>
        <div className="bw-stat-card">
          <span className="bw-stat-label">DAMAGED</span>
          <span className="bw-stat-value" style={{ color: '#ff9800' }}>{damagedItems}</span>
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
              placeholder="Ex. Prof Joel Parenio"
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
            <select
              className="bw-form-input bw-form-select"
              value={form.equipment}
              onChange={e => handleEquipmentChange(e.target.value)}
            >
              <option value="">Select Equipment...</option>
              {uniqueEquipmentOptions.map(item => {
                const available = getAvailableQuantity(item.name);
                return available > 0 ? (
                  <option key={item._id || item.name} value={item.name}>
                    {item.name} (Available: {available})
                  </option>
                ) : null;
              })}
            </select>
            {allEquipment.length === 0 && (
              <p style={{ color: '#999', fontSize: '12px', marginTop: '4px' }}>
                No equipment available in inventory. Please add equipment first.
              </p>
            )}
          </div>

          {form.equipment && (
            <div className="bw-form-group bw-form-group--full">
              <label className="bw-form-label">REFERENCE ID (Select one or more)</label>
              <div className="bw-checkbox-group" style={{ 
                maxHeight: '200px', 
                overflowY: 'auto', 
                border: '1px solid #ddd', 
                borderRadius: '8px', 
                padding: '10px',
                backgroundColor: '#f9f9f9'
              }}>
                {availableRefIds.length === 0 ? (
                  <p style={{ color: '#999', textAlign: 'center', margin: 0 }}>
                    No available reference IDs for this equipment
                  </p>
                ) : (
                  availableRefIds.map(ref => (
                    <label key={ref.id} style={{ 
                      display: 'block', 
                      marginBottom: '8px', 
                      cursor: 'pointer',
                      padding: '4px',
                      borderRadius: '4px',
                      transition: 'background-color 0.2s'
                    }}>
                      <input
                        type="checkbox"
                        value={ref.id}
                        checked={form.selectedReferenceIds?.includes(ref.id) || false}
                        onChange={() => handleReferenceIdToggle(ref.id)}
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
                  ))
                )}
              </div>
              {form.selectedReferenceIds?.length > 0 && (
                <p style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                  Selected: {form.selectedReferenceIds.length} item(s)
                </p>
              )}
            </div>
          )}

          <div className="bw-form-row">
            <div className="bw-form-group">
              <label className="bw-form-label">DATE</label>
              <div style={{ position: 'relative', width: '100%' }}>
                <input
                  ref={dateInputRef}
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
              <label className="bw-form-label">START TIME</label>
              <select
                className="bw-form-input bw-form-select"
                value={form.startTime}
                onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
              >
                {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="bw-form-group">
              <label className="bw-form-label">END TIME</label>
              <select
                className="bw-form-input bw-form-select"
                value={form.endTime}
                onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
              >
                <option value="">Select End Time...</option>
                {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {error && <p className="bw-form-error">{error}</p>}

          <div className="bw-form-submit-row">
            <button type="submit" className="bw-confirm-btn">CONFIRM REQUEST</button>
          </div>
        </form>
      </div>

      {/* Transaction Records */}
      <div className="bw-records-card">
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
                const hasMultipleItems = record.referenceIds && record.referenceIds.length > 1;
                const isOngoing = isTransactionOngoing(record);
                
                return (
                  <React.Fragment key={record.id}>
                    {/* Main Transaction Row */}
                    <tr className={`${isOngoing ? 'bw-row--ongoing' : ''} ${record.status === 'Returned' ? 'bw-row--returned' : ''}`.trim()}>
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
                            backgroundColor: '#4caf50',
                            color: 'white'
                          }}>
                            ONGOING
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
                        {record.equipment}
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
                            className="bw-return-btn" 
                            onClick={() => handleReturn(record.id)}
                            style={{
                              background: '#4caf50',
                              color: 'white',
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
                            {record.referenceIds.map((refId, idx) => (
                              <div key={`ref-${idx}`} style={{ 
                                padding: '6px 8px',
                                borderBottom: idx < record.referenceIds.length - 1 ? '1px solid #eee' : 'none',
                                fontFamily: 'monospace',
                                fontSize: '12px'
                              }}>
                                {refId}
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
      <ConfirmModal
        isOpen={Boolean(confirmDeleteId)}
        title="Delete Borrowing Record"
        message="Are you sure you want to delete this borrowing record?"
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
      
      {/* Borrower Details Modal */}
      {selectedBorrowerDetails && (
        <div className="modal-backdrop" onClick={() => setSelectedBorrowerDetails(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="borrower-details-title">
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
                <label style={{ fontWeight: 'bold', color: '#333', display: 'block', marginBottom: '4px' }}>Borrow Date</label>
                <p style={{ margin: 0, color: '#666' }}>{selectedBorrowerDetails.borrowTimestamp?.date || '—'}</p>
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontWeight: 'bold', color: '#333', display: 'block', marginBottom: '4px' }}>Start Time</label>
                <p style={{ margin: 0, color: '#666' }}>{selectedBorrowerDetails.borrowTimestamp?.time || '—'}</p>
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontWeight: 'bold', color: '#333', display: 'block', marginBottom: '4px' }}>End Time</label>
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
              {!isEditingBorrower ? (
                <button
                  type="button"
                  onClick={() => openBorrowerEdit(selectedBorrowerDetails)}
                  className="modal-btn modal-confirm"
                >
                  Edit
                </button>
              ) : (
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
              )}
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
        </div>
      )}
    </div>
  );
}