import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from '../context/AuthContext';
import "../styles/Authentication.css";

const API_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:5000";

const purgeAppCache = () => {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("jm_")) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
};

const Authentication = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ name: "", email: "", password: "" });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from?.pathname || "/SkillMatch";
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location.state?.from?.pathname]);

  const handleChange = (e) => {
    setFormData(s => ({ ...s, [e.target.name]: e.target.value }));
  };

  const handleToggle = (loginMode) => {
    setIsLogin(loginMode);
    setMessage("");
    setFormData({ name: "", email: "", password: "" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      if (isLogin) {
        const response = await fetch(`${API_URL}/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password
          })
        });

        const data = await response.json();
        if (data.success) {
          const newUserId = data.student?.id || data.student?.email?.toLowerCase() || formData.email?.toLowerCase();
          const prevUserId = localStorage.getItem("jm_userId");
          
          if (prevUserId && prevUserId !== newUserId) {
            purgeAppCache();
          }
          
          localStorage.setItem("jm_userId", newUserId);
          login({
            id: data.student.id,
            name: data.student.name,
            email: data.student.email
          });
          
          const from = location.state?.from?.pathname || "/SkillMatch";
          navigate(from, { replace: true });
        } else {
          setMessage(data.message || "Login failed.");
        }
      } else {
        const response = await fetch(`${API_URL}/signUp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData)
        });

        const data = await response.json();
        if (data.success) {
          setMessage("Account created successfully! Please login.");
          setIsLogin(true);
          setFormData({ name: "", email: "", password: "" });
        } else {
          setMessage(data.message || "Signup failed.");
        }
      }
    } catch (error) {
      console.error("Error:", error);
      setMessage("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bits-auth-page">
      {/* Main Content */}
      <main className="bits-main-content">
        <div className="login-section">
          <div className="login-card">
            <h2 className="login-title">Student Login</h2>
            
            <div className="login-instruction">
              <p>Log in using your BITS Pilani, Email Account</p>
              <small>Example: xyz@pilani.bits-pilani.ac.in</small>
            </div>

            {message && (
              <div className={`message ${message.includes('successful') ? 'success' : 'error'}`}>
                {message}
              </div>
            )}

            {/* Toggle between Login/Signup */}
            <div className="auth-toggle">
              <button 
                type="button"
                className={isLogin ? 'active' : ''} 
                onClick={() => handleToggle(true)}
              >
                Login
              </button>
              <button 
                type="button"
                className={!isLogin ? 'active' : ''} 
                onClick={() => handleToggle(false)}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={handleSubmit} className="login-form">
              {!isLogin && (
                <div className="form-group">
                  <input
                    type="text"
                    name="name"
                    placeholder="Full Name"
                    value={formData.name}
                    onChange={handleChange}
                    required={!isLogin}
                  />
                </div>
              )}
              
              <div className="form-group">
                <input
                  type="email"
                  name="email"
                  placeholder="BITS Email (xyz@pilani.bits-pilani.ac.in)"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
              
              <div className="form-group">
                <input
                  type="password"
                  name="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
              </div>
              
              <button type="submit" className="login-button" disabled={loading}>
                {loading ? 'Processing...' : (isLogin ? 'Login' : 'Sign Up')}
              </button>
            </form>

            {/* Gmail Login Button */}
            <div className="gmail-login-section">
              <button type="button" className="gmail-button" disabled>
                BITS Gmail Login - Coming Soon
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* BITS Footer */}
      <footer className="bits-footer">
        <div className="footer-content">
          <div className="footer-left">
            <p>An institution deemed to be a University estd. vide Sec.3 of the UGC Act,1956 under notification # F.12-23/63.U-2 of Jun 18,1964</p>
            <p>© 2024 AUGS-AGSR DIVISION, FD-II, BITS Pilani, Pilani Campus</p>
            <p>Release Version 1.0</p>
          </div>
          <div className="footer-right">
            <div className="footer-badges">
              <span className="badge innovate">innovate</span>
              <span className="badge achieve">achieve</span>
              <span className="badge lead">lead</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Authentication;