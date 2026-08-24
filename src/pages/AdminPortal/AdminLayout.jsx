import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import logoImage from '../../assets/logo.png';
import settingImage from '../../assets/setting.png';
import LogoutConfirmModal from '../../components/LogoutConfirmModal';
import './AdminPortal.css';

const AdminLayout = () => {
  const navigate = useNavigate();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ) },
    { name: 'User Records', path: '/admin/user-records', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ) },

    { name: 'Requirements', path: '/admin/requirements', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ) },

    { name: 'Schedules', path: '/admin/schedules', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <circle cx="12" cy="15" r="1" />
        <circle cx="16" cy="15" r="1" />
        <circle cx="8" cy="15" r="1" />
      </svg>
    ) },
    { name: 'Equipments', path: '/admin/equipments', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#f3efef">
        <g fill="none" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" d="M16.02 8.077c-2.018.194-4.163.8-5.653 2.29c-1.49 1.49-2.096 3.635-2.29 5.653m7.943-7.943a18.998 18.998 0 0 1 3.228-.016a2.895 2.895 0 0 1 2.69 2.691c.072.932.098 2.059-.015 3.228M16.02 8.077l5.903 5.903m0 0c-.194 2.018-.8 4.163-2.29 5.654c-1.49 1.49-3.635 2.095-5.653 2.29m0 0a19.003 19.003 0 0 1-3.228.015a2.895 2.895 0 0 1-2.69-2.691a18.998 18.998 0 0 1 .015-3.228m5.903 5.903L8.077 16.02"/>
        <path d="M14.995 8.252a6.47 6.47 0 0 0-.867-3.001a6.489 6.489 0 0 0-4.85-3.204a6.499 6.499 0 1 0-1.12 12.943"/>
        <path d="M9.215 2s-.138 2.356 1.357 5.19c.457.869.956 1.569 1.428 2.123M3 5.928s1.933 1.047 3.428 3.881C7.923 12.644 7.785 15 7.785 15"/>
        <path stroke-linecap="round" d="m12.5 17.5l5-5m-2 0l2 2m-5 1l2 2M14 14l2 2"/>
        </g>
        </svg>
    ) },
    { name: 'Borrowing', path: '/admin/borrowing', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C9.24 2 7 4.24 7 7c0 2.76 2.24 5 5 5s5-2.24 5-5c0-2.76-2.24-5-5-5zm0 6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm-1 3h2v1.08C15.28 12.56 17 14.58 17 17H7c0-2.42 1.72-4.44 4-4.92V11zm1 4c-1.1 0-2 .9-2 2h4c0-1.1-.9-2-2-2z" opacity="0"/>
        <path d="M16.5 13c-1.93 0-3.5 1.57-3.5 3.5S14.57 20 16.5 20s3.5-1.57 3.5-3.5S18.43 13 16.5 13zm1.5 4h-1v1h-1v-1h-1v-1h1v-1h1v1h1v1zM12 13c-2.67 0-8 1.34-8 4v2h9.54c-.35-.63-.54-1.34-.54-2.09 0-1.07.37-2.06.97-2.85C13.16 13.06 12.56 13 12 13z"/>
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z"/>
      </svg>
    ) },
    // ✅ FIXED: Settings menu item with imported setting image
    { name: 'Settings', path: '/admin/settings', icon: (
      <img src={settingImage} alt="Settings" style={{ width: '20px', height: '20px' }} />
    ) },
  ];

  useEffect(() => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    const role = sessionStorage.getItem('role') || localStorage.getItem('role');

    if (!token || role !== 'admin') {
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      localStorage.removeItem('user');
      try { sessionStorage.removeItem('token'); sessionStorage.removeItem('role'); sessionStorage.removeItem('user'); } catch(e) {}
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = () => {
    setShowLogoutModal(false);
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('user');
    try { sessionStorage.removeItem('token'); sessionStorage.removeItem('role'); sessionStorage.removeItem('user'); } catch(e) {}
    navigate('/login');
  };

  const cancelLogout = () => {
    setShowLogoutModal(false);
  };

  const closeMobileMenu = () => setMobileOpen(false);

  return (
    <div className="admin-container">
      <button
        type="button"
        className="admin-mobile-toggle"
        onClick={() => setMobileOpen((previous) => !previous)}
        aria-label="Toggle admin navigation"
        aria-expanded={mobileOpen}
      >
        ☰
      </button>
      <div
        className={`admin-mobile-backdrop${mobileOpen ? ' is-open' : ''}`}
        onClick={closeMobileMenu}
        aria-hidden="true"
      />
      {/* Sidebar */}
      <aside className={`admin-sidebar${mobileOpen ? ' mobile-open' : ''}`}>
        {/* Logo Section */}
        <div className="admin-logo" onClick={() => navigate('/admin/dashboard')}>
          <div className="logo-box">
            <img src={logoImage} alt="GymStat" style={{ width: '50px', height: '50px' }} />
          </div>
          <h3 className="sidebar-title">Admin Portal</h3>
        </div>

        {/* Navigation Menu */}
        <nav className="nav-menu">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
              onClick={closeMobileMenu}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.name}</span>
            </NavLink>
          ))}
        </nav>

        {/* Logout Button */}
        <button className="logout-btn" onClick={handleLogout}>
          Log out 
        </button>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        <div className="admin-content">
          <Outlet />
        </div>
      </main>
      <LogoutConfirmModal
        isOpen={showLogoutModal}
        onClose={cancelLogout}
        onConfirm={confirmLogout}
      />
    </div>
  );
};

export default AdminLayout;