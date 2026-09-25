import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import StudentSidebar from './StudentSidebar';
import * as api from '../../services/api';
import './StudentPortal.css';

const StudentLayout = () => {
  const navigate = useNavigate();
  const [authReady, setAuthReady] = useState(false);
  const [authenticatedUser, setAuthenticatedUser] = useState(null);

  useEffect(() => {
    let active = true;
    api.getCurrentUser()
      .then((user) => {
        if (String(user?.role || '').toLowerCase() !== 'student') {
          navigate('/login', { replace: true });
          return;
        }
        if (active) {
          setAuthenticatedUser(user);
          setAuthReady(true);
        }
      })
      .catch((error) => console.warn('[AUTH] Student auth check failed', { status: error.status }));

    return () => { active = false; };
  }, [navigate]);

  const handleLogout = async () => {
    await api.logout();
    localStorage.removeItem('role');
    localStorage.removeItem('user');
    sessionStorage.removeItem('role');
    sessionStorage.removeItem('user');
    navigate('/login');
  };

  if (!authReady) return null;

  return (
    <div className="portal-container">
      <StudentSidebar onLogout={handleLogout} />
      <main className="main-content">
        <Outlet context={{ user: authenticatedUser }} />
      </main>
    </div>
  );
};

export default StudentLayout;