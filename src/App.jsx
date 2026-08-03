import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Satellite } from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import LandingPage from './components/LandingPage/LandingPage.jsx';
import Dashboard from './components/Dashboard/Dashboard.jsx';
import DebrisDashboard from './components/Dashboard/DebrisDashboard.jsx';
import AuthPage from './components/Auth/AuthPage.jsx';
import OnboardingBriefing from './components/Onboarding/OnboardingBriefing.jsx';
import AboutUs from './components/AboutUs.jsx';
import LoadingScreen from './components/LoadingScreen/LoadingScreen.jsx';

function AppInner() {
  const { user, loading, showAuthModal, setShowAuthModal } = useAuth();
  const { state } = useApp();
  const [appState, setAppState] = useState('landing'); // 'landing' | 'dashboard' | 'debris-dashboard' | 'about'
  const [showBriefing, setShowBriefing] = useState(false);

  // Route depending on user briefing status
  const handleLocationSet = () => {
    const landingMode = localStorage.getItem('orbitwatch_landing_mode');
    const isBriefed = localStorage.getItem('orbitwatch_briefed') === 'true';
    if (landingMode === 'debris') {
      setAppState('debris-dashboard');
    } else {
      setAppState('dashboard');
      if (!isBriefed) {
        setShowBriefing(true);
      }
    }
  };

  const handleBriefingComplete = () => {
    localStorage.setItem('orbitwatch_briefed', 'true');
    setShowBriefing(false);
  };

  const handleReset = () => {
    setAppState('landing');
    setShowBriefing(false);
  };

  // Sync state if location is cleared externally
  useEffect(() => {
    if (!state.location && (appState === 'dashboard' || appState === 'debris-dashboard')) {
      setAppState('landing');
      setShowBriefing(false);
    }
  }, [state.location, appState]);

  // Firebase is resolving the persisted session — show a minimal splash
  if (loading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4"
        style={{ background: '#070a12' }}>
        <div className="flex items-center gap-3">
          <Satellite className="w-6 h-6 text-cyan animate-pulse" />
          <span className="font-playfair font-bold text-xl text-white">
            Project <span className="text-cyan">Zenith</span>
          </span>
        </div>
        <Loader2 className="w-5 h-5 text-cyan/50 animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-transparent">
      <AnimatePresence mode="wait">
        {appState === 'landing' && (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.5 }}
            className="w-full h-full"
          >
            <LandingPage 
              onLocationSet={handleLocationSet} 
              onNavigateAbout={() => setAppState('about')}
            />
          </motion.div>
        )}
        {appState === 'dashboard' && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className={`w-full h-full ${showBriefing ? 'hidden pointer-events-none' : ''}`}
          >
            <Dashboard onReset={handleReset} />
          </motion.div>
        )}
        {appState === 'debris-dashboard' && (
          <motion.div
            key="debris-dashboard"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full h-full"
          >
            <DebrisDashboard onReset={handleReset} />
          </motion.div>
        )}
        {appState === 'about' && (
          <motion.div
            key="about"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full h-full overflow-y-auto"
          >
            <AboutUs onBack={() => setAppState('landing')} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cinematic Onboarding Briefing Overlay */}
      <AnimatePresence>
        {showBriefing && (
          <motion.div
            key="briefing-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0"
            style={{ zIndex: 9990 }}
          >
            <OnboardingBriefing 
              observerLocation={state.location}
              onComplete={handleBriefingComplete} 
            />
          </motion.div>
        )}
      </AnimatePresence>
      {/* Global Auth Modal Overlay */}
      <AnimatePresence>
        {showAuthModal && (
          <motion.div
            key="auth-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ zIndex: 9999 }}
            className="fixed inset-0"
          >
            <AuthPage isModal={true} onClose={() => setShowAuthModal(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  const [loadingDone, setLoadingDone] = useState(false);

  return (
    <AuthProvider>
      <AppProvider>
        {/* Loading screen gates everything until assets are ready */}
        {!loadingDone && (
          <LoadingScreen onComplete={() => setLoadingDone(true)} />
        )}
        {loadingDone && (
          <AnimatePresence mode="wait">
            <AppInner />
          </AnimatePresence>
        )}
      </AppProvider>
    </AuthProvider>
  );
}
