import React, { useState, useEffect } from 'react';
import Prompt from '../components/Prompt';
import '../styles/ChatPrep.css';

import { useJobContext } from '../context/JobContext';

const API_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:5000";

const ChatPrep = () => {
  // -------------------- STATE MANAGEMENT --------------------
  // Store generated interview questions (from job description)
  const [questions, setQuestions] = useState(() => {
    try {
      const saved = localStorage.getItem('chatprep_questions');
      return saved && saved !== "undefined" ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to parse chatprep_questions:", e);
      return [];
    }
  });

  // Store Q&A history from user prompts (custom questions asked to GPT)
  const [qaList, setQaList] = useState(() => {
    try {
      const saved = localStorage.getItem('chatprep_qaList');
      return saved && saved !== "undefined" ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to parse chatprep_qaList:", e);
      return [];
    }
  });

  // Context: job description file uploaded earlier
  const { jobDescription } = useJobContext();

  // Loading state while fetching interview questions
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // -------------------- FUNCTIONS --------------------

  /**
   * handleSubmit
   * - Handles custom questions typed by the user in Prompt component
   * - Adds placeholder answer ("...") while waiting
   * - Sends the question to backend (/Ask route)
   * - Updates localStorage + state with GPT’s response
   */
  const handleSubmit = async (question) => {
    const updatedQaList = [...qaList, { question, answer: '...' }];
    setQaList(updatedQaList);
    localStorage.setItem('chatprep_qaList', JSON.stringify(updatedQaList));

    try {
      const response = await fetch(`${API_URL}/Ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      const data = await response.json();

      // Replace placeholder with actual GPT answer
      const finalQaList = updatedQaList.map((qa, i) =>
        i === updatedQaList.length - 1 ? { ...qa, answer: data.answer } : qa
      );

      setQaList(finalQaList);
      localStorage.setItem('chatprep_qaList', JSON.stringify(finalQaList));
    } catch (err) {
      console.error(err);

      // Handle errors gracefully (replace with fallback answer)
      const errorQaList = updatedQaList.map((qa, i) =>
        i === updatedQaList.length - 1
          ? { ...qa, answer: 'Something went wrong. Try again.' }
          : qa
      );

      setQaList(errorQaList);
      localStorage.setItem('chatprep_qaList', JSON.stringify(errorQaList));
    }
  };

  // -------------------- EFFECTS --------------------

  /**
   * Fetch 10 interview questions based on uploaded job description
   * - If questions exist in localStorage, load them from there
   * - Otherwise, send job description file to backend (/get-questions)
   * - Store result in state + localStorage
   */
  useEffect(() => {
    const fetchQuestions = async () => {
      const storedQuestions = localStorage.getItem('chatprep_questions');
      if (storedQuestions) {
        setQuestions(JSON.parse(storedQuestions));
        return; 
      }

      if (!jobDescription) return;

      setLoadingQuestions(true);

      try {
        const formData = new FormData();
        formData.append('file', jobDescription); 

        const res = await fetch(`${API_URL}/get-questions`, {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        setQuestions(data.questions);
        localStorage.setItem('chatprep_questions', JSON.stringify(data.questions));
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingQuestions(false);
      }
    };

    fetchQuestions();
  }, [jobDescription]);

  /**
   * Clear stored data when the page reloads or tab closes
   * - Prevents old questions and answers from persisting forever
   */
  useEffect(() => {
    const handleBeforeUnload = () => {
      localStorage.removeItem('chatprep_questions');
      localStorage.removeItem('chatprep_qaList');
    };
  
    window.addEventListener('beforeunload', handleBeforeUnload);
  
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);
  
  // -------------------- RENDER --------------------
  return (
    <div className='ChatPrep'>
        {/* Section: Auto-generated 10 interview questions */}
        <div className="questions">
            <h2>TEN QUESTIONS TO BE ASKED</h2>

            {loadingQuestions ? (
              <div className="dot-loader">
                <span></span><span></span><span></span>
              </div>
            ) : questions.length > 0 ? (
              <ul>
                {questions.map((qa, index) => (
                  <li key={index} className="qa-item">
                    <h3>Q: {qa.question}</h3>
                    <p>A: {qa.answer}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No questions available.</p>
            )}
        </div>

        {/* Section: Chat-based Interview Helper (user Q&A with GPT) */}
        <div className="chatprep-container">
          <h2 className="chatprep-header">Interview Helper Agent</h2>

          <div className="chatprep-body">
            {qaList.map((item, idx) => (
              <div key={idx} className="qa-item">
                <p><strong>Q:</strong> {item.question}</p>
                <p><strong>A:</strong> {item.answer}</p>
              </div>
            ))}
          </div>

          {/* Input component for asking custom questions */}
          <Prompt onSubmit={handleSubmit} />
        </div>
    </div>
  );
};

export default ChatPrep;
