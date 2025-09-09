import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/Jobs.css';
import { useJobContext } from '../context/JobContext';

const API_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:5000";

const getUserId = () => localStorage.getItem('jm_userId') || 'anon-session';
const keyFor = (base) => `jm_${base}::${getUserId()}`;
const lsGet = (base, fallback = null) => {
  try {
    const raw = localStorage.getItem(keyFor(base));
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};
const lsSet = (base, value) => localStorage.setItem(keyFor(base), JSON.stringify(value));
const lsRemove = (base) => localStorage.removeItem(keyFor(base));

const Jobs = () => {
  const [jobDescriptionFile, setJobDescriptionFile] = useState(null);
  const [cvFile, setCvFile] = useState(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  const [cvFileName, setCvFileName] = useState(() => lsGet('cvFileName', ''));
  const [jdFileName, setJdFileName] = useState(() => lsGet('jobDescriptionFileName', ''));
  const [feedback, setFeedback] = useState(() => lsGet('feedback', null));

  const { setJobDescription: setGlobalJobDescription } = useJobContext();

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCvFile(file);
      setCvFileName(file.name);
      lsSet('cvFileName', file.name);
    }
  };

  const handleJDFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setJobDescriptionFile(file);
      setJdFileName(file.name);
      lsSet('jobDescriptionFileName', file.name);
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
      lsSet('feedback', response.data.feedback);
      setGlobalJobDescription(jobDescriptionFile);
    } catch (error) {
      console.error('There was an error!', error);
      alert(`An error occurred while processing your request: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoadingFeedback(false);
    }
  };

  useEffect(() => {
    const handleBeforeUnload = () => {
      lsRemove('feedback');
      lsRemove('jobDescriptionFileName');
      lsRemove('cvFileName');
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const formatMatchPercentage = (percentage) => {
    return typeof percentage === 'number' ? `${Math.round(percentage)}%` : 'N/A';
  };

  return (
    <div className="jobs-container">
      <div className="jobs-header">
        <h1>Job Match</h1>
        <p>Upload your CV and job description to get detailed analysis and recommendations</p>
      </div>

      <section className="upload-section">
        <div className="upload-card">
          <div className="upload-item">
            <label className="upload-label">
              <span>Upload CV (PDF)</span>
              <input className="upload-input" type="file" accept="application/pdf" onChange={handleFileChange} />
              <div className="upload-button">Choose File</div>
            </label>
            <div className="file-name">Selected CV: {cvFileName}</div>
          </div>

          <div className="upload-item">
            <label className="upload-label">
              <span>Upload Job Description (PDF)</span>
              <input className="upload-input" type="file" accept="application/pdf" onChange={handleJDFileChange} />
              <div className="upload-button">Choose File</div>
            </label>
            <div className="file-name">Selected JD: {jdFileName}</div>
          </div>

          <button className="analyze-button" onClick={handleAnalyzeClick} disabled={loadingFeedback}>
            {loadingFeedback ? 'Analyzing…' : 'Analyze'}
          </button>
        </div>
      </section>

      {feedback && (
        <section className="results-section">
          <div className="summary-grid">
            <div className="summary-card">
              <h3>Overall Match</h3>
              <div className="match-percentage">{formatMatchPercentage(feedback.match_percentage)}</div>
            </div>
            <div className="summary-card">
              <h3>Similarities</h3>
              <div className="count">{Array.isArray(feedback.similarities) ? feedback.similarities.length : 0}</div>
            </div>
            <div className="summary-card missing-card">
              <h3>Missing Skills</h3>
              <div className="count">{Array.isArray(feedback.missing) ? feedback.missing.length : 0}</div>
            </div>
          </div>

          <div className="details-grid">
            {Array.isArray(feedback.similarities) && (
              <div className="details-card">
                <h3>Similarities</h3>
                <ul className="skills-list">
                  {feedback.similarities.map((s, idx) => (
                    <li key={idx} className="skill-item positive">{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {Array.isArray(feedback.missing) && (
              <div className="details-card">
                <h3>Missing Skills</h3>
                <ul className="skills-list">
                  {feedback.missing.map((m, idx) => (
                    <li key={idx} className="skill-item negative">{m}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {feedback.bits_recommendations && Object.keys(feedback.bits_recommendations).length > 0 && (
            <section className="recommendations-section">
              <h3>BITS Course Recommendations</h3>
              <div className="table-container">
                <table className="recommendations-table">
                  <thead>
                    <tr>
                      <th>Missing Skill</th>
                      <th>Recommended Course</th>
                      <th>Match</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(feedback.bits_recommendations).map(([skill, course]) => {
                      const sim = Number(course.Similarity || 0);
                      const band = sim > 0.5 ? 'high' : sim > 0.3 ? 'medium' : 'low';
                      return (
                        <tr key={skill}>
                          <td className="skill-cell">{skill}</td>
                          <td>
                            <div className="course-info">
                              <span className="course-title">{course['Course Title']}</span>
                              <span className="course-code">
                                {course['Course No'] !== 'N/A' ? `(${course['Course No']})` : ''}
                              </span>
                            </div>
                          </td>
                          <td className="match-cell">
                            <span className={`match-badge ${band}`}>{(sim * 100).toFixed(1)}%</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {Array.isArray(feedback.course_recommendations) && feedback.course_recommendations.length > 0 && (
            <section className="external-courses-section">
              <h3>External Courses</h3>
              <div className="external-courses-grid">
                {feedback.course_recommendations.map((c, idx) => (
                  <div key={idx} className="external-course-card">
                    <h4>{c.name}</h4>
                    <a href={c.url} target="_blank" rel="noreferrer">View</a>
                  </div>
                ))}
              </div>
            </section>
          )}
        </section>
      )}
    </div>
  );
};

export default Jobs;