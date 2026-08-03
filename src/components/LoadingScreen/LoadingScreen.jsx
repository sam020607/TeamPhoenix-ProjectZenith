import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const PHASES = [
  'Initialising systems...',
  'Loading star charts...',
  'Calibrating orbital data...',
  'Syncing telemetry...',
  'Preparing control room...',
];

const MIN_DISPLAY_MS = 2800; // never show for less than this

export default function LoadingScreen({ onComplete }) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState(0);
  const [visible, setVisible] = useState(true);
  const startTime = useRef(Date.now());
  const assetsReady = useRef(false);
  const timerReady = useRef(false);

  // Animate progress bar and cycle phases
  useEffect(() => {
    const totalDuration = MIN_DISPLAY_MS;
    const interval = 30;
    let elapsed = 0;

    const tick = setInterval(() => {
      elapsed += interval;
      const pct = Math.min((elapsed / totalDuration) * 100, 95); // cap at 95 until truly ready
      setProgress(pct);
      setPhase(Math.floor((pct / 100) * PHASES.length));
    }, interval);

    const minTimer = setTimeout(() => {
      timerReady.current = true;
      maybeComplete();
    }, totalDuration);

    return () => {
      clearInterval(tick);
      clearTimeout(minTimer);
    };
  }, []);

  // Watch for window load (all assets done)
  useEffect(() => {
    const onLoad = () => {
      assetsReady.current = true;
      maybeComplete();
    };

    if (document.readyState === 'complete') {
      assetsReady.current = true;
      maybeComplete();
    } else {
      window.addEventListener('load', onLoad);
      return () => window.removeEventListener('load', onLoad);
    }
  }, []);

  function maybeComplete() {
    if (assetsReady.current && timerReady.current) {
      setProgress(100);
      setTimeout(() => {
        setVisible(false);
        setTimeout(onComplete, 600); // wait for fade-out before unmounting
      }, 300);
    }
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="loading-screen"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-center select-none"
          style={{ background: '#070a12' }}
        >
          {/* Star field */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 80 }).map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full bg-white"
                style={{
                  width: Math.random() * 1.5 + 0.5 + 'px',
                  height: Math.random() * 1.5 + 0.5 + 'px',
                  top: Math.random() * 100 + '%',
                  left: Math.random() * 100 + '%',
                  opacity: Math.random() * 0.6 + 0.1,
                  animation: `pulse ${2 + Math.random() * 3}s ease-in-out infinite`,
                  animationDelay: Math.random() * 3 + 's',
                }}
              />
            ))}
          </div>

          {/* Outer glow ring */}
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: '420px',
              height: '420px',
              background: 'radial-gradient(circle, rgba(0,212,255,0.06) 0%, transparent 70%)',
            }}
          />

          {/* Central content */}
          <div className="relative flex flex-col items-center gap-8">

            {/* Orbit animation */}
            <div className="relative w-24 h-24 flex items-center justify-center">
              {/* Orbit ring */}
              <motion.div
                className="absolute w-full h-full rounded-full border border-cyan/20"
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              />
              <motion.div
                className="absolute w-[110%] h-[110%] rounded-full border border-white/5"
                animate={{ rotate: -360 }}
                transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
              />

              {/* Orbiting dot */}
              <motion.div
                className="absolute w-full h-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              >
                <div
                  className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-cyan shadow-[0_0_8px_2px_rgba(0,212,255,0.8)]"
                />
              </motion.div>

              {/* Centre planet */}
              <div
                className="w-10 h-10 rounded-full"
                style={{
                  background: 'radial-gradient(circle at 35% 35%, #1a3a5c, #070a12)',
                  boxShadow: '0 0 20px rgba(0,212,255,0.2), inset 0 0 10px rgba(0,0,0,0.5)',
                }}
              />
            </div>

            {/* Title */}
            <div className="flex flex-col items-center gap-1">
              <motion.h1
                className="font-playfair italic text-3xl font-bold text-white tracking-wide"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
              >
                Orbit<span className="text-cyan">Watch</span>
              </motion.h1>
              <motion.p
                className="font-sans text-[10px] uppercase tracking-[0.3em] text-white/30"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.6 }}
              >
                Observatory Control Room
              </motion.p>
            </div>

            {/* Phase text */}
            <motion.p
              key={phase}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="font-mono text-[10px] text-cyan/60 uppercase tracking-widest h-4"
            >
              {PHASES[Math.min(phase, PHASES.length - 1)]}
            </motion.p>

            {/* Progress bar */}
            <div className="w-56 h-[2px] bg-white/[0.07] rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: 'linear-gradient(90deg, #00aacc, #00d4ff)',
                  boxShadow: '0 0 8px rgba(0,212,255,0.6)',
                  width: `${progress}%`,
                }}
                transition={{ ease: 'easeOut' }}
              />
            </div>

            {/* Percentage */}
            <span className="font-mono text-[9px] text-white/20 -mt-5 tabular-nums">
              {Math.round(progress)}%
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
