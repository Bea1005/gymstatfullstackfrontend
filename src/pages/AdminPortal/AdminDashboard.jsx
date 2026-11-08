import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as api from '../../services/api';
import Icon from '../../components/Icon';
import { getDueBorrowings } from '../../utils/borrowingDue';
import "./AdminPortal.css";

const getCurrentAnalyticsDate = (period) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date()).reduce((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  if (period === 'yearly') return parts.year;
  if (period === 'monthly') return `${parts.year}-${parts.month}`;
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const getAnalyticsDateInputType = (period) => (
  period === 'yearly' ? 'number' : period === 'monthly' ? 'month' : 'date'
);

const getAnalyticsDateInputLabel = (period) => (
  period === 'yearly' ? 'Year' : period === 'monthly' ? 'Month' : period === 'weekly' ? 'Week containing' : 'Date'
);

const formatAnalyticsPeriod = (period) => {
  const formatDate = (value) => new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00Z`));
  const range = period.startDate === period.endDate
    ? formatDate(period.startDate)
    : `${formatDate(period.startDate)} – ${formatDate(period.endDate)}`;
  return `${range} · ${period.type}`;
};

const formatPeriodComparison = (currentValue, previousValue) => {
  const current = Number(currentValue) || 0;
  const previous = Number(previousValue) || 0;
  if (previous === 0) return current === 0 ? 'No change' : 'New activity';
  const difference = current - previous;
  const percent = (Math.abs(difference) / previous) * 100;
  return `${difference > 0 ? '+' : difference < 0 ? '−' : ''}${percent.toFixed(1)}% vs previous`;
};

const getAnalyticsTopItem = (items, countKey = 'count') => {
  if (!Array.isArray(items) || items.length === 0) return null;
  return items.reduce((top, item) => (
    Number(item[countKey]) > Number(top[countKey]) ? item : top
  ));
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalEquipments: 0,
    borrowedItems: 0,
    pendingReqs: 0,
  });
  const [activities, setActivities] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [dueBorrowings, setDueBorrowings] = useState([]);
  const [borrowingLoadState, setBorrowingLoadState] = useState('loading');
  const [analytics, setAnalytics] = useState({
    studentAthletesByDepartment: [],
    borrowingsByDepartment: [],
    equipmentBorrowingFrequency: [],
    borrowerTypeActivity: [],
    studentAthleteRegistrationTrend: [],
    borrowingTrend: [],
    equipmentBorrowingTrend: [],
    totalBorrowingTransactions: 0,
  });
  const [analyticsLoadState, setAnalyticsLoadState] = useState('loading');
  const [analyticsError, setAnalyticsError] = useState('');
  const [analyticsExpanded, setAnalyticsExpanded] = useState(true);
  const [analyticsPeriod, setAnalyticsPeriod] = useState('yearly');
  const [analyticsDate, setAnalyticsDate] = useState(getCurrentAnalyticsDate('yearly'));
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    let fetching = false;

    const fetchDashboardData = async () => {
      if (fetching) return;
      fetching = true;

      try {
        const data = await api.getAdminDashboard({ period: analyticsPeriod, date: analyticsDate });
        if (!mounted) return;

        const [scheduleResult, pendingRequestResult, borrowingResult] = await Promise.allSettled([
          api.getSchedules(),
          api.getScheduleRequests({ status: 'pending' }),
          api.getBorrowingRecords(),
        ]);
        if (!mounted) return;

        setStats({
          totalUsers: Number(data.totalUsers) || 0,
          totalEquipments: Number(data.totalEquipments) || 0,
          borrowedItems: Number(data.borrowedItems) || 0,
          pendingReqs: pendingRequestResult.status === 'fulfilled'
            ? getPendingRequestCount(pendingRequestResult.value)
            : Number(data.pendingRequirements) || 0,
        });

        const dashboardAnalytics = data.analytics;
        const requiredAnalyticsFields = [
          'studentAthletesByDepartment',
          'borrowingsByDepartment',
          'equipmentBorrowingFrequency',
          'borrowerTypeActivity',
          'studentAthleteRegistrationTrend',
          'borrowingTrend',
          'equipmentBorrowingTrend',
        ];
        const missingAnalyticsFields = requiredAnalyticsFields.filter(
          (field) => !Array.isArray(dashboardAnalytics?.[field])
        );
        if (
          missingAnalyticsFields.length > 0
          || !Number.isFinite(Number(dashboardAnalytics?.totalBorrowingTransactions))
          || !dashboardAnalytics?.period?.startDate
          || !dashboardAnalytics?.period?.endDate
        ) {
          const contractError = missingAnalyticsFields.length > 0
            ? `The dashboard analytics API response is missing: ${missingAnalyticsFields.join(', ')}.`
            : 'The dashboard analytics API returned an incomplete reporting period or transaction count.';
          console.error('Admin dashboard analytics response contract error:', contractError);
          setAnalyticsError(contractError);
          setAnalyticsLoadState('error');
        } else {
          setAnalytics(dashboardAnalytics);
          setAnalyticsError('');
          setAnalyticsLoadState('ready');
        }

        setActivities(Array.isArray(data.activities) ? data.activities : []);
        setSchedules(scheduleResult.status === 'fulfilled'
          ? getUpcomingSchedules(scheduleResult.value)
          : []);

        if (borrowingResult.status === 'fulfilled') {
          const borrowingRecords = Array.isArray(borrowingResult.value)
            ? borrowingResult.value
            : (Array.isArray(borrowingResult.value?.data) ? borrowingResult.value.data : []);
          setDueBorrowings(getDueBorrowings(borrowingRecords));
          setBorrowingLoadState('ready');
        } else {
          console.error('Admin dashboard borrowing fetch error:', borrowingResult.reason);
          setDueBorrowings([]);
          setBorrowingLoadState(getBorrowingErrorState(borrowingResult.reason));
        }
      } catch (error) {
        if (!mounted) return;
        console.warn('Admin dashboard fetch error:', error);
        setActivities([]);
        setSchedules([]);
        setDueBorrowings([]);
        setBorrowingLoadState(getBorrowingErrorState(error));
        setAnalyticsError(getAnalyticsRequestError(error));
        setAnalyticsLoadState('error');
      } finally {
        fetching = false;
      }
    };

    fetchDashboardData();

    const handleRefresh = () => {
      fetchDashboardData();
    };

    const handleStorageRefresh = (event) => {
      if (event.key === 'gymstat-schedule-updated') {
        fetchDashboardData();
      }
    };

    const intervalId = window.setInterval(fetchDashboardData, 30000);
    window.addEventListener('gymstat-schedule-updated', handleRefresh);
    window.addEventListener('storage', handleStorageRefresh);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener('gymstat-schedule-updated', handleRefresh);
      window.removeEventListener('storage', handleStorageRefresh);
    };
  }, [analyticsDate, analyticsPeriod, dashboardRefreshKey]);

  const topBorrowerType = getAnalyticsTopItem(analytics.borrowerTypeActivity, 'count');
  const topBorrowedEquipment = getAnalyticsTopItem(analytics.equipmentBorrowingFrequency, 'count');

  return (
    <div className="db-root">

      {/* ── Welcome Banner ── */}
      <div className="db-banner">
        <div className="db-banner__circles">
          <div className="db-banner__circle db-banner__circle--1" />
          <div className="db-banner__circle db-banner__circle--2" />
        </div>
        <div className="db-banner__text">
          <h1 className="db-banner__title">Welcome<br />Back, Admin!</h1>
          <p className="db-banner__sub">Monitoring the excellence of MarSU Athletes.</p>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="db-stats">
        {[
          { label: "TOTAL USER",       value: stats.totalUsers,      icon: <Icon name="users" size={38} />,    path: "/admin/user-records" },
          { label: "TOTAL EQUIPMENTS",  value: stats.totalEquipments, icon: <Icon name="wrench" size={38} />,    path: "/admin/equipments" },
          { label: "BORROWED ITEMS",   value: stats.borrowedItems,   icon: <Icon name="clipboardCheck" size={38} />,   path: "/admin/borrowing" },
          { label: "PENDING REQS",     value: stats.pendingReqs,     icon: <Icon name="fileText" size={38} />,     path: "/admin/schedules" },
        ].map((s) => {
          const handleCardKeyDown = (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              navigate(s.path);
            }
          };

          return (
            <div
              key={s.label}
              className="db-stat-card"
              onClick={() => navigate(s.path)}
              onKeyDown={handleCardKeyDown}
              role="button"
              tabIndex={0}
              aria-label={`${s.label}: view ${s.path}`}
            >
              <div className="db-stat-card__left">
                <span className="db-stat-card__label">{s.label}</span>
                <span className="db-stat-card__value">{s.value}</span>
              </div>
              <div className="db-stat-card__icon">{s.icon}</div>
            </div>
          );
        })}
      </div>

      <section className="db-analytics" aria-labelledby="db-analytics-title">
        <div className="db-analytics__trends">
          <div className="db-analytics__trends-header">
            <h2 id="db-analytics-title" className="db-analytics__trends-label">
              Participation &amp; Equipment Analytics
            </h2>
            <button
              className="db-analytics__toggle"
              type="button"
              aria-expanded={analyticsExpanded}
              aria-controls="db-analytics-content"
              aria-label={`${analyticsExpanded ? 'Collapse' : 'Expand'} Participation & Equipment Analytics`}
              onClick={() => setAnalyticsExpanded((expanded) => !expanded)}
            >
              <svg
                className="db-analytics__toggle-icon"
                viewBox="0 0 20 20"
                width="18"
                height="18"
                aria-hidden="true"
                focusable="false"
              >
                <path d="m5 7.5 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <div
            id="db-analytics-content"
            className={`db-analytics__collapse${analyticsExpanded ? ' db-analytics__collapse--expanded' : ''}`}
            aria-hidden={!analyticsExpanded}
            inert={!analyticsExpanded}
          >
            <div className="db-analytics__collapse-inner">
              <div className="db-analytics__heading">
                <p className="db-analytics__description">
                  Historical registrations and borrowing activity · Asia/Manila
                </p>
                <div className="db-analytics__filters">
                  <label className="db-analytics__filter">
                    <span>Group by</span>
                    <select
                      value={analyticsPeriod}
                      onChange={(event) => {
                        const period = event.target.value;
                        setAnalyticsPeriod(period);
                        setAnalyticsDate(getCurrentAnalyticsDate(period));
                        setAnalyticsError('');
                        setAnalyticsLoadState('loading');
                      }}
                    >
                      <option value="daily">Day</option>
                      <option value="weekly">Week</option>
                      <option value="monthly">Month</option>
                      <option value="yearly">Year</option>
                    </select>
                  </label>
                  <label className="db-analytics__filter">
                    <span>{getAnalyticsDateInputLabel(analyticsPeriod)}</span>
                    <input
                      aria-label={`Select reporting ${getAnalyticsDateInputLabel(analyticsPeriod).toLowerCase()}`}
                      type={getAnalyticsDateInputType(analyticsPeriod)}
                      min={analyticsPeriod === 'yearly' ? '1000' : undefined}
                      max={analyticsPeriod === 'yearly' ? '9999' : undefined}
                      value={analyticsDate}
                      onChange={(event) => {
                        setAnalyticsDate(event.target.value || getCurrentAnalyticsDate(analyticsPeriod));
                        setAnalyticsError('');
                        setAnalyticsLoadState('loading');
                      }}
                    />
                  </label>
                  <span className="db-analytics__range" aria-live="polite">
                    {analytics.period ? formatAnalyticsPeriod(analytics.period) : 'Loading reporting period'}
                  </span>
                  <span className="db-analytics__refresh">Updates every 30 seconds</span>
                </div>
              </div>
              {analyticsLoadState === 'loading' && (
                <p className="db-analytics__message db-analytics__message--loading" role="status">
                  Loading dashboard analytics...
                </p>
              )}
              {analyticsLoadState === 'error' && (
                <div className="db-analytics__message db-analytics__message--error" role="alert">
                  <span>{analyticsError || 'Analytics could not be loaded. Please try again.'}</span>
                  <button
                    className="db-analytics__retry"
                    onClick={() => {
                      setAnalyticsError('');
                      setAnalyticsLoadState('loading');
                      setDashboardRefreshKey((current) => current + 1);
                    }}
                    type="button"
                  >
                    Retry
                  </button>
                </div>
              )}
              {analyticsLoadState === 'ready' && (
                <>
                  <div className="db-analytics-summary">
                    <AnalyticsSummaryCard
                      label="Total Players"
                      value={Number(analytics.totalRegisteredStudentAthletes || 0).toLocaleString()}
                      detail={`${Number(analytics.studentAthletesRegisteredInPeriod || 0).toLocaleString()} in period · ${formatPeriodComparison(
                        analytics.studentAthletesRegisteredInPeriod,
                        analytics.previousStudentAthletesRegistered
                      )}`}
                    />
                    <AnalyticsSummaryCard
                      label="Top Department"
                      value={getAnalyticsLeader(analytics.studentAthletesByDepartment, 'department')}
                      detail={`${getAnalyticsLeaderCount(analytics.studentAthletesByDepartment, 'department').toLocaleString()} players`}
                      highlight
                    />
                    <AnalyticsSummaryCard
                      label="Top Borrower"
                      value={topBorrowerType?.borrowerType || '—'}
                      detail={topBorrowerType
                        ? `${Number(topBorrowerType.borrowers || 0).toLocaleString()} borrowers · ${Number(topBorrowerType.count || 0).toLocaleString()} transactions`
                        : 'No activity in period'}
                      highlight
                    />
                    <AnalyticsSummaryCard
                      label="Most Borrowed"
                      value={topBorrowedEquipment?.equipment || '—'}
                      detail={topBorrowedEquipment
                        ? `${Number(topBorrowedEquipment.count || 0).toLocaleString()} units · ${Number(topBorrowedEquipment.transactions || 0).toLocaleString()} loans`
                        : 'No borrowing in period'}
                      highlight
                    />
                    <AnalyticsSummaryCard
                      label="Total Transactions"
                      value={Number(analytics.totalBorrowingTransactions || 0).toLocaleString()}
                      detail={`Previous: ${formatPeriodComparison(
                        analytics.totalBorrowingTransactions,
                        analytics.previousBorrowingTransactions
                      )}`}
                    />
                  </div>
                  <div className="db-analytics__grid">
                    <AnalyticsChart
                      title="Student-Athlete Registrations by Department"
                      description="Registrations in the selected reporting period."
                      items={analytics.studentAthletesByDepartment}
                      labelKey="department"
                      emptyMessage="No dated student-athlete registrations were found for this period."
                    />
                    <AnalyticsChart
                      title="Borrower Type Activity"
                      description="Unique borrowers and transactions by saved GYMSTAT borrower type."
                      items={analytics.borrowerTypeActivity}
                      labelKey="borrowerType"
                      detailKey="borrowers"
                      detailLabel="unique borrowers"
                      emptyMessage="No classified borrower-type activity was found for this period."
                    />
                    <AnalyticsChart
                      title="Most Borrowed Equipment"
                      description="Historical units borrowed; returned transactions remain included."
                      items={analytics.equipmentBorrowingFrequency}
                      labelKey="equipment"
                      emptyMessage="No equipment borrowing records were found for this period."
                      horizontal
                    />
                  </div>
                  <div className="db-analytics__trend-grid">
                    <AnalyticsTrendChart
                      title="Student-Athlete Registrations"
                      data={analytics.studentAthleteRegistrationTrend}
                      period={analytics.period}
                      valueLabel="registrations"
                    />
                    <AnalyticsTrendChart
                      title="Borrowing Transactions"
                      data={analytics.borrowingTrend}
                      period={analytics.period}
                      valueLabel="transactions"
                    />
                    <AnalyticsTrendChart
                      title="Equipment Borrowed"
                      data={analytics.equipmentBorrowingTrend}
                      period={analytics.period}
                      valueLabel="units"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Bottom Panels ── */}
      <div className="db-panels">

        {/* Latest Activities */}
        <div className="db-panel">
          <h3 className="db-panel__title">User Registrations</h3>
          <div className="db-activity-list">
            {activities.map((a) => (
              <div key={a.id} className="db-activity-item">
                <span className="db-activity-dot" />
                <span className="db-activity-text">{a.action}</span>
                <span className="db-activity-time">{a.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Due Borrowed Items */}
        <div className="db-panel">
          <h3 className="db-panel__title">Due Borrowed Items</h3>
          <div className="db-due-list" aria-live="polite">
            {borrowingLoadState === 'loading' && <p className="db-schedule-date">Loading borrowed items...</p>}
            {borrowingLoadState === 'session-error' && <p className="db-schedule-date">Admin session expired. Please sign in again.</p>}
            {borrowingLoadState === 'authorization-error' && <p className="db-schedule-date">You are not authorized to view borrowing records.</p>}
            {borrowingLoadState === 'route-error' && <p className="db-schedule-date">Borrowing records endpoint is unavailable.</p>}
            {borrowingLoadState === 'server-error' && <p className="db-schedule-date">Borrowing records could not be loaded from the server.</p>}
            {borrowingLoadState === 'error' && <p className="db-schedule-date">Unable to load due borrowed items. Check your connection and retry.</p>}
            {borrowingLoadState === 'ready' && dueBorrowings.length === 0 && (
              <p className="db-schedule-date">No due borrowed items</p>
            )}
            {borrowingLoadState === 'ready' && dueBorrowings.map((record) => (
              <div className="db-due-item" key={record._id || record.id}>
                <div className="db-due-item__info">
                  <span className="db-schedule-title">{record.fullname || record.Name || 'Unknown borrower'}</span>
                  <span className="db-schedule-date">{record.equipment || 'Unknown item'}</span>
                  {record.referenceIds?.length > 0 && (
                    <span className="db-due-reference">Ref: {record.referenceIds.join(', ')}</span>
                  )}
                  <span className="db-schedule-date">Due: {record.dueDate}</span>
                </div>
                <div className="db-due-item__status">
                  <span className="db-schedule-time">{record.endTime}</span>
                  <span className="db-due-status">{record.status}</span>
                </div>
              </div>
            ))}
          </div>
          <button className="db-view-all" onClick={() => navigate('/admin/borrowing#records')}>
            View Borrowing Records
          </button>
        </div>

        {/* Upcoming Schedules */}
        <div className="db-panel">
          <h3 className="db-panel__title">Upcoming Schedules</h3>
          <div className="db-schedule-list">
            {schedules.length === 0 && <p className="db-schedule-date">No upcoming approved schedules.</p>}
            {schedules.map((s) => {
              const scheduleTitle = s.event || s.title || 'Untitled Schedule';
              const scheduleDate = s.startDate
                ? (s.startDate === s.endDate ? s.startDate : `${s.startDate} - ${s.endDate}`)
                : (s.date || '');
              const scheduleTime = s.startTime && s.endTime
                ? `${s.startTime} - ${s.endTime}`
                : (s.time || '');
              const scheduleStatus = s.status ? s.status : '';

              return (
                <div key={s._id || s.id} className="db-schedule-item">
                  <div className="db-schedule-info">
                    <span className="db-schedule-title">{scheduleTitle}</span>
                    <span className="db-schedule-date">{scheduleDate}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span className="db-schedule-time">{scheduleTime}</span>
                    {scheduleStatus && <span className="db-schedule-status" style={{ fontSize: '0.8rem', color: '#666' }}>{scheduleStatus}</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <button className="db-view-all" onClick={() => navigate("/admin/schedules")}>
            View All Schedules
          </button>
        </div>

      </div>
    </div>
  );
};

const ANALYTICS_COLORS = ['#7b1e1e', '#d2a500', '#a94b4b', '#e3bd46', '#542020', '#c87955', '#8b7b62', '#d88989'];

const getAnalyticsTotal = (items) => items.reduce((total, item) => total + (Number(item.count) || 0), 0);

const isDepartmentUnavailable = (department) => (
  ['department unavailable', 'department not provided'].includes(String(department || '').trim().toLowerCase())
);

const getAnalyticsLeader = (items, labelKey) => {
  const eligibleItems = labelKey === 'department'
    ? items.filter((item) => !isDepartmentUnavailable(item.department))
    : items;
  const topCount = eligibleItems.reduce((highest, item) => Math.max(highest, Number(item.count) || 0), 0);
  if (!topCount) return '—';
  return eligibleItems
    .filter((item) => Number(item.count) === topCount)
    .map((item) => String(item[labelKey] || 'Not specified'))
    .join(', ');
};

const getAnalyticsLeaderCount = (items, labelKey) => {
  const eligibleItems = labelKey === 'department'
    ? items.filter((item) => !isDepartmentUnavailable(item.department))
    : items;
  return eligibleItems.reduce(
  (highest, item) => Math.max(highest, Number(item.count) || 0),
  0
  );
};

const AnalyticsSummaryCard = ({ label, value, detail, highlight = false }) => (
  <article className={`db-analytics-summary__card${highlight ? ' db-analytics-summary__card--highlight' : ''}`}>
    <span className="db-analytics-summary__label">{label}</span>
    <strong className="db-analytics-summary__value" title={String(value)}>{value}</strong>
    <span className="db-analytics-summary__detail">{detail}</span>
  </article>
);

const AnalyticsChart = ({
  title,
  description,
  items,
  labelKey,
  detailKey,
  detailLabel,
  emptyMessage,
  horizontal = false,
}) => {
  const leaderItems = labelKey === 'department'
    ? items.filter((item) => !isDepartmentUnavailable(item.department))
    : items;
  const topCount = leaderItems.reduce((highest, item) => Math.max(highest, Number(item.count) || 0), 0);
  const total = getAnalyticsTotal(items);
  const chartItems = items.map((item, index) => {
    const count = Number(item.count) || 0;
    return {
      label: String(item[labelKey] || 'Not specified'),
      count,
      detailCount: detailKey ? Number(item[detailKey]) || 0 : null,
      percent: total > 0 ? (count / total) * 100 : 0,
      color: !isDepartmentUnavailable(item.department)
        && count === topCount
        && topCount > 0
        ? '#d2a500'
        : ANALYTICS_COLORS[index % ANALYTICS_COLORS.length],
      isTop: !isDepartmentUnavailable(item.department) && count === topCount && topCount > 0,
    };
  });

  return (
    <article className="db-analytics-card">
      <h3 className="db-analytics-card__title">{title}</h3>
      <p className="db-analytics-card__description">{description}</p>
      {total === 0 ? (
        <p className="db-analytics-card__empty">{emptyMessage}</p>
      ) : (
        <div className="db-analytics-chart">
          <div className={`db-analytics-bars${horizontal ? ' db-analytics-bars--ranked' : ''}`}>
            {chartItems.map((item, index) => (
              <div
                className={`db-analytics-bar${item.isTop ? ' db-analytics-bar--top' : ''}`}
                key={`${item.label}-${index}`}
                title={`${item.label}: ${item.count.toLocaleString()} (${item.percent.toFixed(1)}%)${detailKey ? `, ${item.detailCount.toLocaleString()} ${detailLabel}` : ''}`}
              >
                <div className="db-analytics-bar__meta">
                  <span className="db-analytics-bar__label" title={item.label}>{item.label}</span>
                  <span className="db-analytics-bar__value">{item.count.toLocaleString()}</span>
                </div>
                <div className="db-analytics-bar__track" aria-hidden="true">
                  <span
                    className="db-analytics-bar__fill"
                    style={{
                      width: `${topCount > 0 ? (item.count / topCount) * 100 : 0}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
                {detailKey && (
                  <span className="db-analytics-bar__detail">
                    {item.detailCount.toLocaleString()} {detailLabel}
                  </span>
                )}
                {item.isTop && <span className="db-analytics-bar__badge">Highest</span>}
              </div>
            ))}
          </div>
          <div className="db-analytics-pie">
            <svg
              className="db-analytics-pie__svg"
              viewBox="0 0 120 120"
              role="img"
              aria-label={`${title} pie chart. Total ${total.toLocaleString()}.`}
            >
              <circle className="db-analytics-pie__track" cx="60" cy="60" r="44" />
              {chartItems.reduce((segments, item) => {
                if (item.percent <= 0) return segments;
                const offset = segments.reduce((sum, segment) => sum + segment.percent, 0);
                segments.push(
                  <circle
                    className="db-analytics-pie__segment"
                    key={item.label}
                    cx="60"
                    cy="60"
                    r="44"
                    pathLength="100"
                    stroke={item.color}
                    strokeDasharray={`${item.percent} ${100 - item.percent}`}
                    strokeDashoffset={-offset}
                    transform="rotate(-90 60 60)"
                  >
                    <title>{`${item.label}: ${item.count.toLocaleString()} (${item.percent.toFixed(1)}%)${detailKey ? `, ${item.detailCount.toLocaleString()} ${detailLabel}` : ''}`}</title>
                  </circle>
                );
                return segments;
              }, [])}
              <text className="db-analytics-pie__total" x="60" y="58" textAnchor="middle">{total.toLocaleString()}</text>
              <text className="db-analytics-pie__caption" x="60" y="72" textAnchor="middle">TOTAL</text>
            </svg>
            <ul className="db-analytics-pie__legend">
              {chartItems.map((item, index) => (
                <li key={`${item.label}-${index}`} title={`${item.label}: ${item.count.toLocaleString()} (${item.percent.toFixed(1)}%)`}>
                  <span className="db-analytics-pie__swatch" style={{ backgroundColor: item.color }} />
                  <span className="db-analytics-pie__legend-label">{item.label}</span>
                  <strong>
                    {item.percent.toFixed(1)}%
                    {detailKey && ` · ${item.detailCount.toLocaleString()} ${detailLabel}`}
                  </strong>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </article>
  );
};

const getTrendPoints = (trend, period) => {
  if (!period?.startDate || !period?.endDate) return [];
  const counts = new Map((Array.isArray(trend) ? trend : []).map((item) => [
    String(item.period),
    Number(item.count) || 0,
  ]));

  if (period.type === 'daily') {
    return Array.from({ length: 24 }, (_, hour) => {
      const key = String(hour).padStart(2, '0');
      return { key, label: key, count: counts.get(key) || 0 };
    });
  }
  if (period.type === 'yearly') {
    const [year] = period.startDate.split('-');
    return Array.from({ length: 12 }, (_, index) => {
      const key = `${year}-${String(index + 1).padStart(2, '0')}`;
      const label = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' })
        .format(new Date(`${key}-01T00:00:00Z`));
      return { key, label, count: counts.get(key) || 0 };
    });
  }

  const points = [];
  const cursor = new Date(`${period.startDate}T00:00:00Z`);
  const end = new Date(`${period.endDate}T00:00:00Z`);
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    points.push({
      key,
      label: period.type === 'weekly'
        ? new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(cursor)
        : key.slice(-2),
      count: counts.get(key) || 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return points;
};

const AnalyticsTrendChart = ({ title, data, period, valueLabel }) => {
  const points = getTrendPoints(data, period);
  const total = points.reduce((sum, point) => sum + point.count, 0);
  const max = points.reduce((highest, point) => Math.max(highest, point.count), 0);

  return (
    <article className="db-analytics-trend">
      <h3 className="db-analytics-card__title">{title}</h3>
      <p className="db-analytics-trend__range">
        {period ? formatAnalyticsPeriod(period) : 'Reporting period unavailable'}
      </p>
      {total === 0 ? (
        <p className="db-analytics-card__empty">No records with timestamps in this period.</p>
      ) : (
        <div className="db-analytics-trend__chart" role="img" aria-label={`${title}: ${total} ${valueLabel}`}>
          {points.map((point) => (
            <div
              className="db-analytics-trend__point"
              key={point.key}
              title={`${point.key}: ${point.count.toLocaleString()} ${valueLabel}`}
              aria-label={`${point.key}: ${point.count.toLocaleString()} ${valueLabel}`}
            >
              <span
                className="db-analytics-trend__bar"
                style={{ height: point.count > 0 ? `${Math.max(4, (point.count / max) * 100)}%` : '2px' }}
              />
              <span className="db-analytics-trend__label">{point.label}</span>
            </div>
          ))}
        </div>
      )}
      <p className="db-analytics-trend__total">
        {total.toLocaleString()} {valueLabel} in period
      </p>
    </article>
  );
};

const getPendingRequestCount = (response) => {
  const requests = Array.isArray(response?.data) ? response.data : [];
  return requests.filter((request) => String(request.status || '').toLowerCase() === 'pending').length;
};

const getBorrowingErrorState = (error) => {
  if (error?.status === 401 || error?.code === 'SESSION_EXPIRED') return 'session-error';
  if (error?.status === 403) return 'authorization-error';
  if (error?.status === 404) return 'route-error';
  if (error?.status >= 500) return 'server-error';
  return 'error';
};

const getAnalyticsRequestError = (error) => {
  if (error?.status === 401 || error?.code === 'SESSION_EXPIRED') {
    return 'Your admin session has expired. Sign in again to load analytics.';
  }
  if (error?.status === 403) {
    return 'Your account is not authorized to view Admin Dashboard analytics.';
  }
  if (error?.status === 404) {
    return 'The analytics endpoint was not found. Confirm the backend deployment and API base URL.';
  }
  if (error?.status === 400) {
    return error.message || 'The selected reporting period was rejected by the server.';
  }
  if (error?.status >= 500) {
    return `The analytics API returned HTTP ${error.status}. Check the backend error log, then retry.`;
  }
  if (error?.code === 'REQUEST_TIMEOUT' || error?.name === 'AbortError') {
    return 'The analytics request timed out. Check the backend and try again.';
  }
  return 'Could not reach the analytics API. Check the network connection and API URL, then retry.';
};

const parseScheduleDateTime = (dateValue, timeValue, endOfDay = false) => {
  if (!dateValue) return null;
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;

  if (!timeValue) {
    date.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, 999);
    return date;
  }

  const timeMatch = String(timeValue).trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!timeMatch) return date;

  let hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  const meridiem = timeMatch[3]?.toUpperCase();
  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  date.setHours(hours, minutes, 0, 0);
  return date;
};

const getUpcomingSchedules = (response) => {
  const schedules = Array.isArray(response?.data) ? response.data : [];
  const now = new Date();

  return schedules
    .filter((schedule) => String(schedule.status || '').toLowerCase() === 'active')
    .filter((schedule) => {
      const endDate = schedule.endDate || schedule.startDate;
      const end = parseScheduleDateTime(endDate, schedule.endTime, true);
      return end && end >= now;
    })
    .sort((first, second) => {
      const firstStart = parseScheduleDateTime(first.startDate, first.startTime) || new Date(0);
      const secondStart = parseScheduleDateTime(second.startDate, second.startTime) || new Date(0);
      return firstStart - secondStart;
    })
    .slice(0, 10);
};

export default AdminDashboard;
