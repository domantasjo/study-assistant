import React, { useState, useEffect } from 'react';
import BirthdayGreeting from './components/BirthdayGreeting';
import MainApp from './components/MainApp';
import { AppProvider } from './contexts/AppContext';

const App: React.FC = () => {
  const [showGreeting, setShowGreeting] = useState(true);
  const [isFirstLaunch, setIsFirstLaunch] = useState(true);

  useEffect(() => {
    // Check if this is the first launch
    const hasSeenGreeting = localStorage.getItem('neda-has-seen-greeting');
    if (hasSeenGreeting) {
      setShowGreeting(false);
      setIsFirstLaunch(false);
    }
  }, []);

  const handleContinue = () => {
    localStorage.setItem('neda-has-seen-greeting', 'true');
    setShowGreeting(false);
  };

  return (
    <AppProvider>
      <div className="min-h-screen">
        {showGreeting && isFirstLaunch ? (
          <BirthdayGreeting onContinue={handleContinue} />
        ) : (
          <MainApp />
        )}
      </div>
    </AppProvider>
  );
};

export default App;
