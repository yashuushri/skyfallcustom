# Spyfall Custom - Social Deduction Web Game

An immersive, highly customizable, and completely server-authoritative multiplayer web game inspired by Spyfall. Designed with a modern, dark-themed UI and synthesized sound effects utilizing the Web Audio API. 

This game is optimized for Discord/voice-chat circles, supporting seamless real-time communication over WebSockets (Socket.IO).

---

## 🚀 Key Features
- **Server-Authoritative Security**: The secret location is never sent to the Spy, and player roles are never broadcasted until round reveal. Cheating via browser DevTools is impossible!
- **Dynamic Synthesized SFX**: Zero external audio asset loading. Warm chimes, card flips, countdown beeps, tension sweeps, victory fanfares, and defeat tones are generated in real-time using the browser's native **Web Audio API**.
- **Automatic Reconnection**: Players can refresh or briefly disconnect without losing their active score, roles, or votes.
- **Deep Customization**: Hosts can configure winning targets, discussion/voting durations, spy counts, pack selection, ready checks, and custom turn rotations.
- **Interactive Word Pack Manager**: Create custom decks, bulk import words via comma-delimited text, or upload/download pack configurations as `.json` files.

---

## 🛠 Tech Stack
- **Frontend**: React (v19) + Vite + Tailwind CSS (v4) + Framer Motion
- **Backend**: Node.js + Express + Socket.IO
- **Packaging/Builds**: esbuild (Bundles backend to unified CommonJS format)
- **Deployment**: Highly compatible with Docker, Vercel, Railway, or Fly.io

---

## 📦 Project Structure
- `/server.ts` - Main Express server hosting Socket.IO rooms, countdown intervals, state sanitizers, and game logic.
- `/src/App.tsx` - Fully interactive React state consumer with modular pages matching every gameplay phase.
- `/src/types.ts` - Central game type definitions.
- `/src/wordPacks.ts` - Built-in word directories (Classic, Countries, Cities, Gaming, Anime, Movies, School, Office).
- `/src/soundManager.ts` - Custom Web Audio synthesizer for all sound effects.
- `/src/components/` - Extracted subpanels:
  - `SoundSettings.tsx` - Master volume and sound testing module.
  - `SettingsPanel.tsx` - Host game-rule sliders and selectors.
  - `WordPackManager.tsx` - Full custom word pack administrator.

---

## 💾 SQL Schema (PostgreSQL & Supabase Compatible)
The application is designed to be **highly resilient**. If `DATABASE_URL` is omitted, it operates in high-performance **in-memory backup mode** with zero setup required. Once a PostgreSQL database (e.g. Supabase) is provided, it instantly enables persistent rooms, global custom word packs, and match logs.

Use the following SQL script to initialize or verify your database schema:

```sql
-- 1. Table for active and restored game rooms
CREATE TABLE IF NOT EXISTS rooms (
    id VARCHAR(10) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    settings JSONB NOT NULL,
    stats JSONB NOT NULL,
    custom_packs JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Table for persistent global custom word packs
CREATE TABLE IF NOT EXISTS custom_packs (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    words TEXT[] NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Table for game match history logs
CREATE TABLE IF NOT EXISTS match_history (
    id SERIAL PRIMARY KEY,
    room_id VARCHAR(10) NOT NULL,
    round INT NOT NULL,
    winner VARCHAR(20) NOT NULL,
    players_count INT NOT NULL,
    played_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Optimize queries with standard structural indexes
CREATE INDEX IF NOT EXISTS idx_rooms_updated_at ON rooms(updated_at);
CREATE INDEX IF NOT EXISTS idx_match_history_room ON match_history(room_id);
```

---

## 🐳 Docker Deployment Setup
To deploy this application inside a self-contained container (e.g. for Google Cloud Run, Railway, or Fly.io):

Create a `Dockerfile` in the root:
```dockerfile
# 1. Base Stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# 2. Production Stage
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --only=production
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/server.cjs"]
```

---

## ⚡ Deployment Instructions

### Option A: Railway (Recommended - Fastest for Socket.IO Full-Stack)
Railway is ideal because it natively supports persistent WebSocket links.
1. Sign up/Log in to [Railway](https://railway.app/).
2. Click **New Project** -> **Deploy from GitHub**.
3. Select your repository containing this code.
4. Railway will auto-detect the Node.js project and run `npm run build` and `npm start` (defined in `package.json`).
5. In **Variables**, add:
   - `NODE_ENV` = `production`
   - `PORT` = `3000`
6. Under **Settings**, click **Generate Domain** to get your public game room URL.

---

### Option B: Fly.io
Fly.io runs standard Docker containers globally with ultra-low latency.
1. Install the `flyctl` CLI and run `fly auth login`.
2. Execute `fly launch` in the project root.
3. Choose a app name and deployment region.
4. Fly.io will auto-generate a `fly.toml` file. Ensure the port points to `3000`.
5. Deploy using `fly deploy`.

---

### Option C: Vercel (Frontend Hosting Only)
If you wish to deploy the frontend to Vercel and run the backend separately:
1. Build and host your backend (e.g., on Railway).
2. Connect your repository to Vercel.
3. In Vercel, change your **Output Directory** to `dist`.
4. Add the environment variable `VITE_BACKEND_URL` pointing to your hosted Railway URL (e.g., `https://spyfall-backend.up.railway.app`).
5. Update `App.tsx` socket initialization:
   ```typescript
   const backendUrl = import.meta.env.VITE_BACKEND_URL || window.location.origin;
   socket = io(backendUrl);
   ```

---

## 🔑 Environment Variables
Declare these inside your hosting portal or local `.env` file:
```env
# Node execution environment
NODE_ENV=production

# The port where nginx reverse proxies incoming requests (defaults to 3000)
PORT=3000

# Optional backend endpoint (if hosting frontend and backend on separate domains)
VITE_BACKEND_URL=
```

Enjoy playing Spyfall Custom with your friends! 🕵️‍♂️
