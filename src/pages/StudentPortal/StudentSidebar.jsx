import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import logoImage from "../../assets/logo.png";
import settingImage from "../../assets/setting.png"; // ✅ ADDED import for setting image
import LogoutConfirmModal from '../../components/LogoutConfirmModal';

const StudentSidebar = ({ onLogout }) => {
  const navigate = useNavigate();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { name: 'Home', path: '/student/home', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2h-5v-8H9v8H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ) },
    { name: 'Requirements', path: '/student/requirements', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ) },
    { name: 'Student Profile', path: '/student/profile', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
    ) },
    { name: 'Settings', path: '/student/settings', icon: (
      // ✅ FIXED: Use imported setting image instead of SVG
      <img src={settingImage} alt="Settings" style={{ width: '20px', height: '20px' }} />
    ) },
  ];
  
  const handleLogoutClick = () => {
    setShowLogoutModal(true);
  };

  const handleLogoutConfirm = () => {
    setShowLogoutModal(false);
    if (onLogout) onLogout();
  };

  const handleLogoutCancel = () => {
    setShowLogoutModal(false);
  };

  const closeMobileMenu = () => setMobileOpen(false);

  return (
    <>
      <button
        type="button"
        className="mobile-sidebar-toggle"
        onClick={() => setMobileOpen((prev) => !prev)}
        aria-label="Toggle navigation"
      >
        ☰
      </button>

      <div className={`mobile-sidebar-backdrop ${mobileOpen ? 'open' : ''}`} onClick={closeMobileMenu}></div>

      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        {/* Logo Section */}
        <div className="logo-container" onClick={() => navigate('/student/home')}>
          <div className="logo-circle">
            <img src={logoImage} alt="GymStat" />
          </div>
          <h3 className="sidebar-title">Student Athlete Portal</h3>
        </div>

        {/* Navigation Menu */}
        <nav className="nav-menu">
          {navItems.map((item) => ( 
            <NavLink 
              key={item.name} 
              to={item.path} 
              className={({ isActive }) => isActive ? 'nav-item active-yellow' : 'nav-item'}
              onClick={closeMobileMenu}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.name}</span>
            </NavLink>
          ))}
        </nav>

        {/* Logout Button sa Baba */}
        <button className="logout-btn" onClick={handleLogoutClick}>
          Log out <span className="logout-icon"></span>
        </button>
      </aside>
      <LogoutConfirmModal
        isOpen={showLogoutModal}
        onClose={handleLogoutCancel}
        onConfirm={handleLogoutConfirm}
      />
    </>
  );
};

export default StudentSidebar;