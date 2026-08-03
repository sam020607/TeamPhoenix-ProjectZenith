import { useState, useEffect, useRef, useCallback, Fragment, useMemo, createPortal } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Polygon, Circle, Rectangle, useMap, Popup, Pane, GeoJSON, FeatureGroup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Database, Globe, Radio, MapPin, X, Activity, Navigation, SlidersHorizontal } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { generateOrbitalArc, calculateConeFootprint, azimuthToCompass } from '../../utils/orbitMath.js';
import { SAT_TYPE_CONFIG } from '../../data/mockSatellites.js';
import { CONSTELLATIONS, getSubStellarPoint, getLocalCoordinates, getConstellationShape, getGMST } from '../../data/constellations.js';
import worldData from '../../data/world.json';
import { reverseGeocode } from '../../api/geocodeApi.js';

// Expanded debris hotspot catalogue — representative LEO cluster zones
// Each entry: orbital regime label, lat/lon centroid, intensity 0‑1, spread radius (degrees)
const DEBRIS_HOTSPOTS = [
  // Polar belt — heavy traffic from Earth-obs & recon sats
  { lat: 80.5, lon: 95.0,   intensity: 0.92, radius: 18, label: 'Polar LEO Belt',       color: [255,  40,  40] },
  { lat: 73.0, lon: -15.0,  intensity: 0.75, radius: 14, label: 'Arctic Crossing',       color: [255,  80,  20] },
  { lat: -82.0, lon: 55.0,  intensity: 0.70, radius: 14, label: 'Antarctic Corridor',    color: [255,  80,  20] },
  // Sun-synchronous corridor — Fengyun 1C debris field
  { lat: 55.0, lon:  90.0,  intensity: 0.88, radius: 20, label: 'FY-1C Debris Field',    color: [255,  30,  30] },
  { lat: 45.0, lon: 125.0,  intensity: 0.65, radius: 13, label: 'SSO Cascade Zone',      color: [255, 120,  10] },
  { lat: 35.0, lon: 145.0,  intensity: 0.72, radius: 15, label: 'Japan Launch Track',    color: [255,  90,  10] },
  // Mid-inclination cluster — Cosmos 2251 collision belt
  { lat: 51.0, lon: -80.0,  intensity: 0.85, radius: 16, label: 'Cosmos-2251 Cloud',     color: [255,  30,  30] },
  { lat: 48.0, lon:  35.0,  intensity: 0.60, radius: 12, label: 'Baikonur Uprange',      color: [255, 140,   0] },
  { lat: 28.5, lon: -80.5,  intensity: 0.58, radius: 11, label: 'KSC Launch Corridor',   color: [255, 160,  20] },
  // Equatorial / GEO graveyard approach
  { lat:  5.0, lon: -75.0,  intensity: 0.50, radius:  9, label: 'GTO Crossing Band',     color: [255, 200,  30] },
  { lat: -5.0, lon: 110.0,  intensity: 0.48, radius:  9, label: 'SEA Equatorial Band',   color: [255, 200,  30] },
  // Southern hemisphere dense zones
  { lat: -48.0, lon: -120.0,intensity: 0.55, radius: 11, label: 'South Pacific Zone',    color: [255, 130,  15] },
  { lat: -35.0, lon:  20.0, intensity: 0.42, radius:  9, label: 'Southern Polar Rim',    color: [255, 200,  40] },
  // Supplementary secondary clusters
  { lat: 62.0, lon: -150.0, intensity: 0.68, radius: 13, label: 'Alaska Overpass',       color: [255, 100,  10] },
  { lat: 20.0, lon:  60.0,  intensity: 0.44, radius:  8, label: 'Arabian Corridor',      color: [255, 220,  50] },
  { lat: -22.0, lon: -45.0, intensity: 0.38, radius:  8, label: 'Brazil Downrange',      color: [255, 230,  60] },
];

// Fix Leaflet default icon path issue with Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ── Thermographic Canvas Heatmap ─────────────────────────────────────────────
// Palette: [t, alpha, r, g, b] — t is normalized intensity [0,1]
const THERMO_PAL = [
  [0.00, 0.00,  0,   0,  160],
  [0.04, 0.22,  0,   0,  210],
  [0.10, 0.52,  0,   0,  255],
  [0.20, 0.68,  0,  100, 255],
  [0.30, 0.76,  0,  210, 255],
  [0.38, 0.80,  0,  255, 230],
  [0.46, 0.83,  0,  255, 100],
  [0.54, 0.85,  0,  255,  30],
  [0.62, 0.86, 80,  255,   0],
  [0.69, 0.87, 200, 255,   0],
  [0.76, 0.89, 255, 230,   0],
  [0.83, 0.91, 255, 130,   0],
  [0.89, 0.93, 255,  45,   0],
  [0.94, 0.95, 255,   0,   0],
  [0.97, 0.96, 230,   0,  10],
  [1.00, 0.97, 180,   0,  20],
];

function buildThermoLUT() {
  const LUT = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    // find bracket
    let lo = THERMO_PAL.length - 2, hi = THERMO_PAL.length - 1;
    for (let j = 0; j < THERMO_PAL.length - 1; j++) {
      if (t <= THERMO_PAL[j + 1][0]) { lo = j; hi = j + 1; break; }
    }
    const [t0, a0, r0, g0, b0] = THERMO_PAL[lo];
    const [t1, a1, r1, g1, b1] = THERMO_PAL[hi];
    const f = (t1 - t0) < 1e-9 ? 1 : (t - t0) / (t1 - t0);
    LUT[i * 4]     = Math.round(r0 + f * (r1 - r0));
    LUT[i * 4 + 1] = Math.round(g0 + f * (g1 - g0));
    LUT[i * 4 + 2] = Math.round(b0 + f * (b1 - b0));
    LUT[i * 4 + 3] = Math.round((a0 + f * (a1 - a0)) * 255);
  }
  return LUT;
}

const THERMO_LUT = buildThermoLUT();

// React-Leaflet component: renders a thermographic canvas over the map safely via useEffect
function HeatmapCanvasLayer({ hotspots }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const container = map.getContainer();
    if (!container) return;

    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '450';
    canvas.style.filter = 'blur(16px)';
    canvas.style.opacity = '0.50';
    canvas.style.mixBlendMode = 'screen';

    container.appendChild(canvas);

    const draw = () => {
      try {
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (!w || !h || w <= 0 || h <= 0) return;

        canvas.width  = w;
        canvas.height = h;

        // ── Pass 1: accumulate Gaussian intensity blobs (additive 'lighter' blend) ──
        const off = document.createElement('canvas');
        off.width = w; off.height = h;
        const oc = off.getContext('2d');
        if (!oc) return;
        oc.clearRect(0, 0, w, h);
        oc.globalCompositeOperation = 'lighter';

        hotspots.forEach(({ lat, lon, radius, intensity }) => {
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
          const cp = map.latLngToContainerPoint([lat, lon]);
          const ep = map.latLngToContainerPoint([lat + radius, lon]);
          if (!cp || !ep || !Number.isFinite(cp.x) || !Number.isFinite(cp.y) || !Number.isFinite(ep.y)) return;
          const pr = Math.max(55, Math.abs(ep.y - cp.y) * 2.2);
          if (!Number.isFinite(pr) || pr <= 0) return;
          const v  = Math.round(intensity * 210);

          const grd = oc.createRadialGradient(cp.x, cp.y, 0, cp.x, cp.y, pr);
          grd.addColorStop(0,    `rgba(${v},${v},${v},1)`);
          grd.addColorStop(0.28, `rgba(${v * 0.78 | 0},${v * 0.78 | 0},${v * 0.78 | 0},1)`);
          grd.addColorStop(0.55, `rgba(${v * 0.40 | 0},${v * 0.40 | 0},${v * 0.40 | 0},1)`);
          grd.addColorStop(0.82, `rgba(${v * 0.10 | 0},${v * 0.10 | 0},${v * 0.10 | 0},1)`);
          grd.addColorStop(1,    'rgba(0,0,0,0)');
          oc.fillStyle = grd;

          const x0 = Math.max(0, cp.x - pr | 0);
          const y0 = Math.max(0, cp.y - pr | 0);
          const x1 = Math.min(w, (cp.x + pr + 1) | 0);
          const y1 = Math.min(h, (cp.y + pr + 1) | 0);
          oc.fillRect(x0, y0, x1 - x0, y1 - y0);
        });

        // ── Pass 2: pixel-by-pixel colour mapping via prebuilt LUT ──
        const raw = oc.getImageData(0, 0, w, h).data;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const outImg = ctx.createImageData(w, h);
        const out = outImg.data;

        for (let i = 0; i < raw.length; i += 4) {
          const idx = raw[i]; // R channel carries accumulated intensity 0-255
          if (idx < 5) { out[i + 3] = 0; continue; }
          const li = idx << 2;
          out[i]     = THERMO_LUT[li];
          out[i + 1] = THERMO_LUT[li + 1];
          out[i + 2] = THERMO_LUT[li + 2];
          out[i + 3] = THERMO_LUT[li + 3];
        }
        ctx.putImageData(outImg, 0, 0);
      } catch (err) {
        console.warn('Heatmap layer render warning:', err);
      }
    };

    draw();
    map.on('move moveend zoom zoomend resize', draw);

    return () => {
      map.off('move moveend zoom zoomend resize', draw);
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    };
  }, [map, hotspots]);

  return null;
}

// ── Heatmap Legend overlay ───────────────────────────────────────────────────
const HEATMAP_TIERS = [
  { label: 'Critical',  color: 'rgb(255,30,30)',  threshold: '> 0.8' },
  { label: 'High',      color: 'rgb(255,90,10)',  threshold: '0.6 – 0.8' },
  { label: 'Moderate',  color: 'rgb(255,160,20)', threshold: '0.4 – 0.6' },
  { label: 'Sparse',    color: 'rgb(255,230,60)', threshold: '< 0.4' },
];

function HeatmapLegend({ hotspots }) {
  const [collapsed, setCollapsed] = useState(false);

  const criticalCount = hotspots.filter(h => h.intensity >= 0.8).length;
  const highCount     = hotspots.filter(h => h.intensity >= 0.6 && h.intensity < 0.8).length;
  const modCount      = hotspots.filter(h => h.intensity >= 0.4 && h.intensity < 0.6).length;
  const sparseCount   = hotspots.filter(h => h.intensity < 0.4).length;
  const counts        = [criticalCount, highCount, modCount, sparseCount];

  return (
    <div
      className="absolute bottom-6 left-3 z-[1000] select-none"
      style={{ fontFamily: "'Inter', 'system-ui', sans-serif", width: '182px' }}
    >
      <div
        style={{
          background: 'rgba(7,10,18,0.90)',
          border: '1px solid rgba(239,68,68,0.22)',
          borderRadius: '10px',
          backdropFilter: 'blur(14px)',
          boxShadow: '0 4px 32px rgba(239,68,68,0.10)',
          overflow: 'hidden',
        }}
      >
        {/* ── Clickable Header ── */}
        <button
          onClick={() => setCollapsed(c => !c)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 11px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            borderBottom: collapsed ? 'none' : '1px solid rgba(255,255,255,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: '#ef4444', display: 'inline-block',
              boxShadow: '0 0 6px rgba(239,68,68,0.8)',
            }} />
            <span style={{ fontSize: '8px', color: '#ef4444', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.13em' }}>
              Debris Density Map
            </span>
          </div>
          {/* Chevron */}
          <svg
            width="10" height="10" viewBox="0 0 10 10" fill="none"
            style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}
          >
            <path d="M 2 3.5 L 5 6.5 L 8 3.5" stroke="rgba(239,68,68,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* ── Expandable Body ── */}
        {!collapsed && (
          <div style={{ padding: '8px 11px 10px' }}>
            {/* Gradient bar */}
            <div style={{
              height: '7px', borderRadius: '4px',
              background: 'linear-gradient(to right, rgb(255,230,60), rgb(255,160,20), rgb(255,90,10), rgb(255,30,30))',
              marginBottom: '4px', border: '1px solid rgba(255,255,255,0.05)',
            }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '7px', color: 'rgba(255,255,255,0.3)', marginBottom: '8px' }}>
              <span>Sparse</span>
              <span>Critical</span>
            </div>

            {/* Tier rows */}
            {HEATMAP_TIERS.map((tier, i) => (
              <div key={tier.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: i < 3 ? '5px' : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: tier.color, opacity: 0.85, flexShrink: 0 }} />
                  <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.65)', fontWeight: '500' }}>{tier.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ fontSize: '7.5px', color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace' }}>{tier.threshold}</span>
                  <span style={{ fontSize: '9px', color: tier.color, fontWeight: '700', minWidth: '14px', textAlign: 'right', fontFamily: 'monospace' }}>{counts[i]}</span>
                </div>
              </div>
            ))}

            {/* Total */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', marginTop: '8px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total Zones</span>
              <span style={{ fontSize: '11px', color: 'white', fontWeight: '700', fontFamily: 'monospace' }}>{hotspots.length}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


const CITY_LIGHTS = [
  // North America
  [40.7128, -74.0060], [34.0522, -118.2437], [41.8781, -87.6298], [29.7604, -95.3698], [45.5017, -73.5673],
  [19.4326, -99.1332], [25.7617, -80.1918], [37.7749, -122.4194], [47.6062, -122.3321], [43.6532, -79.3832],
  // South America
  [-23.5505, -46.6333], [-22.9068, -43.1729], [-34.6037, -58.3816], [-12.0464, -77.0428], [4.7110, -74.0721],
  [-33.4489, -70.6693], [-10.9631, -61.5186], [-1.8312, -78.1834],
  // Europe
  [51.5074, -0.1278], [48.8566, 2.3522], [52.5200, 13.4050], [41.9028, 12.4964], [40.4168, -3.7037],
  [55.7558, 37.6173], [52.3676, 4.9041], [50.8503, 4.3517], [48.2082, 16.3738], [59.3293, 18.0686],
  // Africa
  [30.0444, 31.2357], [-26.2041, 28.0473], [6.5244, 3.3792], [33.5731, -7.5898], [9.0300, 38.7400],
  [-1.2921, 36.8219], [-4.3250, 15.3222], [14.6937, -17.4441],
  // Asia & Middle East
  [35.6762, 139.6503], [37.5665, 126.9780], [31.2304, 121.4737], [39.9042, 116.4074], [22.3964, 114.1095],
  [19.0760, 72.8777], [28.6139, 77.2090], [13.7563, 100.5018], [-6.2088, 106.8456], [14.5995, 120.9842],
  [1.3521, 103.8198], [25.2048, 55.2708], [24.7136, 46.6753], [35.6892, 51.3890], [24.8607, 67.0011],
  [23.8103, 90.4125], [16.8409, 96.1735], [10.8231, 106.6297],
  // Oceania
  [-33.8688, 151.2093], [-37.8136, 144.9631], [-36.8485, 174.7633], [-27.4698, 153.0251]
];

function getObjectColor(type, name) {
  const upperName = name?.toUpperCase() || '';
  if (upperName.includes('ISS') || type === 'space-station' && upperName.includes('ISS')) {
    return '#e0584f'; // ISS
  }
  if (upperName.includes('STARLINK') || type === 'gps') {
    return '#a06bd6'; // Starlink/constellations
  }
  if (type === 'weather') {
    return '#3fd6a0'; // Weather satellites
  }
  return '#4d8dff'; // General Satellites
}

// ISS custom icon
function createISSIcon(selected = false) {
  const reticleHtml = selected ? `
    <svg viewBox="0 0 30 30" style="position: absolute; width: 36px; height: 36px; top: -8px; left: -8px; pointer-events: none; animation: reticleRotate 8s linear infinite;">
      <path d="M 6 2 A 12 12 0 0 1 24 2" fill="none" stroke="#e0584f" stroke-width="0.75" stroke-dasharray="1.5, 1.5" />
      <path d="M 24 28 A 12 12 0 0 1 6 28" fill="none" stroke="#e0584f" stroke-width="0.75" stroke-dasharray="1.5, 1.5" />
      <line x1="2" y1="2" x2="6" y2="2" stroke="#e0584f" stroke-width="1.2" />
      <line x1="2" y1="2" x2="2" y2="6" stroke="#e0584f" stroke-width="1.2" />
      <line x1="28" y1="2" x2="24" y2="2" stroke="#e0584f" stroke-width="1.2" />
      <line x1="28" y1="2" x2="28" y2="6" stroke="#e0584f" stroke-width="1.2" />
      <line x1="2" y1="28" x2="6" y2="28" stroke="#e0584f" stroke-width="1.2" />
      <line x1="2" y1="28" x2="2" y2="24" stroke="#e0584f" stroke-width="1.2" />
      <line x1="28" y1="28" x2="24" y2="28" stroke="#e0584f" stroke-width="1.2" />
      <line x1="28" y1="28" x2="28" y2="24" stroke="#e0584f" stroke-width="1.2" />
    </svg>
  ` : '';
  return L.divIcon({
    className: 'iss-marker-icon',
    html: `<div class="iss-dot"></div>${reticleHtml}`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -12],
  });
}

// Satellite custom icon
function createSatIcon(type, name, selected = false) {
  const baseColor = getObjectColor(type, name);
  const size = selected ? 10 : 7;
  const shadowGlow = selected 
    ? `box-shadow: 0 0 8px ${baseColor}, 0 0 16px ${baseColor}; border: 1.5px solid var(--text-primary);`
    : `box-shadow: 0 0 6px ${baseColor}bf, 0 0 14px ${baseColor}4d;`;
  
  const reticleHtml = selected ? `
    <svg viewBox="0 0 30 30" style="position: absolute; width: 36px; height: 36px; top: -11px; left: -11px; pointer-events: none; animation: reticleRotate 8s linear infinite;">
      <path d="M 6 2 A 12 12 0 0 1 24 2" fill="none" stroke="${baseColor}" stroke-width="0.75" stroke-dasharray="1.5, 1.5" />
      <path d="M 24 28 A 12 12 0 0 1 6 28" fill="none" stroke="${baseColor}" stroke-width="0.75" stroke-dasharray="1.5, 1.5" />
      <line x1="2" y1="2" x2="6" y2="2" stroke="${baseColor}" stroke-width="1.2" />
      <line x1="2" y1="2" x2="2" y2="6" stroke="${baseColor}" stroke-width="1.2" />
      <line x1="28" y1="2" x2="24" y2="2" stroke="${baseColor}" stroke-width="1.2" />
      <line x1="28" y1="2" x2="28" y2="6" stroke="${baseColor}" stroke-width="1.2" />
      <line x1="2" y1="28" x2="6" y2="28" stroke="${baseColor}" stroke-width="1.2" />
      <line x1="2" y1="28" x2="2" y2="24" stroke="${baseColor}" stroke-width="1.2" />
      <line x1="28" y1="28" x2="24" y2="28" stroke="${baseColor}" stroke-width="1.2" />
      <line x1="28" y1="28" x2="28" y2="24" stroke="${baseColor}" stroke-width="1.2" />
    </svg>
  ` : '';
  
  return L.divIcon({
    className: 'sat-marker-icon',
    html: `<div class="sat-dot${selected ? ' selected' : ''}" style="width:${size}px;height:${size}px;background:${baseColor};border-radius:50%;${shadowGlow}"></div>${reticleHtml}`,
    iconSize: [size + 4, size + 4],
    iconAnchor: [(size + 4) / 2, (size + 4) / 2],
    popupAnchor: [0, -8],
  });
}

// Observer location icon
function createObserverIcon() {
  return L.divIcon({
    className: 'observer-marker-container',
    html: `
      <div class="observer-pulse"></div>
      <div style="
        position: absolute;
        inset: 2px;
        border-radius: 50%;
        border: 2px solid #e0a847;
        background: rgba(224, 168, 71, 0.45);
        box-shadow: 0 0 10px #e0a847;
        z-index: 2;
      "></div>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

// Radar sweep div icon
function createRadarIcon() {
  return L.divIcon({
    className: 'radar-sweep-container',
    html: `
      <div class="radar-sweep-line"></div>
      <svg viewBox="0 0 100 100" class="radar-scope-reticle" style="position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none;">
        <circle cx="50" cy="50" r="48" stroke="rgba(224, 168, 71, 0.15)" stroke-width="0.5" fill="none" />
        <circle cx="50" cy="50" r="25" stroke="rgba(224, 168, 71, 0.08)" stroke-width="0.5" fill="none" stroke-dasharray="2, 2" />
        <line x1="50" y1="2" x2="50" y2="98" stroke="rgba(224, 168, 71, 0.08)" stroke-width="0.5" stroke-dasharray="2, 2" />
        <line x1="2" y1="50" x2="98" y2="50" stroke="rgba(224, 168, 71, 0.08)" stroke-width="0.5" stroke-dasharray="2, 2" />
        <text x="50" y="8" font-size="6" fill="rgba(224, 168, 71, 0.5)" font-family="monospace" text-anchor="middle" font-weight="bold">N</text>
        <text x="50" y="96" font-size="6" fill="rgba(224, 168, 71, 0.5)" font-family="monospace" text-anchor="middle" font-weight="bold">S</text>
        <text x="94" y="52" font-size="6" fill="rgba(224, 168, 71, 0.5)" font-family="monospace" text-anchor="middle" font-weight="bold">E</text>
        <text x="6" y="52" font-size="6" fill="rgba(224, 168, 71, 0.5)" font-family="monospace" text-anchor="middle" font-weight="bold">W</text>
      </svg>
    `,
    iconSize: [150, 150],
    iconAnchor: [75, 75],
  });
}

/**
 * SmoothISSMarker — interpolates ISS position at ~60fps between API updates.
 * Uses requestAnimationFrame + Leaflet's imperative marker.setLatLng()
 * so React never re-renders per frame — pure DOM mutation.
 */
function SmoothISSMarker({ issPosition, selectedSatellite, showMapDetailCard, actions }) {
  const markerRef = useRef(null);
  const isIssSelected = selectedSatellite?.satid === 25544;
  const issIcon = useMemo(() => createISSIcon(isIssSelected), [isIssSelected]);

  // Track prev/next waypoints and animation timing
  const animState = useRef({
    prevLat: issPosition?.lat ?? 0,
    prevLon: issPosition?.lon ?? 0,
    nextLat: issPosition?.lat ?? 0,
    nextLon: issPosition?.lon ?? 0,
    startTime: performance.now(),
    duration: 5000, // matches POLL_INTERVAL_MS
    rafId: null,
  });

  // Smoothstep easing: 0→1 with ease-in-out feel
  const smoothstep = (t) => t * t * (3 - 2 * t);

  // When issPosition changes from API, start a new interpolation leg
  useEffect(() => {
    if (!issPosition) return;
    const s = animState.current;
    // Snapshot current interpolated position as the new starting point
    const now = performance.now();
    const elapsed = now - s.startTime;
    const rawT = Math.min(1, elapsed / s.duration);
    const t = smoothstep(rawT);
    s.prevLat = s.prevLat + (s.nextLat - s.prevLat) * t;
    s.prevLon = s.prevLon + (s.nextLon - s.prevLon) * t;
    // Destination is the new API fix
    s.nextLat = issPosition.lat;
    s.nextLon = issPosition.lon;
    s.startTime = now;
    // duration = poll interval so we arrive just as next fix arrives
    s.duration = 5000;
  }, [issPosition]);

  // rAF loop — runs independently of React renders
  useEffect(() => {
    const tick = (now) => {
      const s = animState.current;
      const marker = markerRef.current;
      if (marker) {
        const elapsed = now - s.startTime;
        const rawT = Math.min(1, elapsed / s.duration);
        const t = smoothstep(rawT);
        const lat = s.prevLat + (s.nextLat - s.prevLat) * t;
        const lon = s.prevLon + (s.nextLon - s.prevLon) * t;
        marker.setLatLng([lat, lon]);
      }
      s.rafId = requestAnimationFrame(tick);
    };
    animState.current.rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animState.current.rafId);
  }, []); // runs once on mount, loop is self-sustaining

  if (!issPosition) return null;

  // Initial position — rAF takes over immediately after mount
  const issObj = {
    satname: 'ISS (ZARYA)',
    satid: 25544,
    satalt: 408,
    velocity: 7.66,
    satlat: issPosition.lat,
    satlon: issPosition.lon,
    type: 'space-station',
  };

  return (
    <Marker
      ref={markerRef}
      position={[issPosition.lat, issPosition.lon]}
      icon={issIcon}
      zIndexOffset={1000}
      eventHandlers={{
        click: () => {
          if (isIssSelected) {
            if (!showMapDetailCard) {
              actions.setShowMapDetailCard(true);
            } else {
              actions.selectSatellite(null);
            }
          } else {
            actions.selectSatellite(issObj);
          }
        }
      }}
    />
  );
}

// Seeded pseudo-random number generator to place ambient stars deterministically in ocean regions
function seededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

const GENERATED_OCEAN_STARS = (() => {
  const stars = [];
  let seed = 100;
  
  // Ocean coordinate boundary bounding boxes [minLat, maxLat, minLon, maxLon]
  const oceanBoxes = [
    // ─── North Pacific ───
    [10, 55, 140, 178],     // North West Pacific (East of Japan)
    [10, 55, -178, -125],    // North East Pacific (West of US)
    
    // ─── South Pacific ───
    [-55, -5, 150, 178],     // South West Pacific (East of Australia)
    [-55, -5, -178, -85],    // South East Pacific (West of South America)
    
    // ─── Atlantic Ocean ───
    [10, 60, -60, -25],      // North Atlantic (between Americas and Europe/Africa)
    [-50, -5, -35, 10],      // South Atlantic (between South America and Africa)
    
    // ─── Indian Ocean ───
    [-45, -5, 40, 105],      // Indian Ocean (between Africa and Australia)
    
    // ─── Southern Ocean ───
    [-75, -55, -180, 180],   // Southern Ocean (around Antarctica)
    
    // ─── Seas ───
    [5, 22, 55, 95],         // Arabian Sea & Bay of Bengal (India)
    [30, 45, -5, 30],        // Mediterranean Sea (Europe/Africa)

    // ─── High North Pacific & Bering Sea ───
    [52, 66, 160, 180],     // Bering Sea West
    [52, 66, -180, -140],    // Bering Sea East / Gulf of Alaska
    
    // ─── High North Atlantic & Baffin Bay ───
    [55, 75, -70, -50],      // Labrador Sea / Baffin Bay (West of Greenland)
    [60, 80, -25, 45],       // Norwegian / Greenland / Barents Sea (East of Greenland / North of Norway)
    [52, 65, -95, -75],      // Hudson Bay (Canada)
    
    // ─── Arctic Ocean (North of Siberia & Alaska) ───
    [72, 83, -160, -110],    // Beaufort Sea (North of Alaska/Canada)
    [76, 83, 60, 175],       // Kara, Laptev, East Siberian Seas (North of Russia)
  ];

  oceanBoxes.forEach((box, boxIdx) => {
    const [minLat, maxLat, minLon, maxLon] = box;
    const area = (maxLat - minLat) * (maxLon - minLon);
    const starCount = Math.max(10, Math.floor(area / 160)); 
    
    for (let i = 0; i < starCount; i++) {
      const lat = minLat + seededRandom(seed++) * (maxLat - minLat);
      const lon = minLon + seededRandom(seed++) * (maxLon - minLon);
      const delay = (seededRandom(seed++) * 4).toFixed(1);
      const size = (1.2 + seededRandom(seed++) * 1.8).toFixed(1);
      
      stars.push({
        id: `star-${boxIdx}-${i}`,
        coords: [lat, lon],
        delay: `${delay}s`,
        size: `${size}px`
      });
    }
  });

  return stars;
})();

const GRID_LINES = (() => {
  const lines = [];
  // Latitudes (horizontal lines)
  for (let lat = -80; lat <= 80; lat += 20) {
    lines.push({
      id: `lat-${lat}`,
      positions: [[lat, -180], [lat, 180]],
    });
  }
  // Longitudes (vertical lines)
  for (let lon = -180; lon <= 180; lon += 20) {
    lines.push({
      id: `lon-${lon}`,
      positions: [[-85, lon], [85, lon]],
    });
  }
  return lines;
})();

// Asteroid custom icon
function createAsteroidIcon(isHazardous, selected = false) {
  // Hazardous = danger/alert, non-hazardous = secondary status dot (accent-amber)
  const color = isHazardous ? 'var(--accent-alert)' : 'var(--accent-amber)';
  const size = selected ? 10 : 7;
  
  const reticleHtml = selected ? `
    <svg viewBox="0 0 30 30" style="position: absolute; width: 36px; height: 36px; top: -11px; left: -11px; pointer-events: none; animation: reticleRotate 8s linear infinite;">
      <path d="M 6 2 A 12 12 0 0 1 24 2" fill="none" stroke="${color}" stroke-width="0.75" stroke-dasharray="1.5, 1.5" />
      <path d="M 24 28 A 12 12 0 0 1 6 28" fill="none" stroke="${color}" stroke-width="0.75" stroke-dasharray="1.5, 1.5" />
      <line x1="2" y1="2" x2="6" y2="2" stroke="${color}" stroke-width="1.2" />
      <line x1="2" y1="2" x2="2" y2="6" stroke="${color}" stroke-width="1.2" />
      <line x1="28" y1="2" x2="24" y2="2" stroke="${color}" stroke-width="1.2" />
      <line x1="28" y1="2" x2="28" y2="6" stroke="${color}" stroke-width="1.2" />
      <line x1="2" y1="28" x2="6" y2="28" stroke="${color}" stroke-width="1.2" />
      <line x1="2" y1="28" x2="2" y2="24" stroke="${color}" stroke-width="1.2" />
      <line x1="28" y1="28" x2="24" y2="28" stroke="${color}" stroke-width="1.2" />
      <line x1="28" y1="28" x2="28" y2="24" stroke="${color}" stroke-width="1.2" />
    </svg>
  ` : '';

  return L.divIcon({
    className: 'ast-marker-icon',
    html: `<div style="
      width: ${size}px; height: ${size}px;
      background: ${selected ? 'var(--accent)' : color};
      border-radius: 50%;
      border: ${selected ? '1.5px solid var(--text-primary)' : '1px solid rgba(255,255,255,0.4)'};
      transition: all 0.2s;
    "></div>${reticleHtml}`,
    iconSize: [size + 4, size + 4],
    iconAnchor: [(size + 4) / 2, (size + 4) / 2],
    popupAnchor: [0, -8],
  });
}

function getAsteroidTrajectoryPoints(ast, now) {
  const points = [];
  const timeWindow = 4 * 3600 * 1000;
  const hash = parseInt(ast.id) || 54321;
  const latSlope = Math.sin(hash) * 20;
  const lonSlope = Math.cos(hash) * 50;
  const gmst = getGMST(now);
  const baseLat = ast.dec;
  const raDeg = ast.ra * 15;
  
  let baseLon = raDeg - gmst;
  baseLon = baseLon % 360;
  if (baseLon > 180) baseLon -= 360;
  if (baseLon < -180) baseLon += 360;

  for (let i = -10; i <= 10; i++) {
    const t = i / 10;
    const lat = Math.max(-90, Math.min(90, baseLat + t * latSlope));
    let lon = baseLon + t * lonSlope;
    lon = lon % 360;
    if (lon > 180) lon -= 360;
    if (lon < -180) lon += 360;
    points.push([lat, lon]);
  }
  return points;
}

/** Map auto-panner to observer location */
function MapController({ location }) {
  const map = useMap();
  useEffect(() => {
    if (location) {
      map.setView([location.lat, location.lon], 4, { animate: true, duration: 1.5 });
    }
  }, [location, map]);
  return null;
}

/** Map auto-resizer to fit container dynamically when sidebar collapses/expands */
function ResizeController() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [map]);
  return null;
}

/** Map click listener for relocation mode */
function GlobeMapClickLocator({ active, onMapClick }) {
  useMapEvents({
    click(e) {
      if (active) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    }
  });
  return null;
}

/**
 * GlobeMap — Leaflet map component.
 * Shows: ISS moving dot + trail, satellite markers, orbital arcs, cone of visibility, observer location.
 * Now supports Constellations view mode showing visible constellations at their sub-stellar coordinates.
 */
export default function GlobeMap({ className = '', mobileView = 'map', showChrome = true }) {
  const { state, actions } = useApp();
  const { 
    location, 
    issPosition, 
    issTrail, 
    satellites, 
    selectedSatellite, 
    showConeOverlay, 
    satelliteFilter,
    viewMode,
    selectedConstellation,
    asteroids = [],
    selectedAsteroid,
    asteroidFilter,
    theme,
    issNextPasses = [],
    showMapDetailCard,
    showDebrisHeatmap
  } = state;

  const [isRelocating, setIsRelocating] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isControlsExpanded, setIsControlsExpanded] = useState(false);

  const handleMapClick = useCallback(async (lat, lon) => {
    if (isResolving) return;
    setIsResolving(true);
    try {
      const name = await reverseGeocode(lat, lon);
      actions.setLocation({ lat, lon });
      actions.setLocationName(name);
    } catch (err) {
      console.error('[Relocate] Geocoding failed:', err);
      actions.setLocation({ lat, lon });
      actions.setLocationName(`${lat.toFixed(4)}°, ${lon.toFixed(4)}°`);
    } finally {
      setIsResolving(false);
      setIsRelocating(false);
    }
  }, [actions, isResolving]);

  const [mapSettings, setMapSettings] = useState({
    showGrid: localStorage.getItem('orbitwatch_settings_show_grid') !== 'false',
    showStars: localStorage.getItem('orbitwatch_settings_show_stars') !== 'false',
    showRadar: localStorage.getItem('orbitwatch_settings_show_radar') !== 'false',
    showCities: localStorage.getItem('orbitwatch_settings_show_cities') !== 'false',
  });

  const [isChatOpen, setIsChatOpen] = useState(() => localStorage.getItem('orbitwatch_chat_open') === 'true');

  useEffect(() => {
    const handleChatToggle = () => {
      setIsChatOpen(localStorage.getItem('orbitwatch_chat_open') === 'true');
    };
    window.addEventListener('orbitwatch-chat-toggle', handleChatToggle);
    return () => window.removeEventListener('orbitwatch-chat-toggle', handleChatToggle);
  }, []);

  useEffect(() => {
    const handleSettingsChange = () => {
      setMapSettings({
        showGrid: localStorage.getItem('orbitwatch_settings_show_grid') !== 'false',
        showStars: localStorage.getItem('orbitwatch_settings_show_stars') !== 'false',
        showRadar: localStorage.getItem('orbitwatch_settings_show_radar') !== 'false',
        showCities: localStorage.getItem('orbitwatch_settings_show_cities') !== 'false',
      });
    };
    window.addEventListener('orbitwatch-settings-changed', handleSettingsChange);
    return () => window.removeEventListener('orbitwatch-settings-changed', handleSettingsChange);
  }, []);

  const mobileToggleRef = useRef(null);
  const mobilePanelRef = useRef(null);

  useEffect(() => {
    const btn = mobileToggleRef.current;
    if (!btn) return;

    const handleToggle = (e) => {
      e.stopPropagation();
      e.preventDefault();
      setIsControlsExpanded(prev => !prev);
    };

    const stopEvents = [
      'mousedown', 'mouseup', 'touchmove', 'pointerdown', 'pointerup', 'pointermove', 
      'dblclick', 'contextmenu', 'wheel'
    ];
    const handler = (e) => e.stopPropagation();

    btn.addEventListener('click', handleToggle);
    btn.addEventListener('touchstart', handleToggle, { passive: false });
    stopEvents.forEach(evt => btn.addEventListener(evt, handler));

    return () => {
      btn.removeEventListener('click', handleToggle);
      btn.removeEventListener('touchstart', handleToggle);
      stopEvents.forEach(evt => btn.removeEventListener(evt, handler));
    };
  }, [isControlsExpanded]);

  useEffect(() => {
    const panel = mobilePanelRef.current;
    if (!panel) return;

    const stopEvents = [
      'mousedown', 'mouseup', 'touchstart', 'touchend', 'touchmove', 
      'pointerdown', 'pointerup', 'pointermove', 
      'dblclick', 'contextmenu', 'wheel'
    ];
    const handler = (e) => e.stopPropagation();

    stopEvents.forEach(evt => panel.addEventListener(evt, handler, { passive: true }));

    return () => {
      stopEvents.forEach(evt => panel.removeEventListener(evt, handler));
    };
  }, [isControlsExpanded]);

  // Filter based on active selection
  const filteredSatellites = satellites.filter(sat => {
    if (sat.satid === 25544) return false; // Filter out duplicate ISS marker
    if (satelliteFilter === 'all') return true;
    if (satelliteFilter === 'major') {
      return sat.type === 'space-station' || sat.type === 'weather' || sat.type === 'earth-obs' || sat.type === 'gps';
    }
    return sat.type === satelliteFilter;
  });

  // Filter asteroids based on active selection
  const filteredAsteroids = useMemo(() => {
    if (viewMode !== 'asteroids') return [];
    return asteroids.filter(ast => {
      if (asteroidFilter === 'phas') return ast.is_potentially_hazardous;
      if (asteroidFilter === 'close') {
        const timeDiff = Math.abs(Date.now() - ast.close_approach_timestamp);
        return timeDiff < 24 * 3600 * 1000;
      }
      return true;
    });
  }, [asteroids, asteroidFilter, viewMode]);

  // Calculate visible constellations and their sub-stellar map coordinates
  const visibleConstellations = useMemo(() => {
    if (!location) return [];
    const now = Date.now();
    return CONSTELLATIONS.map(c => {
      const subStellar = getSubStellarPoint(c.ra, c.dec, now);
      const coords = getLocalCoordinates(c.ra, c.dec, location.lat, location.lon, now);
      return { ...c, subStellar, coords };
    })
    .filter(c => c.coords.el > 0);
  }, [location]);

  const observerIcon = useRef(createObserverIcon()).current;
  const radarIcon = useRef(createRadarIcon()).current;

  // Build ISS trail positions
  const trailPositions = issTrail.map(p => [p.lat, p.lon]);

  // ISS cone footprint
  const issCone = issPosition && showConeOverlay
    ? calculateConeFootprint(issPosition.lat, issPosition.lon, 408)
    : null;

  return (
    <div className={`relative w-full h-full ${className} ${isRelocating ? 'relocating-map' : ''}`}>
      <MapContainer
        center={location ? [location.lat, location.lon] : [20, 0]}
        zoom={location ? 4 : 2}
        className="w-full h-full"
        style={{ background: 'var(--color-space)' }}
        zoomControl={false}
        attributionControl={true}
      >
        {/* Dynamic theme tile layer */}
        <TileLayer
          key={theme}
          url={theme === 'light'
            ? "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          }
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          maxZoom={19}
          subdomains="abcd"
        />

        {/* Neon-glow country borders */}
        <Pane name="border-pane" style={{ zIndex: 400 }}>
            <GeoJSON
              data={worldData}
              style={() => ({
                color: 'rgba(77, 141, 255, 0.22)',
                weight: 0.8,
                fillColor: 'rgba(15, 22, 35, 0.35)',
                fillOpacity: 1,
              })}
            />
        </Pane>

        <MapController location={location} />
        <ResizeController />
        <GlobeMapClickLocator active={isRelocating} onMapClick={handleMapClick} />

        {/* Faint Lat/Long Grid Overlay */}
        {mapSettings.showGrid && (
          <FeatureGroup>
            {GRID_LINES.map(line => (
              <Polyline
                key={line.id}
                positions={line.positions}
                color="rgba(77, 141, 255, 0.06)"
                weight={0.75}
                dashArray="2, 5"
                interactive={false}
              />
            ))}
          </FeatureGroup>
        )}

        {/* Ambient Stars in Oceans */}
        {mapSettings.showStars && (
          <FeatureGroup>
            {GENERATED_OCEAN_STARS.map((star) => {
              const starIcon = L.divIcon({
                className: 'ambient-star',
                html: `<div class="star-sparkle" style="
                  width: ${star.size};
                  height: ${star.size};
                  animation-delay: ${star.delay};
                  box-shadow: 0 0 3px #ffffff, 0 0 6px #ffffff;
                "></div>`,
                iconSize: [6, 6],
                iconAnchor: [3, 3]
              });
              return (
                <Marker
                  key={star.id}
                  position={star.coords}
                  icon={starIcon}
                  interactive={false}
                  zIndexOffset={-400}
                />
              );
            })}
          </FeatureGroup>
        )}

        {/* Radar sweep at user location */}
        {location && mapSettings.showRadar && (
          <Pane name="radar-sweep-pane" style={{ zIndex: 450 }}>
            <Marker 
              position={[location.lat, location.lon]} 
              icon={radarIcon} 
              interactive={false}
            />
          </Pane>
        )}

        {/* Ambient City Lights Glow Overlay */}
        {mapSettings.showCities && (
          <FeatureGroup>
            {CITY_LIGHTS.map((coords, idx) => {
              const cityIcon = L.divIcon({
                className: 'city-glow-dot',
                html: '<div style="width: 2.5px; height: 2.5px; background: rgba(255, 180, 90, 0.45); border-radius: 50%; box-shadow: 0 0 3px rgba(255, 180, 90, 0.65);"></div>',
                iconSize: [3, 3],
                iconAnchor: [1.5, 1.5],
              });
              return (
                <Marker
                  key={`city-light-${idx}`}
                  position={coords}
                  icon={cityIcon}
                  interactive={false}
                  zIndexOffset={-450}
                />
              );
            })}
          </FeatureGroup>
        )}

        {/* Debris Density Heatmap — thermographic canvas layer (rendered outside MapContainer via portal) */}
        {showDebrisHeatmap && <HeatmapCanvasLayer hotspots={DEBRIS_HOTSPOTS} />}

        {/* Observer location marker */}
        {location && (
          <Marker position={[location.lat, location.lon]} icon={observerIcon}>
            <Popup>
              <div className="font-sans text-xs">
                <p className="font-bold text-cyan uppercase tracking-wider">{location.name}</p>
                <p className="text-muted text-xs mt-1">
                  <span className="font-mono">{location.lat.toFixed(4)}°N</span>, <span className="font-mono">{location.lon.toFixed(4)}°E</span>
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Satellite Tracking View Mode Overlays */}
        {viewMode === 'satellites' && (
          <>
            {/* ISS trail segments with fading opacity and tapered weight */}
            {trailPositions.length > 1 && (
              <>
                {trailPositions.map((pos, idx) => {
                  if (idx === 0) return null;
                  const prevPos = trailPositions[idx - 1];
                  const progress = idx / (trailPositions.length - 1);
                  const opacity = 0.6 * progress;
                  const weight = 1 + 2 * progress;
                  return (
                    <Polyline
                      key={`iss-trail-${idx}`}
                      positions={[prevPos, pos]}
                      color="var(--accent)"
                      weight={weight}
                      opacity={opacity}
                      className="iss-trail-line"
                    />
                  );
                })}
              </>
            )}

            {/* ISS cone of visibility */}
            {issCone && (
              <Polygon
                positions={issCone}
                pathOptions={{
                  color: 'rgba(255, 0, 127, 0.45)',
                  fillColor: 'rgba(255, 0, 127, 0.06)',
                  fillOpacity: 1,
                  weight: 1.25,
                  dashArray: '4, 4',
                  className: 'cone-overlay glowing-cone-footprint',
                }}
              />
            )}

            {/* ISS marker — smooth gliding interpolation between API fixes */}
            <SmoothISSMarker
              issPosition={issPosition}
              selectedSatellite={selectedSatellite}
              showMapDetailCard={showMapDetailCard}
              actions={actions}
            />

            {/* Selected Satellite orbit & cone footprint */}
            {selectedSatellite && (
              <>
                {/* Orbital arc */}
                <Polyline
                  positions={generateOrbitalArc(selectedSatellite.satlat, selectedSatellite.satlon)}
                  color={getObjectColor(selectedSatellite.type, selectedSatellite.satname)}
                  weight={1.5}
                  opacity={0.65}
                  className="glowing-orbit-line"
                />
                
                {/* Cone overlay */}
                {showConeOverlay && (
                  <Polygon
                    positions={calculateConeFootprint(selectedSatellite.satlat, selectedSatellite.satlon, selectedSatellite.satalt)}
                    pathOptions={{
                      color: getObjectColor(selectedSatellite.type, selectedSatellite.satname),
                      fillColor: `${getObjectColor(selectedSatellite.type, selectedSatellite.satname)}10`,
                      fillOpacity: 1,
                      weight: 1,
                      dashArray: '3, 3',
                      className: 'glowing-cone-footprint',
                    }}
                  />
                )}
              </>
            )}

            {/* Satellite markers */}
            {filteredSatellites.map((sat) => {
              const isSelected = selectedSatellite?.satid === sat.satid;
              const satIcon = createSatIcon(sat.type, sat.satname, isSelected);

              return (
                <Marker
                  key={sat.satid}
                  position={[sat.satlat, sat.satlon]}
                  icon={satIcon}
                  eventHandlers={{
                    click: () => {
                      if (isSelected) {
                        if (!showMapDetailCard) {
                          actions.setShowMapDetailCard(true);
                        } else {
                          actions.selectSatellite(null);
                        }
                      } else {
                        actions.selectSatellite(sat);
                      }
                    },
                  }}
                />
              );
            })}
          </>
        )}

        {/* Constellations Tracking View Mode Overlays */}
        {viewMode === 'constellations' && visibleConstellations.map((constell) => {
          const isSelected = selectedConstellation?.id === constell.id;
          
          // Calculate the full shape (stars and lines) for this constellation dynamically
          const shape = getConstellationShape(constell, Date.now());

          // Subtle center anchor icon (a tiny glowing dot instead of a star emoji/marker)
          const centerIcon = L.divIcon({
            className: 'constell-center-icon',
            html: `<div style="
              width: 8px; height: 8px;
              border-radius: 50%;
              background: ${isSelected ? '#ffdf00' : '#ff007f'};
              box-shadow: 0 0 6px ${isSelected ? '#ffdf00' : '#ff007f'};
              opacity: 0.8;
            "></div>`,
            iconSize: [8, 8],
            iconAnchor: [4, 4],
            popupAnchor: [0, -6],
          });

          const constellCone = isSelected && showConeOverlay
            ? calculateConeFootprint(constell.subStellar.lat, constell.subStellar.lon, 4000, 10)
            : null;

          return (
            <Fragment key={constell.id}>
              {/* Constellation visibility cone */}
              {constellCone && (
                <Polygon
                  positions={constellCone}
                  pathOptions={{
                    color: 'rgba(255, 223, 0, 0.4)',
                    fillColor: 'rgba(255, 223, 0, 0.05)',
                    fillOpacity: 1,
                    weight: 1.5,
                    dashArray: '6, 4',
                    className: 'cone-overlay glowing-cone-footprint',
                  }}
                />
              )}

              {/* Line linking observer to sub-stellar point */}
              {isSelected && location && (
                <Polyline
                  positions={[
                    [location.lat, location.lon],
                    [constell.subStellar.lat, constell.subStellar.lon],
                  ]}
                  pathOptions={{
                    color: 'var(--accent-amber)',
                    weight: 1.5,
                    dashArray: '4, 4',
                  }}
                />
              )}

              {/* Outlines of actual constellation shape */}
              {shape.connections.map(([idx1, idx2], lineIdx) => {
                const star1 = shape.stars[idx1];
                const star2 = shape.stars[idx2];
                if (!star1 || !star2) return null;
                return (
                  <Polyline
                    key={`constell-line-${constell.id}-${lineIdx}`}
                    positions={[
                      [star1.lat, star1.lon],
                      [star2.lat, star2.lon],
                    ]}
                    pathOptions={{
                      color: isSelected ? 'var(--accent)' : 'var(--surface-border)',
                      weight: isSelected ? 2.0 : 1.0,
                      opacity: isSelected ? 0.95 : 0.35,
                      dashArray: isSelected ? 'none' : '2, 3',
                    }}
                  />
              );
            })}

              {/* Individual star nodes of actual constellation shape */}
              {shape.stars.map((star, starIdx) => (
                <Circle
                  key={`constell-star-${constell.id}-${starIdx}`}
                  center={[star.lat, star.lon]}
                  radius={isSelected ? 14000 : 8000}
                  pathOptions={{
                    color: isSelected ? 'var(--text-primary)' : 'var(--surface-border)',
                    fillColor: '#ffffff',
                    fillOpacity: 0.9,
                    weight: 1,
                  }}
                />
              ))}

              {/* Clickable central anchor marker */}
              <Marker
                key={`constell-marker-${constell.id}`}
                position={[constell.subStellar.lat, constell.subStellar.lon]}
                icon={centerIcon}
                eventHandlers={{
                  click: () => actions.selectConstellation(isSelected ? null : constell),
                }}
              />
            </Fragment>
          );
        })}

        {/* Asteroids Tracking View Mode Overlays */}
        {viewMode === 'asteroids' && (
          <>
            {/* Selected Asteroid's Trajectory Line */}
            {selectedAsteroid && (
              <Polyline
                positions={getAsteroidTrajectoryPoints(selectedAsteroid, Date.now())}
                color={selectedAsteroid.is_potentially_hazardous ? 'var(--accent-alert)' : 'var(--accent-amber)'}
                weight={2}
                opacity={0.8}
                className="glowing-orbit-line"
              />
            )}

            {/* Asteroid markers */}
            {filteredAsteroids.map((ast) => {
              const isSelected = selectedAsteroid?.id === ast.id;
              const astIcon = createAsteroidIcon(ast.is_potentially_hazardous, isSelected);

              return (
                <Marker
                  key={ast.id}
                  position={[ast.lat, ast.lon]}
                  icon={astIcon}
                  eventHandlers={{
                    click: () => {
                      if (isSelected) {
                        if (!showMapDetailCard) {
                          actions.setShowMapDetailCard(true);
                        } else {
                          actions.selectAsteroid(null);
                        }
                      } else {
                        actions.selectAsteroid(ast);
                      }
                    },
                  }}
                />
              );
            })}
          </>
        )}
      </MapContainer>

      {/* Top-Left Cluster Container */}
      {mobileView === 'map' && (
        <div className="hidden lg:flex absolute top-3 left-3 z-[1000] flex-col gap-2 items-start pointer-events-none">
          {/* Row 1: Location Pill & ISS LIVE status pill */}
          <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
            {location && (
              <div className="glass-panel flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface/90 backdrop-blur border border-surface-border text-text-primary text-[10px] font-sans font-bold uppercase tracking-wider shadow-lg">
                <MapPin className="w-3 h-3 text-cyan" />
                <span>{location.name}</span>
              </div>
            )}

            <button
              onClick={() => setIsRelocating(prev => !prev)}
              className={`glass-panel flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface/90 backdrop-blur border transition-all text-[10px] font-sans font-bold uppercase tracking-wider shadow-lg pointer-events-auto hover:border-cyan
                ${isRelocating 
                  ? 'border-accent-amber text-accent-amber animate-pulse' 
                  : 'border-surface-border text-text-secondary hover:text-text-primary'}`}
              title="Click on the map to relocate observer"
              disabled={isResolving}
            >
              <Globe className="w-3 h-3 text-cyan" />
              <span>{isRelocating ? 'Click Map' : 'Relocate'}</span>
            </button>
            
            <button
              onClick={actions.toggleDebrisHeatmap}
              className={`glass-panel flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface/90 backdrop-blur border transition-all text-[10px] font-sans font-bold uppercase tracking-wider shadow-lg pointer-events-auto cursor-pointer
                ${showDebrisHeatmap 
                  ? 'border-red-500/40 text-red-400 bg-red-500/10 shadow-[0_0_10px_rgba(239,68,68,0.2)]' 
                  : 'border-surface-border text-muted hover:text-text-primary'}`}
              title="Toggle Thermal Concentration Map"
            >
              <span className={`w-2 h-2 rounded-full ${showDebrisHeatmap ? 'bg-red-500 animate-pulse' : 'bg-white/20'}`} />
              <span>{showDebrisHeatmap ? 'Thermal Map ON' : 'Thermal Map OFF'}</span>
            </button>

            {viewMode === 'satellites' && issPosition && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-panel border border-border shadow-lg">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan animate-pulse" />
                <span className="text-cyan text-[10px] font-sans font-bold uppercase tracking-wider">ISS LIVE</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Target count & Filter badge */}
      {mobileView === 'map' && !isChatOpen && (
        <div className="hidden lg:flex absolute top-3 right-3 z-[1000] items-center gap-1.5 px-2 py-1 rounded-md bg-panel border border-border shadow-lg">
          {viewMode === 'constellations' ? (
            <span className="text-cyan text-[10px] font-sans uppercase tracking-wider font-bold shrink-0">
              <span className="font-mono">{visibleConstellations.length}</span> CONSTELLATIONS VISIBLE
            </span>
          ) : viewMode === 'asteroids' ? (
            <>
              <span className="text-cyan text-[10px] font-sans uppercase tracking-wider font-bold shrink-0 hidden sm:inline">
                <span className="font-mono">{filteredAsteroids.length}/{asteroids.length}</span> ASTEROIDS
              </span>
              <select
                value={asteroidFilter}
                onChange={(e) => actions.setAsteroidFilter(e.target.value)}
                className="text-[10px] font-sans uppercase tracking-wider font-bold bg-panel border border-border rounded px-1 py-0.5 text-text focus:outline-none focus:border-cyan cursor-pointer transition-colors"
              >
                <option value="all">All NEAs</option>
                <option value="phas">Hazardous (PHAs)</option>
                <option value="close">Close Approaches</option>
              </select>
            </>
          ) : (
            <>
              <span className="text-cyan text-[10px] font-sans uppercase tracking-wider font-bold shrink-0 hidden sm:inline">
                <span className="font-mono">{filteredSatellites.length}/{satellites.length}</span> OVERHEAD
              </span>
              <select
                value={satelliteFilter}
                onChange={(e) => actions.setSatelliteFilter(e.target.value)}
                className="text-[10px] font-sans uppercase tracking-wider font-bold bg-panel border border-border rounded px-1 py-0.5 text-text focus:outline-none focus:border-cyan cursor-pointer transition-colors"
              >
                <option value="major">Major</option>
                <option value="space-station">Stations</option>
                <option value="tv">TV Sats</option>
                <option value="gps">GPS</option>
                <option value="comms">Comms</option>
                <option value="weather">Weather</option>
                <option value="debris">Debris</option>
                <option value="all">All</option>
              </select>
            </>
          )}
        </div>
      )}

      {/* Collapsed Controls Toggle for Mobile */}
      {mobileView === 'map' && (
        <div className={`lg:hidden absolute top-3 right-3 z-[2010] flex flex-col items-end gap-2 transition-all duration-300 ${showChrome ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-12 pointer-events-none'}`}>
          <button
            ref={mobileToggleRef}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setIsControlsExpanded(prev => !prev);
            }}
            className="w-10 h-10 rounded-md flex items-center justify-center border border-white/[0.08] bg-panel/90 backdrop-blur shadow-lg text-cyan hover:text-text-primary active:scale-95 transition-all pointer-events-auto"
            title="Toggle observatory controls"
          >
            {isControlsExpanded ? <X className="w-5 h-5" /> : <SlidersHorizontal className="w-5 h-5" />}
          </button>

          {/* Expanded Dropdown Panel */}
          {isControlsExpanded && (
            <div 
              ref={mobilePanelRef}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="glass-panel p-3 rounded-lg bg-surface/95 border border-white/[0.08] shadow-2xl flex flex-col gap-2.5 min-w-[200px] animate-fade-in pointer-events-auto"
            >
              <span className="text-[8px] font-sans text-cyan uppercase tracking-widest font-bold">Observatory Control</span>
              
              {/* Location display */}
              {location && (
                <div className="flex items-center gap-1.5 justify-between py-1 border-b border-white/[0.04]">
                  <span className="text-muted text-[9px] uppercase tracking-wider font-semibold">Location</span>
                  <div className="flex items-center gap-1 text-text-primary text-[10px] font-bold uppercase tracking-wider">
                    <MapPin className="w-3 h-3 text-cyan" />
                    <span>{location.name}</span>
                  </div>
                </div>
              )}

              {/* Relocate Action */}
              <button
                onClick={() => setIsRelocating(prev => !prev)}
                className={`flex items-center justify-between w-full px-2 py-1 rounded border transition-all text-[9px] font-sans font-bold uppercase tracking-wider
                  ${isRelocating 
                    ? 'border-accent-amber text-accent-amber bg-accent-amber/10 animate-pulse' 
                    : 'border-white/[0.08] bg-white/[0.02] text-text-secondary hover:text-text-primary hover:border-cyan'}`}
                title="Click on the map to relocate observer"
                disabled={isResolving}
              >
                <span className="flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-cyan" />
                  <span>Relocate</span>
                </span>
                <span className="text-[8px] text-muted">{isRelocating ? 'Click Map' : 'Change'}</span>
              </button>

              {/* ISS Live Indicator */}
              {viewMode === 'satellites' && issPosition && (
                <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                  <span className="text-muted text-[9px] uppercase tracking-wider font-semibold">ISS Status</span>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan/10 border border-cyan/35 shadow-[0_0_8px_rgba(77,141,255,0.1)]">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan animate-pulse" />
                    <span className="text-cyan text-[8px] font-sans font-bold uppercase tracking-wider">LIVE</span>
                  </div>
                </div>
              )}

              {/* Visibility Cone Toggle */}
              <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                <span className="text-muted text-[9px] uppercase tracking-wider font-semibold">Visibility Cone</span>
                <button
                  onClick={actions.toggleConeOverlay}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded border transition-all text-[8px] font-sans font-bold uppercase tracking-wider
                    ${showConeOverlay 
                      ? 'border-cyan/45 text-cyan bg-cyan/5 shadow-[0_0_8px_rgba(77,141,255,0.1)]' 
                      : 'border-white/[0.08] text-muted'}`}
                >
                  {showConeOverlay ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              {/* Target/Filter Dropdown */}
              <div className="flex flex-col gap-1 py-1">
                <span className="text-muted text-[9px] uppercase tracking-wider font-semibold">Filter Targets</span>
                {viewMode === 'asteroids' ? (
                  <select
                    value={asteroidFilter}
                    onChange={(e) => actions.setAsteroidFilter(e.target.value)}
                    className="text-[9px] font-sans uppercase tracking-wider font-bold bg-panel border border-white/[0.08] rounded px-1.5 py-1 text-text focus:outline-none focus:border-cyan cursor-pointer transition-colors w-full"
                  >
                    <option value="all">All NEAs</option>
                    <option value="phas">Hazardous (PHAs)</option>
                    <option value="close">Close Approaches</option>
                  </select>
                ) : (
                  <select
                    value={satelliteFilter}
                    onChange={(e) => actions.setSatelliteFilter(e.target.value)}
                    className="text-[9px] font-sans uppercase tracking-wider font-bold bg-panel border border-white/[0.08] rounded px-1.5 py-1 text-text focus:outline-none focus:border-cyan cursor-pointer transition-colors w-full"
                  >
                    <option value="major">Major</option>
                    <option value="space-station">Stations</option>
                    <option value="tv">TV Sats</option>
                    <option value="gps">GPS</option>
                    <option value="comms">Comms</option>
                    <option value="weather">Weather</option>
                    <option value="debris">Debris</option>
                    <option value="all">All</option>
                  </select>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Category Legend pill row (now unified in top-left container) */}

      {/* Selected Object Detail Card */}
      {selectedSatellite && showMapDetailCard && (
        <div className="absolute top-[42px] right-3 w-72 z-[1000] glass-panel p-3 rounded-lg bg-surface/90 backdrop-blur border border-surface-border shadow-2xl animate-fade-in flex flex-col gap-2">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <span className="text-[8px] font-sans text-cyan uppercase tracking-wider font-bold">TARGET TRACKED</span>
              <h4 className="font-sans uppercase text-[11px] font-bold text-text-primary tracking-wider truncate mt-0.5">
                {selectedSatellite.satname}
              </h4>
              <p className="text-muted text-[9px] font-mono mt-0.5">NORAD ID #{selectedSatellite.satid}</p>
            </div>
            <button 
              onClick={() => actions.setShowMapDetailCard(false)}
              className="text-text-secondary hover:text-text-primary p-0.5 rounded hover:bg-white/5 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan animate-pulse" />
            <span className="text-[8px] font-sans text-cyan uppercase tracking-wider font-bold">TELEMETRY LOCK ACTIVE</span>
            <span className="ml-auto text-[8px] font-sans text-text-secondary uppercase tracking-wider bg-white/5 px-1.5 py-0.5 rounded border border-surface-border">
              {selectedSatellite.type?.replace('-', ' ')}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 border-t border-surface-border/50 pt-2">
            <div>
              <span className="text-muted font-sans text-[8px] uppercase tracking-wider">ALTITUDE</span>
              <span className="font-mono text-text-primary text-[11px] font-bold mt-0.5 block">
                {selectedSatellite.satalt?.toFixed(1)} km
              </span>
            </div>
            <div>
              <span className="text-muted font-sans text-[8px] uppercase tracking-wider">VELOCITY</span>
              <span className="font-mono text-text-primary text-[11px] font-bold mt-0.5 block">
                {selectedSatellite.velocity?.toFixed(2)} km/s
              </span>
            </div>
            <div>
              <span className="text-muted font-sans text-[8px] uppercase tracking-wider">LATITUDE</span>
              <span className="font-mono text-text-primary text-[11px] font-bold mt-0.5 block">
                {selectedSatellite.satlat?.toFixed(4)}°N
              </span>
            </div>
            <div>
              <span className="text-muted font-sans text-[8px] uppercase tracking-wider">LONGITUDE</span>
              <span className="font-mono text-text-primary text-[11px] font-bold mt-0.5 block">
                {selectedSatellite.satlon?.toFixed(4)}°E
              </span>
            </div>
          </div>
        </div>
      )}

      {selectedAsteroid && showMapDetailCard && (
        <div className="absolute top-[42px] right-3 w-72 z-[1000] glass-panel p-3 rounded-lg bg-surface/90 backdrop-blur border border-surface-border shadow-2xl animate-fade-in flex flex-col gap-2">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <span className="text-[8px] font-sans text-accent-amber uppercase tracking-wider font-bold">NEA TARGET TRACKED</span>
              <h4 className="font-sans uppercase text-[11px] font-bold text-text-primary tracking-wider truncate mt-0.5">
                {selectedAsteroid.name}
              </h4>
              <p className="text-muted text-[9px] font-mono mt-0.5">EST. DIA: {selectedAsteroid.estimated_diameter_min_m?.toFixed(0)}-{selectedAsteroid.estimated_diameter_max_m?.toFixed(0)} m</p>
            </div>
            <button 
              onClick={() => actions.setShowMapDetailCard(false)}
              className="text-text-secondary hover:text-text-primary p-0.5 rounded hover:bg-white/5 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${selectedAsteroid.is_potentially_hazardous ? 'bg-accent-alert' : 'bg-accent-amber'} animate-pulse`} />
            <span className={`text-[8px] font-sans ${selectedAsteroid.is_potentially_hazardous ? 'text-accent-alert' : 'text-accent-amber'} uppercase tracking-wider font-bold`}>
              {selectedAsteroid.is_potentially_hazardous ? 'POTENTIALLY HAZARDOUS' : 'SAFE CLOSE APPROACH'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 border-t border-surface-border/50 pt-2">
            <div>
              <span className="text-muted font-sans text-[8px] uppercase tracking-wider">MISS DISTANCE</span>
              <span className="font-mono text-text-primary text-[11px] font-bold mt-0.5 block">
                {(selectedAsteroid.miss_distance_km / 1e6).toFixed(2)}M km
              </span>
            </div>
            <div>
              <span className="text-muted font-sans text-[8px] uppercase tracking-wider">VELOCITY</span>
              <span className="font-mono text-text-primary text-[11px] font-bold mt-0.5 block">
                {selectedAsteroid.relative_velocity_kms?.toFixed(2)} km/s
              </span>
            </div>
            <div>
              <span className="text-muted font-sans text-[8px] uppercase tracking-wider">CLOSE APPROACH</span>
              <span className="font-mono text-text-primary text-[11px] font-bold mt-0.5 block">
                {new Date(selectedAsteroid.close_approach_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div>
              <span className="text-muted font-sans text-[8px] uppercase tracking-wider">MAGNITUDE (H)</span>
              <span className="font-mono text-text-primary text-[11px] font-bold mt-0.5 block">
                {selectedAsteroid.absolute_magnitude_h}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Telemetry Stat Strip (now unified in top-left container) */}

      {/* Corner HUD framing brackets */}
      <div className="absolute inset-2 pointer-events-none z-[999] border border-white/[0.02] rounded-lg">
        {/* Top Left Bracket */}
        <div className="absolute top-0 left-0 w-3 h-3 border-t-[1.5px] border-l-[1.5px] border-cyan/30 rounded-tl" />
        {/* Top Right Bracket */}
        <div className="absolute top-0 right-0 w-3 h-3 border-t-[1.5px] border-r-[1.5px] border-cyan/30 rounded-tr" />
        {/* Bottom Left Bracket */}
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b-[1.5px] border-l-[1.5px] border-cyan/30 rounded-bl" />
        {/* Bottom Right Bracket */}
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b-[1.5px] border-r-[1.5px] border-cyan/30 rounded-br" />
        
        {/* Corner Status telemetry labels */}
        <div className="absolute bottom-1.5 left-2 text-[6.5px] font-mono text-cyan/35 uppercase tracking-[0.15em]">
          SYS_REF: WGS84 // GRID_SCALE: DYNAMIC
        </div>
        <div className="absolute bottom-1.5 right-2 text-[6.5px] font-mono text-cyan/35 uppercase tracking-[0.15em]">
          ALT_REF: MSL // RADAR_RANGE: 150KM
        </div>
      </div>

      {/* Relocate Mode Banner Overlay */}
      {isRelocating && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[1001] glass-panel px-4 py-2 rounded-lg bg-surface/95 border border-accent-amber shadow-2xl flex items-center gap-3 animate-fade-in pointer-events-auto">
          <div className="w-2 h-2 rounded-full bg-accent-amber animate-ping" />
          <span className="text-[10px] font-sans font-bold text-text-primary uppercase tracking-wider">
            {isResolving ? 'Resolving new coordinates...' : 'Select Location: Click anywhere on the map'}
          </span>
          {!isResolving && (
            <button
              onClick={() => setIsRelocating(false)}
              className="px-2 py-0.5 rounded bg-white/5 border border-white/10 hover:bg-white/10 text-[9px] font-sans font-bold uppercase tracking-wider transition-colors text-text"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {/* Debris Heatmap Legend */}
      {showDebrisHeatmap && <HeatmapLegend hotspots={DEBRIS_HOTSPOTS} />}

      {/* Atmospheric Vignette Overlay */}
      <div 
        className="absolute inset-0 pointer-events-none z-[400]" 
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(7, 10, 18, 0.45) 100%)',
        }}
      />
    </div>
  );
}
