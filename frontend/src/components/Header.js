import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Header.css';

const Header = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  // Don't show header on login page
  if (location.pathname === '/') {
    return null;
  }

  return (
    <header className="site-header">
      <nav className="nav-container">
        <div className="nav-brand">
          <Link to="/SkillMatch" className="brand-link">
            Job Match
          </Link>
        </div>
        
        {isAuthenticated && (
          <>
            <div className="nav-links">
              <Link 
                to="/SkillMatch" 
                className={location.pathname === '/SkillMatch' ? 'nav-link active' : 'nav-link'}
              >
                Skill Match
              </Link>
              <Link 
                to="/ChatPrep" 
                className={location.pathname === '/ChatPrep' ? 'nav-link active' : 'nav-link'}
              >
                Chat Prep
              </Link>
            </div>
            
            <div className="nav-user">
              <span className="user-name">Welcome, {user?.name || user?.email}!</span>
              <button onClick={handleLogout} className="logout-btn">
                Logout
              </button>
            </div>
          </>
        )}
      </nav>
    </header>
  );
};

export default Header;
