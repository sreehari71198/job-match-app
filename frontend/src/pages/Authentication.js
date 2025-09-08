import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from '../context/AuthContext';
import "../styles/Authentication.css";

const API_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:5000";

const Authentication = () => {
  const text = "Job Match";
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from?.pathname || "/SkillMatch";
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location.state?.from?.pathname]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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
            password: formData.password,
          }),
        });

        const data = await response.json();

        if (data.success) {
          login({
            id: data.student.id,
            name: data.student.name,
            email: data.student.email,
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
          body: JSON.stringify(formData),
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
          {text.split("").map((char, index) => (
            <span key={index} className="auth-title-char" style={{animationDelay: `${index * 0.1}s`}}>
              {char === " " ? "\u00A0" : char}
            </span>
          ))}
        </h1>

        <div className="auth-toggle">
          <button
            className={isLogin ? "active" : ""}
            onClick={() => handleToggle(true)}
            type="button"
          >
            Login
          </button>
          <button
            className={!isLogin ? "active" : ""}
            onClick={() => handleToggle(false)}
            type="button"
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <input
              type="text"
              name="name"
              placeholder="Full Name"
              value={formData.name}
              onChange={handleChange}
              required={!isLogin}
              autoComplete="name"
            />
          )}
          <input
            type="email"
            name="email"
            placeholder="Email Address"
            value={formData.email}
            onChange={handleChange}
            required
            autoComplete="email"
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            required
            autoComplete={isLogin ? "current-password" : "new-password"}
          />
          <button 
            type="submit" 
            className="auth-submit" 
            disabled={loading}
          >
            {loading ? "Processing..." : (isLogin ? "Login" : "Sign Up")}
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
