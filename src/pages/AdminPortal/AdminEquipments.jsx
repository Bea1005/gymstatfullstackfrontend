import React, { useState, useEffect, useEffectEvent } from 'react';
import NotificationToast from '../../components/NotificationToast';
import ConfirmModal from '../../components/ConfirmModal';
import { getEquipment, getEquipmentReferenceIds, registerEquipment, updateEquipment, deleteEquipment } from '../../services/api';
import Icon from '../../components/Icon';
import './AdminPortal.css';

const today = () => {
  const d = new Date();
  return `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}-${d.getFullYear()}`;
};

const getEquipmentReferenceCode = (name, type) => {
  const normalizedName = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const normalizedType = type.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (['BASKETBALL', 'BASKETBALLS', 'BALLS'].includes(normalizedName)
    || ['BASKETBALL', 'BASKETBALLS', 'BALLS'].includes(normalizedType)) {
    return '1B';
  }
  return normalizedType;
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

const calculateAvailable = (equipmentName, equipmentItems, borrowingRecords) => {
  const activeEquipmentItems = (equipmentItems || []).filter(
    (item) => (item?.condition || 'Good') !== 'Damaged'
  );

  if (!borrowingRecords || borrowingRecords.length === 0) {
    return activeEquipmentItems.length;
  }

  const borrowedCount = borrowingRecords
    .filter((record) => record.status === 'Out' && record.equipment === equipmentName)
    .reduce((sum, record) => {
      if (record.referenceIds && record.referenceIds.length) {
        return sum + record.referenceIds.length;
      }
      return sum + (record.qty || 0);
    }, 0);

  return Math.max(0, activeEquipmentItems.length - borrowedCount);
};

export default function AdminEquipments({ borrowingRecords = [], onUpdateInventory }) {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', type: '', quantity: '1' });
  const [generatedReferenceIds, setGeneratedReferenceIds] = useState([]);
  const [selectedReferenceIds, setSelectedReferenceIds] = useState([]);
  const [referenceIdsLoading, setReferenceIdsLoading] = useState(false);
  const [referenceIdsError, setReferenceIdsError] = useState('');
  const [referenceIdsRefreshKey, setReferenceIdsRefreshKey] = useState(0);
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [expandedItems, setExpandedItems] = useState({});
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  const formatReferenceIdDisplay = (referenceIds = []) => {
    const uniqueIds = [...new Set(referenceIds.filter(Boolean))];

    if (uniqueIds.length === 0) {
      return '—';
    }
    if (uniqueIds.length === 1) {
      return uniqueIds[0];
    }

    return '-';
  };

  const mapEquipmentToUiShape = (equipment) => {
    const normalizedType = equipment.type || equipment.category || 'Sports Equipment';
    const normalizedReferenceId = equipment.referenceId || '';
    const referenceIds = Array.isArray(equipment.referenceIds)
      ? equipment.referenceIds.filter(Boolean)
      : normalizedReferenceId
        ? [normalizedReferenceId]
        : [];

    return {
      id: equipment.id || equipment._id,
      name: equipment.name,
      type: normalizedType,
      total: Number(equipment.total ?? equipment.totalStock ?? 1),
      available: Number(equipment.available ?? equipment.totalStock ?? 1),
      date: equipment.createdAt ? new Date(equipment.createdAt).toLocaleDateString() : today(),
      referenceId: normalizedReferenceId,
      referenceIds,
      condition: equipment.condition || 'Good',
      items: referenceIds.map((refId) => ({
        id: equipment.id || equipment._id,
        referenceId: refId,
        condition: equipment.condition || 'Good'
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
          const existing = groupedEquipment.get(normalizedName);

          if (!existing) {
            groupedEquipment.set(normalizedName, {
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
            condition: entry.condition || 'Good'
          })),
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
    const typeCode = getEquipmentReferenceCode(form.name, form.type);

    setGeneratedReferenceIds([]);
    setSelectedReferenceIds([]);
    setReferenceIdsError('');

    if (!form.name.trim() || !typeCode || !quantityIsValid) {
      setReferenceIdsLoading(false);
      return undefined;
    }

    let active = true;
    setReferenceIdsLoading(true);
    getEquipmentReferenceIds(typeCode, Number(form.quantity), form.name.trim())
      .then((response) => {
        if (!active) return;
        if (!Array.isArray(response?.referenceIds)
          || response.referenceIds.length !== Number(form.quantity)) {
          throw new Error('The equipment server did not return the requested number of Reference IDs.');
        }
        if (response.referenceIds.some((referenceId) => (
          typeof referenceId !== 'string'
          || !new RegExp(`^${typeCode}\\d{7}$`, 'i').test(referenceId)
        ))) {
          throw new Error(
            'The equipment server returned IDs outside the required [Equipment Code][MM][DD][XXX] format. Restart or redeploy the backend, then retry.'
          );
        }
        const referenceIdCodes = response.referenceIds.map((referenceId) => referenceId.slice(0, -7));
        if (referenceIdCodes.some((code) => code !== referenceIdCodes[0])) {
          throw new Error('The equipment server returned IDs with inconsistent equipment codes.');
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

    return () => {
      active = false;
    };
  }, [form.name, form.type, form.quantity, referenceIdsRefreshKey]);

  // Sync inventory with borrowing records
  useEffect(() => {
    if (borrowingRecords && borrowingRecords.length > 0) {
      setItems(prevItems => 
        prevItems.map(equipment => ({
          ...equipment,
          available: calculateAvailable(equipment.name, equipment.items, borrowingRecords)
        }))
      );
    }
  }, [borrowingRecords]);

  const totalItems = items.length;
  const inStock = items.filter(i => {
    const available = i.available !== undefined ? i.available : i.items.length;
    return available > 0;
  }).length;

  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.items.some(item => item.referenceId.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleExpand = (id) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAdd = async (e) => {
    e.preventDefault();

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
      setError(referenceIdsError || 'Wait for Reference IDs to finish generating before registration.');
      return;
    }

    if (selectedReferenceIds.length !== quantity
      || generatedReferenceIds.some((referenceId) => !selectedReferenceIds.includes(referenceId))) {
      setError('Select every generated Reference ID before registering equipment.');
      showToast('Select every generated Reference ID before registering equipment.', 'error');
      return;
    }

    try {
      const response = await registerEquipment({
        name: form.name.trim(),
        type: getEquipmentReferenceCode(form.name, form.type),
        category: 'Sports Equipment',
        quantity,
        referenceIds: generatedReferenceIds,
        condition: 'Good'
      });

      if (response?.success !== true
        || !Array.isArray(response.referenceIds)
        || response.referenceIds.length !== quantity
        || generatedReferenceIds.some((referenceId, index) => response.referenceIds[index] !== referenceId)) {
        throw new Error('The server did not confirm saving all generated Reference IDs.');
      }

      await loadEquipmentFromServer();
      setForm({ name: '', type: '', quantity: '1' });
      setGeneratedReferenceIds([]);
      setSelectedReferenceIds([]);
      setError('');
      showToast(response?.message || 'Equipment registered successfully.', 'success');

      if (onUpdateInventory) {
        onUpdateInventory(items);
      }
    } catch (submitError) {
      console.error('Failed to save equipment to server:', submitError);
      setError(submitError.message || 'Unable to save equipment to the database.');
      showToast(submitError.message || 'Unable to save equipment to the database.', 'error');
      if (submitError.status === 409) {
        setGeneratedReferenceIds([]);
        setSelectedReferenceIds([]);
        setReferenceIdsRefreshKey((current) => current + 1);
      }
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

  const updateItemCondition = async (equipmentId, referenceId, newCondition) => {
    try {
      const equipmentToUpdate = items.find((item) => item.id === equipmentId);
      if (!equipmentToUpdate) {
        throw new Error('Equipment record not found.');
      }

      const targetEquipmentId = equipmentToUpdate.items.find((item) => item.referenceId === referenceId)?.id
        || equipmentToUpdate.id;

      await updateEquipment(targetEquipmentId, {
        condition: newCondition,
      });
      await loadEquipmentFromServer();
      showToast(`Condition updated to ${newCondition}`, 'success');
    } catch (updateError) {
      console.error('Failed to update equipment condition:', updateError);
      showToast(updateError.message || 'Unable to update condition in the database.', 'error');
    }
  };

  const getAvailableForDisplay = (equipment) => {
    if (equipment.available !== undefined) {
      return equipment.available;
    }
    return calculateAvailable(equipment.name, equipment.items, borrowingRecords);
  };

  const generateEquipmentReport = async (filter) => {
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
          equipment.type || equipment.category || 'Sports Equipment',
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

      setToast({ message: 'Report downloaded successfully!', type: 'success' });
      setShowDownloadModal(false);
    } catch (err) {
      console.error('Failed to generate report:', err);
      setToast({ message: 'Failed to generate report. Please try again.', type: 'error' });
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
              >
                All Equipment
              </button>
              <button
                className="eq-modal-option-btn"
                onClick={() => generateEquipmentReport('Good')}
              >
                Good
              </button>
              <button
                className="eq-modal-option-btn"
                onClick={() => generateEquipmentReport('Damaged')}
              >
                Damaged
              </button>
              <button
                className="eq-modal-option-btn"
                onClick={() => generateEquipmentReport('Lost')}
              >
                Lost
              </button>
            </div>
            <button
              className="eq-modal-close-btn"
              onClick={() => setShowDownloadModal(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="eq-stats">
        <div className="eq-stat-card">
          <span className="eq-stat-label">TOTAL EQUIPMENT TYPES</span>
          <span className="eq-stat-value">{totalItems}</span>
        </div>
        <div className="eq-stat-card">
          <span className="eq-stat-label">AVAILABLE UNITS</span>
          <span className="eq-stat-value">{inStock}</span>
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
                  generatedReferenceIds.map((referenceId) => (
                    <label className="eq-reference-id-option" key={referenceId}>
                      <input
                        type="checkbox"
                        value={referenceId}
                        checked={selectedReferenceIds.includes(referenceId)}
                        required
                        aria-required="true"
                        onChange={(event) => {
                          setSelectedReferenceIds((current) => (
                            event.target.checked
                              ? [...current, referenceId]
                              : current.filter((selectedId) => selectedId !== referenceId)
                          ));
                          setError('');
                        }}
                      />
                      <span>{referenceId}</span>
                    </label>
                  ))
                ) : (
                  <span>Select equipment type and quantity</span>
                )}
              </div>
            </div>
          </div>
          {error && <p className="eq-reg-error">{error}</p>}
          <div className="eq-reg-submit-row">
            <button type="submit" className="eq-add-btn">
              + ADD {form.quantity || '0'} {form.quantity === '1' ? 'UNIT' : 'UNITS'} TO INVENTORY
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
              placeholder="Search by name or reference ID..."
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
                const available = getAvailableForDisplay(equipment);
                const total = equipment.total || equipment.items.length;
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
                      <td className="eq-td-type">{equipment.type || 'Sports Equipment'}</td>
                      <td className="eq-td-refid" style={{ minWidth: '180px', maxWidth: '240px', whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
                        {formatReferenceIdDisplay(equipment.referenceIds || [equipment.referenceId])}
                      </td>
                      <td className="eq-td-condition">
                        <span className={`eq-condition-badge eq-condition-badge--${(equipment.condition || 'Good').toLowerCase().replace(/\s+/g, '-')}`}>
                          {equipment.condition || 'Good'}
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
                            value={item.condition}
                            onChange={(e) => updateItemCondition(equipment.id, item.referenceId, e.target.value)}
                            className="eq-condition-select"
                            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #ddd' }}
                          >
                            <option value="Good">Good</option>
                            <option value="Damaged">Damaged</option>
                            <option value="Lost">Lost</option>
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
      <NotificationToast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />
    </div>
  );
}