import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
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

const isValidDomain = (email) => {
  const allowedDomain = "@pilani.bits-pilani.ac.in";
  return email && email.toLowerCase().endsWith(allowedDomain);
};

const Authentication = () => {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();
  const googleButtonRef = useRef(null);

  useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from?.pathname || "/jobs";
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location.state?.from?.pathname]);

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    setMessage("");

    try {
      const decoded = jwtDecode(credentialResponse.credential);
      const { email, name, sub: googleId, picture } = decoded;

      if (!isValidDomain(email)) {
        setMessage("Access restricted to BITS Pilani students only. Please use your @pilani.bits-pilani.ac.in email.");
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_URL}/google-auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          googleId,
          picture,
          credential: credentialResponse.credential
        })
      });

      const data = await response.json();

      if (data.success) {
        const newUserId = data.student?.id || data.student?.email?.toLowerCase() || email.toLowerCase();
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

        const from = location.state?.from?.pathname || "/jobs";
        navigate(from, { replace: true });
      } else {
        setMessage(data.message || "Google authentication failed.");
      }
    } catch (error) {
      console.error("Google auth error:", error);
      setMessage("Google authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setMessage("Google authentication failed. Please try again.");
  };

  const handleCustomButtonClick = () => {
    // Trigger the hidden Google button
    if (googleButtonRef.current) {
      const googleButton = googleButtonRef.current.querySelector('div[role="button"]');
      if (googleButton) {
        googleButton.click();
      }
    }
  };

  return (
    <div className="auth-page">
      <main className="auth-main">
        <div className="auth-container">
          <div className="auth-card">
            <h2 className="auth-title">Student Login</h2>
            
            <div className="auth-subtitle">
              Log in using your BITS Pilani Email Account
              <br />
              <span className="example-text">
                Example: xyz@pilani.bits-pilani.ac.in
              </span>
            </div>

            {/* Custom BITS Login Button */}
            <div className="custom-google-signin">
              <button 
                className="bits-login-button"
                onClick={handleCustomButtonClick}
                disabled={loading}
              >
                <img 
                  src="/bits-logo.png" 
                  alt="BITS Pilani"
                  className="bits-button-logo"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'inline-block';
                  }}
                />
                <span className="bits-logo-fallback" style={{ display: 'none' }}>🎓</span>
                <span className="button-text">
                  {loading ? "Logging in..." : "Login with BITS ID"}
                </span>
              </button>
            </div>

            {/* Hidden Google Login Component */}
            <div ref={googleButtonRef} style={{ display: 'none', opacity: 0, position: 'absolute', pointerEvents: 'none' }}>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                useOneTap={false}
                theme="outline"
                size="large"
              />
            </div>

            {message && (
              <div className={`auth-message ${message.includes("success") ? "success" : "error"}`}>
                {message}
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="bits-footer">
        <div className="footer-content">
          <div className="footer-left">
            <p>© 2025 MatchMySkill - Department of Management, BITS Pilani. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Authentication;
