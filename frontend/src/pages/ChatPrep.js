// src/pages/ChatPrep.js
import React, { useState, useEffect, useMemo } from 'react';
import PrepHeading from '../components/PrepHeading';
import Prompt from '../components/Prompt';
import '../styles/ChatPrep.css';
import { useJobContext } from '../context/JobContext';

// Ensure no trailing slash to avoid // in requests
const API_URL = (process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');

const getUserId = () => localStorage.getItem('jm_userId') || 'anon-session';
const keyFor = (base) => `jm_${base}::${getUserId()}`;

const lsGet = (base, fallback) => {
  try {
    const raw = localStorage.getItem(keyFor(base));
    if (!raw || raw === 'undefined') return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const lsSet = (base, value) => localStorage.setItem(keyFor(base), JSON.stringify(value));
const lsRemove = (base) => localStorage.removeItem(keyFor(base));

const ChatPrep = () => {
  const [questions, setQuestions] = useState(() => lsGet('chatprep_questions', []));
  const [qaList, setQaList] = useState(() => lsGet('chatprep_qaList', []));
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);

  // Pull JD from context with safe helpers
  const { jobDescription, getJobDescription } = useJobContext();

  // Memoized readers for results/feedback (produced by Jobs page)
  const feedback = useMemo(() => lsGet('feedback', null), []);
  const skillsFound = useMemo(() => feedback?.similarities || [], [feedback]);
  const skillsMissing = useMemo(() => feedback?.missing || [], [feedback]);
  const topCourses = useMemo(() => (feedback?.course_recommendations || []).slice(0, 3), [feedback]);

  // Persist UI state
  useEffect(() => { lsSet('chatprep_questions', questions); }, [questions]);
  useEffect(() => { lsSet('chatprep_qaList', qaList); }, [qaList]);

  // Helper: discover JD text from multiple places
  const findJobDescription = () => {
    // 1) Prefer context hook
    const ctxJD = typeof getJobDescription === 'function' ? getJobDescription() : jobDescription;
    if (ctxJD && String(ctxJD).trim()) return String(ctxJD);

    // 2) Direct localStorage fallback (context provider also writes jm_jobDescription)
    const direct = localStorage.getItem('jm_jobDescription');
    if (direct && direct !== 'undefined') {
      try { return JSON.parse(direct); } catch { return direct; }
    }

    // 3) As last resort, infer from prior analysis presence
    const userId = getUserId();
    const jdName = localStorage.getItem(`jm_jobDescriptionFileName::${userId}`);
    if (jdName) return `Job description analyzed previously: ${jdName}`;
    return '';
  };

  // Helper: discover CV text
  // Option A: If backend returns cv_text in /analyze and you store it as jm_cvText, we read that.
  // Option B: If not available, create a minimal placeholder so backend still biases toward CV-grounding.
  const findCvText = () => {
    const raw = localStorage.getItem('jm_cvText');
    if (raw && raw !== 'undefined') {
      try { return JSON.parse(raw); } catch { return raw; }
    }
    // If not yet stored, derive a soft hint based on uploaded filename
    const userId = getUserId();
    const cvName = localStorage.getItem(`jm_cvFileName::${userId}`);
    if (cvName) return `Candidate CV was uploaded: ${cvName}. Use CV experiences and skills detected during analysis to tailor questions.`;
    return '';
  };

  const hasGrounding = () => {
    const jd = findJobDescription();
    const cv = findCvText();
    return Boolean((jd && jd.trim()) || (cv && cv.trim()));
  };

  const generateQuestions = async () => {
    if (!hasGrounding()) {
      alert('Please upload and analyze a job description and/or CV first in Skill Match.');
      return;
    }

    const jdText = findJobDescription();
    const cvText = findCvText();

    const body = {
      jobDescription: jdText,
      cvText,
      // Scaffolding from Skill Match to force specificity
      skillsFound,
      skillsMissing,
      topCourses
    };

    setLoadingQuestions(true);
    try {
      const resp = await fetch(`${API_URL}/generate-questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${errText}`);
      }

      const data = await resp.json();
      if (data.success && Array.isArray(data.questions)) {
        setQuestions(data.questions);
      } else {
        throw new Error(data.message || 'Failed to generate questions');
      }
    } catch (e) {
      console.error('Error generating questions:', e);
      alert(`Failed to generate questions: ${e.message}`);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleChatSubmit = async (question) => {
    if (!question.trim()) return;

    const userMessage = { type: 'user', content: question, timestamp: Date.now() };
    setQaList((prev) => [...prev, userMessage]);
    setLoadingChat(true);

    try {
      const jd = findJobDescription();
      const cv = findCvText();
      const contextParts = [];
      if (jd) contextParts.push(`JD: ${jd.substring(0, 1200)}`);
      if (cv) contextParts.push(`CV: ${cv.substring(0, 1200)}`);
      if (skillsFound?.length) contextParts.push(`SkillsFound: ${skillsFound.slice(0, 15).join(', ')}`);
      if (skillsMissing?.length) contextParts.push(`SkillsMissing: ${skillsMissing.slice(0, 15).join(', ')}`);
      const context = contextParts.join('\n');

      const resp = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question, context })
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();

      if (data.success && data.response) {
        const botMessage = { type: 'bot', content: data.response, timestamp: Date.now() };
        setQaList((prev) => [...prev, botMessage]);
      } else {
        throw new Error(data.message || 'Failed to get response');
      }
    } catch (e) {
      console.error('Error in chat:', e);
      const errMsg = { type: 'bot', content: 'Sorry, there was an error. Please try again.', timestamp: Date.now() };
      setQaList((prev) => [...prev, errMsg]);
    } finally {
      setLoadingChat(false);
    }
  };

  const clearChat = () => {
    setQaList([]);
    lsRemove('chatprep_qaList');
  };

  const clearQuestions = () => {
    setQuestions([]);
    lsRemove('chatprep_questions');
  };

  return (
    <div className="chatprep-page">
      <main className="chatprep-main">
        <div className="chatprep-container">
          {/* Header */}
          <div className="chatprep-header">
            <PrepHeading />
          </div>

          {/* Grid */}
          <div className="chatprep-grid">
            {/* Generated Questions */}
            <div className="questions-section">
              <div className="section-card">
                <div className="section-header">
                  <h2>AI Question Builder</h2>
                  <div className="section-actions">
                    <button
                      onClick={generateQuestions}
                      disabled={loadingQuestions}
                      className="generate-btn"
                    >
                      {loadingQuestions ? (
                        <>
                          <div className="loading-spinner"></div>
                          Generating...
                        </>
                      ) : (
                        <>
                          <span>🎯</span>
                          Generate Questions
                        </>
                      )}
                    </button>
                    {questions.length > 0 && (
                      <button onClick={clearQuestions} className="clear-btn">
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <div className="questions-content">
                  {!hasGrounding() && (
                    <div className="empty-state">
                      <span>📝</span>
                      <p>Upload and analyze a JD and/or CV in Skill Match to generate targeted questions.</p>
                      <p><small>Tip: Ensure analysis saved feedback to localStorage and JD/CV text or filenames are present.</small></p>
                    </div>
                  )}

                  {hasGrounding() && questions.length === 0 && !loadingQuestions && (
                    <div className="empty-state">
                      <span>💡</span>
                      <p>Click “Generate Questions” to create JD and CV grounded interview questions.</p>
                    </div>
                  )}

                  {loadingQuestions && (
                    <div className="empty-state">
                      <div className="loading-spinner"></div>
                      <p>Generating interview questions...</p>
                    </div>
                  )}

                  {questions.length > 0 && (
                    <div className="questions-list">
                      {questions.map((q, i) => (
                        <div key={i} className="question-item">
                          <div className="question-number">{i + 1}</div>
                          <div className="question-text">{q}</div>
                          <button
                            onClick={() => handleChatSubmit(`How should I answer: "${q}"`)}
                            className="practice-btn"
                            disabled={loadingChat}
                          >
                            Practice
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Chat Section */}
            <div className="chat-section">
              <div className="section-card">
                <div className="section-header">
                  <h2>Ask Custom Questions</h2>
                  {qaList.length > 0 && (
                    <button onClick={clearChat} className="clear-btn">
                      Clear Chat
                    </button>
                  )}
                </div>

                <div className="chat-content">
                  {qaList.length === 0 ? (
                    <div className="empty-state">
                      <span>💬</span>
                      <p>Start a conversation with AI assistant!!! Ask any interview-related questions.</p>
                    </div>
                  ) : (
                    <div className="chat-messages">
                      {qaList.map((m, idx) => (
                        <div key={idx} className={`message ${m.type}-message`}>
                          <div className="message-content">{m.content}</div>
                          <div className="message-time">
                            {new Date(m.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      ))}
                      {loadingChat && (
                        <div className="message bot-message loading">
                          <div className="message-content">
                            <div className="typing-indicator">
                              <span></span><span></span><span></span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="chat-input-container">
                    <Prompt
                      onSubmit={handleChatSubmit}
                      disabled={loadingChat}
                      placeholder="Ask a question..."
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
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

export default ChatPrep;
