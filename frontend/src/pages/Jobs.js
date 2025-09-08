import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/Jobs.css';
import { useJobContext } from '../context/JobContext';

const API_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:5000";

const Jobs = () => {
  const [jobDescriptionFile, setJobDescriptionFile] = useState(null);
  const [cvFile, setCvFile] = useState(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [cvFileName, setCvFileName] = useState(() => localStorage.getItem('cvFileName') || '');
  const [jdFileName, setJdFileName] = useState(() => localStorage.getItem('jobDescriptionFileName') || '');
  const [feedback, setFeedback] = useState(() => {
    const saved = localStorage.getItem('feedback');
    return saved ? JSON.parse(saved) : null;
  });

  const { setJobDescription: setGlobalJobDescription } = useJobContext();

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCvFile(file);
      localStorage.setItem('cvFileName', file.name);
      setCvFileName(file.name);
    }
  };

  const handleJDFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setJobDescriptionFile(file);
      localStorage.setItem('jobDescriptionFileName', file.name);
      setJdFileName(file.name);
    }
  };

  const handleAnalyzeClick = async () => {
    if (!jobDescriptionFile || !cvFile) {
      alert('Please upload both the job description and your CV.');
      return;
    }

    const formData = new FormData();
    formData.append('job_description', jobDescriptionFile);
    formData.append('cv', cvFile);
    setLoadingFeedback(true);

    try {
      const response = await axios.post(`${API_URL}/analyze`, formData);
      setFeedback(response.data.feedback);
      localStorage.setItem('feedback', JSON.stringify(response.data.feedback));
      setGlobalJobDescription(jobDescriptionFile);
    } catch (error) {
      console.error('There was an error!', error);
      alert(`An error occurred while processing your request: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoadingFeedback(false);
    }
  };

  const formatMatchPercentage = (percentage) => {
    return typeof percentage === 'number' ? `${Math.round(percentage)}%` : 'N/A';
  };

  useEffect(() => {
    const handleBeforeUnload = () => {
      localStorage.removeItem('feedback');
      localStorage.removeItem('jobDescriptionFileName');
      localStorage.removeItem('cvFileName');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  return (
    <div className="jobs-container">
      <div className="jobs-header">
        <h1>CV-Job Match Analysis</h1>
        <p>Upload your CV and job description to get detailed analysis and recommendations</p>
      </div>

      {/* Upload Section */}
      <div className="upload-section">
        <div className="upload-card">
          <div className="upload-item">
            <label className="upload-label">
              <span>Job Description (PDF)</span>
              <input
                type="file"
                accept=".pdf"
                onChange={handleJDFileChange}
                className="upload-input"
              />
              <div className="upload-button">Choose File</div>
            </label>
            {jdFileName && <span className="file-name">{jdFileName}</span>}
          </div>

          <div className="upload-item">
            <label className="upload-label">
              <span>Your CV (PDF)</span>
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="upload-input"
              />
              <div className="upload-button">Choose File</div>
            </label>
            {cvFileName && <span className="file-name">{cvFileName}</span>}
          </div>

          <button
            onClick={handleAnalyzeClick}
            disabled={loadingFeedback || !jobDescriptionFile || !cvFile}
            className="analyze-button"
          >
            {loadingFeedback ? 'Analyzing...' : 'Analyze Match'}
          </button>
        </div>
      </div>

      {/* Results Section */}
      {feedback && (
        <div className="results-section">
          {/* Match Summary */}
          <div className="summary-grid">
            <div className="summary-card match-card">
              <h3>Overall Match</h3>
              <div className="match-percentage">
                {formatMatchPercentage(feedback.match_percentage)}
              </div>
            </div>
            
            <div className="summary-card similarities-card">
              <h3>Matching Skills</h3>
              <div className="count">{feedback.similarities?.length || 0}</div>
            </div>
            
            <div className="summary-card missing-card">
              <h3>Skills to Improve</h3>
              <div className="count">{feedback.missing?.length || 0}</div>
            </div>
          </div>

          {/* Detailed Results */}
          <div className="details-grid">
            {/* Similarities */}
            {feedback.similarities?.length > 0 && (
              <div className="details-card">
                <h3>✅ Your Strengths</h3>
                <ul className="skills-list">
                  {feedback.similarities.map((skill, idx) => (
                    <li key={idx} className="skill-item positive">{skill}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Missing Skills */}
            {feedback.missing?.length > 0 && (
              <div className="details-card">
                <h3>📈 Areas for Improvement</h3>
                <ul className="skills-list">
                  {feedback.missing.map((skill, idx) => (
                    <li key={idx} className="skill-item negative">{skill}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* BITS Recommended Courses Table */}
          {feedback.bits_recommendations && Object.keys(feedback.bits_recommendations).length > 0 && (
            <div className="recommendations-section">
              <h3>🎓 Recommended BITS Courses</h3>
              <div className="table-container">
                <table className="recommendations-table">
                  <thead>
                    <tr>
                      <th>Missing Skill</th>
                      <th>Recommended Course</th>
                      <th>Match %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(feedback.bits_recommendations).map(([skill, course], idx) => (
                      <tr key={idx}>
                        <td className="skill-cell">{skill}</td>
                        <td className="course-cell">
                          <div className="course-info">
                            <span className="course-title">{course['Course Title']}</span>
                            {course['Course No'] !== 'N/A' && (
                              <span className="course-code">({course['Course No']})</span>
                            )}
                          </div>
                        </td>
                        <td className="match-cell">
                          <span className={`match-badge ${course.Similarity > 0.6 ? 'high' : course.Similarity > 0.3 ? 'medium' : 'low'}`}>
                            {(course.Similarity * 100).toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* External Course Recommendations */}
          {feedback.course_recommendations?.length > 0 && (
            <div className="external-courses-section">
              <h3>🌐 External Learning Resources</h3>
              <div className="external-courses-grid">
                {feedback.course_recommendations.map((course, idx) => (
                  <div key={idx} className="external-course-card">
                    <h4>{course.name}</h4>
                    <a href={course.url} target="_blank" rel="noopener noreferrer">
                      View Course
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Jobs;
