import { createContext, useContext, useReducer, useMemo } from 'react';

export const ACHIEVEMENT_DEFS = [
  {
    id: 'first-contact',
    title: 'First Contact',
    description: 'Log your first satellite, constellation, or asteroid observation.',
    icon: '🔭',
    requirement: 'Log any overhead object'
  },
  {
    id: 'space-explorer',
    title: 'Space Explorer',
    description: 'Observe a habitable space station (ISS or Tiangong) in orbit.',
    icon: '🛸',
    requirement: 'Observe ISS or Tiangong'
  },
  {
    id: 'constellation-guide',
    title: 'Constellation Guide',
    description: 'Map out the stars of a visible constellation.',
    icon: '🌌',
    requirement: 'Log any constellation'
  },
  {
    id: 'asteroid-hazard',
    title: 'Asteroid Hazard',
    description: 'Spot a Near-Earth Asteroid passing near Earth.',
    icon: '☄️',
    requirement: 'Log any asteroid'
  },
  {
    id: 'deflector',
    title: 'Deflector',
    description: 'Spot a Potentially Hazardous Asteroid (PHA).',
    icon: '⚠️',
    requirement: 'Log a hazardous asteroid'
  },
  {
    id: 'midnight-watch',
    title: 'Midnight Watch',
    description: 'Track an object during the quiet hours of midnight (12:00 AM - 4:00 AM).',
    icon: '🦉',
    requirement: 'Log between 00:00 and 04:00 local time'
  },
  {
    id: 'globe-trotter',
    title: 'Globe Trotter',
    description: 'Observe the skies from two or more distinct locations.',
    icon: '🌎',
    requirement: 'Log from 2+ observer locations'
  },
  {
    id: 'veteran-spotter',
    title: 'Veteran Spotter',
    description: 'Build your observation journal with 5 or more logs.',
    icon: '🚀',
    requirement: 'Log 5+ total observations'
  }
];

// Load observed log from localStorage
const loadObservedLog = () => {
  try {
    const saved = localStorage.getItem('orbitwatch_observed_log');
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.error('Failed to load observed log:', e);
    return [];
  }
};

// Load unlocked achievements from localStorage
const loadUnlockedAchievements = () => {
  try {
    const saved = localStorage.getItem('orbitwatch_unlocked_achievements');
    return saved ? JSON.parse(saved) : {};
  } catch (e) {
    console.error('Failed to load unlocked achievements:', e);
    return {};
  }
};

export function checkNewAchievements(allLogs, newLog) {
  const unlocked = {};
  const hasLog = (filterFn) => allLogs.some(filterFn);

  // 1. First Contact
  if (allLogs.length > 0) {
    unlocked['first-contact'] = true;
  }

  // 2. Space Explorer
  if (hasLog(l => l.type === 'satellite' && (l.targetId === '25544' || l.targetId === '48274' || l.name.toLowerCase().includes('iss') || l.name.toLowerCase().includes('tiangong')))) {
    unlocked['space-explorer'] = true;
  }

  // 3. Constellation Guide
  if (hasLog(l => l.type === 'constellation')) {
    unlocked['constellation-guide'] = true;
  }

  // 4. Asteroid Hazard
  if (hasLog(l => l.type === 'asteroid')) {
    unlocked['asteroid-hazard'] = true;
  }

  // 5. Deflector
  if (hasLog(l => l.type === 'asteroid' && l.isHazardous)) {
    unlocked['deflector'] = true;
  }

  // 6. Midnight Watch
  if (hasLog(l => {
    const date = new Date(l.timestamp);
    const hours = date.getHours();
    return hours >= 0 && hours < 4;
  })) {
    unlocked['midnight-watch'] = true;
  }

  // 7. Globe Trotter
  const uniqueLocations = new Set(allLogs.map(l => l.locationName?.trim()).filter(Boolean));
  if (uniqueLocations.size >= 2) {
    unlocked['globe-trotter'] = true;
  }

  // 8. Veteran Spotter
  if (allLogs.length >= 5) {
    unlocked['veteran-spotter'] = true;
  }

  return unlocked;
}

// Always dark mode — apply once on load
(() => {
  try {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.classList.remove('light');
    localStorage.removeItem('orbitwatch_theme');
  } catch (_) {}
})();

/** ─── Initial State ─────────────────────────────────────────────────────── */
const initialState = {
  // Location
  location: null,          // { lat, lon, name, country }
  locationName: '',

  // ISS
  issPosition: null,       // { lat, lon, timestamp }
  issTrail: [],            // Last 20 positions for trail

  // Satellites
  satellites: [],          // Array of satellite objects
  selectedSatellite: null, // Currently selected satellite

  // Passes
  issNextPasses: [],       // Next ISS passes for observer
  satellitePasses: {},     // { satId: [passes] }

  // Astronomy
  nightSkyData: null,      // Planets, stars
  moonPhase: null,         // Moon phase info

  // UI State
  isLoading: false,
  loadingMessage: '',
  error: null,
  activeView: 'map',       // 'map' | 'report' | 'lookup' | 'journal'
  showConeOverlay: true,
  satelliteFilter: 'major', // 'major' | 'all' | 'tv' | 'gps' | 'comms' | 'weather' | 'space-station' | 'debris' | 'earth-obs'
  viewMode: 'satellites',   // 'satellites' | 'constellations' | 'asteroids'
  selectedConstellation: null, // Currently selected constellation
  asteroids: [],            // Array of asteroid objects
  selectedAsteroid: null,   // Currently selected asteroid
  asteroidFilter: 'all',    // 'all' | 'phas' | 'close'
  showDebrisHeatmap: false,

  // Spotting Log & Achievements Gamification
  observedLog: loadObservedLog(),
  unlockedAchievements: loadUnlockedAchievements(),
  newUnlockedAchievements: [], // Achievements queue for modal/toast celebrations

  // NASA APOD Cache
  apodData: null,
  showMapDetailCard: false,
};

/** ─── Reducer ───────────────────────────────────────────────────────────── */
function appReducer(state, action) {
  switch (action.type) {
    case 'SET_LOCATION':
      return { ...state, location: action.payload, issTrail: [], selectedSatellite: null, selectedConstellation: null, selectedAsteroid: null };

    case 'SET_LOCATION_NAME':
      return { ...state, locationName: action.payload };

    case 'SET_ISS_POSITION': {
      const pos = action.payload;
      const trail = [...state.issTrail, pos].slice(-30); // keep last 30 positions
      return { ...state, issPosition: pos, issTrail: trail };
    }

    case 'SET_SATELLITES':
      return { ...state, satellites: action.payload };

    case 'SELECT_SATELLITE':
      return { ...state, selectedSatellite: action.payload, selectedConstellation: null, selectedAsteroid: null, activeView: action.payload ? 'lookup' : state.activeView, showMapDetailCard: action.payload ? true : false };

    case 'SET_ISS_PASSES':
      return { ...state, issNextPasses: action.payload };

    case 'SET_SAT_PASSES':
      return { ...state, satellitePasses: { ...state.satellitePasses, [action.satId]: action.payload } };

    case 'SET_NIGHT_SKY':
      return { ...state, nightSkyData: action.payload };

    case 'SET_MOON_PHASE':
      return { ...state, moonPhase: action.payload };

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload, loadingMessage: action.message || '' };

    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };

    case 'CLEAR_ERROR':
      return { ...state, error: null };

    case 'SET_ACTIVE_VIEW':
      return { ...state, activeView: action.payload };

    case 'TOGGLE_CONE_OVERLAY':
      return { ...state, showConeOverlay: !state.showConeOverlay };

    case 'SET_SATELLITE_FILTER':
      return { ...state, satelliteFilter: action.payload };

    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload, selectedSatellite: null, selectedConstellation: null, selectedAsteroid: null };

    case 'SELECT_CONSTELLATION':
      return { ...state, selectedConstellation: action.payload, selectedSatellite: null, selectedAsteroid: null, activeView: action.payload ? 'lookup' : state.activeView, showMapDetailCard: action.payload ? true : false };

    case 'SET_ASTEROIDS':
      return { ...state, asteroids: action.payload };

    case 'SELECT_ASTEROID':
      return { ...state, selectedAsteroid: action.payload, selectedSatellite: null, selectedConstellation: null, activeView: action.payload ? 'lookup' : state.activeView, showMapDetailCard: action.payload ? true : false };

    case 'SET_ASTEROID_FILTER':
      return { ...state, asteroidFilter: action.payload };

    case 'LOG_OBSERVATION': {
      const newObs = action.payload;
      const updatedLog = [newObs, ...state.observedLog];
      localStorage.setItem('orbitwatch_observed_log', JSON.stringify(updatedLog));

      // Calculate achievements
      const allUnlocked = checkNewAchievements(updatedLog, newObs);
      const newlyUnlocked = [];
      const newUnlockedState = { ...state.unlockedAchievements };

      Object.keys(allUnlocked).forEach(key => {
        if (!state.unlockedAchievements[key]) {
          const timestamp = new Date().toISOString();
          newUnlockedState[key] = timestamp;
          newlyUnlocked.push(key);
        }
      });

      if (newlyUnlocked.length > 0) {
        localStorage.setItem('orbitwatch_unlocked_achievements', JSON.stringify(newUnlockedState));
      }

      return {
        ...state,
        observedLog: updatedLog,
        unlockedAchievements: newUnlockedState,
        newUnlockedAchievements: [...(state.newUnlockedAchievements || []), ...newlyUnlocked]
      };
    }

    case 'DELETE_OBSERVATION': {
      const id = action.payload;
      const updatedLog = state.observedLog.filter(l => l.id !== id);
      localStorage.setItem('orbitwatch_observed_log', JSON.stringify(updatedLog));
      return { ...state, observedLog: updatedLog };
    }

    case 'DISMISS_ACHIEVEMENT_TOAST':
      return { ...state, newUnlockedAchievements: [] };

    case 'SET_SHOW_MAP_DETAIL_CARD':
      return { ...state, showMapDetailCard: action.payload };

    case 'TOGGLE_DEBRIS_HEATMAP':
      return { ...state, showDebrisHeatmap: !state.showDebrisHeatmap };

    case 'SET_APOD_DATA':
      return { ...state, apodData: action.payload };

    case 'RESET':
      return { ...initialState };

    default:
      return state;
  }
}

/** ─── Context ───────────────────────────────────────────────────────────── */
const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Convenience action creators (memoized to prevent infinite render loops)
  const actions = useMemo(() => ({
    setLocation: (location) => dispatch({ type: 'SET_LOCATION', payload: location }),
    setLocationName: (name) => dispatch({ type: 'SET_LOCATION_NAME', payload: name }),
    setISSPosition: (pos) => dispatch({ type: 'SET_ISS_POSITION', payload: pos }),
    setSatellites: (sats) => dispatch({ type: 'SET_SATELLITES', payload: sats }),
    selectSatellite: (sat) => dispatch({ type: 'SELECT_SATELLITE', payload: sat }),
    setISSPasses: (passes) => dispatch({ type: 'SET_ISS_PASSES', payload: passes }),
    setSatPasses: (satId, passes) => dispatch({ type: 'SET_SAT_PASSES', satId, payload: passes }),
    setNightSky: (data) => dispatch({ type: 'SET_NIGHT_SKY', payload: data }),
    setMoonPhase: (data) => dispatch({ type: 'SET_MOON_PHASE', payload: data }),
    setLoading: (v, msg) => dispatch({ type: 'SET_LOADING', payload: v, message: msg }),
    setError: (e) => dispatch({ type: 'SET_ERROR', payload: e }),
    clearError: () => dispatch({ type: 'CLEAR_ERROR' }),
    setActiveView: (v) => dispatch({ type: 'SET_ACTIVE_VIEW', payload: v }),
    toggleConeOverlay: () => dispatch({ type: 'TOGGLE_CONE_OVERLAY' }),
    setSatelliteFilter: (filter) => dispatch({ type: 'SET_SATELLITE_FILTER', payload: filter }),
    setViewMode: (mode) => dispatch({ type: 'SET_VIEW_MODE', payload: mode }),
    selectConstellation: (constell) => dispatch({ type: 'SELECT_CONSTELLATION', payload: constell }),
    setAsteroids: (asteroids) => dispatch({ type: 'SET_ASTEROIDS', payload: asteroids }),
    selectAsteroid: (asteroid) => dispatch({ type: 'SELECT_ASTEROID', payload: asteroid }),
    setAsteroidFilter: (filter) => dispatch({ type: 'SET_ASTEROID_FILTER', payload: filter }),
    logObservation: (obs) => dispatch({ type: 'LOG_OBSERVATION', payload: obs }),
    deleteObservation: (id) => dispatch({ type: 'DELETE_OBSERVATION', payload: id }),
    dismissAchievementToast: () => dispatch({ type: 'DISMISS_ACHIEVEMENT_TOAST' }),
    setShowMapDetailCard: (v) => dispatch({ type: 'SET_SHOW_MAP_DETAIL_CARD', payload: v }),
    toggleDebrisHeatmap: () => dispatch({ type: 'TOGGLE_DEBRIS_HEATMAP' }),
    setApodData: (data) => dispatch({ type: 'SET_APOD_DATA', payload: data }),
    reset: () => dispatch({ type: 'RESET' }),
  }), [dispatch]);

  return (
    <AppContext.Provider value={{ state, actions }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
