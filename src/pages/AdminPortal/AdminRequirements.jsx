import React, { useState, useEffect } from 'react';
import { createRequirement, publishRequirement, getAllRequirements, deleteAdminRequirement } from '../../services/api';
import NotificationToast from '../../components/NotificationToast';
import ConfirmModal from '../../components/ConfirmModal';
import './AdminPortal.css';

const AdminRequirements = () => {
  const createEntryId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const showToast = (message, type = 'success') => setToast({ message, type });
  const closeToast = () => setToast({ message: '', type: 'success' });
  const [requirementNameEntries, setRequirementNameEntries] = useState([{ id: createEntryId(), value: '' }]);
  const [requirementFileEntries, setRequirementFileEntries] = useState([{ id: createEntryId(), file: null }]);
  const [selectedRequirement, setSelectedRequirement] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadedReqs, setUploadedReqs] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Load requirements from MongoDB on component mount
  useEffect(() => {
    loadRequirements();
  }, []);

  const loadRequirements = async () => {
    try {
      setLoading(true);
      const response = await getAllRequirements({ status: 'published' });
      
      // Transform MongoDB data to match component format
      const formattedReqs = response.data.map(req => ({
        id: req._id,
        title: req.title,
        description: req.description,
        fileName: req.fileName || 'document.pdf',
        date: new Intl.DateTimeFormat('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        }).format(new Date(req.publishedAt || req.createdAt)),
        fileType: req.fileType || 'PDF',
        fileSize: req.fileSize || 'N/A',
        isRequired: req.isRequired || true,
        content: req.content || '',
        fileUrl: req.fileUrl,
        requirementType: req.requirementType,
        // Store the original MongoDB data
        _id: req._id,
        status: req.status,
        file: req.file
      }));
      
      setUploadedReqs(formattedReqs);
    } catch (error) {
      console.error('Error loading requirements:', error);
      showToast('Failed to load requirements from database', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEntryFileChange = (entryId, e) => {
    const file = e.target.files?.[0] || null;
    setRequirementFileEntries((prev) => prev.map((entry) => entry.id === entryId ? { ...entry, file } : entry));
  };

  const updateEntryTitle = (entryId, value) => {
    setRequirementNameEntries((prev) => prev.map((entry) => entry.id === entryId ? { ...entry, value } : entry));
  };

  const addRequirementNameEntry = () => {
    setRequirementNameEntries((prev) => [...prev, { id: createEntryId(), value: '' }]);
  };

  const removeRequirementNameEntry = (entryId) => {
    setRequirementNameEntries((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((entry) => entry.id !== entryId);
    });
  };

  const addRequirementFileEntry = () => {
    setRequirementFileEntries((prev) => [...prev, { id: createEntryId(), file: null }]);
  };

  const removeRequirementFileEntry = (entryId) => {
    setRequirementFileEntries((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((entry) => entry.id !== entryId);
    });
  };

  const handleOpenModal = (req) => {
    setSelectedRequirement(req);
    setShowModal(true);
  };

  const handleDownloadFromModal = () => {
    if (selectedRequirement) {
      const content = selectedRequirement.content;
      const blob = new Blob([content], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedRequirement.title.toLowerCase().replace(/ /g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      setShowModal(false);
    }
  };

  // Triggered when admin first clicks Delete - show inline confirmation
  const handleDeleteRequirement = () => {
    if (!selectedRequirement) return;
    setConfirmingDelete(true);
  };

  // Perform actual deletion after admin confirms
  const performDelete = async () => {
    if (!selectedRequirement) return;
    try {
      setIsDeleting(true);
      // Delete the requirement from MongoDB (backend also removes file and announcements)
      await deleteAdminRequirement(selectedRequirement._id);

      // Show styled success toast
      showToast(`Requirement "${selectedRequirement.title}" deleted`, 'success');

      // Close the modal and reset state
      setShowModal(false);
      setSelectedRequirement(null);
      setConfirmingDelete(false);

      // Reload admin list
      await loadRequirements();

      // Notify other open pages (e.g., Student portal) to refresh their lists
      try {
        window.dispatchEvent(new CustomEvent('requirementDeleted', { detail: { id: selectedRequirement._id } }));
      } catch (e) {
        console.warn('Could not dispatch requirementDeleted event', e.message);
      }
    } catch (error) {
      console.error('Error deleting requirement:', error);
      showToast(error.message || 'Failed to delete requirement', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();

    const publishEntries = requirementFileEntries
      .map((fileEntry, index) => ({
        title: (requirementNameEntries[index]?.value || '').trim() || fileEntry.file?.name?.replace(/\.[^/.]+$/, '') || '',
        file: fileEntry.file
      }))
      .filter((entry) => entry.file);

    if (publishEntries.length === 0) {
      showToast('Please select at least one document to publish.', 'error');
      return;
    }

    try {
      setLoading(true);

      const dueDateObj = new Date();
      dueDateObj.setDate(dueDateObj.getDate() + 30);

      for (const entry of publishEntries) {
        const requirementTitle = entry.title.trim() || entry.file.name.replace(/\.[^/.]+$/, '');
        const requirementData = {
          title: requirementTitle,
          description: `Parent/Guardian consent for ${requirementTitle}`,
          type: 'consent',
          sport: 'General',
          dueDate: dueDateObj.toISOString(),
          priority: 'medium',
          instructions: `Please submit your ${requirementTitle}`,
          isActive: true,
          targetStudents: 'all'
        };

        const createResponse = await createRequirement(requirementData, entry.file);
        if (!createResponse.success) {
          throw new Error(createResponse.message || 'Failed to create requirement');
        }

        const requirementId = createResponse.data?._id || createResponse.data?.id;
        if (!requirementId) {
          throw new Error('Requirement was created but no ID was returned.');
        }

        const publishResponse = await publishRequirement(requirementId);
        if (!publishResponse.success) {
          throw new Error(publishResponse.message || 'Failed to publish requirement');
        }
      }

      showToast(`Successfully published ${publishEntries.length} requirement${publishEntries.length > 1 ? 's' : ''}.`, 'success');
      await loadRequirements();

      setRequirementNameEntries([{ id: createEntryId(), value: '' }]);
      setRequirementFileEntries([{ id: createEntryId(), file: null }]);

      try {
        window.dispatchEvent(new Event('gymstat-requirement-updated'));
      } catch (eventError) {
        console.warn('Could not broadcast requirement update', eventError.message);
      }
    } catch (error) {
      console.error('Error uploading requirements:', error);
      showToast(error.message || 'Failed to upload requirement', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-page-content">
      {/* HEADER SECTION */}
      <div className="page-header-container">
        <div className="header-text">
          <h1 className="main-title">Requirements Management</h1>
          <p className="sub-title-desc">Publish downloadable Parent Consent forms for athletes</p>
        </div>
      </div>

      <hr className="divider" />

      {/* UPLOAD PANEL */}
      <div className="upload-section-panel">
        <div className="upload-maroon-card">
          <div className="card-header-inner">
            <span className="icon-badge">📁</span>
            <h3>Upload New Requirement</h3>
          </div>
          
          <form className="admin-upload-form" onSubmit={handleUpload}>
            <div className="requirement-entry-card">
              <div className="requirement-name-section">
                {requirementNameEntries.map((entry) => (
                  <div key={entry.id} className="input-field-group requirement-name-field">
                    <label>Requirement Name</label>
                    <div className="requirement-name-inline-row">
                      <input 
                        type="text" 
                        placeholder="e.g., Parent Consent Form Intramural 2025" 
                        value={entry.value}
                        onChange={(e) => updateEntryTitle(entry.id, e.target.value)}
                        className="modern-text-input requirement-name-input"
                      />
                      <div className="requirement-entry-actions btn-group requirement-name-actions">
                        <button
                          type="button"
                          className="requirement-action-btn requirement-action-btn--secondary"
                          onClick={addRequirementNameEntry}
                        >
                          + Add Another
                        </button>
                        <button
                          type="button"
                          className="requirement-action-btn requirement-action-btn--danger"
                          onClick={() => removeRequirementNameEntry(entry.id)}
                          disabled={requirementNameEntries.length === 1}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="requirement-file-actions">
                {requirementFileEntries.map((entry) => (
                  <div key={entry.id} className="input-field-group requirement-file-field">
                    <label>Select Document</label>
                    <div className="custom-file-upload">
                      <input 
                        type="file" 
                        onChange={(e) => handleEntryFileChange(entry.id, e)}
                        className="hidden-file-input"
                        id={`file-upload-${entry.id}`}
                      />
                      <label htmlFor={`file-upload-${entry.id}`} className="file-label-styled">
                        {entry.file ? entry.file.name : 'Choose File...'}
                      </label>
                    </div>
                    <div className="requirement-entry-actions btn-group">
                      <button
                        type="button"
                        className="requirement-action-btn requirement-action-btn--secondary"
                        onClick={addRequirementFileEntry}
                      >
                        + Add Another
                      </button>
                      <button
                        type="button"
                        className="requirement-action-btn requirement-action-btn--danger"
                        onClick={() => removeRequirementFileEntry(entry.id)}
                        disabled={requirementFileEntries.length === 1}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="requirement-submit-row">
              <button type="submit" className="primary-upload-btn" disabled={loading}>
                {loading ? '⏳ Publishing...' : '📤 Publish to Portal'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ACTIVE REQUIREMENTS - Same design as Student Requirements */}
      <div className="admin-requirements-list">
        <div className="admin-reqs-header">
          <h3>📄 Active Requirements </h3>
          <p>Click on any form to view details or download</p>
        </div>

        {loading && uploadedReqs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
            <p>⏳ Loading requirements...</p>
          </div>
        ) : uploadedReqs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
            <p>📭 No requirements published yet</p>
          </div>
        ) : (
          <div className="requirements-boxes-grid">
            {uploadedReqs.map((req) => (
              <div 
                key={req.id} 
                className="requirement-box"
                onClick={() => handleOpenModal(req)}
              >
                <div className="requirement-box-icon">
                  📄
                </div>
                <div className="requirement-box-content">
                  <h4>{req.title}</h4>
                  <p>{req.description}</p>
                  <div className="requirement-box-meta">
                    <span className="meta-date">📅 Posted: {req.date}</span>
                  </div>
                </div>
                <div className="requirement-box-arrow">
                  <span className="arrow-icon">›</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="admin-reqs-note">
          <p>💡 <strong>Note:</strong> These Parent Consent forms are visible to all students. They can download and submit accomplished forms.</p>
        </div>
      </div>

      {/* Updated Modal Popup with Delete Button */}
      {showModal && selectedRequirement && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content minimal-modal" onClick={(e) => e.stopPropagation()}>
            <div className="minimal-modal-header">
              <h3>{selectedRequirement.title}</h3>
              <button className="minimal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="minimal-modal-body">
              <p>Ready to download "{selectedRequirement.title}"</p>
              <p className="file-info">📁 {selectedRequirement.fileType} • {selectedRequirement.fileSize}</p>
              <p className="file-description">{selectedRequirement.description}</p>
            </div>
            <div className="minimal-modal-footer">
              <button 
                className="minimal-delete" 
                onClick={handleDeleteRequirement}
                disabled={isDeleting}
              >
                {isDeleting ? '⏳ Deleting...' : '🗑️ Delete'}
              </button>
              <button className="minimal-cancel" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="minimal-download" onClick={handleDownloadFromModal}>Download</button>
            </div>
          </div>
        </div>
      )}
        <NotificationToast message={toast.message} type={toast.type} onClose={closeToast} />

        <ConfirmModal
          isOpen={confirmingDelete}
          title="Confirm Delete"
          message={selectedRequirement ? `Are you sure you want to delete "${selectedRequirement.title}"? This will remove the uploaded file, the requirement record, and its announcement.` : 'Are you sure you want to delete this requirement?'}
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={performDelete}
          onCancel={() => setConfirmingDelete(false)}
          confirmDisabled={isDeleting}
        />
    </div>
  );
};

export default AdminRequirements;