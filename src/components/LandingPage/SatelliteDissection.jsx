import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';

const PARTS_INFO = {
  core: {
    title: 'Avionics Core & Chassis',
    desc: 'The central satellite bus built with lightweight gold-foil carbon composite. Houses power control units, OBC (On-Board Computers), lithium-ion battery blocks, and altitude star trackers for stable orientation.',
  },
  solar: {
    title: 'GaAs Solar Arrays',
    desc: 'Dual solar array wings utilizing high-efficiency Gallium Arsenide (GaAs) triple-junction photovoltaic cells. Generates up to 14kW of electricity, feeding the power distribution units and recharging core batteries.',
  },
  antenna: {
    title: 'High-Gain Ka-Band Comms',
    desc: 'Dual-reflector parabolic dish antenna transmitting high-bandwidth data downlink to ground stations. Features an active gimbal motor allowing tracking pointing during rapid LEO orbital flybys.',
  },
  propulsion: {
    title: 'Xenon Ion Thruster',
    desc: 'Highly efficient electrostatic ion engine generating low thrust at massive specific impulse. Uses ionized Xenon gas accelerated through high-voltage grids for altitude maintenance and de-orbit positioning.',
  },
  payload: {
    title: 'Multispectral Camera Suite',
    desc: 'High-resolution payload with triple-aperture lenses capturing scientific visual, thermal infrared, and shortwave infrared spectrums for climate monitoring and vegetation index telemetry.',
  }
};

export default function SatelliteDissection() {
  const sectionRef = useRef(null);
  const canvasRef = useRef(null);
  const [activePart, setActivePart] = useState('core');
  
  // Frame loading state
  const [images, setImages] = useState([]);
  const [loadedCount, setLoadedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Pre-load all 240 WebP frames sequentially
  useEffect(() => {
    const loadedImages = [];
    let loaded = 0;
    const totalFrames = 240;

    for (let i = 1; i <= totalFrames; i++) {
      const img = new Image();
      const frameNum = String(i).padStart(3, '0');
      img.src = `${import.meta.env.BASE_URL}frames/frame_${frameNum}.webp`;
      
      img.onload = () => {
        loaded++;
        setLoadedCount(loaded);
        if (loaded === totalFrames) {
          setImages(loadedImages);
          setIsLoading(false);
        }
      };

      img.onerror = () => {
        // Fallback or retry logic if single frame fails
        loaded++;
        setLoadedCount(loaded);
        if (loaded === totalFrames) {
          setImages(loadedImages);
          setIsLoading(false);
        }
      };

      loadedImages.push(img);
    }
  }, []);

  // Track scroll position specifically inside this section to drive the "auto-explosion"
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"]
  });

  // Standard spring smoothing for scroll-bound translation values
  const scrollExplode = useTransform(scrollYProgress, [0.15, 0.7], [0, 1]);
  const smoothExplode = useSpring(scrollExplode, { damping: 30, stiffness: 50 });
  
  // Local state value for fallback / manual interaction
  const [explodeFactor, setExplodeFactor] = useState(0);

  // Sync scroll animation value to local state
  useEffect(() => {
    return smoothExplode.onChange((v) => {
      setExplodeFactor(Math.max(0, Math.min(1, v)));
    });
  }, [smoothExplode]);

  const frameIndex = Math.min(239, Math.floor(explodeFactor * 240));

  // Determine active subsystem based on frame index
  useEffect(() => {
    if (frameIndex <= 48) {
      setActivePart('core');
    } else if (frameIndex <= 96) {
      setActivePart('solar');
    } else if (frameIndex <= 144) {
      setActivePart('antenna');
    } else if (frameIndex <= 192) {
      setActivePart('propulsion');
    } else {
      setActivePart('payload');
    }
  }, [frameIndex]);

  // Redraw canvas frame on frameIndex or window resize
  useEffect(() => {
    if (isLoading || images.length < 240) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      // Draw the active frame
      const img = images[frameIndex];
      if (img && img.complete) {
        ctx.clearRect(0, 0, rect.width, rect.height);
        
        const imgRatio = img.width / img.height;
        const canvasRatio = rect.width / rect.height;
        
        let drawWidth = rect.width;
        let drawHeight = rect.height;
        let offsetX = 0;
        let offsetY = 0;

        if (imgRatio > canvasRatio) {
          drawHeight = rect.height;
          drawWidth = rect.height * imgRatio;
          offsetX = (rect.width - drawWidth) / 2;
        } else {
          drawWidth = rect.width;
          drawHeight = rect.width / imgRatio;
          offsetY = (rect.height - drawHeight) / 2;
        }

        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
      }
    };

    handleResize(); // Initial draw
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [frameIndex, images, isLoading]);

  return (
    <div 
      ref={sectionRef} 
      className="relative w-full min-h-[140vh] bg-gradient-to-b from-[#0a0d15] to-[#04060b] flex flex-col items-center py-20 px-6 overflow-hidden z-10"
    >
      {/* Title */}
      <div className="w-full max-w-4xl text-center mb-10 z-10 pointer-events-none">
        <span className="text-[10px] font-mono tracking-[0.35em] text-cyan-400 uppercase block mb-2">
          Holographic Telemetry
        </span>
        <h2 className="text-3xl md:text-5xl font-sans font-light tracking-tight text-white mb-4">
          Satellite Assembly Dissection
        </h2>
        <p className="text-white/50 text-xs md:text-sm max-w-lg mx-auto font-light leading-relaxed">
          Scroll to rotate the assembly and inspect individual subsystems. Drag the slider to scan telemetry details frame-by-frame.
        </p>
      </div>

      {/* Main Split Interface */}
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center flex-1 z-10">
        
        {/* Left Column: 3D Interactive Canvas / Preloader */}
        <div className="lg:col-span-8 relative w-full h-[500px] md:h-[650px] rounded-3xl bg-slate-950/40 border border-white/5 overflow-hidden backdrop-blur-md shadow-2xl flex items-center justify-center">
          
          {isLoading ? (
            /* Futuristic Space HUD Preloader */
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 font-mono text-cyan-400 z-50 p-6">
              {/* Spinning Radar Loader */}
              <div className="relative w-24 h-24 mb-6 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border border-cyan-500/10"></div>
                <div className="absolute inset-2 rounded-full border border-dashed border-cyan-500/20 animate-spin" style={{ animationDuration: '8s' }}></div>
                <div className="absolute inset-4 rounded-full border border-cyan-500/40 flex items-center justify-center">
                  <span className="text-white text-xs font-bold animate-pulse">SYS</span>
                </div>
                <div className="absolute inset-0 rounded-full border-t border-cyan-400 animate-spin" style={{ animationDuration: '1.5s' }}></div>
              </div>

              <span className="text-[10px] tracking-[0.3em] uppercase text-cyan-400/80 mb-2 font-bold animate-pulse">
                INITIALIZING ORBITWATCH DATA...
              </span>
              
              {/* Progress bar */}
              <div className="w-full max-w-[280px] bg-slate-900 border border-cyan-500/20 h-2 rounded-full overflow-hidden mb-2">
                <div 
                  className="bg-cyan-500 h-full transition-all duration-150" 
                  style={{ width: `${(loadedCount / 240) * 100}%` }}
                ></div>
              </div>
              
              <span className="text-[9px] text-white/50 tracking-wider">
                PROPAGATING ORBITAL FRAMES: {Math.round((loadedCount / 240) * 100)}%
              </span>
            </div>
          ) : (
            /* High-fidelity WebP Sequencer Canvas */
            <canvas 
              ref={canvasRef} 
              className="w-full h-full object-cover block"
            />
          )}
          
          {/* Compass HUD decoration */}
          <div className="absolute top-4 left-4 p-4 border border-cyan-500/20 rounded-xl font-mono text-[9px] text-cyan-400/80 pointer-events-none flex flex-col gap-1">
            <span>ORIENT_LOCK: TRACKING</span>
            <span>MODEL: ZENITH_OBS_SAT</span>
            <span>STREAM: 4K_RAW_WEBP</span>
          </div>

          {/* Assembly Status bar */}
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between font-mono text-[9px] text-white/50 bg-slate-950/60 py-2 px-4 border border-white/5 rounded-lg">
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping"></span> 
              FRAME SEQUENCE: {frameIndex + 1} / 240
            </span>
            <span>ROTATION LOCK: OFF</span>
          </div>
        </div>

        {/* Right Column: Information Display Panel */}
        <div className="lg:col-span-4 flex flex-col justify-center h-full z-10">
          <motion.div 
            key={activePart}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="p-6 md:p-8 rounded-3xl bg-slate-950/70 border border-white/10 shadow-2xl backdrop-blur-xl flex flex-col justify-between min-h-[300px]"
          >
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[9px] font-mono tracking-[0.2em] text-cyan-400 uppercase">
                  Subsystem Profile
                </span>
                <span className="text-[9px] font-mono text-white/20">// SCAN_OK</span>
              </div>
              <h3 className="text-xl md:text-2xl font-sans font-light tracking-tight text-white mb-4">
                {PARTS_INFO[activePart].title}
              </h3>
              <p className="text-white/60 text-xs md:text-sm leading-relaxed font-light mb-6">
                {PARTS_INFO[activePart].desc}
              </p>
            </div>
            
            {/* Spec readout details */}
            <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-5">
              <div>
                <span className="text-[8px] font-mono text-white/30 uppercase tracking-widest block mb-0.5">STATUS</span>
                <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> ACTIVE
                </span>
              </div>
              <div>
                <span className="text-[8px] font-mono text-white/30 uppercase tracking-widest block mb-0.5">TELEMETRY</span>
                <span className="text-[11px] font-mono text-white font-semibold">100% NOMINAL</span>
              </div>
            </div>
          </motion.div>

          {/* Interactive Manual Controls */}
          <div className="mt-4 p-4 rounded-2xl bg-slate-950/30 border border-white/5 backdrop-blur-md flex flex-col gap-2">
            <div className="flex justify-between font-mono text-[9px] text-white/40">
              <span>SCRUB ASSEMBLY</span>
              <span>SLIDER CONTROL</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.004" 
              value={explodeFactor}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setExplodeFactor(val);
              }}
              className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>
        </div>

      </div>

      {/* Blueprint background grid decoration */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02] border-t border-white/5 z-0" 
           style={{ 
             backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', 
             backgroundSize: '24px 24px' 
           }} 
      />
    </div>
  );
}
