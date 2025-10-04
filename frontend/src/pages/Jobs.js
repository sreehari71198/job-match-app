import React, { useState, useEffect, useRef } from 'react'; // Added useRef
import axios from 'axios';
import '../styles/Jobs.css';
import { useJobContext } from '../context/JobContext';
import GaugeChart from '../components/GaugeChart';

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

  // Add ref for results section
  const resultsRef = useRef(null);

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
      // setGlobalJobDescription(jobDescriptionFile);
    } catch (error) {
      console.error('There was an error!', error);
      alert(`An error occurred while processing your request: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoadingFeedback(false);
    }
  };
// Auto-scroll to results when feedback is loaded (accounting for fixed header)
useEffect(() => {
  if (feedback && resultsRef.current) {
    const timer = setTimeout(() => {
      const headerHeight = 120; // Adjust this value to match your header height
      const elementPosition = resultsRef.current.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerHeight;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }, 500);
    
    return () => clearTimeout(timer);
  }
}, [feedback]);


  useEffect(() => {
    const handleBeforeUnload = () => {
      lsRemove('feedback');
      lsRemove('jobDescriptionFileName');
      lsRemove('cvFileName');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // const formatMatchPercentage = (percentage) => {
  //   return typeof percentage === 'number' ? `${Math.round(percentage)}%` : 'N/A';
  // };

  // Sort BITS recommendations by similarity score in descending order
  const getSortedBitsRecommendations = (bitsRecommendations) => {
    if (!bitsRecommendations) return [];
    
    return Object.entries(bitsRecommendations)
      .sort(([, a], [, b]) => (b.Similarity || 0) - (a.Similarity || 0))
      .map(([skill, course]) => ({ skill, course }));
  };

  const getMatchBadgeClass = (similarity) => {
    if (similarity >= 0.7) return 'high';
    if (similarity >= 0.4) return 'medium';
    return 'low';
  };

  return (
    <div className="page-container">  
      <main className="main-content">
        <div className="jobs-container">
          <div className="jobs-header">
            <h1>Skill Match Analysis</h1>
            <p>Upload your CV and job description to get detailed analysis and recommendations</p>
          </div>

          {/* Upload Section */}
          <div className="upload-section">
            <div className="upload-card">
              <div className="upload-item">
                <label htmlFor="job-description-upload" className="upload-label">
                  <span>Job Description (PDF)</span>
                  <div className="upload-button">
                    {jdFileName ? '✓ Change File' : '📄 Choose PDF'}
                  </div>
                  <input
                    id="job-description-upload"
                    type="file"
                    accept=".pdf"
                    onChange={handleJDFileChange}
                    className="upload-input"
                  />
                </label>
                {jdFileName && <div className="file-name">📄 {jdFileName}</div>}
              </div>

              <div className="upload-item">
                <label htmlFor="cv-upload" className="upload-label">
                  <span>Your CV/Resume (PDF)</span>
                  <div className="upload-button">
                    {cvFileName ? '✓ Change File' : '📄 Choose PDF'}
                  </div>
                  <input
                    id="cv-upload"
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="upload-input"
                  />
                </label>
                {cvFileName && <div className="file-name">📄 {cvFileName}</div>}
              </div>

              <button
                onClick={handleAnalyzeClick}
                disabled={!jobDescriptionFile || !cvFile || loadingFeedback}
                className="analyze-button"
              >
                {loadingFeedback ? '🔄 Analyzing...' : '🚀 Analyze Match'}
              </button>
            </div>
          </div>

          {/* Results Section - Added ref here */}
          {feedback && (
            <div ref={resultsRef} className="results-section">
              {/* Compact Summary Layout */}
              <div className="summary-layout">
                {/* Half-circle gauge */}
                <div className="gauge-section">
                  <GaugeChart 
                    percentage={feedback.match_percentage || 0}
                    size={280}
                    title="Overall Job Match"
                  />
                </div>
                
                {/* Compact skill stats - CENTER ALIGNED */}
                <div className="stats-section">
                  <div className="stat-card-center skills-found">
                    <div className="stat-number">{feedback.similarities?.length || 0}</div>
                    <div className="stat-label">Skills Found</div>
                  </div>
                  
                  <div className="stat-card-center skills-missing">
                    <div className="stat-number">{feedback.missing?.length || 0}</div>
                    <div className="stat-label">Skills Missing</div>
                  </div>
                </div>
              </div>

              {/* Details Grid */}
              <div className="details-grid">
                {feedback.similarities && feedback.similarities.length > 0 && (
                  <div className="details-card">
                    <h3>✅ Skills You Have</h3>
                    <ul className="skills-list">
                      {feedback.similarities.map((skill, index) => (
                        <li key={index} className="skill-item positive">
                          {skill}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {feedback.missing && feedback.missing.length > 0 && (
                  <div className="details-card">
                    <h3>📚 Skills to Develop</h3>
                    <ul className="skills-list">
                      {feedback.missing.map((skill, index) => (
                        <li key={index} className="skill-item negative">
                          {skill}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* BITS Recommendations - Sorted by Match % */}
              {feedback.bits_recommendations && Object.keys(feedback.bits_recommendations).length > 0 && (
                <div className="recommendations-section">
                  <h3>🎓 BITS Pilani Course Recommendations</h3>
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
                        {getSortedBitsRecommendations(feedback.bits_recommendations).map(({ skill, course }, index) => (
                          <tr key={index}>
                            <td className="skill-cell">{skill}</td>
                            <td>
                              <div className="course-info">
                                <div className="course-title">{course['Course Title']}</div>
                                {course['Course No'] !== 'N/A' && (
                                  <div className="course-code">{course['Course No']}</div>
                                )}
                              </div>
                            </td>
                            <td className="match-cell">
                              <span className={`match-badge ${getMatchBadgeClass(course.Similarity)}`}>
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

              {/* External Courses */}
              {feedback.course_recommendations && feedback.course_recommendations.length > 0 && (
                <div className="external-courses-section">
                  <h3>🌐 External Course Recommendations</h3>
                  <div className="external-courses-grid">
                    {feedback.course_recommendations.map((course, index) => (
                      <div key={index} className="external-course-card">
                        <h4>{course.name}</h4>
                        <a href={course.url} target="_blank" rel="noopener noreferrer">
                          View Course →
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Instructions when no results */}
          {!feedback && (
            <div className="instructions-section">
              <div className="instructions-card">
                <h3>📈 How MatchMySkill Works</h3>
                <ol className="instructions-list">
                  <li>Upload a job description PDF that you're interested in</li>
                  <li>Upload your current CV/Resume in PDF format</li>
                  <li>Click "Analyze Match" to get AI-powered insights</li>
                  <li>Receive personalized BITS course recommendations</li>
                  <li>Bridge your skill gaps with targeted learning</li>
                  <li>Use "Interview Prep" for more insights answers from your JD</li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* BITS Footer */}
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

export default Jobs;
