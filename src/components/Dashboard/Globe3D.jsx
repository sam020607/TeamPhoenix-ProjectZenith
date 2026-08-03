import React, { useRef, useMemo, Suspense, Fragment, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useTexture, Stars, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useApp } from '../../context/AppContext.jsx';
import { generateOrbitalArc } from '../../utils/orbitMath.js';
import { SAT_TYPE_CONFIG } from '../../data/mockSatellites.js';
import { CONSTELLATIONS, getSubStellarPoint, getLocalCoordinates, getConstellationShape, getGMST } from '../../data/constellations.js';
import worldData from '../../data/world.json';
import { reverseGeocode } from '../../api/geocodeApi.js';
import { MapPin, Globe, Loader2, SlidersHorizontal, X } from 'lucide-react';

// Expanded debris hotspot catalogue — synced with GlobeMap.jsx
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

/**
 * Animated ISS marker — renders an HTML billboard dot that pulses and animates exactly like the flat map.
 */
function AnimatedISSMarker({ position, onClick, isSelected }) {
  const htmlRef = useRef(null);
  const groupRef = useRef(null);

  useFrame(({ camera }) => {
    if (!groupRef.current || !htmlRef.current) return;
    const worldPos = new THREE.Vector3();
    groupRef.current.getWorldPosition(worldPos);
    
    // Calculate dot product to cull backface markers behind the earth
    const camPos = camera.position;
    const dot = worldPos.x * (camPos.x - worldPos.x) +
                worldPos.y * (camPos.y - worldPos.y) +
                worldPos.z * (camPos.z - worldPos.z);
    const isFacing = dot > 0;
    htmlRef.current.style.display = isFacing ? 'block' : 'none';
  });

  return (
    <group ref={groupRef} position={position}>
      <Html
        ref={htmlRef}
        center
        distanceFactor={6}
        style={{ pointerEvents: 'auto' }}
      >
        <div className="relative flex items-center justify-center">
          <button
            onClick={onClick}
            className="iss-dot pointer-events-auto"
            style={{ 
              cursor: 'pointer',
              border: isSelected ? '2px solid var(--text-primary)' : ''
            }}
          />
          {isSelected && (
            <svg viewBox="0 0 30 30" className="animate-spin-slow" style={{ position: 'absolute', width: '36px', height: '36px', pointerEvents: 'none' }}>
              <path d="M 6 2 A 12 12 0 0 1 24 2" fill="none" stroke="#e0584f" strokeWidth="0.75" strokeDasharray="1.5, 1.5" />
              <path d="M 24 28 A 12 12 0 0 1 6 28" fill="none" stroke="#e0584f" strokeWidth="0.75" strokeDasharray="1.5, 1.5" />
              <line x1="2" y1="2" x2="6" y2="2" stroke="#e0584f" strokeWidth="1.2" />
              <line x1="2" y1="2" x2="2" y2="6" stroke="#e0584f" strokeWidth="1.2" />
              <line x1="28" y1="2" x2="24" y2="2" stroke="#e0584f" strokeWidth="1.2" />
              <line x1="28" y1="2" x2="28" y2="6" stroke="#e0584f" strokeWidth="1.2" />
              <line x1="2" y1="28" x2="6" y2="28" stroke="#e0584f" strokeWidth="1.2" />
              <line x1="2" y1="28" x2="2" y2="24" stroke="#e0584f" strokeWidth="1.2" />
              <line x1="28" y1="28" x2="24" y2="28" stroke="#e0584f" strokeWidth="1.2" />
              <line x1="28" y1="28" x2="28" y2="24" stroke="#e0584f" strokeWidth="1.2" />
            </svg>
          )}
        </div>
      </Html>
    </group>
  );
}

/**
 * Satellite dot with flat CSS shadow-glow borders matching the flat-map.
 */
function GlowDot({ position, color, glowColor, onClick, children }) {
  const htmlRef = useRef(null);
  const groupRef = useRef(null);
  const isSelected = color === '#ffffff'; // In SceneContent: color={isSelected ? '#ffffff' : color}
  const dotColor = isSelected ? '#ffffff' : (glowColor || color);
  const sizePx = isSelected ? 8 : 5;
  const shadowColor = glowColor || color;

  useFrame(({ camera }) => {
    if (!groupRef.current || !htmlRef.current) return;
    const worldPos = new THREE.Vector3();
    groupRef.current.getWorldPosition(worldPos);

    // Calculate dot product to cull backface markers behind the earth
    const camPos = camera.position;
    const dot = worldPos.x * (camPos.x - worldPos.x) +
                worldPos.y * (camPos.y - worldPos.y) +
                worldPos.z * (camPos.z - worldPos.z);
    const isFacing = dot > 0;
    htmlRef.current.style.display = isFacing ? 'block' : 'none';
  });

  return (
    <group ref={groupRef} position={position}>
      <Html
        ref={htmlRef}
        center
        distanceFactor={6}
        style={{ pointerEvents: 'auto' }}
      >
        <div className="relative flex items-center justify-center">
          <button
            onClick={onClick}
            className="relative transition-all duration-150 rounded-full focus:outline-none"
            style={{
              width: `${sizePx}px`,
              height: `${sizePx}px`,
              background: dotColor,
              border: isSelected ? '1.5px solid var(--text-primary)' : 'none',
              boxShadow: isSelected
                ? `0 0 8px ${shadowColor}, 0 0 16px ${shadowColor}`
                : `0 0 6px ${shadowColor}bf, 0 0 14px ${shadowColor}4d`,
              cursor: 'pointer'
            }}
          />
          {isSelected && (
            <svg viewBox="0 0 30 30" className="animate-spin-slow" style={{ position: 'absolute', width: '36px', height: '36px', pointerEvents: 'none' }}>
              <path d="M 6 2 A 12 12 0 0 1 24 2" fill="none" stroke={shadowColor} strokeWidth="0.75" strokeDasharray="1.5, 1.5" />
              <path d="M 24 28 A 12 12 0 0 1 6 28" fill="none" stroke={shadowColor} strokeWidth="0.75" strokeDasharray="1.5, 1.5" />
              <line x1="2" y1="2" x2="6" y2="2" stroke={shadowColor} strokeWidth="1.2" />
              <line x1="2" y1="2" x2="2" y2="6" stroke={shadowColor} strokeWidth="1.2" />
              <line x1="28" y1="2" x2="24" y2="2" stroke={shadowColor} strokeWidth="1.2" />
              <line x1="28" y1="2" x2="28" y2="6" stroke={shadowColor} strokeWidth="1.2" />
              <line x1="2" y1="28" x2="6" y2="28" stroke={shadowColor} strokeWidth="1.2" />
              <line x1="2" y1="28" x2="2" y2="24" stroke={shadowColor} strokeWidth="1.2" />
              <line x1="28" y1="28" x2="24" y2="28" stroke={shadowColor} strokeWidth="1.2" />
              <line x1="28" y1="28" x2="28" y2="24" stroke={shadowColor} strokeWidth="1.2" />
            </svg>
          )}
        </div>
      </Html>
      {children}
    </group>
  );
}

/**
 * Asteroid dot with flat CSS shadow-glow borders matching the flat-map.
 */
function AsteroidHtmlMarker({ position, ast, isSelected, onClick, children }) {
  const htmlRef = useRef(null);
  const groupRef = useRef(null);
  const color = ast.is_potentially_hazardous ? '#e0584f' : '#e0a847';
  const dotColor = isSelected ? '#4d8dff' : color;
  const sizePx = isSelected ? 8 : 5;

  useFrame(({ camera }) => {
    if (!groupRef.current || !htmlRef.current) return;
    const worldPos = new THREE.Vector3();
    groupRef.current.getWorldPosition(worldPos);

    // Calculate dot product to cull backface markers behind the earth
    const camPos = camera.position;
    const dot = worldPos.x * (camPos.x - worldPos.x) +
                worldPos.y * (camPos.y - worldPos.y) +
                worldPos.z * (camPos.z - worldPos.z);
    const isFacing = dot > 0;
    htmlRef.current.style.display = isFacing ? 'block' : 'none';
  });

  return (
    <group ref={groupRef} position={position}>
      <Html
        ref={htmlRef}
        center
        distanceFactor={6}
        style={{ pointerEvents: 'auto' }}
      >
        <div className="relative flex items-center justify-center">
          <button
            onClick={onClick}
            className="relative transition-all duration-150 rounded-full focus:outline-none"
            style={{
              width: `${sizePx}px`,
              height: `${sizePx}px`,
              background: dotColor,
              border: isSelected ? '1.5px solid var(--text-primary)' : 'none',
              boxShadow: isSelected
                ? `0 0 8px ${dotColor}, 0 0 16px ${dotColor}`
                : `0 0 6px ${color}bf, 0 0 14px ${color}4d`,
              cursor: 'pointer'
            }}
          />
          {isSelected && (
            <svg viewBox="0 0 30 30" className="animate-spin-slow" style={{ position: 'absolute', width: '36px', height: '36px', pointerEvents: 'none' }}>
              <path d="M 6 2 A 12 12 0 0 1 24 2" fill="none" stroke={dotColor} strokeWidth="0.75" strokeDasharray="1.5, 1.5" />
              <path d="M 24 28 A 12 12 0 0 1 6 28" fill="none" stroke={dotColor} strokeWidth="0.75" strokeDasharray="1.5, 1.5" />
              <line x1="2" y1="2" x2="6" y2="2" stroke={dotColor} strokeWidth="1.2" />
              <line x1="2" y1="2" x2="2" y2="6" stroke={dotColor} strokeWidth="1.2" />
              <line x1="28" y1="2" x2="24" y2="2" stroke={dotColor} strokeWidth="1.2" />
              <line x1="28" y1="2" x2="28" y2="6" stroke={dotColor} strokeWidth="1.2" />
              <line x1="2" y1="28" x2="6" y2="28" stroke={dotColor} strokeWidth="1.2" />
              <line x1="2" y1="28" x2="2" y2="24" stroke={dotColor} strokeWidth="1.2" />
              <line x1="28" y1="28" x2="24" y2="28" stroke={dotColor} strokeWidth="1.2" />
              <line x1="28" y1="28" x2="28" y2="24" stroke={dotColor} strokeWidth="1.2" />
            </svg>
          )}
        </div>
      </Html>
      {children}
    </group>
  );
}

// Constants for Globe scaling
const EARTH_RADIUS = 2.0;

/**
 * Converts Latitude and Longitude to a Three.js Vector3 point on a sphere.
 */
function latLonToVector3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon) * (Math.PI / 180);

  const x = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.cos(theta);

  return new THREE.Vector3(x, y, z);
}

/**
 * Calculates the Sun's latitude and longitude based on current UTC time and day of year.
 */
function getSunPosition() {
  const now = new Date();
  
  // Calculate day of the year
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now - start;
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  
  // Solar declination (latitude of the sun)
  const declination = 23.44 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 80));
  
  // GMT hours
  const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
  
  // Longitude of the sun: 12:00 UTC is 0 degrees, 1 hour is 15 degrees westward
  const longitude = - (utcHours - 12) * 15;
  
  return { lat: declination, lon: longitude };
}

/**
 * Returns consistent accent color based on satellite type/name.
 */
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

// Atmosphere Shader configuration
const AtmosphereShader = {
  vertexShader: `
    varying vec3 vNormal;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vNormal;
    void main() {
      float intensity = pow(0.7 - dot(vNormal, vec3(0, 0, 1.0)), 2.0);
      gl_FragColor = vec4(0.3, 0.55, 1.0, 1.0) * intensity * 0.7;
    }
  `
};

/**
 * Textured Earth mesh component.
 */
function EarthMesh({ onClick }) {
  // Load standard photorealistic Earth texture and night lights map
  const earthTexture = useTexture('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg');
  const nightTexture = useTexture('https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg');

  return (
    <mesh rotation={[0, -Math.PI / 2, 0]} onClick={onClick}>
      <sphereGeometry args={[EARTH_RADIUS, 64, 64]} />
      <meshPhongMaterial
        map={earthTexture}
        emissiveMap={nightTexture}
        emissive="#ffffff"
        shininess={15}
        roughness={0.7}
        metalness={0.1}
      />
    </mesh>
  );
}

/**
 * Fallback Earth mesh if texture load fails (renders a styled dark navy globe).
 */
function FallbackEarth({ onClick }) {
  return (
    <mesh rotation={[0, -Math.PI / 2, 0]} onClick={onClick}>
      <sphereGeometry args={[EARTH_RADIUS, 32, 32]} />
      <meshPhongMaterial
        color="#130924"
        emissive="#05020c"
        shininess={10}
        flatShading
      />
    </mesh>
  );
}

/**
 * Observer pin with custom backface culling (dot product test)
 * to avoid Drei HTML raycasting occlusion bugs with glow layers.
 */
function ObserverPin({ position }) {
  const htmlRef = useRef(null);
  const groupRef = useRef(null);
  
  useFrame(({ camera }) => {
    if (!groupRef.current || !htmlRef.current) return;
    
    // Get the current world position of the observer pin
    const worldPos = new THREE.Vector3();
    groupRef.current.getWorldPosition(worldPos);
    
    // Calculate the dot product between the observer normal vector and the camera direction vector
    const camPos = camera.position;
    const dot = worldPos.x * (camPos.x - worldPos.x) +
                worldPos.y * (camPos.y - worldPos.y) +
                worldPos.z * (camPos.z - worldPos.z);
                
    const isFacing = dot > 0;
    
    htmlRef.current.style.display = isFacing ? 'block' : 'none';
  });

  return (
    <group ref={groupRef} position={position}>
      <Html
        ref={htmlRef}
        center
        distanceFactor={5.8}
        style={{ pointerEvents: 'none' }}
      >
        <div style={{
          width: '26px',
          height: '26px',
          borderRadius: '50%',
          border: '2.5px solid #e0a847',
          background: 'transparent',
          boxShadow: '0 0 8px #e0a847, inset 0 0 4px #e0a847',
        }} />
      </Html>
    </group>
  );
}

/**
 * Interactive 3D scene elements.
 */
function SceneContent({ isRelocating, setIsRelocating, isResolving, setIsResolving }) {
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
    showDebrisHeatmap
  } = state;

  const earthRef = useRef();

  const glowMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: AtmosphereShader.vertexShader,
      fragmentShader: AtmosphereShader.fragmentShader,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true
    });
  }, []);

  // Filter based on active selection
  const filteredSatellites = useMemo(() => {
    return satellites.filter(sat => {
      if (sat.satid === 25544) return false; // Filter out duplicate ISS marker
      if (satelliteFilter === 'all') return true;
      if (satelliteFilter === 'major') {
        return sat.type === 'space-station' || sat.type === 'weather' || sat.type === 'earth-obs' || sat.type === 'gps';
      }
      return sat.type === satelliteFilter;
    });
  }, [satellites, satelliteFilter]);

  // Calculate visible constellations
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

  // Selected asteroid trajectory points in 3D
  const asteroid3DPath = useMemo(() => {
    if (viewMode !== 'asteroids' || !selectedAsteroid) return [];
    const points = [];
    const hash = parseInt(selectedAsteroid.id) || 54321;
    const latSlope = Math.sin(hash) * 20;
    const lonSlope = Math.cos(hash) * 50;
    const now = Date.now();
    const gmst = getGMST(now);
    const baseLat = selectedAsteroid.dec;
    const raDeg = selectedAsteroid.ra * 15;
    
    let baseLon = raDeg - gmst;
    baseLon = baseLon % 360;
    if (baseLon > 180) baseLon -= 360;
    if (baseLon < -180) baseLon += 360;

    const radius = EARTH_RADIUS + 0.3 + Math.min(2.5, selectedAsteroid.miss_distance_ld * 0.1);

    for (let i = -15; i <= 15; i++) {
      const t = i / 15;
      const lat = Math.max(-90, Math.min(90, baseLat + t * latSlope));
      let lon = baseLon + t * lonSlope;
      lon = lon % 360;
      if (lon > 180) lon -= 360;
      if (lon < -180) lon += 360;
      points.push(latLonToVector3(lat, lon, radius));
    }
    return points;
  }, [viewMode, selectedAsteroid]);

  // Calculate country border lines once
  const borderGeometry = useMemo(() => {
    const points = [];
    worldData.features.forEach(feature => {
      const { type, coordinates } = feature.geometry;
      if (type === 'Polygon') {
        coordinates.forEach(ring => {
          for (let i = 0; i < ring.length - 1; i++) {
            points.push(latLonToVector3(ring[i][1], ring[i][0], EARTH_RADIUS + 0.005));
            points.push(latLonToVector3(ring[i+1][1], ring[i+1][0], EARTH_RADIUS + 0.005));
          }
        });
      } else if (type === 'MultiPolygon') {
        coordinates.forEach(polygon => {
          polygon.forEach(ring => {
            for (let i = 0; i < ring.length - 1; i++) {
              points.push(latLonToVector3(ring[i][1], ring[i][0], EARTH_RADIUS + 0.005));
              points.push(latLonToVector3(ring[i+1][1], ring[i+1][0], EARTH_RADIUS + 0.005));
            }
          });
        });
      }
    });

    const geom = new THREE.BufferGeometry();
    geom.setFromPoints(points);
    return geom;
  }, []);

  // Convert observer position
  const observerPos = useMemo(() => {
    if (!location) return null;
    return latLonToVector3(location.lat, location.lon, EARTH_RADIUS + 0.02);
  }, [location]);

  // Convert ISS position
  const issPos = useMemo(() => {
    if (viewMode !== 'satellites' || !issPosition) return null;
    return latLonToVector3(issPosition.lat, issPosition.lon, EARTH_RADIUS + 0.15); // ~300km altitude representation
  }, [viewMode, issPosition]);

  // Convert ISS Trail positions to 3D
  const trailPoints = useMemo(() => {
    if (viewMode !== 'satellites' || issTrail.length < 2) return [];
    return issTrail.map(p => latLonToVector3(p.lat, p.lon, EARTH_RADIUS + 0.15));
  }, [viewMode, issTrail]);

  // Convert Selected Satellite Orbit to 3D
  const orbitPoints = useMemo(() => {
    if (viewMode !== 'satellites' || !selectedSatellite) return [];
    const arcPoints = generateOrbitalArc(selectedSatellite.satlat, selectedSatellite.satlon);
    
    if (selectedSatellite.isDecaying) {
      const baseRadius = EARTH_RADIUS + (selectedSatellite.satalt / 40000) * 0.4 + 0.05;
      return arcPoints.map((p, idx) => {
        const progress = idx / arcPoints.length; // 0 to 1
        const decayAmount = progress * (selectedSatellite.decayDepth || 0.15);
        const radius = Math.max(EARTH_RADIUS + 0.01, baseRadius - decayAmount);
        return latLonToVector3(p[0], p[1], radius);
      });
    }

    const radius = EARTH_RADIUS + (selectedSatellite.satalt / 40000) * 0.4 + 0.05;
    return arcPoints.map(p => latLonToVector3(p[0], p[1], radius));
  }, [viewMode, selectedSatellite]);

  // Calculate ISS Orbit to 3D
  const issOrbitPoints = useMemo(() => {
    if (viewMode !== 'satellites' || !issPosition) return [];
    const arcPoints = generateOrbitalArc(issPosition.lat, issPosition.lon);
    return arcPoints.map(p => latLonToVector3(p[0], p[1], EARTH_RADIUS + 0.15));
  }, [viewMode, issPosition]);

  // Convert Debris Heatmap Hotspots to 3D
  const heatmapHotspots3D = useMemo(() => {
    return DEBRIS_HOTSPOTS.map(h => {
      const [r, g, b] = h.color;
      return {
        position: latLonToVector3(h.lat, h.lon, EARTH_RADIUS + 0.002),
        // 3 layered sizes: outer diffuse, mid glow, inner core
        layers: [
          { size: h.radius * 0.042, opacity: h.intensity * 0.06 },
          { size: h.radius * 0.024, opacity: h.intensity * 0.14 },
          { size: h.radius * 0.012, opacity: h.intensity * 0.32 },
        ],
        color: new THREE.Color(r / 255, g / 255, b / 255),
        intensity: h.intensity,
      };
    });
  }, []);

  // Slow orbital rotation effect for background stars and earth grids (idle rotation)
  useFrame(({ clock }) => {
    if (earthRef.current) {
      earthRef.current.rotation.y = clock.getElapsedTime() * 0.005;
    }
  });

  const handleEarthClick = async (e) => {
    e.stopPropagation();
    if (isRelocating) {
      if (isResolving) return;
      // Ignore click if mouse dragged (e.g. rotating globe)
      if (e.delta && e.delta > 5) return;
      
      setIsResolving(true);

      let localPoint = e.point.clone();
      if (earthRef.current) {
        localPoint = earthRef.current.worldToLocal(localPoint);
      }
      
      const { x, y, z } = localPoint;
      const dist = Math.sqrt(x * x + y * y + z * z);
      const phi = Math.acos(Math.max(-1, Math.min(1, y / dist)));
      const lat = 90 - phi * (180 / Math.PI);
      const theta = Math.atan2(x, z);
      const lon = theta * (180 / Math.PI);
      
      try {
        const name = await reverseGeocode(lat, lon);
        actions.setLocation({ lat, lon });
        actions.setLocationName(name);
      } catch (err) {
        console.error('[Relocate 3D] Geocoding failed:', err);
        actions.setLocation({ lat, lon });
        actions.setLocationName(`${lat.toFixed(4)}°, ${lon.toFixed(4)}°`);
      } finally {
        setIsResolving(false);
        setIsRelocating(false);
      }
      return;
    }

    if (viewMode === 'satellites') {
      actions.selectSatellite(null);
    } else if (viewMode === 'asteroids') {
      actions.selectAsteroid(null);
    } else {
      actions.selectConstellation(null);
    }
  };

  const isIssSelected = selectedSatellite?.satid === 25544;
  const handleIssClick = (e) => {
    e.stopPropagation();
    actions.selectSatellite(isIssSelected ? null : { satname: 'ISS (ZARYA)', satid: 25544, satalt: 408, velocity: 7.66, type: 'space-station' });
  };

  return (
    <group ref={earthRef}>
      {/* ── Atmosphere Rim Glow ── */}
      <mesh raycast={() => null}>
        <sphereGeometry args={[EARTH_RADIUS + 0.08, 64, 64]} />
        <primitive object={glowMaterial} attach="material" />
      </mesh>

      {/* ── Atmospheric Reentry Hazard Zone (Decay Simulation) ── */}
      {selectedSatellite?.isDecaying && (
        <mesh raycast={() => null}>
          <sphereGeometry args={[EARTH_RADIUS + 0.08, 64, 64]} />
          <meshBasicMaterial 
            color="#ef4444" 
            transparent={true} 
            opacity={0.12} 
            blending={THREE.AdditiveBlending} 
            side={THREE.BackSide}
            wireframe
          />
        </mesh>
      )}

      {/* ── Earth Base Globe ── */}
      <Suspense fallback={<FallbackEarth onClick={handleEarthClick} />}>
        <EarthMesh onClick={handleEarthClick} />
      </Suspense>

      {/* ── Country Borders ── */}
      <lineSegments geometry={borderGeometry} raycast={() => null}>
        <lineBasicMaterial color="#4d8dff" opacity={0.25} transparent={true} />
      </lineSegments>

      {/* ── Glowing Atmospheric Grid Overlay ── */}
      <mesh raycast={() => null}>
        <sphereGeometry args={[EARTH_RADIUS + 0.008, 32, 32]} />
        <meshBasicMaterial
          color="#4d8dff"
          wireframe
          transparent
          opacity={0.04}
        />
      </mesh>

      {/* ── Debris Density Heatmap Domes — layered for Gaussian glow effect ── */}
      {showDebrisHeatmap && heatmapHotspots3D.map((hotspot, idx) =>
        hotspot.layers.map((layer, li) => (
          <mesh key={`debris-heat-${idx}-${li}`} position={hotspot.position} raycast={() => null}>
            <sphereGeometry args={[layer.size, 14, 14]} />
            <meshBasicMaterial
              color={hotspot.color}
              transparent={true}
              opacity={layer.opacity}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        ))
      )}

      {/* ── Observer Pin — Html billboard, pixel-perfect match to flat map ring ── */}
      {observerPos && (
        <ObserverPin position={observerPos} />
      )}

      {/* ── Satellites Mode Overlays ── */}
      {viewMode === 'satellites' && (
        <>
          {/* ISS Orbit line (always visible) */}
          {issOrbitPoints.length > 1 && (
            <Line
              points={issOrbitPoints}
              color="#e0584f"
              lineWidth={1}
              opacity={0.35}
              transparent
              raycast={() => null}
            />
          )}

          {/* ISS Trail */}
          {trailPoints.length > 1 && (
            <Line
              points={trailPoints}
              color="#e0584f"
              lineWidth={1.5}
              dashed
              dashSize={0.08}
              gapSize={0.04}
              raycast={() => null}
            />
          )}

          {/* ISS Model Dot — animated pulse */}
          {issPos && (
            <>
              <AnimatedISSMarker position={issPos} onClick={handleIssClick} isSelected={isIssSelected} />
              {/* HTML Hover Label positioned via a plain group */}
              <group position={issPos}>
                <Html distanceFactor={6}>
                  <div className="bg-surface/90 border border-[#e0584f]/40 rounded px-2 py-1 text-[9px] text-[#e0584f] font-sans font-bold uppercase tracking-wider select-none whitespace-nowrap -translate-x-1/2 -translate-y-6 pointer-events-none shadow-[0_0_10px_rgba(224,88,79,0.4)] backdrop-blur">
                    🚀 ISS
                  </div>
                </Html>
              </group>
            </>
          )}

          {/* Selected Satellite Orbit plane line */}
          {orbitPoints.length > 1 && selectedSatellite && (
            <Line
              points={orbitPoints}
              color={getObjectColor(selectedSatellite.type, selectedSatellite.satname)}
              lineWidth={2}
              raycast={() => null}
            />
          )}

          {/* Satellite markers — with layered glow matching flat map */}
          {filteredSatellites.map(sat => {
            const isSelected = selectedSatellite?.satid === sat.satid;
            const radius = EARTH_RADIUS + (sat.satalt / 40000) * 0.4 + 0.05;
            const satPos = latLonToVector3(sat.satlat, sat.satlon, radius);
            const color = getObjectColor(sat.type, sat.satname);
            const coreSize = isSelected ? 0.035 : 0.022;
            const outerSize = isSelected ? 0.075 : 0.048;

            const handleSatClick = (e) => {
              e.stopPropagation();
              actions.selectSatellite(isSelected ? null : sat);
            };

            return (
              <GlowDot
                key={sat.satid}
                position={satPos}
                color={isSelected ? '#ffffff' : color}
                glowColor={color}
                size={coreSize}
                outerSize={outerSize}
                innerOpacity={0.7}
                outerOpacity={0.3}
                onClick={handleSatClick}
              />
            );
          })}

          {/* Explicit selected satellite marker if it is a mock/decay satellite not present in the standard API list */}
          {selectedSatellite && !filteredSatellites.some(s => s.satid === selectedSatellite.satid) && (
            (() => {
              const radius = EARTH_RADIUS + (selectedSatellite.satalt / 40000) * 0.4 + 0.05;
              const satPos = latLonToVector3(selectedSatellite.satlat, selectedSatellite.satlon, radius);
              const color = selectedSatellite.isDecaying ? '#ef4444' : getObjectColor(selectedSatellite.type, selectedSatellite.satname);
              
              return (
                <>
                  <GlowDot
                    position={satPos}
                    color="#ffffff"
                    glowColor={color}
                    size={0.035}
                    outerSize={0.075}
                    innerOpacity={0.7}
                    outerOpacity={0.3}
                  />
                  <group position={satPos}>
                    <Html distanceFactor={6}>
                      <div className="bg-surface/90 border border-white/20 rounded px-2 py-1 text-[9px] text-text-primary font-sans font-bold uppercase tracking-wider select-none whitespace-nowrap -translate-x-1/2 -translate-y-6 pointer-events-none shadow-xl backdrop-blur">
                        🚨 {selectedSatellite.satname}
                      </div>
                    </Html>
                  </group>
                </>
              );
            })()
          )}
        </>
      )}

      {/* ── Asteroids Mode Overlays ── */}
      {viewMode === 'asteroids' && (
        <>
          {/* Selected Asteroid's 3D Trajectory Path */}
          {asteroid3DPath.length > 1 && selectedAsteroid && (
            <Line
              points={asteroid3DPath}
              color={selectedAsteroid.is_potentially_hazardous ? '#e0584f' : '#e0a847'}
              lineWidth={1.5}
              dashed
              dashSize={0.08}
              gapSize={0.04}
              raycast={() => null}
            />
          )}

          {/* Asteroid markers */}
          {filteredAsteroids.map((ast) => {
            const isSelected = selectedAsteroid?.id === ast.id;
            const radius = EARTH_RADIUS + 0.3 + Math.min(2.5, ast.miss_distance_ld * 0.1);
            const astPos = latLonToVector3(ast.lat, ast.lon, radius);
            const color = isSelected ? '#4d8dff' : (ast.is_potentially_hazardous ? '#e0584f' : '#e0a847');

            const handleAsteroidClick = (e) => {
              e.stopPropagation();
              actions.selectAsteroid(isSelected ? null : ast);
            };

            return (
              <AsteroidHtmlMarker
                key={ast.id}
                position={astPos}
                ast={ast}
                isSelected={isSelected}
                onClick={handleAsteroidClick}
              >
                {/* HTML Hover/Select Tooltip */}
                {isSelected && (
                  <Html distanceFactor={6}>
                    <div className="bg-surface/95 border rounded px-2 py-1 text-[9px] text-text-primary font-sans font-bold uppercase tracking-wider select-none shadow-xl -translate-x-1/2 -translate-y-8 select-none whitespace-nowrap backdrop-blur" style={{ borderColor: `${color}60`, boxShadow: `0 0 10px ${color}40` }}>
                      <p style={{ color }}>☄️ {ast.name}</p>
                      <p className="text-text-secondary font-mono text-[7px] mt-0.5">
                        {ast.relative_velocity_kms?.toFixed(1) || ast.velocity_kms?.toFixed(1)} km/s · {ast.miss_distance_ld?.toFixed(1)} LD
                      </p>
                      {ast.is_potentially_hazardous && (
                        <p className="text-[#e0584f] font-bold text-[7px] mt-0.5 animate-pulse">⚠️ HAZARDOUS (PHA)</p>
                      )}
                    </div>
                  </Html>
                )}
              </AsteroidHtmlMarker>
            );
          })}

          {/* Alignment line between observer and selected asteroid */}
          {selectedAsteroid && observerPos && (() => {
            const radius = EARTH_RADIUS + 0.3 + Math.min(2.5, selectedAsteroid.miss_distance_ld * 0.1);
            const astPos = latLonToVector3(selectedAsteroid.lat, selectedAsteroid.lon, radius);
            return (
              <Line
                points={[observerPos, astPos]}
                color="#4d8dff"
                lineWidth={1}
                dashed
                dashSize={0.06}
                gapSize={0.03}
                raycast={() => null}
              />
            );
          })()}
        </>
      )}

      {/* ── Constellations Mode Overlays ── */}
      {viewMode === 'constellations' && visibleConstellations.map(constell => {
        const isSelected = selectedConstellation?.id === constell.id;
        const constellRadius = EARTH_RADIUS + 1.2; // Celestial sphere representation
        const centerPos = latLonToVector3(constell.subStellar.lat, constell.subStellar.lon, constellRadius);
        
        // Calculate stars and connection lines
        const shape = getConstellationShape(constell, Date.now());
        const starPoints3D = shape.stars.map(s => latLonToVector3(s.lat, s.lon, constellRadius));

        const handleConstellClick = (e) => {
          e.stopPropagation();
          actions.selectConstellation(isSelected ? null : constell);
        };

        return (
          <Fragment key={constell.id}>
            {/* Outline connection lines */}
            {shape.connections.map(([idx1, idx2], lineIdx) => {
              const p1 = starPoints3D[idx1];
              const p2 = starPoints3D[idx2];
              if (!p1 || !p2) return null;
              return (
                <Line
                  key={`3d-line-${constell.id}-${lineIdx}`}
                  points={[p1, p2]}
                  color={isSelected ? '#e0a847' : '#4d8dff'}
                  lineWidth={isSelected ? 1.8 : 0.8}
                  opacity={isSelected ? 1.0 : 0.3}
                  transparent
                  raycast={() => null}
                />
              );
            })}

            {/* Individual star nodes */}
            {starPoints3D.map((pt, idx) => (
              <mesh key={`3d-star-${constell.id}-${idx}`} position={pt} raycast={() => null}>
                <sphereGeometry args={[isSelected ? 0.018 : 0.01, 8, 8]} />
                <meshBasicMaterial color={isSelected ? '#ffffff' : '#e6d5fa'} />
              </mesh>
            ))}

            {/* Subtle center anchor glowing point (Not a star emoji) */}
            <group position={centerPos}>
              <mesh onClick={handleConstellClick}>
                <sphereGeometry args={[0.024, 8, 8]} />
                <meshBasicMaterial color={isSelected ? '#e0a847' : '#4d8dff'} />
              </mesh>
              
              {/* Selected tooltip banner */}
              {isSelected && (
                <>
                  <mesh onClick={handleConstellClick}>
                    <sphereGeometry args={[0.05, 8, 8]} />
                    <meshBasicMaterial color="#e0a847" transparent opacity={0.3} />
                  </mesh>
                  <Html distanceFactor={6}>
                    <div className="bg-surface/95 border border-[#e0a847]/60 rounded px-2 py-1 text-[9px] text-text-primary font-sans font-bold uppercase tracking-wider select-none shadow-xl -translate-x-1/2 -translate-y-8 select-none backdrop-blur shadow-[0_0_10px_rgba(224,168,71,0.3)]">
                      <p className="text-[#e0a847]">🌌 {constell.name}</p>
                      <p className="text-text-secondary font-mono text-[7px] mt-0.5">RA: {constell.ra}h · Dec: {constell.dec}°</p>
                    </div>
                  </Html>
                </>
              )}
            </group>

            {/* Projection line linking observer pin to constellation center */}
            {isSelected && observerPos && (
              <Line
                points={[observerPos, centerPos]}
                color="#e0a847"
                lineWidth={1}
                dashed
                dashSize={0.06}
                gapSize={0.03}
                raycast={() => null}
              />
            )}
          </Fragment>
        );
      })}
    </group>
  );
}

/**
 * Globe3D — Three.js 3D Viewport wrapper.
 */
export default function Globe3D({ className = '', mobileView = 'map', showChrome = true }) {
  const { state, actions } = useApp();
  const {
    location,
    selectedSatellite,
    selectedAsteroid,
    selectedConstellation,
    showConeOverlay
  } = state;

  const [isRelocating, setIsRelocating] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isControlsExpanded, setIsControlsExpanded] = useState(false);

  const sunPos = useMemo(() => {
    const pos = getSunPosition();
    return latLonToVector3(pos.lat, pos.lon, 15);
  }, []);

  const [globeSettings, setGlobeSettings] = useState({
    autoRotate: localStorage.getItem('orbitwatch_settings_globe_rotate') !== 'false',
    speed: parseFloat(localStorage.getItem('orbitwatch_settings_globe_speed') || '0.3'),
  });

  useEffect(() => {
    const handleSettingsChange = () => {
      setGlobeSettings({
        autoRotate: localStorage.getItem('orbitwatch_settings_globe_rotate') !== 'false',
        speed: parseFloat(localStorage.getItem('orbitwatch_settings_globe_speed') || '0.3'),
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

  const shouldAutoRotate = globeSettings.autoRotate && !selectedSatellite && !selectedAsteroid && !selectedConstellation;

  return (
    <div 
      className={`relative ${isRelocating ? 'cursor-crosshair' : ''} ${className}`}
      style={{
        background: 'radial-gradient(circle at center, #020409 0%, #000000 100%)'
      }}
    >
      {/* 3D WebGL Canvas */}
      <Canvas
        camera={{ position: [0, 3, 5], fov: 45, far: 2000 }}
        style={{ width: '100%', height: '100%', outline: 'none' }}
        onPointerMissed={() => {
          if (isRelocating) return;
          actions.selectSatellite(null);
          actions.selectConstellation(null);
          actions.selectAsteroid(null);
        }}
      >
        {/* Lights */}
        <ambientLight intensity={0.25} />
        <directionalLight position={sunPos} intensity={2.0} />

        {/* Space Starfield Background */}
        <Stars
          radius={120}
          depth={60}
          count={3500}
          factor={6}
          saturation={0.8}
          fade
          speed={1.0}
        />

        {/* 3D Scene */}
        <SceneContent
          isRelocating={isRelocating}
          setIsRelocating={setIsRelocating}
          isResolving={isResolving}
          setIsResolving={setIsResolving}
        />

        {/* Camera interaction */}
        <OrbitControls
          enableZoom={true}
          enablePan={true}
          minDistance={2.5}
          maxDistance={120}
          autoRotate={shouldAutoRotate}
          autoRotateSpeed={globeSettings.speed}
        />
      </Canvas>

      {/* Decorative HUD corners */}
      <div className="absolute top-4 left-4 border-t-2 border-l-2 border-[#4d8dff]/40 w-4 h-4 pointer-events-none filter drop-shadow-[0_0_3px_rgba(77,141,255,0.4)]" />
      <div className="absolute top-4 right-4 border-t-2 border-r-2 border-[#4d8dff]/40 w-4 h-4 pointer-events-none filter drop-shadow-[0_0_3px_rgba(77,141,255,0.4)]" />
      <div className="absolute bottom-4 left-4 border-b-2 border-l-2 border-[#4d8dff]/40 w-4 h-4 pointer-events-none filter drop-shadow-[0_0_3px_rgba(77,141,255,0.4)]" />
      <div className="absolute bottom-4 right-4 border-b-2 border-r-2 border-[#4d8dff]/40 w-4 h-4 pointer-events-none filter drop-shadow-[0_0_3px_rgba(77,141,255,0.4)]" />

      {/* Top-Left Cluster Container */}
      {mobileView === 'map' && (
        <div className="hidden lg:flex absolute top-3 left-3 z-[1000] flex-col gap-2 items-start pointer-events-none">
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
              title="Click on the globe to relocate observer"
              disabled={isResolving}
            >
              <Globe className="w-3 h-3 text-cyan" />
              <span>{isRelocating ? 'Click Globe' : 'Relocate'}</span>
            </button>
          </div>
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
                title="Click on the globe to relocate observer"
                disabled={isResolving}
              >
                <span className="flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-cyan" />
                  <span>Relocate</span>
                </span>
                <span className="text-[8px] text-muted">{isRelocating ? 'Click Globe' : 'Change'}</span>
              </button>

              {/* Visibility Cone Toggle */}
              <div className="flex items-center justify-between py-1 border-t border-white/[0.04] mt-1.5 pt-1.5">
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
            </div>
          )}
        </div>
      )}

      {/* Relocate Mode Banner Overlay */}
      {isRelocating && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[1001] glass-panel px-4 py-2 rounded-lg bg-surface/95 border border-accent-amber shadow-2xl flex items-center gap-3 animate-fade-in pointer-events-auto">
          <div className="w-2 h-2 rounded-full bg-accent-amber animate-ping" />
          <span className="text-[10px] font-sans font-bold text-text-primary uppercase tracking-wider">
            {isResolving ? 'Resolving new coordinates...' : 'Select Location: Click anywhere on the globe'}
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
    </div>
  );
}
