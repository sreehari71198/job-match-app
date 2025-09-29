import React, { useState, useEffect } from 'react';
import Prompt from '../components/Prompt';
import PrepHeading from '../components/PrepHeading';
import '../styles/ChatPrep.css';
import { useJobContext } from '../context/JobContext';

const API_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:5000";

const getUserId = () => localStorage.getItem('jm_userId') || 'anon-session';
const keyFor = (base) => `jm_${base}::${getUserId()}`;

const lsGet = (base, fallback = []) => {
  try {
    const raw = localStorage.getItem(keyFor(base));
    if (!raw || raw === "undefined") return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const lsSet = (base, val) => localStorage.setItem(keyFor(base), JSON.stringify(val));
const lsRemove = (base) => localStorage.removeItem(keyFor(base));

const ChatPrep = () => {
  const [questions, setQuestions] = useState(() => lsGet('chatprep_questions', []));
  const [qaList, setQaList] = useState(() => lsGet('chatprep_qaList', []));
  const { jobDescription, hasJobDescription, getJobDescription } = useJobContext();
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);

  useEffect(() => {
    lsSet('chatprep_questions', questions);
  }, [questions]);

  useEffect(() => {
    lsSet('chatprep_qaList', qaList);
  }, [qaList]);

  // Enhanced function to find job description from multiple sources
  const findJobDescription = () => {
    console.log('=== Finding Job Description ===');
    
    // 1. Try JobContext first
    let jobDesc = getJobDescription ? getJobDescription() : jobDescription;
    if (jobDesc && jobDesc.trim()) {
      console.log('Found job description in JobContext:', jobDesc.substring(0, 100));
      return jobDesc;
    }
    
    // 2. Try direct localStorage
    const directStored = localStorage.getItem('jm_jobDescription');
    if (directStored && directStored !== 'undefined') {
      try {
        jobDesc = JSON.parse(directStored);
        if (jobDesc && jobDesc.trim()) {
          console.log('Found job description in direct localStorage:', jobDesc.substring(0, 100));
          return jobDesc;
        }
      } catch (e) {
        if (directStored.trim()) {
          console.log('Found job description in direct localStorage (string):', directStored.substring(0, 100));
          return directStored;
        }
      }
    }
    
    // 3. Try to extract from feedback data (this is the key fix!)
    try {
      const userId = getUserId();
      const feedbackKey = `jm_feedback::${userId}`;
      const storedFeedback = localStorage.getItem(feedbackKey);
      console.log('Checking feedback storage key:', feedbackKey);
      console.log('Feedback exists:', !!storedFeedback);
      
      if (storedFeedback && storedFeedback !== 'undefined') {
        const feedback = JSON.parse(storedFeedback);
        console.log('Feedback object keys:', Object.keys(feedback));
        
        // Check for job description in feedback
        if (feedback.job_description && feedback.job_description.trim()) {
          console.log('Found job description in feedback:', feedback.job_description.substring(0, 100));
          return feedback.job_description;
        }
        
        // Also check if the entire feedback text could be used
        if (feedback.similarities || feedback.missing) {
          console.log('Found feedback with skills - this means analysis was done');
          // If we have feedback but no job description text, 
          // we can still generate generic questions
          return 'Job analysis completed with skill matching results available.';
        }
      }
    } catch (e) {
      console.error('Error accessing stored feedback:', e);
    }
    
    // 4. Try to find any indication that analysis was completed
    try {
      const userId = getUserId();
      const cvFileName = localStorage.getItem(`jm_cvFileName::${userId}`);
      const jdFileName = localStorage.getItem(`jm_jobDescriptionFileName::${userId}`);
      const feedback = localStorage.getItem(`jm_feedback::${userId}`);
      
      if (cvFileName && jdFileName && feedback) {
        console.log('Found evidence of completed analysis - using placeholder text');
        return `Analysis completed for job description: ${jdFileName} and CV: ${cvFileName}`;
      }
    } catch (e) {
      console.error('Error checking file history:', e);
    }
    
    console.log('No job description found anywhere');
    return '';
  };

  const generateQuestions = async () => {
    console.log('=== Generate Questions Called ===');
    
    const finalJobDescription = findJobDescription();
    
    if (!finalJobDescription || finalJobDescription.trim() === '') {
      alert('Please upload and analyze a job description first in the Skill Match section.');
      return;
    }

    setLoadingQuestions(true);
    try {
      console.log('Sending request to generate questions...');
      console.log('Job description length:', finalJobDescription.length);
      
      const requestBody = { 
        jobDescription: finalJobDescription.toString().trim() 
      };

      const response = await fetch(`${API_URL}/generate-questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('Success response:', data);

      if (data.success && data.questions) {
        setQuestions(data.questions);
        console.log('Questions set:', data.questions.length);
      } else {
        throw new Error(data.message || 'Failed to generate questions');
      }
    } catch (error) {
      console.error('Error generating questions:', error);
      alert(`Failed to generate questions: ${error.message}`);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleChatSubmit = async (question) => {
    if (!question.trim()) return;

    const userMessage = { type: 'user', content: question, timestamp: Date.now() };
    setQaList(prev => [...prev, userMessage]);
    setLoadingChat(true);

    try {
      const jobDesc = findJobDescription();
      const context = jobDesc ? `Job Description Context: ${jobDesc.substring(0, 500)}...\n\n` : '';
      
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: question,
          context: context
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.response) {
        const botMessage = { type: 'bot', content: data.response, timestamp: Date.now() };
        setQaList(prev => [...prev, botMessage]);
      } else {
        throw new Error(data.message || 'Failed to get response');
      }
    } catch (error) {
      console.error('Error in chat:', error);
      const errorMessage = { 
        type: 'bot', 
        content: 'Sorry, I encountered an error. Please try again.', 
        timestamp: Date.now() 
      };
      setQaList(prev => [...prev, errorMessage]);
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

  // Enhanced check for job description
  const hasJobDesc = () => {
    const found = findJobDescription();
    return Boolean(found && found.trim());
  };

  return (
    <div className="chatprep-page">
      <main className="chatprep-main">
        <div className="chatprep-container">
          {/* Page Title */}
          <div className="chatprep-header">
            <PrepHeading />
          </div>

          {/* Content Grid */}
          <div className="chatprep-grid">
            {/* Generated Questions Section */}
            <div className="questions-section">
              <div className="section-card">
                <div className="section-header">
                  <h2>Generated Questions</h2>
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
                  {!hasJobDesc() && (
                    <div className="empty-state">
                      <span>📝</span>
                      <p>Upload a job description in Skill Match to generate relevant interview questions.</p>
                      <p><small>Debug: Check browser console for job description detection details.</small></p>
                    </div>
                  )}
                  
                  {hasJobDesc() && questions.length === 0 && !loadingQuestions && (
                    <div className="empty-state">
                      <span>💡</span>
                      <p>Click "Generate Questions" to create interview questions based on your job description.</p>
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
                      {questions.map((question, index) => (
                        <div key={index} className="question-item">
                          <div className="question-number">{index + 1}</div>
                          <div className="question-text">{question}</div>
                          <button 
                            onClick={() => handleChatSubmit(`How should I answer: "${question}"`)}
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
                      <p>Start a conversation! Ask any interview-related questions.</p>
                    </div>
                  ) : (
                    <div className="chat-messages">
                      {qaList.map((message, index) => (
                        <div key={index} className={`message ${message.type}-message`}>
                          <div className="message-content">
                            {message.content}
                          </div>
                          <div className="message-time">
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      ))}
                      {loadingChat && (
                        <div className="message bot-message loading">
                          <div className="message-content">
                            <div className="typing-indicator">
                              <span></span>
                              <span></span>
                              <span></span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Chat Input */}
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

      {/* Footer - Same as Jobs.js */}
      <footer className="bits-footer">
        <div className="footer-content">
          <div className="footer-left">
            <p>© 2025 MatchMySkill - BITS Pilani. All rights reserved.</p>
            <p>Built for BITS Pilani students by BITS Pilani students.</p>
            <p>Empowering your career journey with AI-driven insights.</p>
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

export default ChatPrep;
