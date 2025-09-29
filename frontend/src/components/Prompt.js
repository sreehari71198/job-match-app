import React, { useState } from 'react';
import '../styles/Prompt.css';

const Prompt = ({ onSubmit, disabled = false, placeholder = "Ask a question..." }) => {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim() && !disabled) {
      onSubmit(inputValue.trim());
      setInputValue('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="prompt-form">
      <div className="prompt-input-container">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          disabled={disabled}
          className="prompt-input"
        />
        <button
          type="submit"
          disabled={disabled || !inputValue.trim()}
          className="prompt-submit"
        >
          {disabled ? (
            <div className="loading-spinner-small"></div>
          ) : (
            <span>Send</span>
          )}
        </button>
      </div>
    </form>
  );
};

export default Prompt;
