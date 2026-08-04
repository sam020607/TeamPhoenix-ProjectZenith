# OrbitWatch

> A real-time satellite tracking and space intelligence dashboard built by **Team Phoenix**

![Project Zenith](public/images/top100/heic1501a.webp)

---

## Live Demo

**[team-phoenix-project-zenith.vercel.app](https://team-phoenix-project-zenith.vercel.app/)**

---

## Features

| Feature | Sub-Features & Minor Details | Description |
| :--- | :--- | :--- |
| **Live Satellite Map & Constellations** | • 2D Leaflet starry map & 3D Three.js Globe<br>• Visible Constellations layer<br>• Wikipedia page redirects<br>• Ambient city lights toggle<br>• Grid, stars, and radar filters<br>• Atmospheric limb shaders<br>• Split orbit path rendering<br>• Decoupled details overlay cards | Renders real-time satellite locations, a detailed starry sky map, and visible constellations at their sub-stellar coordinates. Constellations can be clicked to view descriptions and visit their Wikipedia pages directly. Includes map settings to toggle grid lines, stars, radar rings, and ambient city lights (where population is high). Includes atmospheric glow shaders, past/future path styling, and decoupled map cards. |
| **ISS Tracker** | • Live SGP4/SDP4 propagation<br>• Visibility cone footprint<br>• Historic ground trail | Tracks the ISS position in real-time. Displays ground footprint visibility cones (10° minimum elevation) and its historic orbital track. |
| **Satellite Battles** | • Background web worker propagation<br>• 24-hr Closest Encounter Solver<br>• Deterministic Battle Scoring engine<br>• Tactical summary generator<br>• Auto-open 3D mode | Side-by-side satellite comparisons. Uses a background worker for thread-safe propagation, calculates closest approach windows, scores performance (coverage area, revisit times, daily swept ground area), and generates tactical analysis bullet points client-side. |
| **APOD Gallery** | • NASA APOD API integration<br>• Parallax telescope image gallery | Displays NASA's Astronomy Picture of the Day. Includes a 4-column parallax image archive (column count scales responsively on mobile) with custom touch scroll support. |
| **NEO Tracker** | • Close-approach NEAs feed<br>• NASA JPL page redirects<br>• Potential Hazard indicators<br>• Approach timeline filtering | Displays a feed of Near-Earth Objects from NASA. Filters and highlights Potentially Hazardous Asteroids (PHAs) and close approaches. Clicking on an asteroid opens its official NASA JPL Small-Body Database details page. |
| **Tonight's Sky Report** | • Local visible overhead count<br>• Moon phase calculations<br>• Local ISS pass countdowns | Provides a summary of celestial events for your coordinates. Computes overhead counts, local passes, and renders real-time moon phase drawings. |
| **Satellite Lookup** | • NORAD ID & name search<br>• Orbital parameters telemetry | Searchable registry of all active satellites. Syncs selection dynamically with the map overlays. |
| **Observer's Journal** | • Persistent text log entry<br>• Firebase Auth & Local Storage sync | A persistent notebook to record celestial sightings. Syncs user entries to Firebase or fallback LocalStorage. |
| **AURA AI Assistant** | • Gemini API integration<br>• Context-aware prompting<br>• Draggable floating trigger widget | Natural language assistant. Injects observer coordinates, current satellite, and sky metrics into Gemini prompts. FAB has touch-none dragging and click-drag separation. |
| **Interactive Onboarding** | • 7-slide briefing cards<br>• Boot loader simulator<br>• Looping background space video<br>• SVG noise CRT scanline filter | Cinematic onboarding flow. Simulates a terminal boot sequence, plays a looping background space video under an SVG noise filter, and provides a walkthrough replay setting. |
| **Firebase Auth** | • Google & GitHub SSO<br>• Offline mock authentication fallbacks | Provides sign-in/registration. Safely triggers offline mock user sessions if API keys or Firebase environment files are missing. |
| **Settings Panel** | • In-app API key configurator<br>• Presets & theme configuration<br>• UTC vs. Local observer clocks | Configures system options. Hosts the onboarding replay utility, theme toggles, and dual clocks showing Observer Local Time (LCL) vs. Global/Observer UTC time (OBS). |
| **Location Geolocation** | • One-click map pin search button<br>• Browser-based coordinates lock | The search bar on the landing page (and header) features a GPS map pin button that automatically retrieves and locks in observer coordinates. |
| **Mobile Optimization** | • Edge-to-Edge Maps<br>• Navigation FAB & slide-up Portal<br>• Collapsed Sliders menu<br>• Touch-interception fixes | Adjusts layout to mobile screens. Canvases bleed under header, collapses menus responsively, and uses native `touchstart` + `click` event handling to prevent Leaflet/OrbitControls click conflicts. |

---

## 🔍 Core Feature Highlights

Here is a detailed breakdown of the specialized capabilities built into **Project Zenith**:

### 📍 One-Click Geolocation Coordinates Lock (`MapPin` Search)
* **Landing Page & Header Pin**: The central search bar features a specialized GPS MapPin icon button (`MapPin`).
* **Instant Calibration**: Clicking the pin prompts browser geolocation permission, retrieves your precise latitude and longitude, fills the search input automatically, and updates the global observer coordinates. This instantly calibrates the dashboard sky map, overhead satellite count, local countdown timers, and moon phase calculations for your exact current location.

### ⏰ Local Time vs. Global/Observer Time (LCL & OBS Clocks)
* **Synchronized Dual Clocks**: Located in the top header is a dual-clock system displaying Local Client Time (`LCL`) next to Observer Astronomical Time (`OBS`).
* **`LCL` (Local Client Time)**: Reflects the standard system time and timezone of your browser's local computer.
* **`OBS` (Observer Time)**: Displays timezone-corrected observer local time, computed dynamically based on the active observer coordinates' longitude offset (`UTC` offset calculations). This provides observer-accurate celestial and satellite pass synchronization.

### 🌌 Constellation Sky Projection & Wikipedia Integration
* **Real-time Stellar Mapping**: Both the 2D Leaflet Starry Map and 3D Three.js Globe render real-time constellations projected at their actual celestial coordinates.
* **Wikipedia Redirects**: Clicking on a constellation opens a detailed popup overlay showing its abbreviation, name, and coordinate telemetry. From there, users can click **"📖 Explore on Wikipedia"** to open its official Wikipedia encyclopedia article in a new tab.

### 🗺️ Starry Map Overlay & Disappearable Ambient City Lights
* **Ambient Lighting Toggle**: The map settings controls allow you to toggle the visibility of **Ambient City Lights** on the globe/map.
* **Smart Population Gradients**: City lights glow realistically on land surfaces representing high-density population areas. They dynamically fade and disappear in regions entering daylight or when the toggle is deactivated to provide an unobstructed view of the stars.
* **Starry Sky Filter**: Toggles a beautiful starry space background layer with custom celestial gridlines, radar sweeps, and satellite footprints.

### ☄️ Asteroid NEO Tracker & NASA JPL Redirects
* **Close-Approach NEA Feed**: Fetches real-time Near-Earth Asteroid (NEA) reports from the NASA NeoWs API.
* **JPL SBDB Redirects**: Selecting any asteroid from the feed displays its close-approach velocity, distance, hazard status, and a direct link to the **NASA JPL Small-Body Database** (`☄️ View JPL Small-Body Database`). This redirect lets you analyze the asteroid's full orbital diagram, physical characteristics, and telemetry charts directly on NASA's official portal.

---

## Tech Stack


| Layer | Technology |
|---|---|
| **Framework** | [Vite](https://vitejs.dev/) + [React 18](https://react.dev/) |
| **3D Globe** | [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) + [Three.js](https://threejs.org/) + [@react-three/drei](https://github.com/pmndrs/drei) |
| **2D Map** | [React Leaflet](https://react-leaflet.js.org/) + [Leaflet.js](https://leafletjs.com/) |
| **Animation** | [Framer Motion](https://www.framer-motion.com/) + [GSAP](https://gsap.com/) + [Lenis](https://lenis.darkroom.engineering/) |
| **Auth** | [Firebase Authentication](https://firebase.google.com/docs/auth) |
| **Orbital Math** | [satellite.js](https://github.com/shashwatak/satellite-js) (SGP4/SDP4 propagation) |
| **Icons** | [Lucide React](https://lucide.dev/) + [Tabler Icons](https://tabler.io/icons) |
| **Routing** | [React Router v7](https://reactrouter.com/) |
| **HTTP** | [Axios](https://axios-http.com/) |
| **Sun/Moon Calc** | [SunCalc](https://github.com/mourner/suncalc) |

---

## Dependencies

### Runtime

| Package | Version | Purpose |
|---|---|---|
| react | ^18.3.1 | UI framework |
| react-dom | ^18.3.1 | React DOM rendering |
| react-router-dom | ^7.1.1 | Client-side routing |
| @react-three/fiber | ^8.18.0 | React renderer for Three.js |
| @react-three/drei | ^9.122.0 | Three.js helpers & abstractions |
| three | ^0.184.0 | 3D graphics engine |
| react-globe.gl | ^2.38.0 | Interactive 3D globe component |
| leaflet | ^1.9.4 | 2D interactive maps |
| react-leaflet | ^4.2.1 | React bindings for Leaflet |
| satellite.js | ^4.1.4 | SGP4/SDP4 orbital propagation |
| framer-motion | ^11.18.2 | Declarative animations |
| motion | ^12.40.0 | Animation primitives |
| gsap | ^3.15.0 | High-performance animations |
| lenis | ^1.3.23 | Smooth scroll library |
| firebase | ^12.15.0 | Authentication (Google & GitHub) |
| axios | ^1.7.9 | HTTP client |
| suncalc | ^1.9.0 | Sun & moon position calculations |
| lucide-react | ^0.469.0 | Icon set |
| @tabler/icons-react | ^3.44.0 | Extended icon set |
| @fiddle-digital/string-tune | ^1.2.0 | Scroll-driven animation engine |
| hls.js | ^1.6.16 | HLS video stream playback |
| clsx | ^2.1.1 | Conditional className utility |
| tailwind-merge | ^3.6.0 | Tailwind class merging utility |

### Dev

| Package | Version | Purpose |
|---|---|---|
| vite | ^5.2.0 | Build tool & dev server |
| @vitejs/plugin-react | ^4.2.1 | React fast refresh for Vite |
| tailwindcss | ^3.4.17 | Utility-first CSS framework |
| postcss | ^8.4.49 | CSS processing |
| autoprefixer | ^10.4.20 | CSS vendor prefixing |
| gh-pages | ^6.3.0 | GitHub Pages deployment |
| @types/react | ^18.3.18 | TypeScript types for React |
| @types/react-dom | ^18.3.5 | TypeScript types for React DOM |

---

## API Keys Required

Create a `.env.local` file in the project root with the following variables:

```env
# Firebase (Authentication)
# Get these from: https://console.firebase.google.com → Project Settings → General → Your Apps
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# NASA API (APOD + Asteroids/NEO)
# Free key, 1,000 req/hour. Get it at: https://api.nasa.gov
# Falls back to DEMO_KEY (30 req/hour) if not set.
VITE_NASA_API_KEY=

# N2YO (Satellite passes + overhead objects)
# Free tier available. Register at: https://www.n2yo.com/api/
VITE_N2YO_API_KEY=
VITE_N2YO_API_KEY_SECONDARY=   # Optional fallback key

# Google Gemini (AURA AI Assistant)
# Get at: https://aistudio.google.com/app/apikey
# Falls back to simulated Guest Mode if not set.
VITE_GEMINI_API_KEY=

# Astronomy API (Planet/moon positions)
# Register at: https://astronomyapi.com/
VITE_ASTRONOMY_APP_ID=
VITE_ASTRONOMY_APP_SECRET=

# Space-Track (Extended TLE dataset)
# Optional. Register at: https://www.space-track.org/auth/createAccount
# Falls back to CelesTrak (no key needed) if not set.
VITE_SPACETRACK_USER=
VITE_SPACETRACK_PASSWORD=
```

> **Note:** All keys are optional except Firebase (required for auth). The app degrades gracefully — satellite tracking works without N2YO, AI works in Guest Mode without Gemini, etc.

---

## Setup & Local Development

### Prerequisites
- [Node.js](https://nodejs.org/) v18+ and npm

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/sam020607/TeamPhoenix-ProjectZenith.git
cd TeamPhoenix-ProjectZenith

# 2. Install dependencies
npm install

# 3. Create your environment file
cp .env.example .env.local
# Then fill in your API keys in .env.local

# 4. Start the development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Build & Deploy

```bash
# Build for production
npm run build

# Preview the production build locally
npm run preview
```

### Deploying to Vercel

1. Push to GitHub
2. Import repo at [vercel.com/new](https://vercel.com/new)
3. Vercel auto-detects Vite — leave all build settings as default
4. Add all `VITE_*` environment variables in Vercel → Settings → Environment Variables
5. Hit **Deploy**

The included `vercel.json` handles SPA routing and API proxying automatically.

---

## External APIs Used

| API | Purpose | Registration Required | Env Variable(s) | Docs |
|---|---|---|---|---|
| [CelesTrak](https://celestrak.org/) | TLE satellite orbital data | None — fully public, no account needed | — | [celestrak.org](https://celestrak.org/) |
| [N2YO](https://www.n2yo.com/api/) | Overhead satellite passes & predictions | Free account + API key from n2yo.com/api | `VITE_N2YO_API_KEY` | [n2yo.com/api](https://www.n2yo.com/api/) |
| [NASA API](https://api.nasa.gov/) | APOD image + Near-Earth Object asteroid data | Free — name & email only, key emailed instantly | `VITE_NASA_API_KEY` | [api.nasa.gov](https://api.nasa.gov/) |
| [Google Gemini](https://ai.google.dev/) | AURA AI assistant (natural language) | Free — Google account, key from AI Studio | `VITE_GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com/) |
| [Firebase Auth](https://firebase.google.com/) | Google & GitHub sign-in / authentication | Free — create a Firebase project + enable Auth | `VITE_FIREBASE_API_KEY` and 5 other `VITE_FIREBASE_*` vars | [firebase.google.com](https://firebase.google.com/) |
| [AstronomyAPI](https://astronomyapi.com/) | Moon phase & planet position data | Free tier — account registration required | `VITE_ASTRONOMY_APP_ID`, `VITE_ASTRONOMY_APP_SECRET` | [astronomyapi.com](https://astronomyapi.com/) |
| [Space-Track](https://www.space-track.org/) | Extended satellite TLE catalogue | Free — account registration + approval required | `VITE_SPACETRACK_USER`, `VITE_SPACETRACK_PASSWORD` | [space-track.org](https://www.space-track.org/) |

> **Note:** CelesTrak is used as the primary TLE source and requires no credentials. Space-Track is an optional extended source — the app falls back to CelesTrak automatically if Space-Track credentials are not provided.

---

## Project Structure

```
src/
├── api/                    # API client modules (NASA, N2YO, CelesTrak, etc.)
├── components/
│   ├── Auth/               # Login / sign-up pages
│   ├── Dashboard/          # Main control room UI + all panels
│   ├── LandingPage/        # Animated landing / home page
│   ├── JournalPanel/       # Observer's journal
│   ├── NightReport/        # Tonight's sky report
│   ├── PassCountdown/      # Satellite pass timer
│   ├── LookUpCard/         # Satellite search & lookup
│   ├── Onboarding/         # First-run briefing flow
│   └── ui/                 # Reusable UI primitives
├── features/
│   ├── satellite-battles/  # Battle mode — orbital comparison
│   └── battle-telemetry/   # Live telemetry for battles
├── hooks/                  # Custom React hooks (ISS, satellites, passes)
├── context/                # Global state (location, theme, satellite store)
├── services/               # Background workers (orbital math Web Worker)
├── utils/                  # Coordinate transforms, formatting helpers
└── firebase.js             # Firebase app initialisation
```

---

## Team Phoenix

| Name | Role |
|---|---|
| Agarim Karnwal | Lead Developer |
| Samriddhi Upadhyay | Full Stack Developer |

---

## License

This project was built for **AstralWeb Innovate Hackathon**, organized by **AARUSH**. All rights reserved by Team Phoenix.
