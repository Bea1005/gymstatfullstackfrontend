import { Outlet } from 'react-router-dom';
import usePortalSession, { PortalSessionError } from '../../hooks/usePortalSession';
import './CoachPortal.css';

const CoachLayout = () => {
  const { authReady, authError } = usePortalSession(['coach'], 'Coach');

  if (!authReady) return authError ? <PortalSessionError /> : null;

  return (
    <div className="portal-container coach-portal-shell">
      <main className="main-content coach-main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default CoachLayout;
