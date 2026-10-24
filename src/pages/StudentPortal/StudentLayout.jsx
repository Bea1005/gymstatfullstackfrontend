import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import StudentSidebar from './StudentSidebar';
import StudentNotifications from './StudentNotifications';
import * as api from '../../services/api';
import usePortalSession, { PortalSessionError } from '../../hooks/usePortalSession';
import './StudentPortal.css';

const StudentLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { authReady, authError, user: authenticatedUser } = usePortalSession(['student'], 'Student');

  const handleLogout = async () => {
    await api.logout();
    navigate('/login');
  };

  if (!authReady) return authError ? <PortalSessionError /> : null;

  return (
    <div className="portal-container">
      <StudentSidebar onLogout={handleLogout} />
      <main className="main-content">
        {['/student/home', '/student/requirements'].includes(location.pathname) && <StudentNotifications />}
        <Outlet context={{ user: authenticatedUser }} />
      </main>
    </div>
  );
};

export default StudentLayout;