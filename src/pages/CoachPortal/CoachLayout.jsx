import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import * as api from '../../services/api';
import './CoachPortal.css';

const CoachLayout = () => {
  const navigate = useNavigate();
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let active = true;
    api.getCurrentUser()
      .then((user) => {
        if (String(user?.role || '').toLowerCase() !== 'coach') {
          navigate('/login', { replace: true });
          return;
        }
        if (active) setAuthReady(true);
      })
      .catch((error) => console.warn('[AUTH] Coach auth check failed', { status: error.status }));

    return () => { active = false; };
  }, [navigate]);

  if (!authReady) return null;

  return (
    <div className="portal-container coach-portal-shell">
      <main className="main-content coach-main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default CoachLayout;
