import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useISSTracker } from '../../hooks/useISSTracker.js';
import { useSatellites } from '../../hooks/useSatellites.js';
import { usePassPredictions } from '../../hooks/usePassPredictions.js';
import GlobeMap from './GlobeMap.jsx';
import Globe3D from './Globe3D.jsx';
import LocationSearch from '../LandingPage/LocationSearch.jsx';
import HazardsPanel from '../HazardsPanel/HazardsPanel.jsx';
import {
  ShieldAlert, AlertTriangle, Sun,
  MapPin, Globe, Compass, RotateCcw,
} from 'lucide-react';

// Catalog of well-known defunct debris objects
const DEBRIS_CATALOG = [
  { satid: 'DEBRIS-29112', satname: 'Cosmos 2251 Debris',  satlat: 51.5074, satlon: -0.1278,   satalt: 420, inclination: 74.0, type: 'debris', desc: 'Fragment from the 2009 satellite collision event.' },
  { satid: 'DEBRIS-38411', satname: 'Fengyun 1C Debris',   satlat: 35.6762, satlon: 139.6503,  satalt: 395, inclination: 98.6, type: 'debris', desc: 'Fragment from the 2007 anti-satellite test.' },
  { satid: 'DEBRIS-18499', satname: 'Delta 1 Rocket Body', satlat: 40.7128, satlon: -74.0060,  satalt: 480, inclination: 28.5, type: 'debris', desc: 'Spent rocket stage decaying in low Earth orbit.' },
  { satid: 'DEBRIS-41002', satname: 'Iridium 33 Debris',   satlat: 64.7507, satlon: -147.353,  satalt: 435, inclination: 86.4, type: 'debris', desc: 'Collided remnant tracking polar trajectories.' },
];

const STORM_LABELS = ['Quiet (G0)', 'Minor (G1)', 'Moderate (G2)', 'Strong (G3)', 'Severe (G4)', 'Extreme (G5)'];

export default function DebrisDashboard({ onReset }) {
  const { state, actions } = useApp();
  const { location, selectedSatellite, showDebrisHeatmap } = state;

  useISSTracker(!!location);
  useSatellites();
  usePassPredictions();

  const [is3DMode,       setIs3DMode]       = useState(false);
  const [activeSubTab,   setActiveSubTab]   = useState('alerts');
  const [showSearch,     setShowSearch]     = useState(false);
  const [solarStormLevel, setSolarStormLevel] = useState(2);

  const baseAltitude    = 422;
  const currentDecayAlt = Math.max(300, baseAltitude - solarStormLevel * 20);

  // Clock
  const [clk, setClk] = useState({ local: '', utc: '' });
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClk({
        local: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
        utc:   now.toISOString().slice(11, 19),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-enable heatmap when entering this dashboard
  useEffect(() => {
    if (!showDebrisHeatmap) actions.toggleDebrisHeatmap();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Decay simulator: inject mock decaying satellite
  useEffect(() => {
    if (activeSubTab === 'simulator') {
      actions.selectSatellite({
        satid: 'iss-decay',
        satname: 'ISS (DECAYING)',
        satlat: location?.lat || 51.5074,
        satlon: location?.lon || -0.1278,
        satalt: currentDecayAlt,
        type: 'space-station',
        isDecaying: true,
        inclination: 51.6,
      });
    } else if (selectedSatellite?.satid === 'iss-decay') {
      actions.selectSatellite(null);
    }
  }, [activeSubTab, solarStormLevel]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTrackCatalog = (item) => {
    actions.selectSatellite(item);
  };

  // Section header helper — matches Dashboard's small uppercase sans labels
  const SectionLabel = ({ children }) => (
    <span className="text-[9px] font-sans font-semibold uppercase tracking-[0.12em] text-muted">
      {children}
    </span>
  );

  // Tab button — font-sans, not font-mono
  const Tab = ({ id, label }) => (
    <button
      onClick={() => setActiveSubTab(id)}
      className={`flex-1 py-2.5 text-center text-[10px] font-sans font-semibold uppercase tracking-wide border-b-2 transition-all cursor-pointer
        ${activeSubTab === id
          ? 'border-red-500 text-red-400 bg-red-500/[0.02]'
          : 'border-transparent text-muted hover:text-text-primary'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="w-full h-full bg-space text-text-primary font-sans flex flex-col overflow-hidden select-none">

      {/* ── HEADER — matches main Dashboard header height and style ── */}
      <header className="h-[52px] shrink-0 border-b border-white/[0.08] bg-surface px-4 flex items-center justify-between z-40">

        {/* Logo — font-playfair italic, exactly like Dashboard sidebar */}
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
          <div className="flex flex-col leading-tight">
            <span className="font-playfair italic text-[15px] font-bold text-text-primary truncate">
              OrbitWatch <span className="text-red-400 not-italic text-[12px] font-sans font-semibold">Hazard</span>
            </span>
            <span className="text-[8px] font-sans uppercase tracking-[0.15em] text-muted">
              Debris Control Deck
            </span>
          </div>
        </div>

        {/* Center: station pill */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/[0.03] border border-white/[0.06]">
          <MapPin className="w-3 h-3 text-red-400 shrink-0" />
          <span className="text-[10px] font-sans text-text-secondary">
            <span className="text-muted mr-1">Station:</span>
            <span className="font-semibold text-text-primary">{location?.name || 'Unknown'}</span>
            <span className="text-muted ml-1.5 font-mono text-[9px]">
              {location?.lat?.toFixed(2)}°N {location?.lon?.toFixed(2)}°E
            </span>
          </span>
          <button
            onClick={() => setShowSearch(v => !v)}
            className="ml-1.5 px-2 py-0.5 rounded bg-white/5 hover:bg-red-500/10 border border-white/[0.08] hover:border-red-500/25 text-[8px] font-sans font-semibold uppercase tracking-wide transition-all cursor-pointer text-muted hover:text-red-400"
          >
            {showSearch ? 'Close' : 'Relocate'}
          </button>
        </div>

        {/* Right: clocks + controls */}
        <div className="flex items-center gap-3">
          {/* Clocks — font-mono for the time values only */}
          <div className="hidden lg:flex items-center gap-3 border-r border-white/[0.06] pr-3">
            <div className="text-right">
              <p className="text-[7px] font-sans uppercase tracking-widest text-muted">Local</p>
              <p className="text-[11px] font-mono font-bold text-text-primary">{clk.local}</p>
            </div>
            <div className="text-right">
              <p className="text-[7px] font-sans uppercase tracking-widest text-muted">UTC</p>
              <p className="text-[11px] font-mono font-bold text-red-400">{clk.utc}</p>
            </div>
          </div>

          {/* 2D / 3D toggle */}
          <button
            onClick={() => setIs3DMode(v => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-white/[0.08] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06] text-[9px] font-sans font-semibold uppercase tracking-wide text-text-secondary hover:text-text-primary transition-all cursor-pointer"
          >
            <Globe className="w-3 h-3" />
            {is3DMode ? '2D Map' : '3D Globe'}
          </button>

          {/* Exit button — same style as main dashboard's reset button */}
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[9px] font-sans font-semibold uppercase tracking-wide transition-all cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            Exit
          </button>
        </div>
      </header>

      {/* ── SEARCH DROP-DOWN ── */}
      {showSearch && (
        <div className="absolute top-[52px] left-1/2 -translate-x-1/2 w-full max-w-lg p-3 bg-surface/95 border border-white/[0.08] border-t-0 rounded-b-xl z-50 shadow-2xl backdrop-blur-md">
          <p className="text-[9px] font-sans font-semibold uppercase tracking-widest text-muted mb-2">
            Relocate Observer Station
          </p>
          <LocationSearch
            onLocationSelect={(loc) => {
              actions.setLocation(loc);
              actions.setLocationName(loc.name);
              setShowSearch(false);
            }}
            variant="compact"
          />
        </div>
      )}

      {/* ── MAIN WORKSPACE ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* LEFT PANEL */}
        <aside className="w-[280px] shrink-0 border-r border-white/[0.06] bg-surface flex flex-col overflow-hidden">

          {/* Tab bar */}
          <div className="flex border-b border-white/[0.06]">
            <Tab id="alerts"    label="Conjunctions" />
            <Tab id="simulator" label="Decay Sim" />
            <Tab id="catalog"   label="Catalog" />
          </div>

          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">

            {/* ─── CONJUNCTIONS TAB ─── */}
            {activeSubTab === 'alerts' && (
              <>
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.04]">
                  <SectionLabel>Conjunction Database</SectionLabel>
                  <span className="px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-[7.5px] font-sans font-semibold uppercase tracking-wide animate-pulse">
                    Live
                  </span>
                </div>
                <HazardsPanel />
              </>
            )}

            {/* ─── DECAY SIMULATOR TAB ─── */}
            {activeSubTab === 'simulator' && (
              <div className="flex flex-col gap-3">
                <div className="pb-2 border-b border-white/[0.04]">
                  <SectionLabel>Solar Weather Modeling</SectionLabel>
                </div>

                {/* Info card */}
                <div className="border border-white/[0.05] rounded-lg p-3 bg-white/[0.01]">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-[10px] font-sans font-semibold text-amber-400 uppercase tracking-wide">
                      Solar Event Simulator
                    </span>
                  </div>
                  <p className="text-[9px] font-sans text-muted leading-relaxed">
                    Adjust solar storm severity to simulate atmospheric heating and subsequent orbital altitude loss.
                  </p>
                </div>

                {/* Slider */}
                <div className="border border-white/[0.05] rounded-lg p-3 bg-white/[0.01] flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-sans font-semibold uppercase tracking-wide text-text-secondary">
                      Solar Wind Level
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-[8px] font-mono font-bold">
                      {STORM_LABELS[solarStormLevel]}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0" max="5"
                    value={solarStormLevel}
                    onChange={e => setSolarStormLevel(+e.target.value)}
                    className="w-full h-1 bg-white/10 rounded appearance-none cursor-pointer accent-red-500"
                  />
                  <div className="flex justify-between text-[7px] font-mono text-muted">
                    <span>G0</span><span>G2</span><span>G5</span>
                  </div>
                </div>

                {/* Readout */}
                <div className="border border-white/[0.05] rounded-lg p-3 bg-white/[0.01] flex flex-col gap-1.5">
                  <SectionLabel>Decay Rates (Calculated)</SectionLabel>
                  <div className="mt-1 flex flex-col gap-1.5 text-[10px]">
                    {[
                      { label: 'Simulated Altitude', value: `${currentDecayAlt} km`,                               color: 'text-text-primary' },
                      { label: 'Density Coeff',       value: `${Math.pow(2.2, solarStormLevel).toFixed(1)}×`,      color: 'text-amber-400' },
                      { label: 'Altitude Loss',       value: `${(0.02 * Math.pow(3, solarStormLevel)).toFixed(2)} km/day`, color: 'text-red-400' },
                    ].map(r => (
                      <div key={r.label} className="flex justify-between items-center border-t border-white/[0.04] pt-1.5 first:border-0 first:pt-0">
                        <span className="font-sans text-muted">{r.label}</span>
                        <span className={`font-mono font-bold ${r.color}`}>{r.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Decay curve SVG */}
                <div className="h-20 w-full rounded-lg border border-white/[0.05] bg-white/[0.01] overflow-hidden relative">
                  <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="decay-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.02" />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity="0.18" />
                      </linearGradient>
                    </defs>
                    <rect x="0" y="50%" width="100%" height="50%" fill="url(#decay-fill)" />
                    <line x1="0" y1="50%" x2="100%" y2="50%" stroke="rgba(239,68,68,0.2)" strokeWidth="1" strokeDasharray="3,3" />
                    <path
                      d={`M 0 14 Q 50 ${14 + solarStormLevel * 8} 100 ${14 + solarStormLevel * 14}`}
                      fill="none" stroke="#ef4444" strokeWidth="1.5"
                      style={{ transition: 'all 0.3s' }}
                    />
                    <text x="4" y="11"  fill="rgba(255,255,255,0.3)" fontSize="5.5" fontFamily="monospace">422 km</text>
                    <text x="97%" y="63" fill="rgba(239,68,68,0.45)" fontSize="5.5" fontFamily="monospace" textAnchor="end">300 km limit</text>
                  </svg>
                </div>
              </div>
            )}

            {/* ─── CATALOG TAB ─── */}
            {activeSubTab === 'catalog' && (
              <div className="flex flex-col gap-3">
                <div className="pb-2 border-b border-white/[0.04]">
                  <SectionLabel>Defunct Debris Catalog</SectionLabel>
                </div>
                <p className="text-[9px] font-sans text-muted leading-relaxed">
                  Select a cataloged debris object to isolate its orbital track on the map.
                </p>
                <div className="flex flex-col gap-2">
                  {DEBRIS_CATALOG.map(item => {
                    const sel = selectedSatellite?.satid === item.satid;
                    return (
                      <div
                        key={item.satid}
                        onClick={() => handleTrackCatalog(item)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all
                          ${sel
                            ? 'border-red-500/60 bg-red-500/10'
                            : 'border-white/[0.05] bg-white/[0.01] hover:border-white/10 hover:bg-white/[0.02]'}`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-[10px] font-sans font-semibold text-text-primary leading-tight">{item.satname}</span>
                          <span className="text-[8px] font-mono text-muted shrink-0">{item.satid}</span>
                        </div>
                        <p className="text-[9px] font-sans text-muted mt-1 leading-snug">{item.desc}</p>
                        <div className="flex gap-3 mt-1.5 text-[8px] font-mono text-muted">
                          <span>Alt {item.satalt} km</span>
                          <span>Inc {item.inclination}°</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        </aside>

        {/* CENTER MAP */}
        <main className="flex-1 relative overflow-hidden w-full h-full">
          {is3DMode
            ? <Globe3D className="w-full h-full" showChrome={false} />
            : <GlobeMap className="w-full h-full" showChrome={false} />
          }
        </main>

        {/* RIGHT PANEL — Telemetry */}
        <aside className="w-[260px] shrink-0 border-l border-white/[0.06] bg-surface flex flex-col p-3 gap-3 overflow-y-auto">

          <div className="pb-2 border-b border-white/[0.04]">
            <SectionLabel>Telemetry Lock</SectionLabel>
          </div>

          {/* Locked target */}
          {selectedSatellite ? (
            <div className="border border-red-500/20 rounded-xl bg-red-500/[0.01] p-3 flex flex-col gap-2.5">
              <div className="flex items-start justify-between gap-2 pb-2 border-b border-white/[0.04]">
                <div>
                  <h4 className="text-[11px] font-sans font-bold text-text-primary">{selectedSatellite.satname}</h4>
                  <span className="text-[8px] font-mono text-muted">ID: {selectedSatellite.satid}</span>
                </div>
                <span className="px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-[7.5px] font-sans font-semibold uppercase shrink-0">
                  Locked
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: 'Altitude',  value: `${selectedSatellite.satalt?.toFixed(1) ?? 400} km` },
                  { label: 'Inc',       value: `${selectedSatellite.inclination ?? 74.0}°` },
                  { label: 'Latitude',  value: `${selectedSatellite.satlat?.toFixed(2)}°N` },
                  { label: 'Longitude', value: `${selectedSatellite.satlon?.toFixed(2)}°E` },
                ].map(f => (
                  <div key={f.label} className="bg-white/[0.02] border border-white/[0.04] rounded p-2">
                    <p className="text-[7px] font-sans uppercase tracking-wide text-muted">{f.label}</p>
                    <p className="text-[10px] font-mono font-bold text-text-primary mt-0.5">{f.value}</p>
                  </div>
                ))}
              </div>
              {selectedSatellite.isDecaying && (
                <div className="flex items-center gap-2 border border-red-500/20 bg-red-500/10 px-2.5 py-2 rounded-lg text-red-400 text-[9px] font-sans font-semibold animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  Burnup Simulation Active
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-5 border border-dashed border-white/[0.06] rounded-xl min-h-[130px] gap-2">
              <Compass className="w-7 h-7 text-muted" />
              <p className="text-[9px] font-sans text-muted">
                No target locked. Select a catalog item or conjunction to track.
              </p>
            </div>
          )}

          {/* NOAA summary */}
          <div className="border border-white/[0.05] rounded-xl bg-white/[0.01] p-3 flex flex-col gap-2.5">
            <div className="flex items-center gap-2 pb-2 border-b border-white/[0.04]">
              <Sun className="w-3.5 h-3.5 text-red-400" />
              <SectionLabel>NOAA Indices</SectionLabel>
            </div>
            {[
              { label: 'Solar Wind Speed', value: '590 km/s',  color: 'text-text-primary' },
              { label: 'Solar Flux (SFI)', value: '178 SFI',   color: 'text-text-primary' },
              { label: 'Geomagnetic Kp',   value: '4.2 Kp',   color: 'text-red-400' },
            ].map(r => (
              <div key={r.label} className="flex justify-between items-center">
                <span className="text-[9px] font-sans text-muted">{r.label}</span>
                <span className={`text-[10px] font-mono font-bold ${r.color}`}>{r.value}</span>
              </div>
            ))}
          </div>

        </aside>
      </div>
    </div>
  );
}
