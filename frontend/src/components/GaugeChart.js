import React, { useEffect, useState } from 'react';
import '../styles/GaugeChart.css';

const GaugeChart = ({ percentage, size = 200, title = "Overall Match" }) => {
  const [animatedPercentage, setAnimatedPercentage] = useState(0);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedPercentage(percentage);
    }, 500);
    
    return () => clearTimeout(timer);
  }, [percentage]);

  // Half-circle calculations - increased radius
  const radius = 90; // Increased from 65 to 90
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - (animatedPercentage / 100) * circumference;

  const getColor = (percent) => {
    if (percent >= 80) return '#10b981';
    if (percent >= 60) return '#f59e0b';
    if (percent >= 40) return '#f97316';
    return '#ef4444';
  };

  const getGradient = (percent) => {
    if (percent >= 80) return 'url(#greenGradient)';
    if (percent >= 60) return 'url(#yellowGradient)';
    if (percent >= 40) return 'url(#orangeGradient)';
    return 'url(#redGradient)';
  };

  const getLabel = (percent) => {
    if (percent >= 80) return 'Excellent';
    if (percent >= 60) return 'Good';
    if (percent >= 40) return 'Fair';
    return 'Poor';
  };

  return (
    <div className="gauge-container">
      <div className="gauge-title">{title}</div>
      
      <div className="gauge-chart-half" style={{ width: size, height: size * 0.7 }}>
        <svg width={size} height={size * 0.7} viewBox="0 0 280 200">
          <defs>
            <linearGradient id="greenGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="yellowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
            <linearGradient id="orangeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#ea580c" />
            </linearGradient>
            <linearGradient id="redGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#dc2626" />
            </linearGradient>
          </defs>

          {/* Background half-circle */}
          <path
            d="M 50 160 A 90 90 0 0 1 230 160"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="14"
            className="gauge-background"
          />

          {/* Progress half-circle */}
          <path
            d="M 50 160 A 90 90 0 0 1 230 160"
            fill="none"
            stroke={getGradient(animatedPercentage)}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="gauge-progress"
            style={{
              transition: 'stroke-dashoffset 2s ease-in-out'
            }}
          />

          {/* Center content */}
          <text
            x="140"
            y="130"
            textAnchor="middle"
            className="gauge-percentage"
            fill={getColor(animatedPercentage)}
          >
            {Math.round(animatedPercentage)}%
          </text>
          
          <text
            x="140"
            y="155"
            textAnchor="middle"
            className="gauge-label"
            fill="#6b7280"
          >
            {getLabel(animatedPercentage)}
          </text>
        </svg>
      </div>
    </div>
  );
};

export default GaugeChart;
