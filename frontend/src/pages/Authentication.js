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
  const text = "Job Match";
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
          body: JSON.stringify({ email: formData.email, password: formData.password })
        });
        const data = await response.json();

        if (data.success) {
          const newUserId = data.student?.id || data.student?.email?.toLowerCase() || formData.email?.toLowerCase();
          const prevUserId = localStorage.getItem("jm_userId");
          
          if (prevUserId && prevUserId !== newUserId) {
            purgeAppCache();
          }
          localStorage.setItem("jm_userId", newUserId);

          login({ id: data.student.id, name: data.student.name, email: data.student.email });
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
    <div className="authentication-container">
      <div className="auth-card">
        <h1 className="auth-title">
          {text.split("").map((c, i) => (
            <span key={i} className="auth-title-char">
              {c === " " ? "\u00A0" : c}
            </span>
          ))}
        </h1>

        <div className="auth-toggle">
          <button className={isLogin ? "active" : ""} onClick={() => handleToggle(true)}>Login</button>
          <button className={!isLogin ? "active" : ""} onClick={() => handleToggle(false)}>Sign Up</button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {!isLogin && (
            <input
              name="name"
              type="text"
              placeholder="Name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          )}
          <input
            name="email"
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            required
          />
          <input
            name="password"
            type="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            required
          />
          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? (isLogin ? "Logging in..." : "Creating...") : isLogin ? "Login" : "Create Account"}
          </button>
        </form>

        {message && (
          <div className={`auth-message ${message.toLowerCase().includes("success") ? "success" : "error"}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
};

export default Authentication;