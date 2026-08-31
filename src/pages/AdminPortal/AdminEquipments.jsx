import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import NotificationToast from '../../components/NotificationToast';
import ConfirmModal from '../../components/ConfirmModal';
import { getEquipment, registerEquipment, updateEquipment, deleteEquipment } from '../../services/api';
import './AdminPortal.css';

const today = () => {
  const d = new Date();
  return `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}-${d.getFullYear()}`;
};

// Sports equipment type options for dropdown
const EQUIPMENT_TYPE_OPTIONS = [
  'Balls',
  'Rackets',
  'Net',
  'General',
  'Sports Equipment'
];

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

export default function AdminEquipments({ borrowingRecords = [], onUpdateInventory }) {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', type: '', referenceId: '' });
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [expandedItems, setExpandedItems] = useState({});
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  const formatReferenceIdDisplay = (referenceIds = []) => {
    const uniqueIds = [...new Set(referenceIds.filter(Boolean))].sort((a, b) => {
      const matchA = a.match(/(.*?)(\d+)(.*)/);
      const matchB = b.match(/(.*?)(\d+)(.*)/);

      if (!matchA || !matchB) {
        return a.localeCompare(b);
      }

      const prefixA = matchA[1];
      const prefixB = matchB[1];
      const numberA = Number(matchA[2]);
      const numberB = Number(matchB[2]);
      const suffixA = matchA[3];
      const suffixB = matchB[3];

      if (prefixA !== prefixB) {
        return prefixA.localeCompare(prefixB);
      }
      if (suffixA !== suffixB) {
        return suffixA.localeCompare(suffixB);
      }
      return numberA - numberB;
    });

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

  // Calculate available count (items not on loan)
  const calculateAvailable = (equipmentName, equipmentItems) => {
    const activeEquipmentItems = (equipmentItems || []).filter(
      (item) => (item?.condition || 'Good') !== 'Damaged'
    );

    if (!borrowingRecords || borrowingRecords.length === 0) {
      return activeEquipmentItems.length;
    }

    const borrowedCount = borrowingRecords
      .filter(r => r.status === 'Out' && r.equipment === equipmentName)
      .reduce((sum, r) => {
        if (r.referenceIds && r.referenceIds.length) {
          return sum + r.referenceIds.length;
        }
        return sum + (r.qty || 0);
      }, 0);

    return Math.max(0, activeEquipmentItems.length - borrowedCount);
  };

  useEffect(() => {
    loadEquipmentFromServer();
  }, []);

  // Sync inventory with borrowing records
  useEffect(() => {
    if (borrowingRecords && borrowingRecords.length > 0) {
      setItems(prevItems => 
        prevItems.map(equipment => ({
          ...equipment,
          available: calculateAvailable(equipment.name, equipment.items)
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

    if (!form.referenceId.trim()) {
      setError('Reference ID is required.');
      showToast('Reference ID is required.', 'error');
      return;
    }

    try {
      const response = await registerEquipment({
        name: form.name.trim(),
        type: form.type.trim(),
        category: form.type.trim(),
        referenceId: form.referenceId.trim(),
        condition: 'Good'
      });

      await loadEquipmentFromServer();
      setForm({ name: '', type: '', referenceId: '' });
      setError('');
      showToast(response?.message || `Equipment saved to database successfully.`, 'success');

      if (onUpdateInventory) {
        onUpdateInventory(items);
      }
    } catch (submitError) {
      console.error('Failed to save equipment to server:', submitError);
      setError(submitError.message || 'Unable to save equipment to the database.');
      showToast(submitError.message || 'Unable to save equipment to the database.', 'error');
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

      const targetEquipmentId = equipmentToUpdate.referenceId === referenceId && equipmentToUpdate.id
        ? equipmentToUpdate.id
        : equipmentToUpdate.id;

      await updateEquipment(targetEquipmentId, {
        referenceId: referenceId || equipmentToUpdate.referenceId,
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
    return calculateAvailable(equipment.name, equipment.items);
  };

  const generateEquipmentReport = async (filter) => {
    try {
      const response = await getEquipment();
      const allEquipment = Array.isArray(response?.data) ? response.data : [];

      let filteredEquipment = allEquipment;
      if (filter !== 'all') {
        filteredEquipment = allEquipment.filter(eq => (eq.condition || 'Good') === filter);
      }

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'in',
        format: [8.5, 13]
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 0.5;
      const lineHeight = 0.25;
      let yPosition = margin;

      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text('EQUIPMENT MASTERLIST REPORT', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += lineHeight * 2;

      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      const filterLabel = filter === 'all' ? 'All Equipment' : 'Condition: ' + filter;
      doc.text('Filter: ' + filterLabel, margin, yPosition);
      yPosition += lineHeight;
      doc.text('Generated: ' + new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(), margin, yPosition);
      yPosition += lineHeight * 1.5;

      const col1X = margin;
      const col2X = margin + 2.5;
      const col3X = margin + 4.2;
      const col4X = margin + 5.2;
      const col5X = margin + 6.2;
      const colWidth1 = 2.3;
      const colWidth2 = 1.5;
      const colWidth3 = 0.9;
      const colWidth4 = 0.9;
      const colWidth5 = 1.8;

      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.setFillColor(123, 30, 30);
      doc.setTextColor(255, 255, 255);
      const headerY = yPosition;
      doc.rect(col1X, headerY, colWidth1, lineHeight, 'F');
      doc.rect(col2X, headerY, colWidth2, lineHeight, 'F');
      doc.rect(col3X, headerY, colWidth3, lineHeight, 'F');
      doc.rect(col4X, headerY, colWidth4, lineHeight, 'F');
      doc.rect(col5X, headerY, colWidth5, lineHeight, 'F');
      doc.text('EQUIPMENT NAME', col1X + 0.05, headerY + 0.18);
      doc.text('REFERENCE ID', col2X + 0.05, headerY + 0.18);
      doc.text('QTY', col3X + 0.05, headerY + 0.18);
      doc.text('CONDITION', col4X + 0.05, headerY + 0.18);
      doc.text('TYPE', col5X + 0.05, headerY + 0.18);
      yPosition += lineHeight + 0.05;

      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');
      doc.setFontSize(8);

      const maxTableHeight = pageHeight - margin - 0.5;
      const rowHeight = lineHeight * 0.8;

      filteredEquipment.forEach((equipment) => {
        const condition = equipment.condition || 'Good';
        const referenceIds = Array.isArray(equipment.referenceIds) && equipment.referenceIds.length > 0
          ? equipment.referenceIds
          : [equipment.referenceId || 'N/A'];
        const quantity = referenceIds.length > 0 ? referenceIds.length : (equipment.total || equipment.totalStock || 1);

        referenceIds.forEach((refId, idx) => {
          if (yPosition + rowHeight > maxTableHeight) {
            doc.addPage();
            yPosition = margin;
          }

          if (idx % 2 === 1) {
            doc.setFillColor(245, 245, 245);
            doc.rect(col1X, yPosition, pageWidth - 2 * margin, rowHeight, 'F');
          }

          if (idx === 0) {
            const nameLines = doc.splitTextToSize(equipment.name, colWidth1 - 0.1);
            doc.text(nameLines, col1X + 0.05, yPosition + 0.08);
          }

          doc.text(refId, col2X + 0.05, yPosition + 0.12);

          if (idx === 0) {
            doc.text(String(quantity), col3X + 0.1, yPosition + 0.12);
          }

          doc.text(condition, col4X + 0.05, yPosition + 0.12);

          if (idx === 0) {
            const type = equipment.type || equipment.category || 'Sports Equipment';
            const typeLines = doc.splitTextToSize(type, colWidth5 - 0.1);
            doc.text(typeLines, col5X + 0.05, yPosition + 0.08);
          }

          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.01);
          doc.rect(col1X, yPosition, colWidth1, rowHeight);
          doc.rect(col2X, yPosition, colWidth2, rowHeight);
          doc.rect(col3X, yPosition, colWidth3, rowHeight);
          doc.rect(col4X, yPosition, colWidth4, rowHeight);
          doc.rect(col5X, yPosition, colWidth5, rowHeight);

          yPosition += rowHeight;
        });
      });

      const footerY = pageHeight - 0.4;
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('Page ' + (doc.internal.pages.length - 1), pageWidth / 2, footerY, { align: 'center' });

      const fileName = 'Equipment_Masterlist_' + filter + '_' + new Date().toISOString().split('T')[0] + '.pdf';
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
          📥 Download Report
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
              <select
                className="eq-reg-input eq-reg-select"
                value={form.type}
                onChange={e => { setForm(f => ({ ...f, type: e.target.value })); setError(''); }}
              >
                <option value="">Equipment Type</option>
                {EQUIPMENT_TYPE_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div className="eq-reg-group">
              <label className="eq-reg-label">REFERENCE ID</label>
              <input
                type="text"
                className="eq-reg-input"
                placeholder="e.g., EQ-001, BASK-01"
                value={form.referenceId}
                onChange={e => { setForm(f => ({ ...f, referenceId: e.target.value })); setError(''); }}
              />
            </div>
          </div>
          {error && <p className="eq-reg-error">{error}</p>}
          <div className="eq-reg-submit-row">
            <button type="submit" className="eq-add-btn">+ ADD 1 UNIT TO INVENTORY</button>
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
                        <button className="eq-del-btn" title="Delete" onClick={() => handleDelete(equipment.id)}>🗑</button>
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