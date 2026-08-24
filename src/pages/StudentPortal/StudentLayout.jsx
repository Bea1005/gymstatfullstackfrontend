import React, { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import StudentSidebar from './StudentSidebar';
import './StudentPortal.css';

const StudentLayout = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    const role = sessionStorage.getItem('role') || localStorage.getItem('role');

    if (!token || role !== 'student') {
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      localStorage.removeItem('user');
      try { sessionStorage.removeItem('token'); sessionStorage.removeItem('role'); sessionStorage.removeItem('user'); } catch(e) {}
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('user');
    try { sessionStorage.removeItem('token'); sessionStorage.removeItem('role'); sessionStorage.removeItem('user'); } catch(e) {}
    navigate('/login');
  };

  return (
    <div className="portal-container">
      <StudentSidebar onLogout={handleLogout} />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default StudentLayout;