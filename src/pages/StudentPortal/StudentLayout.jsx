import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import StudentSidebar from './StudentSidebar';
import * as api from '../../services/api';
import usePortalSession from '../../hooks/usePortalSession';
import './StudentPortal.css';

const StudentLayout = () => {
  const navigate = useNavigate();
  const { authReady, user: authenticatedUser } = usePortalSession(['student'], 'Student');

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