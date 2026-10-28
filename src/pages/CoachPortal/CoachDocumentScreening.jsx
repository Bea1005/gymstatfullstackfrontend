import { useNavigate } from 'react-router-dom';
import usePortalSession, { PortalSessionError } from '../../hooks/usePortalSession';
import { RequirementScreeningInterface } from '../ScreenerPortal/ScreenerPage';

const normalizeSportValue = (value) => String(value ?? '')
  .normalize('NFKC')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const getCoachAssignedSports = (coachUser = {}) => {
  const sports = [
    ...(Array.isArray(coachUser.assignedSports) ? coachUser.assignedSports : []),
    ...(Array.isArray(coachUser.sports) ? coachUser.sports : []),
    ...(Array.isArray(coachUser.sportParticipation)
      ? coachUser.sportParticipation.map((entry) => entry?.sport || entry?.name || entry?.label)
      : []),
    coachUser.sport,
  ];
  const seenSports = new Set();

  return sports.reduce((uniqueSports, sport) => {
    const displaySport = String(sport ?? '').replace(/\s+/g, ' ').trim();
    const normalizedSport = normalizeSportValue(displaySport);
    if (normalizedSport && !seenSports.has(normalizedSport)) {
      seenSports.add(normalizedSport);
      uniqueSports.push(displaySport);
    }
    return uniqueSports;
  }, []);
};

const CoachDocumentScreening = () => {
  const { authReady, authError, user } = usePortalSession(['coach'], 'Coach');
  const navigate = useNavigate();

  if (!authReady) return authError ? <PortalSessionError /> : null;

  const assignedSports = getCoachAssignedSports(user);
  const coachName = String(user?.fullname || user?.name || '').trim();

  return (
    <div className="coach-screening-page">
      <header className="coach-screening-header">
        <div>
          <button
            type="button"
            onClick={() => navigate('/coach/home')}
            style={{
              margin: '0 0 16px',
              padding: '9px 14px',
              border: '1px solid rgba(116, 77, 28, 0.3)',
              borderRadius: '999px',
              background: '#f5e7b9',
              color: '#4a0a16',
              font: 'inherit',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Back to Student Gallery
          </button>
          <p className="coach-section-label">Coach Portal</p>
          <h1>Document Screening</h1>
        </div>
        <div className="coach-screening-header-meta">
          <span className="coach-view-chip">
            {assignedSports.length} assigned sport{assignedSports.length === 1 ? '' : 's'}
          </span>
        </div>
      </header>

      <section className="coach-screening-shell">
        <div className="coach-screening-sports">
          <div className="coach-screening-info-group">
            <span className="coach-info-label">Coach</span>
            <strong>{coachName || 'Coach information unavailable'}</strong>
          </div>
          <div className="coach-screening-info-group">
            <span className="coach-info-label">Assigned sports</span>
            {assignedSports.length ? (
              assignedSports.map((sport) => (
                <span key={normalizeSportValue(sport)} className="coach-sport-pill">
                  {sport}
                </span>
              ))
            ) : (
              <span className="coach-sport-pill coach-sport-pill-empty">Sports information unavailable</span>
            )}
          </div>
        </div>
      </section>

      <div className="coach-screening-workspace">
        <RequirementScreeningInterface />
      </div>
    </div>
  );
};

export default CoachDocumentScreening;
