import React, { useState, useEffect, useEffectEvent, useRef } from 'react';
import { createRequirement, publishRequirement, getAllRequirements, updateAdminRequirement, deleteAdminRequirement, downloadPublishedRequirement } from '../../services/api';
import NotificationToast from '../../components/NotificationToast';
import ConfirmModal from '../../components/ConfirmModal';
import Icon from '../../components/Icon';
import { REGISTRATION_CATEGORIES } from '../../constants/registrationCategories';
import './AdminPortal.css';

const REGISTRATION_SCOPE_GROUPS = REGISTRATION_CATEGORIES.map(({ name, events = [], subcategories = [] }) => ({
  name,
  groups: subcategories.length
    ? subcategories.map(({ name: groupName, sports = [] }) => ({ name: groupName, items: sports }))
    : [{ name: 'Events', items: events }]
}));

const parseRequirementScope = (sport) => String(sport || '')
  .split('|')
  .map((value) => value.trim())
  .filter(Boolean);

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
  const [customRequirements, setCustomRequirements] = useState([]);
  const [customRequirementForm, setCustomRequirementForm] = useState({
    title: '',
    description: '',
    instructions: '',
    targetStudents: 'all',
    scopeItems: []
  });
  const [editingCustomRequirement, setEditingCustomRequirement] = useState(null);
  const [savingCustomRequirement, setSavingCustomRequirement] = useState(false);
  const [publishingCustomRequirementId, setPublishingCustomRequirementId] = useState('');
  const [customRequirementToArchive, setCustomRequirementToArchive] = useState(null);
  const [archivingCustomRequirement, setArchivingCustomRequirement] = useState(false);
  const savingCustomRequirementRef = useRef(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const downloadInProgressRef = useRef(false);
  const uploadInProgressRef = useRef(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [activeRequirementsTab, setActiveRequirementsTab] = useState('upload');

  const handleRequirementsTabKeyDown = (event) => {
    const nextTab = {
      ArrowRight: 'student',
      ArrowLeft: 'upload',
      Home: 'upload',
      End: 'student'
    }[event.key];

    if (!nextTab || nextTab === activeRequirementsTab) return;

    event.preventDefault();
    setActiveRequirementsTab(nextTab);
    document.getElementById(`admin-requirements-${nextTab}-tab`)?.focus();
  };

  const loadRequirements = async () => {
    try {
      setLoading(true);
      const [response, customResponse] = await Promise.all([
        getAllRequirements({ status: 'published' }),
        getAllRequirements({ type: 'other' })
      ]);
      
      // Transform MongoDB data to match component format
      const formattedReqs = (response.data || [])
        .filter((req) => !(req.type === 'other' && !req.file?.filename && !req.file?.path))
        .map(req => ({
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
      setCustomRequirements((customResponse.data || [])
        .filter((requirement) => (
          requirement.type === 'other'
          && !requirement.file?.filename
          && !requirement.file?.path
        ))
        .map((requirement) => ({
          ...requirement,
          id: requirement._id,
          isArchived: requirement.status === 'archived' || requirement.isActive === false
        })));
    } catch (error) {
      console.error('Error loading requirements:', error);
      showToast('Failed to load requirements from database', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadRequirementsOnMount = useEffectEvent(loadRequirements);

  const broadcastRequirementUpdate = () => {
    try {
      localStorage.setItem('gymstat-requirement-updated', String(Date.now()));
      window.dispatchEvent(new Event('gymstat-requirement-updated'));
    } catch (error) {
      console.warn('Could not broadcast requirement update', error.message);
    }
  };

  // Load requirements from MongoDB on component mount
  useEffect(() => {
    loadRequirementsOnMount();
  }, []);

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

  const handleDownloadFromModal = async () => {
    if (!selectedRequirement?._id || downloadInProgressRef.current) return;

    downloadInProgressRef.current = true;
    try {
      setIsDownloading(true);
      const fallbackFilename = selectedRequirement.file?.originalname
        || selectedRequirement.file?.filename
        || selectedRequirement.fileName
        || `${selectedRequirement.title || 'requirement'}.pdf`;
      await downloadPublishedRequirement(selectedRequirement._id, fallbackFilename);
      setShowModal(false);
    } catch (error) {
      console.error('Failed to download requirement file:', error);
      showToast(error?.message || 'Unable to download this requirement file.', 'error');
    } finally {
      downloadInProgressRef.current = false;
      setIsDownloading(false);
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

  const resetCustomRequirementForm = () => {
    setCustomRequirementForm({
      title: '',
      description: '',
      instructions: '',
      targetStudents: 'all',
      scopeItems: []
    });
    setEditingCustomRequirement(null);
  };

  const handleEditCustomRequirement = (requirement) => {
    setEditingCustomRequirement(requirement);
    setCustomRequirementForm({
      title: requirement.title || '',
      description: requirement.description || '',
      instructions: requirement.instructions || '',
      targetStudents: requirement.targetStudents || 'all',
      scopeItems: requirement.targetStudents === 'sport-specific'
        ? parseRequirementScope(requirement.sport)
        : []
    });
  };

  const handleSaveCustomRequirement = async (event) => {
    event.preventDefault();
    if (savingCustomRequirementRef.current) return;

    const title = customRequirementForm.title.trim();
    const description = customRequirementForm.description.trim();
    const instructions = customRequirementForm.instructions.trim();
    const scopeItems = [...new Set(customRequirementForm.scopeItems)];
    if (!title) {
      showToast('Enter a requirement name.', 'error');
      return;
    }
    if (customRequirementForm.targetStudents === 'sport-specific' && scopeItems.length === 0) {
      showToast('Select at least one sport or event, or choose All Sports and Events.', 'error');
      return;
    }

    const dueDate = editingCustomRequirement?.dueDate
      ? new Date(editingCustomRequirement.dueDate).toISOString()
      : (() => {
        const date = new Date();
        date.setDate(date.getDate() + 30);
        return date.toISOString();
      })();
    const requirementData = {
      title,
      description,
      instructions,
      type: 'other',
      sport: customRequirementForm.targetStudents === 'sport-specific' ? scopeItems.join(' | ') : 'General',
      targetStudents: customRequirementForm.targetStudents,
      dueDate,
      priority: editingCustomRequirement?.priority || 'medium',
      isActive: true,
      ...(editingCustomRequirement?.isArchived ? { status: 'published' } : {})
    };

    let createdRequirementId = '';
    try {
      savingCustomRequirementRef.current = true;
      setSavingCustomRequirement(true);
      if (editingCustomRequirement) {
        const response = await updateAdminRequirement(editingCustomRequirement._id, requirementData);
        if (response?.success === false) {
          throw new Error(response.message || 'Failed to update custom requirement.');
        }
      } else {
        const createResponse = await createRequirement(requirementData);
        if (!createResponse?.success) {
          throw new Error(createResponse?.message || 'Failed to create custom requirement.');
        }
        const requirementId = createResponse.data?._id || createResponse.data?.id;
        if (!requirementId) {
          throw new Error('Requirement was created but no ID was returned.');
        }
        createdRequirementId = requirementId;
        const publishResponse = await publishRequirement(requirementId);
        if (!publishResponse?.success) {
          throw new Error(publishResponse?.message || 'Failed to publish custom requirement.');
        }
      }

      resetCustomRequirementForm();
      await loadRequirements();
      broadcastRequirementUpdate();
    } catch (error) {
      console.error('Failed to save custom requirement:', error);
      if (createdRequirementId) {
        resetCustomRequirementForm();
        await loadRequirements();
        showToast('Requirement was saved as a draft. Publish it from the requirements list when ready.', 'error');
        return;
      }
      showToast(error.message || 'Unable to save custom requirement.', 'error');
    } finally {
      savingCustomRequirementRef.current = false;
      setSavingCustomRequirement(false);
    }
  };

  const publishCustomRequirementDraft = async (requirement) => {
    if (!requirement?._id || publishingCustomRequirementId) return;
    try {
      setPublishingCustomRequirementId(requirement._id);
      const response = await publishRequirement(requirement._id);
      if (!response?.success) {
        throw new Error(response?.message || 'Failed to publish requirement.');
      }
      showToast(`Requirement "${requirement.title}" published.`, 'success');
      await loadRequirements();
      broadcastRequirementUpdate();
    } catch (error) {
      console.error('Failed to publish custom requirement:', error);
      showToast(error.message || 'Unable to publish requirement.', 'error');
    } finally {
      setPublishingCustomRequirementId('');
    }
  };

  const archiveCustomRequirement = async () => {
    if (!customRequirementToArchive || archivingCustomRequirement) return;
    try {
      setArchivingCustomRequirement(true);
      const response = await updateAdminRequirement(customRequirementToArchive._id, {
        status: 'archived',
        isActive: false
      });
      if (response?.success === false) {
        throw new Error(response.message || 'Failed to archive requirement.');
      }
      showToast(`Requirement "${customRequirementToArchive.title}" archived.`, 'success');
      setCustomRequirementToArchive(null);
      if (editingCustomRequirement?._id === customRequirementToArchive._id) {
        resetCustomRequirementForm();
      }
      await loadRequirements();
      broadcastRequirementUpdate();
    } catch (error) {
      console.error('Failed to archive custom requirement:', error);
      showToast(error.message || 'Unable to archive custom requirement.', 'error');
    } finally {
      setArchivingCustomRequirement(false);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (uploadInProgressRef.current) return;

    const entryCount = Math.max(requirementNameEntries.length, requirementFileEntries.length);
    const publishEntries = Array.from({ length: entryCount }, (_, index) => ({
      title: (requirementNameEntries[index]?.value || '').trim(),
      file: requirementFileEntries[index]?.file || null
    })).filter((entry) => entry.title || entry.file);

    if (publishEntries.length === 0) {
      showToast('Enter at least one requirement name to publish.', 'error');
      return;
    }
    if (publishEntries.some((entry) => !entry.title)) {
      showToast('Enter a requirement name for every requirement you want to publish.', 'error');
      return;
    }

    uploadInProgressRef.current = true;
    try {
      setLoading(true);

      const dueDateObj = new Date();
      dueDateObj.setDate(dueDateObj.getDate() + 30);

      for (const entry of publishEntries) {
        const requirementTitle = entry.title;
        const requirementData = {
          title: requirementTitle,
          description: `Parent/Guardian consent for ${requirementTitle}`,
          type: entry.file ? 'consent' : 'other',
          sport: 'General',
          dueDate: dueDateObj.toISOString(),
          priority: 'medium',
          instructions: `Please submit your ${requirementTitle}`,
          isActive: true,
          targetStudents: 'all'
        };

        const createResponse = await createRequirement(requirementData, entry.file || undefined);
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
      uploadInProgressRef.current = false;
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

      <div className="admin-requirements-tabs" role="tablist" aria-label="Requirements sections">
        <button
          id="admin-requirements-upload-tab"
          className={`admin-requirements-tab${activeRequirementsTab === 'upload' ? ' is-active' : ''}`}
          type="button"
          role="tab"
          aria-selected={activeRequirementsTab === 'upload'}
          tabIndex={activeRequirementsTab === 'upload' ? 0 : -1}
          aria-controls="admin-requirements-upload-panel admin-requirements-list-panel"
          onClick={() => setActiveRequirementsTab('upload')}
          onKeyDown={handleRequirementsTabKeyDown}
        >
          Upload Requirements
        </button>
        <button
          id="admin-requirements-student-tab"
          className={`admin-requirements-tab${activeRequirementsTab === 'student' ? ' is-active' : ''}`}
          type="button"
          role="tab"
          aria-selected={activeRequirementsTab === 'student'}
          tabIndex={activeRequirementsTab === 'student' ? 0 : -1}
          aria-controls="admin-requirements-student-panel"
          onClick={() => setActiveRequirementsTab('student')}
          onKeyDown={handleRequirementsTabKeyDown}
        >
          Add Student Requirements
        </button>
      </div>

      <div
        id="admin-requirements-upload-panel"
        className="admin-requirements-panel"
        role="tabpanel"
        aria-labelledby="admin-requirements-upload-tab"
        hidden={activeRequirementsTab !== 'upload'}
      >
      {/* UPLOAD PANEL */}
      <div className="upload-section-panel">
        <div className="upload-maroon-card">
          <div className="card-header-inner">
            <span className="icon-badge"><Icon name="folder" size={20} /></span>
            <h3>Upload New Requirement</h3>
          </div>
          
          <form className="requirement-document-upload-form" onSubmit={handleUpload}>
            <div className="requirement-entry-card">
              <div className="requirement-name-section">
                {requirementNameEntries.map((entry) => (
                  <div key={entry.id} className="input-field-group requirement-name-field">
                    <label>Requirement Name *</label>
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
                    <label>Select Document (Optional)</label>
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
                {loading ? 'Publishing...' : <><Icon name="upload" size={16} /> Publish to Portal</>}
              </button>
            </div>
          </form>
        </div>
      </div>
      </div>

      <div
        id="admin-requirements-student-panel"
        className="admin-requirements-panel"
        role="tabpanel"
        aria-labelledby="admin-requirements-student-tab"
        hidden={activeRequirementsTab !== 'student'}
      >
      <section className="admin-requirements-list">
        <div className="admin-reqs-header">
          <h3><Icon name="document" size={20} /> Custom Student Requirements</h3>
          <p>Create requirements students can submit from their Upload New tab.</p>
        </div>

        <form className="admin-upload-form" onSubmit={handleSaveCustomRequirement}>
          <div className="requirement-entry-card">
            <div className="input-field-group">
              <label htmlFor="custom-requirement-title">Requirement Name</label>
              <input
                id="custom-requirement-title"
                className="modern-text-input"
                type="text"
                maxLength={120}
                value={customRequirementForm.title}
                onChange={(event) => setCustomRequirementForm((current) => ({
                  ...current,
                  title: event.target.value
                }))}
                placeholder="e.g., Updated Medical Clearance"
                required
              />
            </div>
            <div className="input-field-group">
              <label htmlFor="custom-requirement-description">Details</label>
              <textarea
                id="custom-requirement-description"
                className="modern-text-input"
                rows={3}
                maxLength={1000}
                value={customRequirementForm.description}
                onChange={(event) => setCustomRequirementForm((current) => ({
                  ...current,
                  description: event.target.value
                }))}
                placeholder="Describe what students need to submit."
              />
            </div>
            <div className="input-field-group">
              <label htmlFor="custom-requirement-instructions">Submission Instructions</label>
              <textarea
                id="custom-requirement-instructions"
                className="modern-text-input"
                rows={2}
                maxLength={1000}
                value={customRequirementForm.instructions}
                onChange={(event) => setCustomRequirementForm((current) => ({
                  ...current,
                  instructions: event.target.value
                }))}
                placeholder="Optional instructions for students."
              />
            </div>
            <div className="input-field-group">
              <label id="custom-requirement-sports-label">Sports and Events</label>
              <details className="requirement-sport-picker">
                <summary aria-labelledby="custom-requirement-sports-label">
                  {customRequirementForm.targetStudents === 'all'
                    ? 'All Sports and Events'
                    : customRequirementForm.scopeItems.length
                      ? `${customRequirementForm.scopeItems.length} item${customRequirementForm.scopeItems.length === 1 ? '' : 's'} selected`
                      : 'Select sports and events'}
                </summary>
                <div className="requirement-sport-options" role="group" aria-labelledby="custom-requirement-sports-label">
                  <label className="requirement-sport-option">
                    <input
                      type="checkbox"
                      checked={customRequirementForm.targetStudents === 'all'}
                      onChange={(event) => setCustomRequirementForm((current) => ({
                        ...current,
                        targetStudents: event.target.checked ? 'all' : 'sport-specific',
                        scopeItems: []
                      }))}
                    />
                    <span>All Sports and Events</span>
                  </label>
                  {REGISTRATION_SCOPE_GROUPS.map((category) => (
                    <div className="requirement-sport-category" key={category.name}>
                      <label className="requirement-sport-option requirement-sport-category-option">
                        <input
                          type="checkbox"
                          checked={category.groups.flatMap(({ items }) => items).every((item) => (
                            customRequirementForm.scopeItems.includes(item)
                          ))}
                          disabled={customRequirementForm.targetStudents === 'all'}
                          onChange={(event) => setCustomRequirementForm((current) => {
                            const categoryItems = category.groups.flatMap(({ items }) => items);
                            const nextItems = event.target.checked
                              ? [...current.scopeItems, ...categoryItems]
                              : current.scopeItems.filter((item) => !categoryItems.includes(item));
                            return {
                              ...current,
                              targetStudents: 'sport-specific',
                              scopeItems: [...new Set(nextItems)]
                            };
                          })}
                        />
                        <strong>{category.name}</strong>
                      </label>
                      {category.groups.map((group) => (
                        <div className="requirement-sport-subcategory" key={group.name}>
                          {category.groups.length > 1 && (
                            <label className="requirement-sport-option requirement-sport-subcategory-option">
                              <input
                                type="checkbox"
                                checked={group.items.every((item) => customRequirementForm.scopeItems.includes(item))}
                                disabled={customRequirementForm.targetStudents === 'all'}
                                onChange={(event) => setCustomRequirementForm((current) => {
                                  const nextItems = event.target.checked
                                    ? [...current.scopeItems, ...group.items]
                                    : current.scopeItems.filter((item) => !group.items.includes(item));
                                  return {
                                    ...current,
                                    targetStudents: 'sport-specific',
                                    scopeItems: [...new Set(nextItems)]
                                  };
                                })}
                              />
                              <span>{group.name}</span>
                            </label>
                          )}
                          <div className="requirement-sport-category-items">
                            {group.items.map((item) => (
                              <label key={item} className="requirement-sport-option">
                                <input
                                  type="checkbox"
                                  checked={customRequirementForm.scopeItems.includes(item)}
                                  disabled={customRequirementForm.targetStudents === 'all'}
                                  onChange={(event) => setCustomRequirementForm((current) => {
                                    const nextItems = event.target.checked
                                      ? [...current.scopeItems, item]
                                      : current.scopeItems.filter((selectedItem) => selectedItem !== item);
                                    return {
                                      ...current,
                                      targetStudents: 'sport-specific',
                                      scopeItems: [...new Set(nextItems)]
                                    };
                                  })}
                                />
                                <span>{item}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </details>
              {customRequirementForm.targetStudents === 'sport-specific' && customRequirementForm.scopeItems.length > 0 && (
                <p className="requirement-sport-selection-summary">
                  Selected: {customRequirementForm.scopeItems.join(', ')}
                </p>
              )}
            </div>
          </div>
          <div className="requirement-submit-row">
            <button type="submit" className="primary-upload-btn" disabled={savingCustomRequirement}>
              {savingCustomRequirement
                ? 'Saving...'
                : editingCustomRequirement ? 'Save Changes' : 'Add Custom Requirement'}
            </button>
            {editingCustomRequirement && (
              <button
                type="button"
                className="requirement-action-btn requirement-action-btn--secondary"
                onClick={resetCustomRequirementForm}
                disabled={savingCustomRequirement}
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>

        {customRequirements.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: '#666' }}>
            No custom requirements have been created.
          </div>
        ) : (
          <div className="requirements-boxes-grid">
            {customRequirements.map((requirement) => (
              <div key={requirement._id} className="requirement-box">
                <div className="requirement-box-icon">
                  <Icon name="document" />
                </div>
                <div className="requirement-box-content">
                  <h4>{requirement.title}</h4>
                  {requirement.description && <p>{requirement.description}</p>}
                  {requirement.instructions && <p><strong>Submission instructions:</strong> {requirement.instructions}</p>}
                  {!requirement.description && !requirement.instructions && <p>No additional details.</p>}
                  <div className="requirement-box-meta">
                    <span className="meta-date">
                      {requirement.isArchived
                        ? 'Archived'
                        : requirement.status === 'published' ? 'Published' : 'Draft'}
                      {requirement.targetStudents === 'sport-specific'
                        ? ` · ${parseRequirementScope(requirement.sport).join(', ')}`
                        : ' · All Sports'}
                    </span>
                  </div>
                  <div className="requirement-entry-actions btn-group" style={{ marginTop: '10px' }}>
                    {requirement.status === 'draft' && (
                      <button
                        type="button"
                        className="requirement-action-btn requirement-action-btn--secondary"
                        onClick={() => publishCustomRequirementDraft(requirement)}
                        disabled={Boolean(publishingCustomRequirementId)}
                      >
                        {publishingCustomRequirementId === requirement._id ? 'Publishing...' : 'Publish'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="requirement-action-btn requirement-action-btn--secondary"
                      onClick={() => handleEditCustomRequirement(requirement)}
                    >
                      Edit
                    </button>
                    {!requirement.isArchived && (
                      <button
                        type="button"
                        className="requirement-action-btn requirement-action-btn--danger"
                        onClick={() => setCustomRequirementToArchive(requirement)}
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      </div>

      <div
        id="admin-requirements-list-panel"
        className="admin-requirements-panel"
        role="tabpanel"
        aria-labelledby="admin-requirements-upload-tab"
        hidden={activeRequirementsTab !== 'upload'}
      >
      {/* ACTIVE REQUIREMENTS - Same design as Student Requirements */}
      <div className="admin-requirements-list">
        <div className="admin-reqs-header">
                <h3><Icon name="document" size={20} /> Active Requirements </h3>
          <p>Click on any form to view details or download</p>
        </div>

        {uploadedReqs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                <p><Icon name="folder" size={18} /> No requirements published yet</p>
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
                  <Icon name="document" />
                </div>
                <div className="requirement-box-content">
                  <h4>{req.title}</h4>
                  <p>{req.description}</p>
                  <div className="requirement-box-meta">
                    <span className="meta-date"><Icon name="calendar" size={16} /> Posted: {req.date}</span>
                  </div>
                </div>
                <div className="requirement-box-arrow">
                  <span className="arrow-icon"><Icon name="chevronRight" /></span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="admin-reqs-note">
          <p><Icon name="info" size={16} /> <strong>Note:</strong> These Parent Consent forms are visible to all students. They can download and submit accomplished forms.</p>
        </div>
      </div>
      </div>

      {/* Updated Modal Popup with Delete Button */}
      {showModal && selectedRequirement && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content minimal-modal" onClick={(e) => e.stopPropagation()}>
            <div className="minimal-modal-header">
              <h3>{selectedRequirement.title}</h3>
              <button className="minimal-close" onClick={() => setShowModal(false)} aria-label="Close requirement details"><Icon name="close" size={18} /></button>
            </div>
            <div className="minimal-modal-body">
              <p>Ready to download "{selectedRequirement.title}"</p>
              <p className="file-info"><Icon name="document" size={15} /> {selectedRequirement.fileType} • {selectedRequirement.fileSize}</p>
              <p className="file-description">{selectedRequirement.description}</p>
            </div>
            <div className="minimal-modal-footer">
              <button 
                className="minimal-delete" 
                onClick={handleDeleteRequirement}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : <><Icon name="trash" size={16} /> Delete</>}
              </button>
              <button className="minimal-cancel" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="minimal-download" onClick={handleDownloadFromModal} disabled={isDownloading}>
                {isDownloading ? 'Downloading...' : 'Download'}
              </button>
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

        <ConfirmModal
          isOpen={Boolean(customRequirementToArchive)}
          title="Archive Custom Requirement"
          message={customRequirementToArchive
            ? `Archive "${customRequirementToArchive.title}"? Students will no longer be able to submit it. Existing submissions will be preserved.`
            : ''}
          confirmText={archivingCustomRequirement ? 'Archiving...' : 'Archive'}
          cancelText="Cancel"
          onConfirm={archiveCustomRequirement}
          onCancel={() => setCustomRequirementToArchive(null)}
          confirmDisabled={archivingCustomRequirement}
        />
    </div>
  );
};

export default AdminRequirements;