import React, { useState, useEffect } from 'react';
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

// Equipment structure with reference IDs and conditions
const INITIAL_EQUIPMENT = [
  { 
    id: 1, 
    name: 'Spalding Ball', 
    type: 'Balls',
    total: 10, 
    date: '04-22-2026',
    available: 10,
    items: [
      { referenceId: 'SPL-001', condition: 'Good' },
      { referenceId: 'SPL-002', condition: 'Good' },
      { referenceId: 'SPL-003', condition: 'Damaged' },
      { referenceId: 'SPL-004', condition: 'Good' }
    ]
  },
  { 
    id: 2, 
    name: 'Volleyball Mikasa', 
    type: 'Balls',
    total: 11, 
    date: '05-20-2026',
    available: 11,
    items: [
      { referenceId: 'VOL-001', condition: 'Good' },
      { referenceId: 'VOL-002', condition: 'Good' }
    ]
  },
  { 
    id: 3, 
    name: 'Racket', 
    type: 'Rackets',
    total: 8, 
    date: '06-27-2026',
    available: 8,
    items: [
      { referenceId: 'RCK-001', condition: 'Good' },
      { referenceId: 'RCK-002', condition: 'Good' }
    ]
  },
  { 
    id: 4, 
    name: 'Baseball Bat', 
    type: 'Rackets',
    total: 6, 
    date: '06-28-2026',
    available: 6,
    items: [
      { referenceId: 'BAT-001', condition: 'Good' },
      { referenceId: 'BAT-002', condition: 'Good' }
    ]
  },
];

export default function AdminEquipments({ borrowingRecords = [], onUpdateInventory }) {
  const [items, setItems] = useState(INITIAL_EQUIPMENT);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', type: '', referenceId: '' });
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [expandedItems, setExpandedItems] = useState({});

  const mapEquipmentToUiShape = (equipment) => {
    const normalizedType = equipment.type || equipment.category || 'Sports Equipment';
    const normalizedReferenceId = equipment.referenceId || '';

    return {
      id: equipment.id || equipment._id,
      name: equipment.name,
      type: normalizedType,
      total: Number(equipment.total ?? equipment.totalStock ?? 1),
      available: Number(equipment.available ?? equipment.totalStock ?? 1),
      date: equipment.createdAt ? new Date(equipment.createdAt).toLocaleDateString() : today(),
      referenceId: normalizedReferenceId,
      items: [{ referenceId: normalizedReferenceId, condition: equipment.condition || 'Good' }]
    };
  };

  const loadEquipmentFromServer = async () => {
    try {
      const response = await getEquipment();
      const serverItems = Array.isArray(response?.data) ? response.data : [];
      if (serverItems.length > 0) {
        setItems(serverItems.map(mapEquipmentToUiShape));
      } else {
        setItems(INITIAL_EQUIPMENT);
      }
    } catch (loadError) {
      console.error('Failed to load equipment from server:', loadError);
      setItems(INITIAL_EQUIPMENT);
    }
  };

  // Calculate available count (items not on loan)
  const calculateAvailable = (equipmentName, equipmentItems) => {
    if (!borrowingRecords || borrowingRecords.length === 0) {
      return equipmentItems.length;
    }
    
    const borrowedCount = borrowingRecords
      .filter(r => r.status === 'Out' && r.equipment === equipmentName)
      .reduce((sum, r) => {
        if (r.referenceIds && r.referenceIds.length) {
          return sum + r.referenceIds.length;
        }
        return sum + (r.qty || 0);
      }, 0);
    
    return Math.max(0, equipmentItems.length - borrowedCount);
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
      await updateEquipment(equipmentId, { condition: newCondition });
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

  return (
    <div className="eq-root">
      <div className="eq-page-header">
        <h1 className="eq-title">Equipment Inventory</h1>
        <p className="eq-subtitle">Track, update, and manage all gymnasium sports assets.</p>
      </div>

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
                <th>QUANTITY (Available/Total)</th>
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
                      <td className="eq-td-refid">{equipment.referenceId || '—'}</td>
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
                        <td className="eq-detail-refid">{item.referenceId}</td>
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
                  <td colSpan="6" className="eq-empty">No equipment found.</td>
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