import { useEffect, useMemo, useState } from 'react';
import { exportAdminAuditLogs, getAdminAuditLogs } from '../../services/api';
import Icon from '../../components/Icon';
import './AdminAuditLog.css';

const PAGE_SIZE = 25;

const ROLE_OPTIONS = [
  ['admin', 'Admin'],
  ['coach', 'Coach'],
  ['screener', 'Screener'],
  ['student', 'Student-Athlete'],
  ['calendar', 'Public Calendar'],
  ['pending', 'Pending account'],
];

const ACTION_OPTIONS = [
  'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'REGISTER',
  'APPROVE', 'REJECT', 'REVIEW', 'FORWARD', 'UPLOAD', 'IMPORT', 'BORROW',
  'RETURN', 'ARCHIVE', 'RESTORE', 'EXPORT', 'VIEW',
];

const MODULE_OPTIONS = [
  'Authentication', 'Account Profile', 'Admin Dashboard', 'User Management',
  'Requirements', 'Student Requirements', 'Coach Requirements', 'Coach Portal',
  'Screener Review', 'Screener Portal', 'Schedules', 'Schedule Requests',
  'Equipment', 'Borrowing', 'Public Calendar', 'Student Portal', 'GYMSTAT',
];

const formatDateTime = (value) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Unknown time';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const toLocalBoundaryIso = (value, nextDay = false) => {
  if (!value) return '';
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day + (nextDay ? 1 : 0));
  return date.toISOString();
};

const initialFilters = {
  search: '',
  role: '',
  action: '',
  module: '',
  result: '',
  fromDate: '',
  toDate: '',
  page: 1,
};

const AdminAuditLog = () => {
  const [filters, setFilters] = useState(initialFilters);
  const [searchInput, setSearchInput] = useState('');
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 0 });
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) => current.search === searchInput.trim()
        ? current
        : { ...current, search: searchInput.trim(), page: 1 });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const apiFilters = useMemo(() => ({
    search: filters.search,
    role: filters.role,
    action: filters.action,
    module: filters.module,
    result: filters.result,
    startDate: toLocalBoundaryIso(filters.fromDate),
    endDate: toLocalBoundaryIso(filters.toDate, true),
    page: filters.page,
    pageSize: PAGE_SIZE,
  }), [filters]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getAdminAuditLogs(apiFilters)
      .then((response) => {
        if (!active) return;
        setRecords(Array.isArray(response.records) ? response.records : []);
        setPagination(response.pagination || { page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 0 });
      })
      .catch((requestError) => {
        if (!active) return;
        setRecords([]);
        setError(requestError.message || 'Unable to load audit records.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [apiFilters, refreshVersion]);

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value, page: 1 }));
  };

  const clearFilters = () => {
    setSearchInput('');
    setFilters(initialFilters);
  };

  const handleExport = async () => {
    setExporting(true);
    setError('');
    try {
      await exportAdminAuditLogs(apiFilters);
    } catch (exportError) {
      setError(exportError.message || 'Unable to export audit records.');
    } finally {
      setExporting(false);
    }
  };

  const hasActiveFilters = Boolean(
    searchInput.trim() || filters.role || filters.action || filters.module
      || filters.result || filters.fromDate || filters.toDate
  );
  const changePage = (page) => setFilters((current) => ({ ...current, page }));

  return (
    <section className="admin-page-content audit-page">
      <header className="audit-header">
        <div>
          <p className="audit-eyebrow">ADMIN PORTAL</p>
          <h1>Audit Log</h1>
          <p className="audit-subtitle">Review important activity across GYMSTAT.</p>
        </div>
        <div className="audit-header-actions">
          <button
            type="button"
            className="audit-button audit-button-secondary"
            onClick={() => setRefreshVersion((version) => version + 1)}
            disabled={loading}
          >
            <Icon name="rotateCcw" size={16} />
            Refresh
          </button>
          <button
            type="button"
            className="audit-button audit-button-primary"
            onClick={handleExport}
            disabled={exporting || loading || pagination.total === 0}
          >
            <Icon name="download" size={16} />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </header>

      <div className="audit-filters" aria-label="Audit log filters">
        <label className="audit-search">
          <span className="audit-visually-hidden">Quick search</span>
          <Icon name="search" size={17} />
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search user, action, module, record..."
          />
        </label>
        <label className="audit-filter-control">
          <span>Role</span>
          <select value={filters.role} onChange={(event) => updateFilter('role', event.target.value)}>
            <option value="">All roles</option>
            {ROLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="audit-filter-control">
          <span>Action</span>
          <select value={filters.action} onChange={(event) => updateFilter('action', event.target.value)}>
            <option value="">All actions</option>
            {ACTION_OPTIONS.map((action) => <option key={action} value={action}>{action.replace(/_/g, ' ')}</option>)}
          </select>
        </label>
        <label className="audit-filter-control">
          <span>Module</span>
          <select value={filters.module} onChange={(event) => updateFilter('module', event.target.value)}>
            <option value="">All modules</option>
            {MODULE_OPTIONS.map((module) => <option key={module} value={module}>{module}</option>)}
          </select>
        </label>
        <label className="audit-filter-control">
          <span>Status</span>
          <select value={filters.result} onChange={(event) => updateFilter('result', event.target.value)}>
            <option value="">All statuses</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILURE">Failed</option>
          </select>
        </label>
        <label className="audit-filter-control audit-date-control">
          <span>From</span>
          <input type="date" value={filters.fromDate} onChange={(event) => updateFilter('fromDate', event.target.value)} />
        </label>
        <label className="audit-filter-control audit-date-control">
          <span>To</span>
          <input type="date" value={filters.toDate} onChange={(event) => updateFilter('toDate', event.target.value)} />
        </label>
        <button type="button" className="audit-clear-button" onClick={clearFilters} disabled={!hasActiveFilters}>
          Clear filters
        </button>
      </div>

      {error && <div className="audit-error" role="alert">{error}</div>}

      <div className="audit-table-card">
        <div className="audit-table-heading">
          <div>
            <h2>Activity history</h2>
            <span>{pagination.total.toLocaleString()} records</span>
          </div>
          {loading && <span className="audit-loading-label">Loading…</span>}
        </div>
        <div className="audit-table-scroll">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Date &amp; Time</th>
                <th>User</th>
                <th>Role</th>
                <th>Action / Module</th>
                <th>Affected Record</th>
                <th>Status</th>
                <th><span className="audit-visually-hidden">Details</span></th>
              </tr>
            </thead>
            <tbody>
              {!loading && records.map((record) => (
                <tr key={record._id}>
                  <td className="audit-date-cell">{formatDateTime(record.timestamp)}</td>
                  <td>
                    <strong>{record.actorName || 'Unknown user'}</strong>
                    {record.userId && <small>{record.userId}</small>}
                  </td>
                  <td><span className="audit-role-badge">{record.role || 'Unknown'}</span></td>
                  <td>
                    <strong>{String(record.action || 'ACTIVITY').replace(/_/g, ' ')}</strong>
                    <small>{record.module || 'GYMSTAT'}</small>
                  </td>
                  <td>{record.affectedRecord || '-'}</td>
                  <td>
                    <span className={`audit-status ${record.result === 'SUCCESS' ? 'is-success' : 'is-failure'}`}>
                      {record.result === 'SUCCESS' ? 'Success' : 'Failed'}
                    </span>
                  </td>
                  <td>
                    <button type="button" className="audit-detail-button" onClick={() => setSelectedRecord(record)}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && records.length === 0 && (
                <tr>
                  <td colSpan="7" className="audit-empty">
                    <Icon name="clipboard" size={28} />
                    <strong>{error ? 'Audit records unavailable' : 'No activity matches these filters'}</strong>
                    <span>{error ? 'Refresh the page or try again later.' : 'Try a different search or clear the selected filters.'}</span>
                  </td>
                </tr>
              )}
              {loading && records.length === 0 && (
                <tr><td colSpan="7" className="audit-empty">Loading audit records…</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <footer className="audit-pagination">
          <span>
            {pagination.total === 0
              ? 'Showing 0 records'
              : `Showing ${(pagination.page - 1) * pagination.pageSize + 1}–${Math.min(pagination.page * pagination.pageSize, pagination.total)} of ${pagination.total}`}
          </span>
          <div>
            <button type="button" className="audit-button audit-button-secondary" onClick={() => changePage(pagination.page - 1)} disabled={loading || pagination.page <= 1}>
              Previous
            </button>
            <span>Page {pagination.page} of {Math.max(pagination.totalPages, 1)}</span>
            <button type="button" className="audit-button audit-button-secondary" onClick={() => changePage(pagination.page + 1)} disabled={loading || pagination.page >= pagination.totalPages}>
              Next
            </button>
          </div>
        </footer>
      </div>

      {selectedRecord && (
        <div className="audit-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelectedRecord(null);
        }}>
          <section className="audit-modal" role="dialog" aria-modal="true" aria-labelledby="audit-detail-title">
            <header>
              <div>
                <p className="audit-eyebrow">ACTIVITY DETAILS</p>
                <h2 id="audit-detail-title">{String(selectedRecord.action || 'ACTIVITY').replace(/_/g, ' ')}</h2>
              </div>
              <button type="button" className="audit-icon-button" onClick={() => setSelectedRecord(null)} aria-label="Close activity details">
                <Icon name="close" size={18} />
              </button>
            </header>
            <dl>
              <div><dt>Date and time</dt><dd>{formatDateTime(selectedRecord.timestamp)}</dd></div>
              <div><dt>User</dt><dd>{selectedRecord.actorName || selectedRecord.identifier || 'Pending account'}</dd></div>
              <div><dt>User ID</dt><dd>{selectedRecord.userId || '-'}</dd></div>
              <div><dt>Role</dt><dd>{selectedRecord.role || 'Unknown'}</dd></div>
              <div><dt>Module</dt><dd>{selectedRecord.module || 'GYMSTAT'}</dd></div>
              <div><dt>Affected record</dt><dd>{selectedRecord.affectedRecord || '—'}</dd></div>
              <div><dt>Status</dt><dd>{selectedRecord.result === 'SUCCESS' ? 'Success' : `Failed${selectedRecord.httpStatus ? ` (HTTP ${selectedRecord.httpStatus})` : ''}`}</dd></div>
              <div className="audit-detail-wide"><dt>Description</dt><dd>{selectedRecord.description || 'No additional description.'}</dd></div>
              {Array.isArray(selectedRecord.changedFields) && selectedRecord.changedFields.length > 0 && (
                <div className="audit-detail-wide"><dt>Changed fields</dt><dd>{selectedRecord.changedFields.join(', ')}</dd></div>
              )}
            </dl>
            <footer>
              <button type="button" className="audit-button audit-button-primary" onClick={() => setSelectedRecord(null)}>Close</button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
};

export default AdminAuditLog;
