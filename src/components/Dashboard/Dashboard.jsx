import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp, ACHIEVEMENT_DEFS } from '../../context/AppContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useISSTracker } from '../../hooks/useISSTracker.js';
import { useSatellites } from '../../hooks/useSatellites.js';
import { usePassPredictions } from '../../hooks/usePassPredictions.js';
import { useAsteroids } from '../../hooks/useAsteroids.js';
import GlobeMap from './GlobeMap.jsx';
import Globe3D from './Globe3D.jsx';
import SatellitePanel from './SatellitePanel.jsx';
import PassCountdown from '../PassCountdown/PassCountdown.jsx';
import LookUpCard from '../LookUpCard/LookUpCard.jsx';
import NightReport from '../NightReport/NightReport.jsx';
import LocationSearch from '../LandingPage/LocationSearch.jsx';
import JournalPanel from '../JournalPanel/JournalPanel.jsx';
import DiagnosticsPanel from './DiagnosticsPanel.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import AIAssistant from './AIAssistant.jsx';
import SatelliteBattles from '../../features/satellite-battles/SatelliteBattles.jsx';
import HazardsPanel from '../HazardsPanel/HazardsPanel.jsx';
import { CONSTELLATIONS, getLocalCoordinates } from '../../data/constellations.js';
import {
  Map, List, Star, Compass, Radio, RotateCcw,
  Eye, EyeOff, Satellite, Settings, ChevronLeft, ChevronRight, Globe, Trophy, Activity, Flame, Moon, Zap, LogOut, X, ShieldAlert
} from 'lucide-react';

/** User avatar + sign-out dropdown shown in the top navigation bar */
function UserAvatar() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!user) return null;

  const initials = (user.displayName || user.email || '?')
    .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        id="user-avatar-btn"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 rounded-full focus:outline-none transition-all"
        style={{ padding: '2px' }}
        title={user.displayName || user.email}
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt="avatar"
            className="w-7 h-7 rounded-full object-cover ring-2"
            style={{ ringColor: open ? 'rgba(77,141,255,0.8)' : 'rgba(77,141,255,0.3)', border: open ? '2px solid rgba(77,141,255,0.7)' : '2px solid rgba(255,255,255,0.12)' }}
          />
        ) : (
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold font-sans"
            style={{
              background: 'linear-gradient(135deg, #4d8dff 0%, #6b6fd6 100%)',
              border: open ? '2px solid rgba(77,141,255,0.7)' : '2px solid rgba(255,255,255,0.12)',
              color: '#fff',
            }}
          >
            {initials}
          </div>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id="user-dropdown"
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-10 z-[2000] min-w-[220px] rounded-xl overflow-hidden"
            style={{
              background: 'rgba(10,14,22,0.96)',
              border: '1px solid rgba(255,255,255,0.1)',
              backdropFilter: 'blur(24px)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            {/* User info */}
            <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[13px] font-semibold font-sans text-white truncate">
                {user.displayName || 'Operator'}
              </p>
              <p className="text-[11px] font-sans text-muted truncate mt-0.5">{user.email}</p>
            </div>
            {/* Sign out */}
            <button
              id="sign-out-btn"
              onClick={async () => { setOpen(false); await signOut(); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-sans font-medium transition-colors focus:outline-none"
              style={{ color: 'rgba(255,255,255,0.55)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(224,88,79,0.08)'; e.currentTarget.style.color = '#f87171'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; }}
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const MOBILE_VIEWS = [
  { id: 'map', label: 'Map', icon: Map },
  { id: 'satellites', label: 'Objects', icon: Satellite },
  { id: 'battles', label: 'Battles', icon: Flame },
  { id: 'hazards', label: 'Hazards', icon: ShieldAlert },
  { id: 'lookup', label: 'Look Up', icon: Compass },
  { id: 'report', label: 'Tonight', icon: Star },
  { id: 'journal', label: 'Journal', icon: Trophy },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const NAV_ITEMS = [
  { id: 'objects', label: 'Objects', icon: Satellite },
  { id: 'countdown', label: 'Telemetry', icon: Radio },
  { id: 'battles', label: 'Battles', icon: Flame },
  { id: 'lookup', label: 'Look Up', icon: Compass },
  { id: 'report', label: 'Tonight', icon: Star },
  { id: 'journal', label: 'Journal', icon: Trophy },
];

const TONIGHT_SUB_ITEMS = [
  { id: 'satellites', label: 'Satellites', icon: Satellite },
  { id: 'planets', label: 'Planets', icon: Star },
  { id: 'moon', label: 'Moon', icon: Moon },
  { id: 'meteors', label: 'Meteors', icon: Zap },
];

const SECONDARY_ITEMS = [
  { id: 'diagnostics', label: 'Diagnostics', icon: Activity },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const RIGHT_PANEL_HEADERS = {
  objects: { label: "Overhead Objects", icon: Satellite },
  countdown: { label: "Next ISS Pass", icon: Radio },
  battles: { label: "Satellite Battles", icon: Flame },
  hazards: { label: "Space Hazards", icon: ShieldAlert },
  lookup: { label: "Look Up Tracker", icon: Compass },
  report: { label: "Tonight's Sky", icon: Star },
  journal: { label: "Observer Journal", icon: Trophy },
  diagnostics: { label: "System Diagnostics", icon: Activity },
  settings: { label: "Settings", icon: Settings },
};

/**
 * Dashboard — Main layout after location is selected.
 * Desktop: 3-column layout (sidebar | map | right panel)
 * Mobile: tab-based stacked layout
 */
export default function Dashboard({ onReset }) {
  const { state, actions } = useApp();
  const {
    location,
    issPosition,
    satellites,
    selectedSatellite,
    showConeOverlay,
    newUnlockedAchievements,
    viewMode,
    satelliteFilter,
    asteroidFilter,
    asteroids,
    selectedConstellation,
    selectedAsteroid,
    issNextPasses = []
  } = state;

  const overheadCount = useMemo(() => {
    return satellites.filter(sat => {
      if (satelliteFilter === 'all') return true;
      if (satelliteFilter === 'major') {
        return sat.type === 'space-station' || sat.type === 'weather' || sat.type === 'earth-obs' || sat.type === 'gps';
      }
      return sat.type === satelliteFilter;
    }).length;
  }, [satellites, satelliteFilter]);

  // Activate all data hooks
  useISSTracker(!!location);
  useSatellites();
  usePassPredictions();
  useAsteroids();

  const [mobileView, setMobileView] = useState('map');
  const [activeNav, setActiveNav] = useState(() => {
    const saved = localStorage.getItem('orbitwatch_active_nav');
    return saved || 'objects';
  });
  const [rightPanel, setRightPanel] = useState('objects');
  const [showSearch, setShowSearch] = useState(false);
  const [is3DMode, setIs3DMode] = useState(false);

  const handleMobileViewChange = (id) => {
    if (id === 'battles') {
      setMobileView('map');
      setActiveNav('battles');
      localStorage.setItem('orbitwatch_active_nav', 'battles');
      return;
    }

    setMobileView(id);
    let navId = id;
    if (id === 'satellites') navId = 'objects';
    else if (id === 'report') navId = 'report';
    else if (id === 'lookup') navId = 'lookup';
    else if (id === 'journal') navId = 'journal';
    else if (id === 'diagnostics') navId = 'diagnostics';
    else if (id === 'settings') navId = 'settings';
    else if (id === 'hazards') navId = 'hazards';
    else if (id === 'map') navId = 'objects';

    setActiveNav(navId);
    localStorage.setItem('orbitwatch_active_nav', navId);
  };

  const isTabActive = (id) => {
    if (id === 'map') {
      return mobileView === 'map' && activeNav !== 'battles';
    }
    if (id === 'battles') {
      return mobileView === 'map' && activeNav === 'battles';
    }
    return mobileView === id;
  };

  useEffect(() => {
    if (activeNav === 'battles') {
      setIs3DMode(true);
    } else {
      setIs3DMode(false);
    }
  }, [activeNav]);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('orbitwatch_nav_collapsed');
    return saved === null ? false : saved === 'true';
  });

  const [tonightSubItem, setTonightSubItem] = useState(() => {
    const saved = localStorage.getItem('orbitwatch_tonight_sub_item');
    return saved || 'satellites';
  });

  const [isTonightOpen, setIsTonightOpen] = useState(() => {
    const saved = localStorage.getItem('orbitwatch_tonight_open');
    return saved === 'true' || saved === null;
  });

  const [showTonightFlyout, setShowTonightFlyout] = useState(false);

  const [timeState, setTimeState] = useState({
    localTime: '',
    localZone: '',
    obsTime: '',
    obsZone: ''
  });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      
      // Local time and zone
      const lTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      const localOffsetMin = -now.getTimezoneOffset();
      const localOffsetHrs = localOffsetMin / 60;
      const localOffsetSign = localOffsetHrs >= 0 ? '+' : '';
      const lZone = `UTC${localOffsetSign}${localOffsetHrs.toFixed(1).replace('.0', '')}`;
      
      // Observer time and zone based on longitude
      let oTime = '--:--:--';
      let oZone = 'UTC+0';
      if (location) {
        const offsetHours = location.lon / 15;
        const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
        const obsDate = new Date(utcTime + (3600000 * offsetHours));
        oTime = obsDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        
        const obsOffsetSign = offsetHours >= 0 ? '+' : '';
        oZone = `UTC${obsOffsetSign}${offsetHours.toFixed(1).replace('.0', '')}`;
      }
      
      setTimeState({
        localTime: lTime,
        localZone: lZone,
        obsTime: oTime,
        obsZone: oZone
      });
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [location]);

  const toggleCollapsed = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('orbitwatch_nav_collapsed', String(next));
      return next;
    });
  };

  const [rightPanelOpen, setRightPanelOpen] = useState(() => {
    const saved = localStorage.getItem('orbitwatch_right_panel_open');
    return saved === null ? true : saved === 'true';
  });

  const toggleRightPanel = () => {
    setRightPanelOpen(prev => {
      const next = !prev;
      localStorage.setItem('orbitwatch_right_panel_open', String(next));
      return next;
    });
  };

  const [isChatOpen, setIsChatOpen] = useState(() => localStorage.getItem('orbitwatch_chat_open') === 'true');

  useEffect(() => {
    const handleChatToggle = () => {
      setIsChatOpen(localStorage.getItem('orbitwatch_chat_open') === 'true');
    };
    window.addEventListener('orbitwatch-chat-toggle', handleChatToggle);
    return () => window.removeEventListener('orbitwatch-chat-toggle', handleChatToggle);
  }, []);

  const [showChrome, setShowChrome] = useState(true);
  const [isNavMenuOpen, setIsNavMenuOpen] = useState(false);
  const chromeTimeoutRef = useRef(null);

  const resetChromeTimer = useCallback(() => {
    setShowChrome(true);
  }, []);

  useEffect(() => {
    setShowChrome(true);
  }, []);

  const handleNavClick = (itemId) => {
    if (itemId === 'report') {
      setIsTonightOpen(prev => {
        const next = !prev;
        localStorage.setItem('orbitwatch_tonight_open', String(next));
        return next;
      });
      setActiveNav('report');
      localStorage.setItem('orbitwatch_active_nav', 'report');
    } else {
      setActiveNav(itemId);
      localStorage.setItem('orbitwatch_active_nav', itemId);
      setIsTonightOpen(false);
      localStorage.setItem('orbitwatch_tonight_open', 'false');
    }

    setRightPanelOpen(true);

    // Clear any selected items when switching categories
    if (selectedSatellite) actions.selectSatellite(null);
    if (selectedConstellation) actions.selectConstellation(null);
    if (selectedAsteroid) actions.selectAsteroid(null);
  };

  const handleSubItemClick = (subId) => {
    setActiveNav('report');
    localStorage.setItem('orbitwatch_active_nav', 'report');
    setTonightSubItem(subId);
    localStorage.setItem('orbitwatch_tonight_sub_item', subId);
    setIsTonightOpen(true);
    localStorage.setItem('orbitwatch_tonight_open', 'true');

    setRightPanelOpen(true);

    // Clear any selected items
    if (selectedSatellite) actions.selectSatellite(null);
    if (selectedConstellation) actions.selectConstellation(null);
    if (selectedAsteroid) actions.selectAsteroid(null);
  };

  const hasSelectedObject = !!(selectedSatellite || selectedConstellation || selectedAsteroid);

  // Sync rightPanel based on selection state and activeNav
  useEffect(() => {
    if (hasSelectedObject) {
      if (activeNav === 'hazards') {
        setRightPanel('hazards');
      } else {
        setRightPanel('lookup');
        setRightPanelOpen(true);
      }
    } else {
      setRightPanel(activeNav);
    }
  }, [hasSelectedObject, activeNav]);

  // For mobile: auto-transition view to lookup details when an object is selected
  useEffect(() => {
    if (hasSelectedObject && activeNav !== 'hazards') {
      setMobileView('lookup');
    }
  }, [hasSelectedObject, activeNav]);

  // Compute active count for the objects panel header dynamically
  const objectsCount = useMemo(() => {
    if (viewMode === 'constellations') {
      if (!location) return 0;
      const now = Date.now();
      return CONSTELLATIONS.filter(c => {
        const coords = getLocalCoordinates(c.ra, c.dec, location.lat, location.lon, now);
        return coords.el > 0;
      }).length;
    } else if (viewMode === 'asteroids') {
      return asteroids.filter(ast => {
        if (asteroidFilter === 'phas') return ast.is_potentially_hazardous;
        if (asteroidFilter === 'close') {
          const timeDiff = Math.abs(Date.now() - ast.close_approach_timestamp);
          return timeDiff < 24 * 3600 * 1000;
        }
        return true;
      }).length;
    } else {
      return satellites.filter(sat => {
        if (satelliteFilter === 'all') return true;
        if (satelliteFilter === 'major') {
          return sat.type === 'space-station' || sat.type === 'weather' || sat.type === 'earth-obs' || sat.type === 'gps';
        }
        return sat.type === satelliteFilter;
      }).length;
    }
  }, [viewMode, location, asteroids, asteroidFilter, satellites, satelliteFilter]);

  // Dynamic header details based on viewMode
  const getHeaderInfo = () => {
    if (rightPanel === 'objects') {
      if (viewMode === 'constellations') {
        return { label: "Visible Constellations", icon: Star, badgeClass: "badge-cyan" };
      }
      if (viewMode === 'asteroids') {
        return { label: "Near-Earth Asteroids", icon: Flame, badgeClass: "badge-red" };
      }
      return { label: "Overhead Objects", icon: Satellite, badgeClass: "badge-cyan" };
    }
    const info = RIGHT_PANEL_HEADERS[rightPanel] || RIGHT_PANEL_HEADERS.countdown;
    return { ...info, badgeClass: "badge-cyan" };
  };

  function handleNewLocation(loc) {
    actions.setLocation(loc);
    actions.setLocationName(loc.name);
    setShowSearch(false);
  }



  return (
    <div className="flex h-[100dvh] lg:h-screen w-screen bg-space overflow-hidden select-none text-text">
      {/* ── Collapsible Left Navigation Rail (Desktop Only) ── */}
      <aside 
        className={`hidden lg:flex flex-col h-full bg-surface transition-all duration-200 ease-in-out shrink-0 relative
          ${isCollapsed ? 'w-[72px]' : 'w-[240px]'}`}
      >
        {/* Header block at top */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08] h-[52px] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Satellite className="w-5 h-5 text-cyan shrink-0 animate-pulse" />
            {!isCollapsed && (
              <div className="flex flex-col min-w-0 transition-opacity duration-200">
                <span className="font-playfair italic text-[15px] font-bold text-text truncate leading-tight">OrbitWatch</span>
                <span className="text-[8px] font-sans uppercase tracking-[0.15em] text-muted truncate">Control Room</span>
              </div>
            )}
          </div>
          <button 
            onClick={toggleCollapsed} 
            className="p-1 rounded border border-border bg-panel/30 hover:bg-panel-light text-muted hover:text-text transition-all"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Nav List */}
        <nav className="flex-1 py-4 space-y-1.5 px-3 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            const isTonight = item.id === 'report';
            const Chevron = ChevronRight;

            return (
              <div key={item.id} className="space-y-1 relative">
                <button
                  onClick={() => {
                    if (isCollapsed && isTonight) {
                      setShowTonightFlyout(prev => !prev);
                    } else {
                      handleNavClick(item.id);
                    }
                  }}
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center nav-tooltip gap-0' : 'justify-between'} p-2.5 rounded-md transition-all relative group
                    ${isActive 
                      ? 'bg-panel-light text-text-primary border-l-2 border-accent pl-[8px]' 
                      : 'text-text-secondary hover:text-text-primary hover:bg-panel-light/50 pl-[10px]'}`}
                  style={{ borderLeftStyle: isActive ? 'solid' : 'none' }}
                  data-tooltip={isCollapsed ? item.label : undefined}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-accent' : 'text-text-secondary group-hover:text-text-primary'}`} />
                    {!isCollapsed && (
                      <span 
                        className={`font-sans text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-all duration-200 ease-in-out
                          ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'}`}
                      >
                        {item.label}
                      </span>
                    )}
                  </div>
                  {isTonight && !isCollapsed && (
                    <Chevron className={`w-3.5 h-3.5 text-muted transition-transform duration-200 ${isTonightOpen ? 'rotate-90' : ''}`} />
                  )}
                </button>

                {/* Inline sub-items under TONIGHT (expanded sidebar only) */}
                {isTonight && !isCollapsed && (
                  <AnimatePresence initial={false}>
                    {isTonightOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden pl-4 space-y-1"
                      >
                        {TONIGHT_SUB_ITEMS.map((sub) => {
                          const SubIcon = sub.icon;
                          const isSubActive = activeNav === 'report' && tonightSubItem === sub.id;
                          return (
                            <button
                              key={sub.id}
                              onClick={() => handleSubItemClick(sub.id)}
                              className={`w-full flex items-center gap-2.5 p-2 rounded transition-all text-left group
                                ${isSubActive
                                  ? 'bg-panel-light/60 text-accent font-bold'
                                  : 'text-text-secondary hover:text-text-primary hover:bg-panel-light/30'}`}
                            >
                              <SubIcon className={`w-3.5 h-3.5 shrink-0 transition-colors ${isSubActive ? 'text-accent' : 'text-text-secondary group-hover:text-text-primary'}`} />
                              <span className="font-sans text-[10px] uppercase tracking-wider font-semibold">
                                {sub.label}
                              </span>
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}

                {/* Flyout sub-items under TONIGHT (collapsed sidebar only) */}
                {isTonight && isCollapsed && showTonightFlyout && (
                  <>
                    <div className="fixed inset-0 z-[1001]" onClick={() => setShowTonightFlyout(false)} />
                    <div 
                      className="absolute left-[56px] top-0 bg-surface border border-surface-border rounded-lg shadow-xl py-2 px-1.5 z-[1002] w-48 font-sans flex flex-col gap-1 select-none animate-in fade-in zoom-in-95 duration-150"
                    >
                      <div className="px-2.5 py-1 text-[9px] font-sans font-bold uppercase tracking-wider text-muted border-b border-surface-border/50 mb-1">
                        Tonight's Sky
                      </div>
                      {TONIGHT_SUB_ITEMS.map((sub) => {
                        const SubIcon = sub.icon;
                        const isSubActive = activeNav === 'report' && tonightSubItem === sub.id;
                        return (
                          <button
                            key={sub.id}
                            onClick={() => {
                              handleSubItemClick(sub.id);
                              setShowTonightFlyout(false);
                            }}
                            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-left transition-all
                              ${isSubActive 
                                ? 'bg-panel-light text-accent' 
                                : 'text-text-secondary hover:text-text-primary hover:bg-panel-light/40'}`}
                          >
                            <SubIcon className={`w-3.5 h-3.5 ${isSubActive ? 'text-accent' : 'text-text-secondary'}`} />
                            <span className="text-[10px] font-sans uppercase tracking-wider font-semibold">
                              {sub.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </nav>

        {/* Dominant white pill button */}
        <div className="px-3 py-2 shrink-0">
          {isCollapsed ? (
            <button
              onClick={onReset}
              className="w-10 h-10 mx-auto rounded-full bg-white text-[var(--bg)] flex items-center justify-center hover:opacity-90 transition-all shadow-sm nav-tooltip gap-0"
              data-tooltip="Reset Session"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onReset}
              className="w-full py-2.5 rounded-full bg-white text-[var(--bg)] text-[10px] font-sans font-bold uppercase tracking-wider hover:opacity-90 transition-all shadow-sm flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Session</span>
            </button>
          )}
        </div>

        {/* Separator */}
        <div className="border-t border-white/[0.08] my-2 mx-3 shrink-0" />

        {/* Bottom anchored diagnostics/settings links */}
        <div className="space-y-1 px-3 pb-4 shrink-0">
          {SECONDARY_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'diagnostics') {
                    handleNavClick('diagnostics');
                    setRightPanelOpen(true);
                  } else if (item.id === 'settings') {
                    handleNavClick('settings');
                    setRightPanelOpen(true);
                  }
                }}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center nav-tooltip gap-0' : 'justify-start gap-2.5'} p-2 rounded transition-all group
                  ${isActive
                    ? 'bg-panel-light text-text-primary border-l-2 border-accent pl-[6px]'
                    : 'text-text-secondary hover:text-text-primary hover:bg-panel-light/35 pl-[8px]'}`}
                data-tooltip={isCollapsed ? item.label : undefined}
                style={{ borderLeftStyle: isActive ? 'solid' : 'none' }}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 transition-colors ${isActive ? 'text-accent' : 'text-text-secondary group-hover:text-text-primary opacity-70 group-hover:opacity-100'}`} />
                <span
                  className={`font-sans text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap transition-all duration-200 ease-in-out
                    ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'}`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── Main Application Container (Header + Content) ── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* ── Top Navigation Bar ── */}
        <header 
          className={`lg:relative absolute top-0 left-0 right-0 z-[2000] flex items-center gap-3 px-4 py-2.5 shrink-0 bg-gradient-to-b from-[#0a0d1a]/85 via-[#0a0d1a]/30 to-transparent lg:bg-none lg:bg-panel lg:backdrop-blur-md border-b-0 lg:border-b lg:border-white/[0.08] transition-all duration-300 pointer-events-none lg:pointer-events-auto
            ${showChrome ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-12 pointer-events-none'}`}
        >
          {/* Logo (hidden on desktop) */}
          <div className="flex items-center gap-1.5 lg:hidden select-none pointer-events-none">
            <Satellite className="w-4 h-4 text-cyan animate-pulse" />
          </div>

          {/* Location display or inline header search */}
          <div className="pointer-events-auto shrink-0">
            {showSearch ? (
              <LocationSearch
                variant="header"
                onLocationSelect={handleNewLocation}
                onCancel={() => setShowSearch(false)}
              />
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg cursor-pointer hover:border-white/20 transition-colors glass-pill shrink-0"
                onClick={() => setShowSearch(true)}
                title="Click to search and change location"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-cyan animate-pulse shrink-0" />
                <span className="font-sans text-[10px] font-semibold text-text uppercase tracking-wider shrink-0 max-w-[200px] truncate">
                  {location?.name || 'No location'}
                </span>
                <span className="text-muted text-[9px] font-mono hidden md:block shrink-0">
                  {location ? `${location.lat.toFixed(2)}°, ${location.lon.toFixed(2)}°` : ''}
                </span>
              </div>
            )}
          </div>

          {/* ISS live indicator */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md glass-pill pointer-events-auto">
            <div className={`w-1.5 h-1.5 rounded-full ${issPosition ? 'bg-cyan animate-pulse' : 'bg-muted'}`} />
            <span className="font-sans text-[10px] font-semibold text-muted uppercase tracking-wider hidden sm:block">
              ISS {issPosition ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>

          {/* Centered Legend Pill */}
          <div className="flex-1 flex justify-center items-center px-2 pointer-events-none">
            <div className="glass-panel flex items-center gap-x-[8px] px-2 py-1 rounded-full bg-surface/90 backdrop-blur border border-surface-border shadow-md select-none shrink-0 pointer-events-auto">
              {/* Sats */}
              <div className="flex items-center gap-1 group relative cursor-pointer" title="Sats">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4d8dff] shadow-[0_0_3px_#4d8dff80] shrink-0" />
                <span className="hidden xl:inline text-[9px] font-sans font-bold text-text-secondary uppercase tracking-wider">
                  Sats
                </span>
              </div>
              
              {/* ISS */}
              <div className="flex items-center gap-1 group relative cursor-pointer" title="ISS">
                <span className="w-1.5 h-1.5 rounded-full bg-[#e0584f] shadow-[0_0_3px_#e0584f80] shrink-0" />
                <span className="hidden xl:inline text-[9px] font-sans font-bold text-text-secondary uppercase tracking-wider">
                  ISS
                </span>
              </div>

              {/* Starlink/Const */}
              <div className="flex items-center gap-1 group relative cursor-pointer" title="Starlink/Const">
                <span className="w-1.5 h-1.5 rounded-full bg-[#a06bd6] shadow-[0_0_3px_#a06bd680] shrink-0" />
                <span className="hidden xl:inline text-[9px] font-sans font-bold text-text-secondary uppercase tracking-wider">
                  Constell
                </span>
              </div>

              {/* Weather */}
              <div className="flex items-center gap-1 group relative cursor-pointer" title="Weather">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3fd6a0] shadow-[0_0_3px_#3fd6a080] shrink-0" />
                <span className="hidden xl:inline text-[9px] font-sans font-bold text-text-secondary uppercase tracking-wider">
                  Weather
                </span>
              </div>

              {/* Ground Stn */}
              <div className="flex items-center gap-1 group relative cursor-pointer" title="Ground Stn">
                <span className="w-1.5 h-1.5 rounded-full bg-[#e0a847] shadow-[0_0_3px_#e0a84780] shrink-0" />
                <span className="hidden xl:inline text-[9px] font-sans font-bold text-text-secondary uppercase tracking-wider">
                  Ground Stn
                </span>
              </div>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2 pointer-events-auto">
            {/* Control Clocks */}
            <div className="hidden md:flex items-center gap-3 mr-2 border-r border-white/[0.08] pr-3 select-none">
              <div className="flex flex-col items-end">
                <span className="text-[7px] font-sans text-muted uppercase tracking-wider font-bold">
                  LCL <span className="text-[6.5px] text-white/30">({timeState.localZone})</span>
                </span>
                <span className="font-mono text-[10.5px] font-bold text-text-primary tracking-wider tabular-nums mt-0.5">
                  {timeState.localTime || '--:--:--'}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[7px] font-sans text-muted uppercase tracking-wider font-bold">
                  OBS <span className="text-[6.5px] text-cyan/50">({timeState.obsZone})</span>
                </span>
                <span className="font-mono text-[10.5px] font-bold text-cyan tracking-wider tabular-nums mt-0.5">
                  {timeState.obsTime}
                </span>
              </div>
            </div>

            {/* Cone toggle */}
            <button
              onClick={actions.toggleConeOverlay}
              className={`hidden lg:inline-flex p-1.5 rounded-md border transition-all ${showConeOverlay ? 'border-cyan/40 text-cyan bg-cyan/5' : 'border-border text-muted'}`}
              title="Toggle visibility cones"
            >
              {showConeOverlay ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>

            {/* Overhead Now */}
            <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md glass-pill" title="Overhead Now">
              <Globe className="w-3 h-3 text-cyan" />
              <span className="font-mono text-xs text-cyan">{overheadCount}</span>
            </div>

            {/* Active Passes */}
            <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md glass-pill" title="Active Passes">
              <Radio className="w-3 h-3 text-cyan" />
              <span className="font-mono text-xs text-cyan">{issNextPasses?.length || 0}</span>
            </div>

            {/* Satellite count */}
            <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md glass-pill" title="Total Tracked">
              <Satellite className="w-3 h-3 text-cyan" />
              <span className="font-mono text-xs text-cyan">{satellites.length}</span>
            </div>

            {/* Reset */}
            <button
              onClick={onReset}
              className="hidden lg:inline-flex p-1.5 rounded-md border border-border text-muted hover:text-text hover:border-border-light transition-all"
              title="Reset to landing page"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* User avatar + sign-out dropdown */}
            <UserAvatar />
          </div>
        </header>

        {/* Location search dropdown (replaced by inline header input) */}

        {/* ── Main Content Area ── */}
        <div className="flex-1 flex overflow-hidden">
          {/* ── Center: Map / Battles ── */}
          <main className="flex-1 relative overflow-hidden">
            {activeNav === 'battles' ? (
              <SatelliteBattles 
                is3DMode={is3DMode} 
                onResetBattle={() => {
                  setActiveNav('objects');
                  localStorage.setItem('orbitwatch_active_nav', 'objects');
                  setMobileView('map');
                }}
              />
            ) : is3DMode ? (
              <Globe3D className="w-full h-full" mobileView={mobileView} showChrome={showChrome} />
            ) : (
              <GlobeMap className="w-full h-full" mobileView={mobileView} showChrome={showChrome} />
            )}

            {/* Right Sidebar Edge Handle Toggle */}
            {!isChatOpen && activeNav !== 'battles' && (
              <button
                onClick={toggleRightPanel}
                className="hidden lg:flex absolute right-0 top-1/2 -translate-y-1/2 z-[1000] w-8 h-20 bg-surface rounded-l-md items-center justify-center text-muted hover:text-text-primary transition-all shadow-md cursor-pointer group focus:outline-none border-0"
                title={rightPanelOpen ? "Collapse Sidebar Info" : "Expand Sidebar Info"}
              >
                <Compass className="w-4 h-4 text-text-secondary group-hover:text-text-primary transition-colors" />
              </button>
            )}

            {/* 3D Globe / 2D Map Toggle Button */}
            {!isChatOpen && (
              <button
                onClick={() => setIs3DMode(!is3DMode)}
                className={`absolute z-[1000] flex items-center gap-2 px-3 py-2 rounded-lg bg-panel border border-border text-cyan hover:border-border-light text-[11px] font-sans uppercase tracking-wider transition-all duration-300
                  lg:bottom-5 lg:right-5 lg:left-auto bottom-6 left-6 right-auto
                  ${showChrome ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12 pointer-events-none'}`}
                title={is3DMode ? 'Switch to flat map' : 'Switch to 3D globe'}
              >
                {is3DMode ? (
                  <>
                    <Map className="w-3.5 h-3.5" />
                    <span>View Flat Map</span>
                  </>
                ) : (
                  <>
                    <Globe className="w-3.5 h-3.5" />
                    <span>View on Globe</span>
                  </>
                )}
              </button>
            )}

            {/* Mobile: Single floating action button (FAB) for navigation */}
            <div className={`lg:hidden fixed bottom-6 right-6 z-[2010] transition-all duration-300 ${showChrome ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12 pointer-events-none'}`}>
              <button
                onClick={() => setIsNavMenuOpen(prev => !prev)}
                className="w-12 h-12 rounded-full flex items-center justify-center pointer-events-auto shadow-2xl relative border text-cyan bg-[#0f1626]/85 hover:bg-[#0f1626] border-cyan/40 backdrop-blur-[16px] active:scale-95 transition-all"
              >
                {isNavMenuOpen ? <X className="w-5 h-5 text-cyan" /> : <Compass className="w-5 h-5 text-cyan" />}
              </button>
            </div>

            {/* Mobile Navigation Drawer Overlay */}
            <AnimatePresence>
              {isNavMenuOpen && (
                <>
                  {/* Backdrop blur */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsNavMenuOpen(false)}
                    className="lg:hidden fixed inset-0 z-[2020] bg-black/60 backdrop-blur-sm"
                  />
                  {/* Drawer */}
                  <motion.div
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="lg:hidden fixed bottom-0 left-0 right-0 z-[2025] bg-[#0a0d1a]/95 border-t border-white/[0.08] rounded-t-3xl px-6 pt-5 pb-8 flex flex-col gap-4 shadow-2xl backdrop-blur-xl"
                  >
                    <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
                      <div className="flex items-center gap-2">
                        <Compass className="w-4 h-4 text-cyan animate-pulse" />
                        <span className="font-playfair italic text-sm font-bold text-text-primary">Navigation Portal</span>
                      </div>
                      <button
                        onClick={() => setIsNavMenuOpen(false)}
                        className="text-muted hover:text-text-primary p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-4 gap-3 py-2">
                      {MOBILE_VIEWS.map(({ id, label, icon: Icon }) => {
                        const isActive = isTabActive(id);
                        return (
                          <button
                            key={id}
                            onClick={() => {
                              handleMobileViewChange(id);
                              setIsNavMenuOpen(false);
                            }}
                            className={`flex flex-col items-center justify-center p-3 rounded-2xl gap-2 transition-all border
                              ${isActive 
                                ? 'bg-cyan/10 border-cyan/50 text-cyan shadow-[0_0_12px_rgba(77,141,255,0.15)]' 
                                : 'bg-white/[0.02] border-white/[0.04] text-muted hover:text-text-primary hover:border-white/[0.1]'}`}
                          >
                            <div className={`p-2 rounded-xl ${isActive ? 'bg-cyan/20' : 'bg-white/[0.04]'}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <span className="text-[9px] font-sans font-bold uppercase tracking-wider text-center">
                              {label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </main>

          {/* ── Right Panel (desktop) ── */}
          <aside 
            className={`hidden lg:flex flex-col shrink-0 overflow-hidden transition-all duration-200 ease-in-out bg-surface
              ${(rightPanelOpen && activeNav !== 'battles') ? 'w-80' : 'w-0'}`}
          >
            <div className="w-80 h-full flex flex-col overflow-hidden" data-lenis-prevent>
               {/* Static Panel Header */}
               {(() => {
                 const headerInfo = getHeaderInfo();
                 const Icon = headerInfo.icon;
                 return (
                   <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.08] h-[52px] shrink-0 select-none">
                     <Icon className="w-3.5 h-3.5 text-cyan" />
                     <h3 className="font-playfair italic text-base font-bold text-text-primary">
                      {headerInfo.label}
                    </h3>
                    {rightPanel === 'objects' && (
                      <span className={`ml-2 badge ${headerInfo.badgeClass} text-xs`}>
                        {objectsCount}
                      </span>
                    )}
                  </div>
                );
              })()}

              {/* Panel content */}
              <div className="flex-1 flex flex-col overflow-y-auto">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={rightPanel}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="flex-1 flex flex-col overflow-hidden"
                  >
                    {rightPanel === 'objects' && <SatellitePanel hideHeader={true} />}
                    {rightPanel === 'countdown' && <div className="flex-1 overflow-y-auto"><PassCountdown /></div>}
                    {rightPanel === 'lookup' && <div className="flex-1 overflow-y-auto"><LookUpCard /></div>}
                    {rightPanel === 'report' && (
                      <NightReport 
                        activeSubItem={tonightSubItem} 
                        onSubItemChange={(subId) => {
                          setTonightSubItem(subId);
                          localStorage.setItem('orbitwatch_tonight_sub_item', subId);
                        }} 
                      />
                    )}
                    {rightPanel === 'journal' && <JournalPanel />}
                    {rightPanel === 'diagnostics' && <DiagnosticsPanel />}
                    {rightPanel === 'settings' && (
                      <SettingsPanel 
                        onReplayBriefing={() => {
                          localStorage.removeItem('orbitwatch_briefed');
                          onReset();
                        }}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </aside>
        </div>



        {/* ── Mobile Overlay Panels (Tabs Contents) ── */}
        <AnimatePresence>
          {mobileView !== 'map' && (
            <motion.div
              key={mobileView}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="lg:hidden absolute inset-x-0 bottom-0 top-14 z-[1500] bg-panel border-t border-border overflow-y-auto flex flex-col pb-16"
            >
              {/* Sticky Drawer Header */}
              <div className="sticky top-0 z-[1000] flex items-center justify-between px-4 py-3 bg-[#0d121c]/90 backdrop-blur-md border-b border-border">
                <div className="flex items-center gap-2">
                  {mobileView === 'satellites' && <Satellite className="w-4 h-4 text-cyan" />}
                  {mobileView === 'report' && <Star className="w-4 h-4 text-cyan" />}
                  {mobileView === 'hazards' && <ShieldAlert className="w-4 h-4 text-cyan" />}
                  {mobileView === 'journal' && <Trophy className="w-4 h-4 text-cyan" />}
                  {mobileView === 'lookup' && <Compass className="w-4 h-4 text-cyan" />}
                  {mobileView === 'diagnostics' && <Activity className="w-4 h-4 text-cyan" />}
                  {mobileView === 'settings' && <Settings className="w-4 h-4 text-cyan" />}
                  <span className="font-playfair italic text-xs font-bold text-text-primary uppercase tracking-wider">
                    {mobileView === 'satellites' && 'Telemetry List'}
                    {mobileView === 'report' && 'Tonight\'s Sky'}
                    {mobileView === 'hazards' && 'Space Hazards'}
                    {mobileView === 'journal' && 'Sky Record Book'}
                    {mobileView === 'lookup' && 'Look Up Details'}
                    {mobileView === 'diagnostics' && 'System Diagnostics'}
                    {mobileView === 'settings' && 'Core Settings'}
                  </span>
                </div>
                <button
                  onClick={() => setMobileView('map')}
                  className="p-1 rounded-md border border-border bg-panel/30 hover:bg-panel-light text-muted hover:text-text transition-all focus:outline-none cursor-pointer"
                  aria-label="Close panel"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Drawer Content Area */}
              <div className="flex-1 overflow-y-auto p-3">
                {mobileView === 'satellites' && <SatellitePanel />}
                {mobileView === 'report' && (
                  <NightReport 
                    activeSubItem={tonightSubItem} 
                    onSubItemChange={(subId) => {
                      setTonightSubItem(subId);
                      localStorage.setItem('orbitwatch_tonight_sub_item', subId);
                    }} 
                  />
                )}
                {mobileView === 'journal' && <JournalPanel />}
                {mobileView === 'lookup' && (
                  <div className="divide-y divide-border/30 space-y-3">
                    <PassCountdown />
                    <div className="pt-3">
                      <LookUpCard />
                    </div>
                  </div>
                )}
                {mobileView === 'diagnostics' && <DiagnosticsPanel />}
                {mobileView === 'settings' && (
                  <SettingsPanel 
                    onReplayBriefing={() => {
                      localStorage.removeItem('orbitwatch_briefed');
                      onReset();
                    }}
                  />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Achievement Unlock Toast Celebrations ── */}
        {newUnlockedAchievements && newUnlockedAchievements.length > 0 && (() => {
          const activeId = newUnlockedAchievements[0];
          const ach = ACHIEVEMENT_DEFS.find(a => a.id === activeId);
          if (!ach) return null;

          return (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-navy/80 backdrop-blur-sm">
              <motion.div
                initial={{ scale: 0.8, opacity: 0, y: 50 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.8, opacity: 0, y: 50 }}
                transition={{ type: 'spring', damping: 15 }}
                className="w-full max-w-sm bg-panel border-2 border-cyan/60 rounded-2xl p-6 flex flex-col items-center gap-4 text-center shadow-[0_0_50px_rgba(58,123,217,0.4)] relative overflow-hidden scanlines"
              >
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan to-transparent animate-pulse" />
                
                <div className="w-16 h-16 rounded-full bg-cyan/20 border border-cyan/40 flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(58,123,217,0.3)] animate-bounce mt-2">
                  {ach.icon}
                </div>

                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-mono text-cyan tracking-[0.25em] uppercase font-bold text-glow-cyan">
                    Achievement Unlocked
                  </span>
                  <h3 className="text-xl font-playfair font-bold text-text mt-1">
                    {ach.title}
                  </h3>
                </div>

                <p className="text-sm text-muted-light font-crimson px-2">
                  {ach.description}
                </p>

                <button
                  onClick={actions.dismissAchievementToast}
                  className="mt-2 w-full py-2 bg-cyan border border-cyan text-xs font-crimson font-bold text-space rounded-lg hover:bg-transparent hover:text-cyan hover:border-cyan transition-all shadow-md uppercase tracking-wider"
                >
                  Awesome!
                </button>
              </motion.div>
            </div>
          );
        })()}

        {/* Onboard AI Assistant Chatbot */}
        <AIAssistant showChrome={showChrome} />
      </div>
    </div>
  );
}
