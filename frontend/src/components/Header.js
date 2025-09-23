import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Header.css';

const Header = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    // Clear localStorage
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('jm_')) {
        keys.push(key);
      }
    }
    keys.forEach(key => localStorage.removeItem(key));

    logout();
    navigate('/', { replace: true });
  };

  const isActiveLink = (path) => {
    return location.pathname === path ? 'active' : '';
  };

  return (
    <>
      <header className="common-header">
        <div className="header-container">
          {/* Left: MatchMySkill Branding */}
          <div className="app-branding">
            <div className="app-logo">
              <img 
                src="/matchmyskill-logo.png" 
                alt="MatchMySkill Logo" 
                className="app-logo-image"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'block';
                }}
              />
              <div className="app-logo-fallback" style={{display: 'none'}}>🎯</div>
            </div>
            <div className="app-info">
              <h1>MatchMySkill</h1>
              <p>AI-Powered Skill Gap Analysis & Course Recommendations</p>
            </div>
          </div>

          {/* Center: Navigation (only when authenticated) */}
          {isAuthenticated && (
            <nav className="navigation">
              <Link 
                to="/SkillMatch" 
                className={`nav-button ${isActiveLink('/SkillMatch')}`}
              >
                📊 Skill Match
              </Link>
              <Link 
                to="/ChatPrep" 
                className={`nav-button ${isActiveLink('/ChatPrep')}`}
              >
                💬 Chat Prep
              </Link>
            </nav>
          )}

          {/* Right: BITS Branding */}
          <div className="bits-section">
            <div className="bits-branding">
              <img 
                src="/bits-logo.png" 
                alt="BITS Pilani Logo" 
                className="bits-logo-image"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'block';
                }}
              />
              <div className="bits-logo-fallback" style={{display: 'none'}}>🏛️</div>
              <div className="bits-info">
                <h1>BITS Pilani</h1>
                <h2>Pilani Campus</h2>
                <h3>Department of Management</h3>
              </div>
            </div>

            {/* User Actions (only when authenticated) */}
            {isAuthenticated && (
              <div className="user-actions">
                <div className="welcome-text">
                  Welcome, {user?.name || user?.email?.split('@')[0] || 'Student'}
                </div>
                <button onClick={handleLogout} className="logout-button">
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* BITS Colored Stripe */}
        <div className="bits-stripe"></div>
      </header>
    </>
  );
};

export default Header;
