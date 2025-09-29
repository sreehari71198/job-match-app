import React, { createContext, useState, useContext, useEffect } from 'react';

const JobContext = createContext();

export const useJobContext = () => {
  const context = useContext(JobContext);
  if (!context) {
    throw new Error('useJobContext must be used within a JobProvider');
  }
  return context;
};

export const JobProvider = ({ children }) => {
  const [jobDescription, setJobDescriptionState] = useState('');

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('jm_jobDescription');
    if (stored && stored !== 'undefined' && stored.trim() !== '') {
      try {
        const parsed = JSON.parse(stored);
        setJobDescriptionState(parsed);
        console.log('JobContext: Loaded job description from localStorage');
      } catch {
        setJobDescriptionState(stored);
        console.log('JobContext: Loaded job description as string from localStorage');
      }
    }
  }, []);

  // Custom setter that also saves to localStorage
  const setJobDescription = (description) => {
    console.log('JobContext: Setting job description:', description?.substring(0, 100) + '...');
    
    let descString = '';
    
    // Handle different input types
    if (typeof description === 'string') {
      descString = description;
    } else if (description && typeof description === 'object' && description.name) {
      // If it's a file object, we can't store it directly
      // The actual text content should be extracted elsewhere
      console.warn('JobContext: Received file object, expecting text content');
      return;
    } else if (description) {
      descString = String(description);
    }
    
    setJobDescriptionState(descString);
    
    if (descString && descString.trim() !== '') {
      localStorage.setItem('jm_jobDescription', JSON.stringify(descString));
      console.log('JobContext: Saved job description to localStorage');
    } else {
      localStorage.removeItem('jm_jobDescription');
      console.log('JobContext: Removed job description from localStorage');
    }
  };

  // Helper method to check if job description exists
  const hasJobDescription = () => {
    const contextHas = Boolean(jobDescription && jobDescription.trim() !== '');
    const storageHas = Boolean(localStorage.getItem('jm_jobDescription'));
    console.log('JobContext: hasJobDescription - context:', contextHas, 'storage:', storageHas);
    return contextHas || storageHas;
  };

  // Helper method to get job description from any available source
  const getJobDescription = () => {
    if (jobDescription && jobDescription.trim() !== '') {
      return jobDescription;
    }
    
    // Fallback to localStorage
    const stored = localStorage.getItem('jm_jobDescription');
    if (stored && stored !== 'undefined') {
      try {
        return JSON.parse(stored);
      } catch {
        return stored;
      }
    }
    
    return '';
  };

  // Clear job description
  const clearJobDescription = () => {
    setJobDescriptionState('');
    localStorage.removeItem('jm_jobDescription');
    console.log('JobContext: Cleared job description');
  };

  const value = {
    jobDescription,
    setJobDescription,
    hasJobDescription,
    getJobDescription,
    clearJobDescription
  };

  return (
    <JobContext.Provider value={value}>
      {children}
    </JobContext.Provider>
  );
};
