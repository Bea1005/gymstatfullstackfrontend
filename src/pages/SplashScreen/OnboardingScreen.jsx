import { useNavigate } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import './SplashScreen.css';
import gymBackground from "../../assets/gym-background.jpg";
import logoImage from "../../assets/logo.png";

const OnboardingScreen = () => {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleStart = () => {
    navigate('/login');
  };

  const scrollToSection = (sectionId) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
    setIsMenuOpen(false);
  };

  const navigateFromMenu = (path) => {
    setIsMenuOpen(false);
    navigate(path);
  };

  return (
    <div className="landing-page-wrapper">
      {/* ===== HEADER ===== */}
      <header className={`landing-header ${isScrolled ? 'scrolled' : ''}`}>
        <div className="landing-header-content">
          {/* Logo/Brand */}
          <div className="landing-logo-section">
            <img src={logoImage} alt="GYMSTAT Logo" className="landing-logo" />
            <span className="landing-brand-text">GYMSTAT</span>
          </div>

          {/* Navigation */}

          <nav id="landing-navigation" className={`landing-nav ${isMenuOpen ? 'is-open' : ''}`}>
                        <button 
              className="landing-nav-link"
              onClick={() => scrollToSection('landing-hero')}
              title="Return to the landing hero"
            >
              Home
            </button>
            <button 
              className="landing-nav-link"
              onClick={() => navigateFromMenu('/document-center')}
              title="View documents and forms"
            >
              Documents
            </button>
            <button 
              className="landing-nav-link"
              onClick={() => navigateFromMenu('/calendar')}
              title="View gymnasium calendar"
            >
              Calendar
            </button>
                        <button 
              className="landing-nav-link"
              onClick={() => scrollToSection('landing-about')}
              title="Go to About"
            >
              About
            </button>
          </nav>

          {/* CTA Button */}
          <button className="landing-header-cta2" onClick={() => navigateFromMenu('/login')}>
            Sign In
          </button>
          <button className="landing-header-cta" onClick={() => navigateFromMenu('/register')}>
            Get Started
          </button>

          <button
            type="button"
            className={`landing-menu-toggle ${isMenuOpen ? 'is-open' : ''}`}
            onClick={() => setIsMenuOpen((isOpen) => !isOpen)}
            aria-expanded={isMenuOpen}
            aria-controls="landing-navigation"
            aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>

        </div>
      </header>

      {/* ===== HERO SECTION ===== */}
      <section id="landing-hero" className="landing-hero">
        {/* Background Image */}
        <div 
          className="landing-hero-bg"
          style={{ backgroundImage: `url(${gymBackground})` }}
        />
        <div className="landing-hero-overlay"></div>

        <div className="landing-hero-content">
          {/* Logo Section */}
          <div className="landing-hero-logo">
            <img 
              src={logoImage} 
              alt="GYMSTAT Logo" 
              className="landing-hero-logo-img"
            />
          </div>

          {/* Text Content */}
          <div className="landing-hero-text">
            <p className="landing-hero-title">
              GYMSTAT: Gymnasium and Student Athlete Record Management System 
            </p>
            <p className="landing-hero-description">
              Manage schedules, track equipment, and monitor student-athlete records 
              efficiently in one place.
            </p>
          </div>

          {/* Action Button */}
          <button className="landing-hero-cta" onClick={handleStart}>
            GET STARTED
          </button>
        </div>

        {/* Decorative Elements */}
        <div className="landing-decor-circle circle-1"></div>
        <div className="landing-decor-circle circle-2"></div>
      </section>

      {/* ===== FEATURES SECTION ===== */}
      <section id="landing-about" className="landing-features">
        <div className="landing-section-container">
          <div className="landing-section-header">
            <h2>Everything You Need to Manage GYMSTAT Efficiently</h2>
          </div>

          <div className="landing-features-grid">
            {/* Feature 1 */}
            <div className="landing-feature-card" style={{ animationDelay: '0.1s' }}>
              <div className="landing-feature-icon">📅</div>
              <h3>Smart Schedule Management</h3>
              <p>View, request, approve, and manage gymnasium schedules while keeping activities organized.</p>
            </div>

            {/* Feature 2 */}
            <div className="landing-feature-card" style={{ animationDelay: '0.2s' }}>
              <div className="landing-feature-icon">🏀</div>
              <h3>Equipment Management</h3>
              <p>Monitor equipment, borrowing transactions, availability, reference IDs, and returns in one organized system.</p>
            </div>

            {/* Feature 3 */}
            <div className="landing-feature-card" style={{ animationDelay: '0.3s' }}>
              <div className="landing-feature-icon">🎓</div>
              <h3>Student-Athlete Records</h3>
              <p>Manage student-athlete records and requirements efficiently while keeping important information accessible.</p>
            </div>

            {/* Feature 4 */}
            <div className="landing-feature-card" style={{ animationDelay: '0.4s' }}>
              <div className="landing-feature-icon">📊</div>
              <h3>Centralized Management</h3>
              <p>Connect scheduling, equipment management, records, announcements, and other GYMSTAT functions in one platform.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CONTENT PREVIEW SECTION ===== */}
      <section className="landing-content-preview">
        <div className="landing-section-container">
          <div className="landing-section-header">
            <h2>Explore GYMSTAT</h2>
          </div>

          <div className="landing-preview-cards-grid">
            {/* Card 1 - Public Calendar */}
            <div className="landing-preview-card" style={{ animationDelay: '0.1s' }}>
              <div className="landing-preview-card-icon">📅</div>
              <h3>Public Calendar</h3>
              <p>View available gymnasium schedules and activities at a glance. Plan your workouts and activities efficiently.</p>
              <button 
                className="landing-preview-card-btn"
                onClick={() => navigate('/calendar')}
              >
                View Calendar →
              </button>
            </div>

            {/* Card 2 - Document Center */}
            <div className="landing-preview-card" style={{ animationDelay: '0.2s' }}>
              <div className="landing-preview-card-icon">📄</div>
              <h3>Document Center</h3>
              <p>Access important GYMSTAT forms, templates, and documents. Download what you need for your activities.</p>
              <button 
                className="landing-preview-card-btn"
                onClick={() => navigate('/document-center')}
              >
                Open Documents →
              </button>
            </div>

            {/* Card 3 - Equipment & Records */}
            <div className="landing-preview-card" style={{ animationDelay: '0.3s' }}>
              <div className="landing-preview-card-icon">⚙️</div>
              <h3>Equipment & Records</h3>
              <p>Manage equipment inventory and student-athlete records. Keep track of borrowing transactions and history.</p>
              <button 
                className="landing-preview-card-btn"
                onClick={handleStart}
              >
                Explore System →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CALL-TO-ACTION SECTION ===== */}
      <section className="landing-cta-section">
        <div className="landing-section-container">
          <div className="landing-cta-content">
            <h2>Manage GYMSTAT Smarter</h2>
            <p>Keep schedules, equipment, and student-athlete records organized in one centralized system.</p>
            <button className="landing-cta-primary-btn" onClick={handleStart}>
              Explore GYMSTAT
            </button>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="landing-footer">
        <div className="landing-footer-content">
          <div className="landing-footer-section">
            <h4>GYMSTAT</h4>
            <p>Gymnasium and Student Athlete Record Management System</p>
          </div>

          <div className="landing-footer-section">
            <h5>Site Links</h5>
            <ul>
              <li><button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Home</button></li>
              <li><button onClick={() => navigate('/calendar')}>Public Calendar</button></li>
              <li><button onClick={() => navigate('/document-center')}>Document Center</button></li>
            </ul>
          </div>

          <div className="landing-footer-section">
            <h5>System</h5>
            <ul>
              <li><span>Schedule Management</span></li>
              <li><span>Equipment Management</span></li>
              <li><span>Student-Athlete Records</span></li>
            </ul>
          </div>

          <div className="landing-footer-section">
            <h5>Connect</h5>
            <div className="landing-footer-social">
              <p>Follow us for updates and announcements</p>
            </div>
          </div>
        </div>

        <div className="landing-footer-bottom">
          <p>&copy; 2026 GYMSTAT. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default OnboardingScreen;
