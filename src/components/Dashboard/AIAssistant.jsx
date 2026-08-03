import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { Bot, X, Send, Sparkles, Terminal, AlertCircle, RefreshCw, HelpCircle, Activity } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { getAllSourceSnapshots } from '../../services/apiMonitor.js';
import axios from 'axios';

// Google Gemini API configuration
export function getGeminiKey() {
  return localStorage.getItem('orbitwatch_gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || '';
}

// Space facts for Guest Mode fallback
const SPACE_FACTS = [
  "The International Space Station orbits Earth about every 90 minutes at a speed of roughly 28,000 km/h (17,500 mph).",
  "One day on Venus is longer than one year. Venus takes 243 Earth days to rotate once on its axis, but only 225 Earth days to travel around the Sun.",
  "Neutron stars are so dense that a single teaspoon of their material would weigh about 6 billion tons on Earth.",
  "Light from the Sun takes approximately 8 minutes and 20 seconds to reach Earth.",
  "There are more trees on Earth than stars in the Milky Way galaxy (about 3 trillion trees vs. 100-400 billion stars).",
  "Apollo astronauts' footprints on the Moon will probably stay there for at least 100 million years because the Moon has no atmosphere or wind.",
  "The footprint of a satellite in Low Earth Orbit (LEO) spans thousands of kilometers, but it is only visible above the horizon for 5 to 15 minutes per pass."
];

export default function AIAssistant({ showChrome = true }) {
  const { state } = useApp();
  const { location, locationName, issPosition, satellites } = state;

  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragControls = useDragControls();

  const handlePointerDown = (e) => {
    dragControls.start(e);
  };
  const [messages, setMessages] = useState([
    {
      role: 'model',
      content: "System initialized. I am your OrbitWatch onboard AI assistant. How can I help you analyze the skies today?",
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isGuestMode, setIsGuestMode] = useState(() => !getGeminiKey());
  const [showConfigAlert, setShowConfigAlert] = useState(() => !getGeminiKey());

  const messagesEndRef = useRef(null);

  useEffect(() => {
    const handleSettingsChange = () => {
      const key = getGeminiKey();
      setIsGuestMode(!key);
      setShowConfigAlert(!key);
    };
    window.addEventListener('orbitwatch-settings-changed', handleSettingsChange);
    return () => window.removeEventListener('orbitwatch-settings-changed', handleSettingsChange);
  }, []);

  // Auto-scroll to the bottom of messages list
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Sync open state to localStorage for conditional map overlay hiding
  useEffect(() => {
    localStorage.setItem('orbitwatch_chat_open', isOpen.toString());
    window.dispatchEvent(new Event('orbitwatch-chat-toggle'));
  }, [isOpen]);

  // Build real-time context injected into LLM system instructions
  const buildSystemContext = () => {
    const observerLoc = location
      ? `${locationName || 'Unknown'} (${location.lat.toFixed(4)}°N, ${location.lon.toFixed(4)}°E)`
      : 'Not set';

    const issCoords = issPosition
      ? `Latitude ${issPosition.lat.toFixed(4)}°, Longitude ${issPosition.lon.toFixed(4)}°`
      : 'Offline/Mocking';

    const apiSnapshots = getAllSourceSnapshots();
    const apiStatusText = apiSnapshots
      .map(src => `${src.label}: ${src.status.toUpperCase()}${src.isFallback ? ' (MOCK/CACHE)' : ''}`)
      .join(', ');

    const visibleSats = satellites.slice(0, 15).map(s => 
      `- ${s.satname} (NORAD: ${s.satid}, Type: ${s.type}, Altitude: ${s.satalt.toFixed(1)} km, Vel: ${s.velocity.toFixed(2)} km/s)`
    ).join('\n');

    return `You are AURA — the Astronomical Universal Reconnaissance Assistant (OrbitWatch onboard AI Assistant).
You assist operators in a satellite tracking control room. 

Here is the CURRENT REAL-TIME TELEMETRY STATE of the control room:
- **Observer Location**: ${observerLoc}
- **Real-Time ISS Position**: ${issCoords}
- **System API Health Status**: ${apiStatusText}
- **Overhead Satellites List (Showing top 15 of ${satellites.length} visible)**:
${visibleSats || 'No satellites currently cataloged overhead.'}

**INSTRUCTIONS**:
1. You have direct access to the telemetry details printed above. Answer questions about them with 100% accuracy based on the values provided.
2. Maintain a professional, helpful, and slightly technical control room operator tone.
3. Keep answers concise and direct (maximum 3-4 sentences) so they fit nicely within a compact sidebar chat widget.
4. If asked about stars or constellations, remind them they can toggle constellations in the tracker sidebar.
5. If the user asks about API keys, explain that they can configure VITE_N2YO_API_KEY and VITE_GEMINI_API_KEY in their local .env file.`;
  };

  // Handles simulated replies in Guest Mode
  const getSimulatedResponse = (query) => {
    const q = query.toLowerCase();

    if (q.includes('iss') || q.includes('space station') || q.includes('where')) {
      if (issPosition) {
        return `The ISS is currently overhead at Latitude ${issPosition.lat.toFixed(4)}° and Longitude ${issPosition.lon.toFixed(4)}°, moving at approximately 7.66 km/s at an altitude of 408 km.`;
      }
      return "The ISS position is currently being estimated mathematically. It typically orbits at 51.6° inclination with a 92-minute orbital period.";
    }

    if (q.includes('api') || q.includes('diagnostics') || q.includes('health') || q.includes('celestrak') || q.includes('n2yo') || q.includes('limit')) {
      const apiSnapshots = getAllSourceSnapshots();
      const report = apiSnapshots.map(s => `${s.label}: ${s.status.toUpperCase()}`).join(', ');
      return `Onboard systems diagnostics report: ${report}. Celestrak is cache-synced for 24 hours, and N2YO is operating on a 3-minute poll interval to preserve quota limits.`;
    }

    if (q.includes('satellite') || q.includes('overhead') || q.includes('objects')) {
      if (satellites.length > 0) {
        const sample = satellites.slice(0, 3).map(s => s.satname).join(', ');
        return `I am currently tracking ${satellites.length} objects overhead. The closest visible targets include: ${sample}. You can use the left sidebar rail to filter by category (Weather, GPS, Comms).`;
      }
      return "No satellites are currently cataloged overhead. Ensure your observer location is set on the map.";
    }

    if (q.includes('fact') || q.includes('trivia') || q.includes('tell') || q.includes('space')) {
      const idx = Math.floor(Math.random() * SPACE_FACTS.length);
      return `[Astronomical Fact] ${SPACE_FACTS[idx]}`;
    }

    return "I am AURA, operating in Guest Mode (Simulated AI). To enable my full generative LLM capabilities, please add a VITE_GEMINI_API_KEY to your .env file. For now, you can ask me about 'ISS location', 'API health', 'overhead satellites', or request a 'space fact'!";
  };

  // Send message handler
  const handleSendMessage = async (textToSend = inputValue) => {
    if (!textToSend.trim()) return;

    // Add user message
    const userMsg = { role: 'user', content: textToSend, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    // Call API or Simulator
    if (isGuestMode) {
      setTimeout(() => {
        const reply = getSimulatedResponse(textToSend);
        setMessages(prev => [...prev, { role: 'model', content: reply, timestamp: new Date() }]);
        setIsTyping(false);
      }, 800 + Math.random() * 800); // realistic typing delay
    } else {
      try {
        const contextPrompt = buildSystemContext();
        const activeKey = getGeminiKey();
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`;
        
        // Format history for Gemini API contents parameter
        const history = messages.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        }));

        // Append latest user message
        history.push({
          role: 'user',
          parts: [{ text: textToSend }]
        });

        const response = await axios.post(geminiUrl, {
          contents: history,
          systemInstruction: {
            parts: [{ text: contextPrompt }]
          },
          generationConfig: {
            maxOutputTokens: 300,
            temperature: 0.6,
          }
        }, {
          headers: { 
            'Content-Type': 'application/json',
            'x-goog-api-key': activeKey
          }
        });


        const replyText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "I was unable to compile a reply. Telemetry error.";
        
        setMessages(prev => [...prev, { role: 'model', content: replyText, timestamp: new Date() }]);
      } catch (err) {
        console.error('[Gemini API] Failed to fetch LLM response:', err.message);
        setMessages(prev => [...prev, { 
          role: 'model', 
          content: `Connection error: ${err.message}. Reverting to Guest Mode simulator for safety. Please check your VITE_GEMINI_API_KEY settings.`, 
          timestamp: new Date() 
        }]);
        setIsGuestMode(true);
      } finally {
        setIsTyping(false);
      }
    }
  };

  // Keyboard support
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  const handlePromptClick = (promptText) => {
    handleSendMessage(promptText);
  };

  return (
    <motion.div 
      drag
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={() => {
        setTimeout(() => setIsDragging(false), 50);
      }}
      dragConstraints={{
        top: -window.innerHeight + 120,
        bottom: 24,
        left: -window.innerWidth + 120,
        right: 24
      }}
      className={`fixed bottom-24 lg:bottom-6 right-6 z-[2000] flex flex-col items-end pointer-events-none transition-all duration-300 ${showChrome || isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12 pointer-events-none'}`}
    >
      
      {/* ── CHAT WINDOW OVERLAY ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="w-[360px] md:w-[380px] h-[480px] max-h-[calc(100vh-100px)] mb-4 glass-card border border-white/[0.08] shadow-2xl rounded-2xl flex flex-col overflow-hidden pointer-events-auto z-50"
            style={{
              background: 'rgba(15, 22, 38, 0.72)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              boxShadow: '0 24px 48px -12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)'
            }}
          >
            {/* Terminal Style Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-black/20 shrink-0">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-cyan" />
                <div className="flex flex-col leading-tight">
                  <span className="font-mono text-[10px] tracking-widest text-text uppercase font-bold">AURA</span>
                  <span className="font-sans text-[7px] tracking-wider text-muted uppercase font-normal">Astronomical Universal Reconnaissance Assistant</span>
                </div>
                <span className="flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-full border border-white/[0.04]">
                  <span className={`w-1 h-1 rounded-full ${isGuestMode ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400 shadow-[0_0_4px_#3fd6a0]'}`} />
                  <span className="text-[7px] font-sans font-bold text-muted uppercase tracking-wider">
                    {isGuestMode ? 'GUEST MODEL' : 'GEMINI ACTIVE'}
                  </span>
                </span>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-muted hover:text-text transition-colors p-1 rounded hover:bg-white/[0.04]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* API Config Banner */}
            {showConfigAlert && (
              <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-[9px] font-sans text-amber-400 flex items-start gap-2 shrink-0">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold uppercase tracking-wider">Running in Offline/Guest mode</p>
                  <p className="text-zinc-400 mt-0.5">To unlock real generative responses, add your API key to `.env` as <code className="font-mono text-text text-[8px] bg-black/30 px-1 py-0.5 rounded border border-white/[0.05]">VITE_GEMINI_API_KEY</code>.</p>
                </div>
                <button 
                  onClick={() => setShowConfigAlert(false)} 
                  className="text-amber-400 hover:text-text text-[10px] font-bold p-0.5"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Message Feed List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans text-xs scrollbar-thin">
              {messages.map((msg, idx) => (
                <div 
                  key={idx}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`px-3.5 py-2.5 rounded-2xl max-w-[85%] leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-accent/20 text-text border border-accent/25 rounded-tr-none shadow-[0_4px_12px_rgba(77,141,255,0.05)]'
                        : 'bg-white/[0.03] text-text border border-white/[0.06] rounded-tl-none shadow-[0_4px_12px_rgba(0,0,0,0.15)]'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <span className="text-[8px] text-muted font-mono mt-1 px-1">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}

              {isTyping && (
                <div className="flex flex-col items-start">
                  <div className="px-3.5 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-2xl rounded-tl-none flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggested Pills */}
            <div className="px-4 py-2 border-t border-white/[0.04] bg-black/10 flex gap-2 overflow-x-auto shrink-0 scrollbar-none">
              <button 
                onClick={() => handlePromptClick("Where is the ISS now?")}
                className="px-2.5 py-1 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.1] rounded-full text-[9px] font-sans text-muted hover:text-text transition-all whitespace-nowrap"
              >
                🛰️ Where is the ISS?
              </button>
              <button 
                onClick={() => handlePromptClick("Check system API health")}
                className="px-2.5 py-1 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.1] rounded-full text-[9px] font-sans text-muted hover:text-text transition-all whitespace-nowrap"
              >
                🔬 Check API Health
              </button>
              <button 
                onClick={() => handlePromptClick("Tell me a space fact")}
                className="px-2.5 py-1 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.1] rounded-full text-[9px] font-sans text-muted hover:text-text transition-all whitespace-nowrap"
              >
                ✨ Space Fact
              </button>
            </div>

            {/* Chat Input Bar */}
            <div className="p-3 border-t border-white/[0.06] bg-black/20 flex gap-2 items-center shrink-0">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask AURA..."
                className="flex-1 glass-input px-3.5 py-2 text-xs font-sans text-text border border-white/[0.08] bg-black/40 rounded-xl focus:border-cyan/50 outline-none"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputValue.trim()}
                className="p-2 bg-white hover:bg-cyan-400 disabled:bg-white/[0.04] text-black disabled:text-muted rounded-xl transition-all shadow-[0_0_8px_rgba(255,255,255,0.1)] active:scale-95 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FLOATING TRIGGER CIRCLE (FAB) ── */}
      <motion.button
        onPointerDown={handlePointerDown}
        onClick={() => {
          if (!isDragging) {
            setIsOpen(!isOpen);
          }
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="w-12 h-12 rounded-full flex items-center justify-center pointer-events-auto shadow-2xl relative border touch-none"
        style={{
          background: isOpen ? 'rgba(77, 141, 255, 0.2)' : 'rgba(15, 22, 38, 0.75)',
          borderColor: isOpen ? 'rgba(77, 141, 255, 0.5)' : 'rgba(255,255,255,0.08)',
          boxShadow: isOpen 
            ? '0 0 12px rgba(77, 141, 255, 0.4), inset 0 1px 0 rgba(255,255,255,0.03)' 
            : '0 8px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)'
        }}
      >
        <Bot className={`w-5 h-5 ${isOpen ? 'text-cyan' : 'text-text-primary'}`} />
        {!isOpen && (
          <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan"></span>
          </span>
        )}
      </motion.button>

    </motion.div>
  );
}
