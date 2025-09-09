import React, { useState, useEffect } from 'react';
import Prompt from '../components/Prompt';
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
  const { jobDescription } = useJobContext();
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  const handleSubmit = async (question) => {
    const updated = [...qaList, { question, answer: '...' }];
    setQaList(updated);
    lsSet('chatprep_qaList', updated);

    try {
      const response = await fetch(`${API_URL}/Ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      });
      const data = await response.json();
      const finalList = updated.map((qa, i) =>
        i === updated.length - 1 ? { ...qa, answer: data.answer } : qa
      );
      setQaList(finalList);
      lsSet('chatprep_qaList', finalList);
    } catch (err) {
      console.error(err);
      const fallback = updated.map((qa, i) =>
        i === updated.length - 1 ? { ...qa, answer: 'Something went wrong. Try again.' } : qa
      );
      setQaList(fallback);
      lsSet('chatprep_qaList', fallback);
    }
  };

  useEffect(() => {
    const fetchQuestions = async () => {
      const cached = lsGet('chatprep_questions', null);
      if (cached && Array.isArray(cached) && cached.length > 0) {
        setQuestions(cached);
        return;
      }
      if (!jobDescription) return;

      setLoadingQuestions(true);
      try {
        const formData = new FormData();
        formData.append('file', jobDescription);
        const res = await fetch(`${API_URL}/get-questions`, {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        const qs = data.questions || [];
        setQuestions(qs);
        lsSet('chatprep_questions', qs);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingQuestions(false);
      }
    };
    fetchQuestions();
  }, [jobDescription]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      lsRemove('chatprep_questions');
      lsRemove('chatprep_qaList');
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  return (
    <div className="ChatPrep">
      <div className="questions">
        <h2>Generated Questions</h2>
        {loadingQuestions ? (
          <div className="dot-loader">
            <span></span><span></span><span></span>
          </div>
        ) : questions && questions.length > 0 ? (
          <ul className="qa-list">
            {questions.map((item, idx) => (
              <li key={idx} className="qa-item">
                <p><strong>Q:</strong> {item.question}</p>
                <p><strong>A:</strong> {item.answer}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p>No questions available.</p>
        )}
      </div>

      <div className="chatprep-container">
        <div className="chatprep-header">Ask custom questions</div>
        <div className="chatprep-body">
          <Prompt onSubmit={handleSubmit} />
          {qaList.length > 0 && (
            <div className="history">
              <h3>History</h3>
              <ul className="qa-list">
                {qaList.map((qa, i) => (
                  <li key={i} className="qa-item">
                    <p><strong>Q:</strong> {qa.question}</p>
                    <p><strong>A:</strong> {qa.answer}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatPrep;