import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import './CoachPortal.css';

const CoachLayout = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    const role = sessionStorage.getItem('role') || localStorage.getItem('role');

    if (!token || role !== 'coach') {
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      localStorage.removeItem('user');
      try { sessionStorage.removeItem('token'); sessionStorage.removeItem('role'); sessionStorage.removeItem('user'); } catch(e) {}
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  return (
    <div className="portal-container coach-portal-shell">
      <main className="main-content coach-main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default CoachLayout;
