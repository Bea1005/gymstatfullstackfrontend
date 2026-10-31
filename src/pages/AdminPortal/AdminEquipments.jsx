import React, { useState, useEffect, useEffectEvent, useRef } from 'react';
import NotificationToast from '../../components/NotificationToast';
import ConfirmModal from '../../components/ConfirmModal';
import { getEquipment, getEquipmentReferenceIds, registerEquipment, updateEquipment, deleteEquipment } from '../../services/api';
import Icon from '../../components/Icon';
import { filterEquipmentGroups } from './equipmentSearch';
import './AdminPortal.css';

const today = () => {
  const d = new Date();
  return `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}-${d.getFullYear()}`;
};

// Sports equipment type options for dropdown
// Sports equipment options - can now be freely typed in Equipment Name field
const SPORTS_EQUIPMENT_OPTIONS = [
  'Basketball',
  'Volleyball',
  'Soccer Ball',
  'Baseball Bat',
  'Tennis Racket',
  'Badminton Racket',
  'Table Tennis Paddle',
  'Football',
  'Gym Mat',
  'Dumbbells',
  'Weight Plates',
  'Jump Rope',
  'Cones',
  'Whistle',
  'Stopwatch',
  'First Aid Kit',
  'Water Jug',
  'Scoreboard',
  'Spalding Ball',
  'Volleyball Mikasa',
  'Racket'
];

export default function AdminEquipments({ onUpdateInventory }) {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', type: '', quantity: '1' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const registrationInProgress = useRef(false);
  const [generatedReferenceIds, setGeneratedReferenceIds] = useState([]);
  const [referenceIdsLoading, setReferenceIdsLoading] = useState(false);
  const [referenceIdsError, setReferenceIdsError] = useState('');
  const [referenceIdsRefreshKey, setReferenceIdsRefreshKey] = useState(0);
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [pendingConditionChange, setPendingConditionChange] = useState(null);
  const [isConditionChangeSaving, setIsConditionChangeSaving] = useState(false);
  const [expandedItems, setExpandedItems] = useState({});
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const equipmentConditionUpdatesRef = useRef(new Set());
  const conditionChangeConfirmationInProgressRef = useRef(false);
  const reportInProgressRef = useRef(false);

  const formatReferenceIdDisplay = (referenceIds = []) => {
    const uniqueIds = [...new Set(referenceIds.filter(Boolean))];

    if (uniqueIds.length === 0) {
      return '—';
    }
    if (uniqueIds.length === 1) {
      return uniqueIds[0];
    }

    return uniqueIds.join(', ');
  };

  const mapEquipmentToUiShape = (equipment) => {
    const normalizedReferenceId = equipment.referenceId || '';
    const total = Number(equipment.total ?? equipment.totalStock ?? 1);
    const onLoan = Number(equipment.onLoan ?? 0);
    const available = Number(equipment.available ?? Math.max(0, total - onLoan));
    const condition = equipment.condition === 'Under Repair' ? 'Repair' : (equipment.condition || 'Good');
    const referenceIds = Array.isArray(equipment.referenceIds)
      ? equipment.referenceIds.filter(Boolean)
      : normalizedReferenceId
        ? [normalizedReferenceId]
        : [];

    return {
      id: equipment.id || equipment._id,
      name: equipment.name,
      type: equipment.type,
      total,
      available,
      onLoan,
      damagedUnits: condition === 'Damaged' ? total : 0,
      date: equipment.createdAt ? new Date(equipment.createdAt).toLocaleDateString() : today(),
      referenceId: normalizedReferenceId,
      referenceIds,
      condition,
      items: referenceIds.map((refId) => ({
        id: equipment.id || equipment._id,
        referenceId: refId,
        condition,
        onLoan: Number(equipment.onLoan || 0),
        available,
        totalStock: total
      }))
    };
  };

  const loadEquipmentFromServer = async () => {
    try {
      const response = await getEquipment();
      const serverItems = Array.isArray(response?.data) ? response.data : [];

      if (serverItems.length > 0) {
        const groupedEquipment = new Map();

        serverItems.forEach((equipment) => {
          const normalizedName = equipment.name || 'Unknown Equipment';
          const item = mapEquipmentToUiShape(equipment);
          const groupingKey = JSON.stringify([normalizedName, item.type]);
          const existing = groupedEquipment.get(groupingKey);

          if (!existing) {
            groupedEquipment.set(groupingKey, {
              ...item,
              referenceIds: [...item.referenceIds],
              items: [...item.items],
            });
            return;
          }

          const nextReferenceIds = [...new Set([...existing.referenceIds, ...item.referenceIds])];
          const nextItems = [...existing.items, ...item.items].filter((entry) => entry.referenceId);

          existing.total = Number(existing.total || 0) + Number(item.total || 0);
          existing.available = Number(existing.available || 0) + Number(item.available || 0);
          existing.onLoan = Number(existing.onLoan || 0) + Number(item.onLoan || 0);
          existing.damagedUnits = Number(existing.damagedUnits || 0) + Number(item.damagedUnits || 0);
          existing.referenceId = nextReferenceIds[0] || '';
          existing.referenceIds = nextReferenceIds;
          existing.items = nextItems;
          existing.condition = item.condition || existing.condition || 'Good';
          existing.date = existing.date || item.date;
        });

        setItems(Array.from(groupedEquipment.values()).map((group) => ({
          ...group,
          referenceId: group.referenceIds[0] || '',
          items: group.items.map((entry) => ({
            id: entry.id,
            referenceId: entry.referenceId,
            condition: entry.condition || 'Good',
            available: Number(entry.available || 0),
            onLoan: Number(entry.onLoan || 0),
            totalStock: Number(entry.totalStock || 0)
          })),
          onLoan: Number(group.onLoan || 0),
          condition: group.condition || 'Good'
        })));
      } else {
        setItems([]);
      }
    } catch (loadError) {
      console.error('Failed to load equipment from server:', loadError);
      setItems([]);
    }
  };

  const loadEquipmentFromServerEvent = useEffectEvent(loadEquipmentFromServer);

  useEffect(() => {
    loadEquipmentFromServerEvent();
  }, []);

  useEffect(() => {
    const quantityIsValid = /^\d+$/.test(form.quantity)
      && Number.isSafeInteger(Number(form.quantity))
      && Number(form.quantity) > 0;
    const equipmentType = form.type.trim();

    setGeneratedReferenceIds([]);
    setReferenceIdsError('');

    if (!form.name.trim() || !equipmentType || !quantityIsValid) {
      setReferenceIdsLoading(false);
      return undefined;
    }

    let active = true;
    setReferenceIdsLoading(true);
    const requestTimer = window.setTimeout(() => {
      getEquipmentReferenceIds(equipmentType, Number(form.quantity), form.name.trim())
        .then((response) => {
          if (!active) return;
          if (!Array.isArray(response?.referenceIds)
            || response.referenceIds.length !== Number(form.quantity)) {
            throw new Error('The equipment server did not return the requested number of Reference IDs.');
          }
          if (response.referenceIds.some((referenceId) => (
            typeof referenceId !== 'string'
            || !/^[A-Z0-9]{1,4}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}$/i.test(referenceId)
          ))) {
            throw new Error(
              'The equipment server returned IDs outside the required short [Equipment Code][MM][DD][XXX] format.'
            );
          }
          if (new Set(response.referenceIds).size !== response.referenceIds.length) {
            throw new Error('The equipment server returned duplicate Reference IDs. Retry after refreshing the equipment list.');
          }
          setGeneratedReferenceIds(response.referenceIds);
        })
        .catch((error) => {
          if (!active) return;
          console.error('Failed to generate equipment Reference IDs:', error);
          setReferenceIdsError(error.message || 'Unable to generate Reference IDs.');
        })
        .finally(() => {
          if (active) setReferenceIdsLoading(false);
        });
    }, 400);

    return () => {
      active = false;
      window.clearTimeout(requestTimer);
    };
  }, [form.name, form.type, form.quantity, referenceIdsRefreshKey]);

  const totalItems = items.length;
  const damagedEquipmentUnits = items.reduce((sum, equipment) => (
    sum + Number(equipment.damagedUnits || 0)
  ), 0);

  const filtered = filterEquipmentGroups(items, search);

  const toggleExpand = (id) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAdd = async (e) => {
    e.preventDefault();

    if (registrationInProgress.current) return;

    if (!form.name.trim()) {
      setError('Please enter an equipment name.');
      showToast('Please enter an equipment name.', 'error');
      return;
    }

    if (!form.type.trim()) {
      setError('Please select an equipment type.');
      showToast('Please select an equipment type.', 'error');
      return;
    }

    if (!/^\d+$/.test(form.quantity) || !Number.isSafeInteger(Number(form.quantity)) || Number(form.quantity) < 1) {
      setError('Quantity must be a positive whole number.');
      showToast('Quantity must be a positive whole number.', 'error');
      return;
    }

    const quantity = Number(form.quantity);
    if (referenceIdsLoading || generatedReferenceIds.length !== quantity) {
      setError(referenceIdsError || 'Reference IDs are still being generated. Please wait before registering.');
      return;
    }

    registrationInProgress.current = true;
    setIsSubmitting(true);

    try {
      const response = await registerEquipment({
        name: form.name.trim(),
        type: form.type.trim(),
        category: 'Sports Equipment',
        quantity,
        referenceIds: generatedReferenceIds,
        condition: 'Good'
      });

      if (response?.success !== true
        || !Array.isArray(response.referenceIds)
        || response.referenceIds.length !== quantity
        || response.referenceIds.some((referenceId) => typeof referenceId !== 'string')
        || new Set(response.referenceIds).size !== quantity
        || !Array.isArray(response.data)
        || response.data.length !== quantity
        || response.data.some((equipment) => (
          !equipment || typeof equipment.referenceId !== 'string'
        ))
        || response.data.some((equipment) => !response.referenceIds.includes(equipment.referenceId))
        || new Set(response.data.map((equipment) => equipment.referenceId)).size !== quantity) {
        throw new Error('The server did not confirm saving unique Reference IDs for every unit.');
      }

      const nextItemsByKey = new Map(items.map((equipment) => [
        JSON.stringify([equipment.name, equipment.type]),
        { ...equipment, referenceIds: [...equipment.referenceIds], items: [...equipment.items] }
      ]));

      response.data.forEach((savedEquipment) => {
        const savedItem = mapEquipmentToUiShape(savedEquipment);
        const groupingKey = JSON.stringify([savedItem.name, savedItem.type]);
        const existing = nextItemsByKey.get(groupingKey);

        if (!existing) {
          nextItemsByKey.set(groupingKey, savedItem);
          return;
        }

        const existingReferenceIds = new Set(existing.referenceIds);
        const newlyRegisteredItems = savedItem.items.filter(
          (item) => !existingReferenceIds.has(item.referenceId)
        );
        if (newlyRegisteredItems.length === 0) return;

        existing.referenceIds = [...existing.referenceIds, ...newlyRegisteredItems.map((item) => item.referenceId)];
        existing.items = [...existing.items, ...newlyRegisteredItems];
        existing.referenceId = existing.referenceIds[0] || '';
        existing.total += newlyRegisteredItems.reduce((sum, item) => sum + Number(item.totalStock || 0), 0);
        existing.available += newlyRegisteredItems.reduce((sum, item) => sum + Number(item.available || 0), 0);
        existing.onLoan += newlyRegisteredItems.reduce((sum, item) => sum + Number(item.onLoan || 0), 0);
        existing.damagedUnits += newlyRegisteredItems.reduce((sum, item) => (
          sum + (item.condition === 'Damaged' ? Number(item.totalStock || 1) : 0)
        ), 0);
      });

      const updatedItems = Array.from(nextItemsByKey.values());
      setItems(updatedItems);
      setForm({ name: '', type: '', quantity: '1' });
      setGeneratedReferenceIds([]);
      setError('');

      if (onUpdateInventory) {
        onUpdateInventory(updatedItems);
      }
    } catch (submitError) {
      console.error('Failed to save equipment to server:', submitError);
      setError(submitError.message || 'Unable to save equipment to the database.');
      showToast(submitError.message || 'Unable to save equipment to the database.', 'error');
      if (submitError.status === 409) {
        setGeneratedReferenceIds([]);
        setReferenceIdsRefreshKey((current) => current + 1);
      }
    } finally {
      registrationInProgress.current = false;
      setIsSubmitting(false);
    }
  };

  const showToast = (message, type = 'success') => setToast({ message, type });

  const handleDelete = (id) => {
    const equipmentToDelete = items.find(i => i.id === id);
    const availableCount = equipmentToDelete.available !== undefined ? equipmentToDelete.available : equipmentToDelete.items.length;
    
    if (availableCount < (equipmentToDelete.total || equipmentToDelete.items.length)) {
      setError('Cannot delete equipment that is currently borrowed.');
      showToast('Cannot delete equipment that is currently borrowed.', 'error');
      return;
    }
    setConfirmDeleteId(id);
  };

  const confirmDelete = async () => {
    const equipmentToDelete = items.find(i => i.id === confirmDeleteId);

    if (!equipmentToDelete) {
      setConfirmDeleteId(null);
      return;
    }

    try {
      await deleteEquipment(equipmentToDelete.id);
      await loadEquipmentFromServer();
      setToast({ message: 'Equipment Successfully Removed', type: 'success' });
    } catch (deleteError) {
      console.error('Failed to delete equipment from server:', deleteError);
      setToast({ message: deleteError.message || 'Unable to remove equipment from the database.', type: 'error' });
    }

    setConfirmDeleteId(null);
  };

  const cancelDelete = () => {
    setConfirmDeleteId(null);
  };

  const requestItemConditionChange = (equipmentId, referenceId, newCondition) => {
    const equipment = items.find((item) => item.id === equipmentId);
    const equipmentItem = equipment?.items.find((item) => item.referenceId === referenceId);
    if (!equipment || !equipmentItem || equipmentItem.condition === newCondition) return;

    setPendingConditionChange({
      equipmentId,
      referenceId,
      equipmentName: equipment.name,
      previousCondition: equipmentItem.condition,
      newCondition
    });
  };

  const updateItemCondition = async (equipmentId, referenceId, newCondition) => {
    const updateKey = `${equipmentId}:${referenceId}`;
    if (equipmentConditionUpdatesRef.current.has(updateKey)) return false;
    equipmentConditionUpdatesRef.current.add(updateKey);
    try {
      const equipmentToUpdate = items.find((item) => item.id === equipmentId);
      if (!equipmentToUpdate) {
        throw new Error('Equipment record not found.');
      }

      const targetEquipmentId = equipmentToUpdate.items.find((item) => item.referenceId === referenceId)?.id
        || equipmentToUpdate.id;

      const response = await updateEquipment(targetEquipmentId, {
        condition: newCondition,
      });
      if (response?.success !== true || response.data?.condition !== newCondition) {
        throw new Error('The server did not confirm saving the selected equipment condition.');
      }
      await loadEquipmentFromServer();
    } catch (updateError) {
      console.error('Failed to update equipment condition:', updateError);
      showToast(updateError.message || 'Unable to update condition in the database.', 'error');
    } finally {
      equipmentConditionUpdatesRef.current.delete(updateKey);
    }
  };

  const confirmItemConditionChange = async () => {
    if (!pendingConditionChange || conditionChangeConfirmationInProgressRef.current) return;

    conditionChangeConfirmationInProgressRef.current = true;
    setIsConditionChangeSaving(true);
    try {
      const saved = await updateItemCondition(
        pendingConditionChange.equipmentId,
        pendingConditionChange.referenceId,
        pendingConditionChange.newCondition
      );
      if (saved) setPendingConditionChange(null);
    } finally {
      conditionChangeConfirmationInProgressRef.current = false;
      setIsConditionChangeSaving(false);
    }
  };

  const cancelItemConditionChange = () => {
    if (conditionChangeConfirmationInProgressRef.current) return;
    setPendingConditionChange(null);
  };

  const generateEquipmentReport = async (filter) => {
    if (reportInProgressRef.current) return;
    reportInProgressRef.current = true;
    setIsGeneratingReport(true);
    try {
      const { jsPDF } = await import('jspdf');
      const { autoTable } = await import('jspdf-autotable');
      const response = await getEquipment();
      const allEquipment = Array.isArray(response?.data) ? response.data : [];

      let filteredEquipment = allEquipment;
      if (filter !== 'all') {
        filteredEquipment = allEquipment.filter(eq => (eq.condition || 'Good') === filter);
      }

      const doc = new jsPDF({ orientation: 'portrait', unit: 'in', format: [8.5, 11] });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 0.55;
      const generatedAt = new Date();
      const filterLabel = filter === 'all' ? 'All Equipment' : `Condition: ${filter}`;
      const tableRows = filteredEquipment.map((equipment) => {
        const referenceIds = Array.isArray(equipment.referenceIds) && equipment.referenceIds.length > 0
          ? equipment.referenceIds.filter(Boolean)
          : equipment.referenceId
            ? [equipment.referenceId]
            : [];
        const quantity = referenceIds.length || Number(equipment.total || equipment.totalStock || 1);

        return [
          equipment.name || 'Unknown Equipment',
          referenceIds.length ? referenceIds.join('\n') : 'N/A',
          String(quantity),
          equipment.condition || 'Good',
          equipment.type || '',
        ];
      });

      autoTable(doc, {
        head: [['Equipment Name', 'Reference ID', 'Qty', 'Condition', 'Type']],
        body: tableRows,
        theme: 'grid',
        startY: 1.34,
        margin: { top: 1.34, right: margin, bottom: 0.58, left: margin },
        tableWidth: pageWidth - margin * 2,
        rowPageBreak: 'avoid',
        showHead: 'everyPage',
        styles: {
          font: 'helvetica',
          fontSize: 8,
          textColor: [45, 45, 45],
          fillColor: [255, 255, 255],
          lineColor: [225, 221, 216],
          lineWidth: 0.006,
          cellPadding: { top: 0.075, right: 0.07, bottom: 0.075, left: 0.07 },
          overflow: 'linebreak',
          valign: 'middle',
        },
        headStyles: {
          fontStyle: 'bold',
          fontSize: 8,
          textColor: [123, 30, 30],
          fillColor: [255, 255, 255],
          lineColor: [255, 220, 0],
          lineWidth: 0.015,
          minCellHeight: 0.32,
        },
        alternateRowStyles: { fillColor: [250, 249, 247] },
        columnStyles: {
          0: { cellWidth: 2.05, halign: 'left', valign: 'top' },
          1: { cellWidth: 2.15, halign: 'center', valign: 'top' },
          2: { cellWidth: 0.65, halign: 'center' },
          3: { cellWidth: 1.05, halign: 'center' },
          4: { cellWidth: 1.5, halign: 'left', valign: 'top' },
        },
        didDrawPage: () => {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(12);
          doc.setTextColor(123, 30, 30);
          doc.text('GYMSTAT', pageWidth / 2, 0.34, { align: 'center' });
          doc.setFontSize(9);
          doc.text('EQUIPMENT MASTERLIST REPORT', pageWidth / 2, 0.53, { align: 'center' });
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(90, 90, 90);
          doc.text(`Generated: ${generatedAt.toLocaleString()}`, pageWidth / 2, 0.7, { align: 'center' });
          doc.setFontSize(7);
          doc.text(`Filter: ${filterLabel}`, pageWidth / 2, 0.85, { align: 'center' });
          doc.setDrawColor(255, 220, 0);
          doc.setLineWidth(0.015);
          doc.line(pageWidth / 2 - 0.5, 0.97, pageWidth / 2 + 0.5, 0.97);
        },
      });

      const pageCount = doc.internal.getNumberOfPages();
      for (let page = 1; page <= pageCount; page += 1) {
        doc.setPage(page);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(120, 120, 120);
        doc.text(`Page ${page} of ${pageCount}`, pageWidth / 2, pageHeight - 0.22, { align: 'center' });
      }

      const fileName = `Equipment_Masterlist_${filter}_${generatedAt.toISOString().slice(0, 10)}.pdf`;
      doc.save(fileName);

      setShowDownloadModal(false);
    } catch (err) {
      console.error('Failed to generate report:', err);
      setToast({ message: 'Failed to generate report. Please try again.', type: 'error' });
    } finally {
      reportInProgressRef.current = false;
      setIsGeneratingReport(false);
    }
  };

  return (
    <div className="eq-root">
      <div className="eq-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="eq-title">Equipment Inventory</h1>
          <p className="eq-subtitle">Track, update, and manage all gymnasium sports assets.</p>
        </div>
        <button
          className="eq-download-report-btn"
          onClick={() => setShowDownloadModal(true)}
          title="Download equipment report"
        >
          <Icon name="download" size={16} /> Download Report
        </button>
      </div>

      {showDownloadModal && (
        <div className="eq-modal-overlay" onClick={() => setShowDownloadModal(false)}>
          <div className="eq-modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="eq-modal-title">Download Equipment Report</h2>
            <p className="eq-modal-subtitle">Select which equipment to include:</p>
            <div className="eq-modal-options">
              <button
                className="eq-modal-option-btn"
                onClick={() => generateEquipmentReport('all')}
                disabled={isGeneratingReport}
              >
                {isGeneratingReport ? 'Generating...' : 'All Equipment'}
              </button>
              <button
                className="eq-modal-option-btn"
                onClick={() => generateEquipmentReport('Good')}
                disabled={isGeneratingReport}
              >
                Good
              </button>
              <button
                className="eq-modal-option-btn"
                onClick={() => generateEquipmentReport('Damaged')}
                disabled={isGeneratingReport}
              >
                Damaged
              </button>
              <button
                className="eq-modal-option-btn"
                onClick={() => generateEquipmentReport('Lost')}
                disabled={isGeneratingReport}
              >
                Lost
              </button>
            </div>
            <button
              className="eq-modal-close-btn"
              onClick={() => setShowDownloadModal(false)}
              disabled={isGeneratingReport}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="eq-stats">
        <div className="eq-stat-card">
          <span className="eq-stat-label">TOTAL EQUIPMENT</span>
          <span className="eq-stat-value">{totalItems}</span>
        </div>
        <div className="eq-stat-card">
          <span className="eq-stat-label">DAMAGED EQUIPMENTS</span>
          <span className="eq-stat-value">{damagedEquipmentUnits}</span>
        </div>
      </div>

      <div className="eq-register-card">
        <h2 className="eq-register-title">REGISTER NEW EQUIPMENT</h2>
        <form className="eq-reg-form" onSubmit={handleAdd} noValidate>
          <div className="eq-reg-row">
            <div className="eq-reg-group">
              <label className="eq-reg-label">EQUIPMENT NAME</label>
              <input
                type="text"
                className="eq-reg-input"
                placeholder="e.g., Spalding Ball, Basketball"
                value={form.name}
                onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setError(''); }}
              />
            </div>
            <div className="eq-reg-group">
              <label className="eq-reg-label">EQUIPMENT TYPE</label>
              <input
                type="text"
                className="eq-reg-input"
                placeholder="e.g., BASK, VOL, SPAL"
                value={form.type}
                list="equipment-type-codes"
                onChange={e => { setForm(f => ({ ...f, type: e.target.value })); setError(''); }}
              />
              <datalist id="equipment-type-codes">
                {[...new Set(items.map((equipment) => equipment.type).filter(Boolean))].map((typeCode) => (
                  <option key={typeCode} value={typeCode} />
                ))}
              </datalist>
            </div>
            <div className="eq-reg-group">
              <label className="eq-reg-label">QUANTITY</label>
              <input
                type="number"
                className="eq-reg-input eq-reg-input--qty"
                min="1"
                step="1"
                value={form.quantity}
                onChange={e => { setForm(f => ({ ...f, quantity: e.target.value })); setError(''); }}
              />
            </div>
            <div className="eq-reg-group">
              <label className="eq-reg-label">REFERENCE ID</label>
              <div className="eq-reg-input eq-reference-id-options" role="group" aria-label="Generated Reference IDs">
                {referenceIdsLoading ? (
                  <span>Generating Reference IDs…</span>
                ) : referenceIdsError ? (
                  <span className="eq-reference-id-error" role="alert">{referenceIdsError}</span>
                ) : generatedReferenceIds.length > 0 ? (
                  <span className="eq-reference-id-values">{generatedReferenceIds.join(', ')}</span>
                ) : (
                  <span>Select equipment type and quantity</span>
                )}
              </div>
            </div>
          </div>
          {error && <p className="eq-reg-error">{error}</p>}
          <div className="eq-reg-submit-row">
            <button type="submit" className="eq-add-btn" disabled={isSubmitting} aria-busy={isSubmitting}>
              {isSubmitting
                ? 'ADDING TO INVENTORY…'
                : `ADD ${form.quantity || ''} ${form.quantity === '' ? '' : ''} TO INVENTORY`}
            </button>
          </div>
        </form>
      </div>

      <div className="eq-list-card">
        <div className="eq-list-header">
          <h3 className="eq-list-title">Equipment Masterlist</h3>
          <div className="eq-search-box">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="eq-search-input"
              placeholder="Search by name, reference ID, or condition..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="eq-table-wrap">
          <table className="eq-table">
            <thead>
              <tr>
                <th>EQUIPMENT NAME</th>
                <th>EQUIPMENT TYPE</th>
                <th>REFERENCE ID</th>
                <th>CONDITION</th>
                <th>QUANTITY</th>
                <th>DATE</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((equipment) => {
                const total = Number(equipment.total ?? equipment.items.length);
                const available = Number(equipment.available ?? Math.max(0, total - Number(equipment.onLoan || 0)));
                const quantityDisplay = `${available}/${total}`;
                const isExpanded = expandedItems[equipment.id];
                
                return (
                  <React.Fragment key={equipment.id}>
                    <tr>
                      <td className="eq-td-name">
                        <button 
                          className="eq-expand-btn" 
                          onClick={() => toggleExpand(equipment.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '8px', color: '#1d1a1a', fontSize: '14px' }}
                        >
                          {isExpanded ? '▼' : '▶'}
                        </button>
                        {equipment.name}
                      </td>
                      <td className="eq-td-type">{equipment.type}</td>
                      <td className="eq-td-refid" style={{ minWidth: '180px', maxWidth: '240px', whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
                        {formatReferenceIdDisplay(equipment.referenceIds || [equipment.referenceId])}
                      </td>
                      <td className="eq-td-condition">
                        <span className={`eq-condition-badge eq-condition-badge--${(equipment.condition || 'Good').toLowerCase().replace(/\s+/g, '-')}`}>
                          {equipment.condition === 'Under Repair' ? 'Repair' : (equipment.condition || 'Good')}
                        </span>
                      </td>
                      <td className="eq-td-qty">{quantityDisplay}</td>
                      <td className="eq-td-date">{equipment.date}</td>
                      <td>
                        <button className="eq-del-btn" title="Delete" onClick={() => handleDelete(equipment.id)}><Icon name="trash" size={16} /></button>
                      </td>
                    </tr>
                    {isExpanded && equipment.items.map((item, idx) => (
                      <tr key={`${equipment.id}-detail-${idx}`} className="eq-detail-row">
                        <td className="eq-detail-name"></td>
                        <td className="eq-detail-type"></td>
                        <td className="eq-detail-refid" style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{item.referenceId}</td>
                        <td className="eq-detail-condition" colSpan="2">
                          <select
                            value={item.condition === 'Under Repair' ? 'Repair' : item.condition}
                            onChange={(e) => requestItemConditionChange(equipment.id, item.referenceId, e.target.value)}
                            disabled={Boolean(pendingConditionChange)}
                            className="eq-condition-select"
                            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #ddd' }}
                          >
                            <option value="Good">Good</option>
                            <option value="Damaged">Damaged</option>
                            <option value="Lost">Lost</option>
                            <option value="Repair">Repair</option>
                          </select>
                        </td>
                        <td></td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="7" className="eq-empty">No equipment found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <ConfirmModal
        isOpen={Boolean(confirmDeleteId)}
        title="Remove Equipment"
        message="Are you sure you want to remove this equipment from inventory?"
        confirmText="Remove"
        cancelText="Keep"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
      <ConfirmModal
        isOpen={Boolean(pendingConditionChange)}
        title="Change Equipment Condition"
        message={pendingConditionChange
          ? `Change ${pendingConditionChange.equipmentName} (${pendingConditionChange.referenceId}) from ${pendingConditionChange.previousCondition} to ${pendingConditionChange.newCondition}?`
          : ''}
        confirmText={isConditionChangeSaving ? 'Saving...' : 'Confirm'}
        cancelText="Cancel"
        onConfirm={confirmItemConditionChange}
        onCancel={cancelItemConditionChange}
        confirmDisabled={isConditionChangeSaving}
      />
      <NotificationToast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />
    </div>
  );
}