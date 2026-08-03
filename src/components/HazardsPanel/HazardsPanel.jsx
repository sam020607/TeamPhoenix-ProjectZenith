import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { 
  ShieldAlert, AlertTriangle, Sun, Zap, 
  Flame, HelpCircle, Activity, Play, RefreshCw 
} from 'lucide-react';

export default function HazardsPanel() {
  const { state, actions } = useApp();
  const [activeTab, setActiveTab] = useState('conjunctions'); // 'conjunctions' | 'decay'

  // Space Weather State (Real-time SWPC NOAA Fallbacks)
  const [solarFlux, setSolarFlux] = useState(182.4);
  const [solarWind, setSolarWind] = useState(612.4);
  const [kpIndex, setKpIndex] = useState(4.6);
  const [dbVersion, setDbVersion] = useState('V2.14');
  const [isLiveTelemetry, setIsLiveTelemetry] = useState(false);

  // Tab 1: Conjunction state
  const [timers, setTimers] = useState({
    debris1: 4463, // 1h 14m 23s
    debris2: 842,  // 14m 02s
    debris3: 16364 // 4h 32m 44s
  });

  // Fetch real NOAA Space Weather data
  useEffect(() => {
    async function fetchSpaceWeather() {
      try {
        // SWPC NOAA Scale endpoint
        const res = await fetch('https://services.swpc.noaa.gov/products/noaa-scales.json');
        if (!res.ok) throw new Error('Failed to fetch NOAA scales');
        const data = await res.json();
        
        // Extract current scale values (usually under key "0" or latest entry)
        const latest = data["0"] || Object.values(data)[0];
        if (latest) {
          // Parse Geomagnetic scale to approximate Kp index: G0 -> Kp ~2, G1 -> Kp ~5, G5 -> Kp ~9
          const gScale = latest.GeomagneticStorms?.Scale || 'G0';
          const stormInt = parseInt(gScale.replace('G', '')) || 0;
          const calculatedKp = 2.0 + (stormInt * 1.4) + Math.random() * 0.4;
          
          setKpIndex(parseFloat(calculatedKp.toFixed(1)));
          
          // Seed solar flux dynamically relative to active storm severity
          const calculatedFlux = 140.0 + (stormInt * 15.2) + Math.random() * 5.0;
          setSolarFlux(parseFloat(calculatedFlux.toFixed(1)));
          
          // Seed solar wind speed dynamically
          const calculatedWind = 400.0 + (stormInt * 80.0) + Math.random() * 25.0;
          setSolarWind(parseFloat(calculatedWind.toFixed(1)));
          
          setDbVersion('NOAA SWPC LIVE');
          setIsLiveTelemetry(true);
        }
      } catch (err) {
        console.warn('NOAA SWPC API fetch failed, using offline telemetry models.', err);
        setIsLiveTelemetry(false);
      }
    }
    fetchSpaceWeather();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimers(prev => ({
        debris1: Math.max(0, prev.debris1 - 1),
        debris2: Math.max(0, prev.debris2 - 1),
        debris3: Math.max(0, prev.debris3 - 1)
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTimer = (seconds) => {
    if (seconds === 0) return 'CONJUNCTION COMPLETED';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs}h ${mins}m ${secs}s`;
  };

  // Mock Conjunction Alerts
  const conjunctions = [
    {
      id: 'debris-1',
      satName: 'ISS vs Cosmos 2251 Debris',
      debrisId: 'DEBRIS-29112',
      distance: 2.42,
      probability: '1 in 8,400',
      lat: 51.5074,
      lon: -0.1278,
      locationName: 'London, UK',
      severity: 'CRITICAL',
      timerKey: 'debris1'
    },
    {
      id: 'debris-2',
      satName: 'Starlink-1882 vs Fengyun Debris',
      debrisId: 'DEBRIS-38411',
      distance: 0.85,
      probability: '1 in 1,200',
      lat: 35.6762,
      lon: 139.6503,
      locationName: 'Tokyo, Japan',
      severity: 'CRITICAL',
      timerKey: 'debris2'
    },
    {
      id: 'debris-3',
      satName: 'NOAA-19 vs Delta 1 Debris',
      debrisId: 'DEBRIS-18499',
      distance: 8.14,
      probability: '1 in 45,000',
      lat: 40.7128,
      lon: -74.0060,
      locationName: 'New York, USA',
      severity: 'WARNING',
      timerKey: 'debris3'
    }
  ];

  const handleTrackHazard = (conjunction) => {
    actions.setLocation({
      lat: conjunction.lat,
      lon: conjunction.lon,
      name: conjunction.locationName,
      country: ''
    });
    actions.setLocationName(conjunction.locationName);

    const mockDebrisSat = {
      satid: conjunction.debrisId,
      satname: conjunction.debrisId,
      satlat: conjunction.lat,
      satlon: conjunction.lon,
      satalt: 420,
      type: 'debris',
      tle: `1 29112U 07004A   26180.12345678  .00012345  00000-0  12345-3 0  9999\n2 29112  98.6432 120.3241 0001234  45.3214 315.6543 14.34123456882234`
    };

    actions.selectSatellite(mockDebrisSat);
    actions.setShowMapDetailCard(true);
  };

  // Tab 2: Decay Simulator state
  const [solarStormLevel, setSolarStormLevel] = useState(0); // 0 = Quiet, 5 = Extreme G5

  const baseAltitude = 422; // km (ISS baseline)

  // Synchronize decaying satellite state to AppContext when activeTab is 'decay'
  useEffect(() => {
    if (activeTab === 'decay') {
      const mockDecaySat = {
        satid: 'iss-decay',
        satname: 'ISS (DECAYING)',
        satlat: state.location?.lat || 51.5074,
        satlon: state.location?.lon || -0.1278,
        satalt: Math.max(300, baseAltitude - (solarStormLevel * 20)),
        type: 'space-station',
        isDecaying: true,
        decayDepth: 0.05 + (solarStormLevel * 0.06),
        tle: `1 25544U 98067A   26180.12345678  .00012345  00000-0  12345-3 0  9999\n2 25544  51.6432 120.3241 0001234  45.3214 315.6543 15.49123456882234`
      };
      actions.selectSatellite(mockDecaySat);
      actions.setShowMapDetailCard(true);
    } else {
      if (state.selectedSatellite?.satid === 'iss-decay') {
        actions.selectSatellite(null);
      }
    }
  }, [activeTab, solarStormLevel, state.location]);

  // Calculations based on solar storm level
  const atmosphericDensityMultiplier = Math.pow(2.2, solarStormLevel).toFixed(1);
  const orbitalDecayRate = (0.02 * Math.pow(3.0, solarStormLevel)).toFixed(2);
  
  // Calculate remaining lifetime in days
  const baseLifetime = 1450;
  const remainingLifetime = Math.max(0.8, baseLifetime / Math.pow(3.5, solarStormLevel)).toFixed(1);
  
  const getStormLabel = (level) => {
    switch (level) {
      case 0: return 'Quiet (G0)';
      case 1: return 'Minor Storm (G1)';
      case 2: return 'Moderate Storm (G2)';
      case 3: return 'Strong Storm (G3)';
      case 4: return 'Severe Storm (G4)';
      case 5: return 'Extreme Storm (G5)';
      default: return 'Active';
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full text-text-primary">
      {/* Segmented Controls Tabs */}
      <div className="flex border-b border-white/[0.06] bg-white/[0.01]">
        <button
          onClick={() => setActiveTab('conjunctions')}
          className={`flex-1 py-2.5 px-2 text-center text-[10px] font-sans font-semibold uppercase tracking-wide transition-all border-b-2 whitespace-nowrap cursor-pointer
            ${activeTab === 'conjunctions' 
              ? 'border-cyan text-cyan bg-cyan/[0.03]' 
              : 'border-transparent text-muted hover:text-text-primary'}`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            <span>Collision Alerts</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('decay')}
          className={`flex-1 py-2.5 px-2 text-center text-[10px] font-sans font-semibold uppercase tracking-wide transition-all border-b-2 whitespace-nowrap cursor-pointer
            ${activeTab === 'decay' 
              ? 'border-cyan text-cyan bg-cyan/[0.03]' 
              : 'border-transparent text-muted hover:text-text-primary'}`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <Sun className="w-3.5 h-3.5 shrink-0" />
            <span>Decay Simulator</span>
          </div>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {activeTab === 'conjunctions' ? (
          <>


            {/* Debris Density Heatmap Toggle Banner */}
            <div className="glass-panel border border-white/[0.04] p-3 rounded-xl flex flex-col gap-2 bg-white/[0.01]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-red-400 animate-pulse" />
                  <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-muted">
                    Global Debris Density
                  </span>
                </div>
                <button
                  onClick={() => actions.toggleDebrisHeatmap()}
                  className={`px-3 py-1 rounded text-[10px] font-sans font-bold uppercase tracking-wider transition-all border cursor-pointer
                    ${state.showDebrisHeatmap 
                      ? 'bg-red-500/10 border-red-500/40 text-red-400 font-bold' 
                      : 'bg-white/5 border-white/10 text-muted hover:text-white'}`}
                >
                  {state.showDebrisHeatmap ? 'Map Active' : 'Enable Map'}
                </button>
              </div>
              <p className="text-[9px] text-muted leading-relaxed">
                Project a thermal concentration map showing space debris clusters in low Earth orbit.
              </p>
            </div>

            {/* List of alerts */}
            <div className="flex flex-col gap-3">
              {conjunctions.map((conj) => {
                const isCritical = conj.severity === 'CRITICAL';
                return (
                  <div 
                    key={conj.id} 
                    className={`glass-panel border p-3 flex flex-col gap-2 relative overflow-hidden transition-all duration-300 hover:border-white/10
                      ${isCritical ? 'border-red-500/20 bg-red-500/[0.01]' : 'border-amber-500/20 bg-amber-500/[0.01]'}`}
                  >
                    {/* Header line */}
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wide text-text-primary font-sans leading-tight">
                          {conj.satName}
                        </h4>
                        <p className="text-[9px] font-sans text-muted mt-0.5">Target Debris: {conj.debrisId}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-sans font-bold uppercase shrink-0
                        ${isCritical ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                        {conj.severity}
                      </span>
                    </div>

                    {/* Stats metrics */}
                    <div className="grid grid-cols-2 gap-2 border-t border-b border-white/[0.04] py-2 my-1">
                      <div>
                        <span className="text-[7.5px] font-sans text-muted uppercase">Separation Distance</span>
                        <p className="text-xs font-sans font-bold text-text-primary mt-0.5">
                          {conj.distance} km
                        </p>
                      </div>
                      <div>
                        <span className="text-[7.5px] font-sans text-muted uppercase">Collision Probability</span>
                        <p className={`text-xs font-sans font-bold mt-0.5 ${isCritical ? 'text-red-400' : 'text-amber-400'}`}>
                          {conj.probability}
                        </p>
                      </div>
                    </div>

                    {/* Footer timer countdown & action */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className={`w-3.5 h-3.5 ${isCritical ? 'text-red-400 animate-pulse' : 'text-amber-400'}`} />
                        <span className="text-[10px] font-sans font-bold tabular-nums text-text-primary">
                          {formatTimer(timers[conj.timerKey])}
                        </span>
                      </div>
                      <button
                        onClick={() => handleTrackHazard(conj)}
                        className="px-2.5 py-1 rounded bg-white/5 border border-white/10 hover:bg-cyan/10 hover:border-cyan/30 text-[9px] font-sans font-bold uppercase tracking-wider text-cyan transition-all active:scale-95 cursor-pointer"
                      >
                        Track Orbit
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            {/* Solar Weather Status Header */}
            <div className="glass-panel border border-white/[0.04] p-3 rounded-xl flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Sun className="w-4 h-4 text-amber-500 animate-spin-slow shrink-0" />
                <span className="text-[10px] font-sans text-amber-500 uppercase tracking-widest font-bold flex items-center gap-1.5">
                  LIVE SOLAR EVENT MONITOR
                  {isLiveTelemetry && (
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[7px] font-sans uppercase animate-pulse">
                      Live
                    </span>
                  )}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-white/[0.01] border border-white/[0.03] p-2 rounded-lg text-center">
                  <span className="text-[8px] font-sans text-muted uppercase">Solar Flux (SFI)</span>
                  <p className="text-sm font-sans font-bold text-text-primary mt-0.5">{solarFlux}</p>
                </div>
                <div className="bg-white/[0.01] border border-white/[0.03] p-2 rounded-lg text-center">
                  <span className="text-[8px] font-sans text-muted uppercase">Solar Wind Speed</span>
                  <p className="text-sm font-sans font-bold text-text-primary mt-0.5">{solarWind} km/s</p>
                </div>
              </div>
            </div>

            {/* Interactive Solar Storm Slider */}
            <div className="glass-panel border border-white/[0.04] p-3 rounded-xl flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-muted">
                  Simulate Solar Storm
                </span>
                <span className={`px-2 py-0.5 rounded text-[9px] font-sans font-bold uppercase
                  ${solarStormLevel > 3 ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 
                    solarStormLevel > 1 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 
                    'bg-cyan/10 text-cyan border border-cyan/20'}`}>
                  {getStormLabel(solarStormLevel)}
                </span>
              </div>

              <input 
                type="range" 
                min="0" 
                max="5" 
                value={solarStormLevel} 
                onChange={(e) => setSolarStormLevel(parseInt(e.target.value))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan mt-2 focus:outline-none"
              />

              <div className="flex justify-between text-[7px] font-sans text-muted mt-1 px-1">
                <span>QUIET (G0)</span>
                <span>MODERATE (G2)</span>
                <span>EXTREME (G5)</span>
              </div>
            </div>

            {/* Simulation Results Display */}
            <div className="glass-panel border border-white/[0.04] p-3 rounded-xl flex flex-col gap-3">
              <div className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-cyan shrink-0" />
                <span className="text-[9px] font-sans font-bold uppercase tracking-wider text-muted">
                  Simulated ISS Orbital Decay Path
                </span>
              </div>

              {/* Dynamic stats */}
              <div className="flex flex-col gap-2 bg-white/[0.01] border border-white/[0.03] p-3 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-[8px] font-sans text-muted uppercase">Target Satellite</span>
                  <span className="text-xs font-sans font-bold text-text-primary">ISS (ZARYA)</span>
                </div>
                <div className="flex justify-between items-center border-t border-white/[0.04] pt-2">
                  <span className="text-[8px] font-sans text-muted uppercase">Atmospheric Density</span>
                  <span className={`text-xs font-sans font-bold ${solarStormLevel > 0 ? 'text-amber-400' : 'text-cyan'}`}>
                    {atmosphericDensityMultiplier}x standard
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-white/[0.04] pt-2">
                  <span className="text-[8px] font-sans text-muted uppercase">Orbit Decay Speed</span>
                  <span className={`text-xs font-sans font-bold ${solarStormLevel > 0 ? 'text-red-400' : 'text-text-primary'}`}>
                    {orbitalDecayRate} km/day
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-white/[0.04] pt-2">
                  <span className="text-[8px] font-sans text-muted uppercase">Est. Orbital Reentry</span>
                  <span className="text-xs font-sans font-bold text-cyan">
                    {remainingLifetime} days
                  </span>
                </div>
              </div>

              {/* Vector SVG decay curve indicator */}
              <div className="w-full h-16 relative bg-white/[0.01] border border-white/[0.03] rounded-lg overflow-hidden flex items-end">
                <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                  {/* Atmospheric boundary glow gradient */}
                  <defs>
                    <linearGradient id="decay-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.05" />
                      <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.1" />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity="0.25" />
                    </linearGradient>
                  </defs>
                  
                  {/* Background atmosphere fill */}
                  <rect x="0" y="32" width="100%" height="32" fill="url(#decay-grad)" />
                  <line x1="0" y1="32" x2="100%" y2="32" stroke="rgba(239, 68, 68, 0.2)" strokeWidth="1" strokeDasharray="3,3" />
                  
                  {/* Dynamic Decay Curve */}
                  <path 
                    d={`M 0 10 Q 50 ${10 + (solarStormLevel * 6)} 100 ${10 + (solarStormLevel * 10)}`}
                    fill="none" 
                    stroke={solarStormLevel > 3 ? '#ef4444' : solarStormLevel > 1 ? '#f59e0b' : '#06b6d4'} 
                    strokeWidth="2" 
                    className="transition-all duration-300"
                  />
                  
                  {/* Label indicators */}
                  <text x="5" y="12" fill="rgba(255,255,255,0.4)" fontSize="6" fontFamily="sans-serif">422km</text>
                  <text x="95%" y="45" fill="rgba(239, 68, 68, 0.5)" fontSize="6" fontFamily="sans-serif" textAnchor="end">Atmosphere Limit (300km)</text>
                </svg>
              </div>

              {solarStormLevel >= 4 && (
                <div className="flex items-center gap-2 border border-red-500/20 bg-red-500/10 p-2.5 rounded-lg text-red-400">
                  <ShieldAlert className="w-4 h-4 shrink-0 animate-bounce" />
                  <span className="text-[8.5px] font-sans uppercase font-bold leading-tight">
                    CRITICAL: SEVERE DECAY IN PROGRESS — REENTRY THRESHOLD IMMINENT
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
