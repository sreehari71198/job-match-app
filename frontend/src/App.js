import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { JobProvider } from './context/JobContext';

// Components
import Header from './components/Header';
import PrivateRoute from './components/PrivateRoute';

// Pages
import Authentication from './pages/Authentication';
import Jobs from './pages/Jobs';
import ChatPrep from './pages/ChatPrep';

function App() {
  return (
    <AuthProvider>
      <JobProvider>
        <BrowserRouter>
          <div className="App">
            <Header />
            <main>
              <Routes>
                {/* Public route */}
                <Route path="/" element={<Authentication />} />
                
                {/* Protected routes */}
                <Route element={<PrivateRoute />}>
                  <Route path="/SkillMatch" element={<Jobs />} />
                  <Route path="/ChatPrep" element={<ChatPrep />} />
                </Route>

                {/* Catch all - redirect to login */}
                <Route path="*" element={<Authentication />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </JobProvider>
    </AuthProvider>
  );
}

export default App;
