import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Satellite } from 'lucide-react';

export default function AboutUs({ onBack }) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-white p-6 md:p-12 overflow-y-auto" style={{ background: '#070a12' }}>
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-white/70 hover:text-cyan transition-colors mb-12"
      >
        <ArrowLeft size={20} />
        <span className="uppercase tracking-widest text-xs font-semibold">Back to OrbitWatch</span>
      </button>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-3xl mx-auto"
      >
        <div className="flex items-center gap-4 mb-8 text-cyan">
          <Satellite size={48} />
          <h1 className="text-4xl md:text-6xl font-playfair tracking-wide text-white font-semibold">
            OrbitWatch
          </h1>
        </div>

        <h2 className="text-xl md:text-2xl font-sans tracking-[0.25em] uppercase text-white/60 font-semibold mb-12">
          Orbit Watch
        </h2>

        <div className="space-y-8 text-lg text-white/80 leading-relaxed font-light">
          <p>
            OrbitWatch began with a simple question: What if anyone, anywhere could look up and know exactly what was traversing the silent void above them?
          </p>
          <p>
            Our mission is to democratize orbital awareness. By combining real-time, high-precision orbital element data (TLEs) with advanced client-side mathematical propagation models, we have built a tool that translates the complex choreography of thousands of satellites into an intuitive, accessible interface.
          </p>
          <p>
            We do not rely on generalized path approximations or delayed tracking feeds. When you use OrbitWatch, you are seeing active, real-time calculations that compute the exact altitude, velocity, and trajectory of spacecraft relative to your physical location on Earth.
          </p>
          <p>
            Whether you are an amateur astronomer tracking the International Space Station, a researcher monitoring global communications constellations, or simply someone who finds wonder in the night sky, OrbitWatch is your personal window into the orbital sphere.
          </p>
        </div>

        <div className="mt-24 pt-8 border-t border-white/10 text-center text-sm text-white/40 uppercase tracking-widest">
          Curated by OrbitWatch © {new Date().getFullYear()}
        </div>
      </motion.div>
    </div>
  );
}
