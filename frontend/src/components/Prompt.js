import React, { useState } from 'react';
import '../styles/Prompt.css'

const Prompt = ({ onSubmit }) => {
  const [question, setQuestion] = useState('');

  const handleSend = () => {
    if (question.trim() !== '') {
      if (typeof onSubmit === 'function') {
        onSubmit(question);
      } else {
        console.error("onSubmit is not a function");
      }
      setQuestion('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  return (
    <div className='prompt-container'>
      <textarea
        className='prompt-textarea'
        rows='1'
        placeholder='Ask a question...'
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button className='prompt-button' onClick={handleSend}>
        Send
      </button>
    </div>
  );
};

export default Prompt;
