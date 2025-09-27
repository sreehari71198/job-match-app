import React, { useState, useEffect } from "react";
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

// Domain validation function
const isValidDomain = (email) => {
  const allowedDomain = "@pilani.bits-pilani.ac.in";
  return email && email.toLowerCase().endsWith(allowedDomain);
};

const Authentication = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: ""
  });
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

        const from = location.state?.from?.pathname || "/SkillMatch";
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    if (formData.email && !isValidDomain(formData.email)) {
      setMessage("Please use your BITS Pilani email address (@pilani.bits-pilani.ac.in)");
      setLoading(false);
      return;
    }

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
    <div className="auth-container">
      <div className="auth-card">
        <h2 className="auth-title">Student Login</h2>
        <p className="auth-subtitle">
          Log in using your BITS Pilani Email Account<br />
          <span className="example-text">Example: xyz@pilani.bits-pilani.ac.in</span>
        </p>

        <div className="auth-toggle">
          <button
            className={isLogin ? "active" : ""}
            onClick={() => handleToggle(true)}
            disabled={loading}
          >
            Login
          </button>
          <button
            className={!isLogin ? "active" : ""}
            onClick={() => handleToggle(false)}
            disabled={loading}
          >
            Sign Up
          </button>
        </div>

        {/* Google Sign-In Button */}
        <div className="google-signin-container">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            useOneTap={false}
            theme="outline"
            size="large"
            text="Sign in with BITS Email ID"
            shape="rectangular"
            disabled={loading}
          />
        </div>

        <div className="divider">
          <span>OR</span>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <input
              type="text"
              name="name"
              placeholder="Full Name"
              value={formData.name}
              onChange={handleChange}
              required
              disabled={loading}
            />
          )}
          <input
            type="email"
            name="email"
            placeholder="Email (xyz@pilani.bits-pilani.ac.in)"
            value={formData.email}
            onChange={handleChange}
            required
            disabled={loading}
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            required
            disabled={loading}
          />
          
          <button type="submit" disabled={loading} className="auth-submit-btn">
            {loading ? "Please wait..." : (isLogin ? "Login" : "Sign Up")}
          </button>
        </form>

        {message && (
          <div className={`auth-message ${message.includes('successful') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
};

export default Authentication;
