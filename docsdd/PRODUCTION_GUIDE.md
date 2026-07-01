# Production Deployment & Architecture Guide

This comprehensive guide describes the architecture, data flows, deployment processes, and production configurations for **Spyfall Custom**.

---

## 📖 1. Project Overview & Architecture

Spyfall Custom is a full-stack, real-time social deduction game. The system is built around a **server-authoritative multiplayer state machine** to prevent client-side manipulation (such as viewing the location in the browser console).

### Technical Stack
* **Frontend**: Single Page Application (SPA) powered by React 19, Vite, Tailwind CSS (v4), and Framer Motion.
* **Backend**: Express.js server hosted on Node.js orchestrating real-time state via Socket.IO.
* **Bundling/Compilation**: `vite` compiles client static assets; `esbuild` bundles backend TypeScript handlers into a single, high-performance CommonJS file (`dist/server.cjs`) to ensure lightning-fast startup times and eliminate ES module path resolution errors.

### Authorization & State Flow diagram
```
┌──────────────┐         Establishes Socket.IO Connection       ┌──────────────┐
│  Client SPA  │ ─────────────────────────────────────────────> │ Express/Node │
│  (React 19)  │ <───────────────────────────────────────────── │  Game Server │
└──────────────┘           Syncs Sanitized State Updates        └──────────────┘
```

---

## 📁 2. Folder Structure

The project has been refactored to separate concerns cleanly:
```text
├── .github/workflows/ci.yml # Automated linting, type-checks, and compilation build tests
├── docs/
│   └── PRODUCTION_GUIDE.md  # This document
├── src/                     # React Client Code
│   ├── components/          # Reusable layout and configuration overlays
│   │   ├── SettingsPanel.tsx   # Host session constraints sliders/selectors
│   │   ├── SoundSettings.tsx   # Volume slider and synthesized test triggers
│   │   └── WordPackManager.tsx # Deck visual editor & bulk word delimiter
│   ├── types.ts             # Central TypeScript specifications (States, Players, etc.)
│   ├── wordPacks.ts         # High-resolution built-in word packs list
│   ├── soundManager.ts      # Browser Web Audio API low-latency custom sound synthesizer
│   ├── App.tsx              # Central page manager and dynamic phase views controller
│   ├── main.tsx             # DOM injection mount entry point
│   └── index.css            # Tailwind directives and customized 3D flip card animations
├── Dockerfile               # Production multi-stage Docker image builder
├── docker-compose.yml       # Docker orchestrator for single-command deployments
├── server.ts                # Primary Entry Point: Express router, middlewares, and Socket.IO
├── package.json             # NPM package scripts and configurations
└── tsconfig.json            # Strict type settings
```

---

## 💾 3. Database Schema (Supabase PostgreSQL)

For sessions, persistent statistics, custom word decks, or authentication tracking, you can spin up a **Supabase PostgreSQL** instance. Use the following schema to establish tables:

```sql
-- 1. User Profiles
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    nickname VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Persistent Word Decks
CREATE TABLE IF NOT EXISTS word_packs (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    is_custom BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Decks Word Mapping
CREATE TABLE IF NOT EXISTS pack_words (
    id SERIAL PRIMARY KEY,
    pack_id VARCHAR(50) REFERENCES word_packs(id) ON DELETE CASCADE,
    word VARCHAR(100) NOT NULL,
    UNIQUE(pack_id, word)
);

-- 4. Completed Game Sessions
CREATE TABLE IF NOT EXISTS game_sessions (
    id SERIAL PRIMARY KEY,
    room_code VARCHAR(10) NOT NULL,
    winner VARCHAR(20) CHECK (winner IN ('spies', 'civilians')),
    total_players INT DEFAULT 3,
    played_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Match Scores logs
CREATE TABLE IF NOT EXISTS player_scores (
    id SERIAL PRIMARY KEY,
    session_id INT REFERENCES game_sessions(id) ON DELETE CASCADE,
    player_name VARCHAR(50) NOT NULL,
    score INT NOT NULL,
    role VARCHAR(20) CHECK (role IN ('spy', 'civilian', 'spectator'))
);

-- Indexes to optimize querying performance for live-stats
CREATE INDEX IF NOT EXISTS idx_pack_words_pack_id ON pack_words(pack_id);
CREATE INDEX IF NOT EXISTS idx_player_scores_session_id ON player_scores(session_id);
```

---

## 🔌 4. Socket.IO Event Documentation

The communication interface is strictly typed. All network messages are validated inside the connection wrapper to prevent packet injection.

### Client-to-Server (`socket.emit`)
* `create_room` - `({ name, settings })` - Initializes a new game room.
* `join_room` - `({ roomId, name, playerId })` - Enters an active game room.
* `request_sync` - `({ roomId, playerId })` - Synchronizes states upon client reconnection.
* `update_settings` - `({ roomId, playerId, settings })` - Updates room configuration limits (Host only).
* `update_custom_packs` - `({ roomId, playerId, packs })` - Saves custom decks (Host only).
* `toggle_ready` - `({ roomId, playerId })` - Toggles ready status inside the Lobby.
* `start_game` - `({ roomId, playerId })` - Launches a new game session (Host only).
* `click_ready_reveal` - `({ roomId, playerId })` - Confirms dossier has been viewed by the player.
* `next_turn` - `({ roomId, playerId })` - Concludes current discussion question and rotates turn speaker.
* `skip_discussion` - `({ roomId, playerId })` - Proposes or forces transition to voting.
* `adjust_timer` - `({ roomId, playerId, amount })` - Extends or decreases the timer during play (Host only).
* `force_lobby` - `({ roomId, playerId })` - Interrupts current round and returns everyone to lobby (Host only).
* `submit_vote` - `({ roomId, playerId, targetPlayerId })` - Submits final voting target.
* `submit_spy_guess` - `({ roomId, playerId, word })` - Submits a location guess (Spy only).
* `next_round` - `({ roomId, playerId })` - Advances to next match round (Host only).
* `play_again` - `({ roomId, playerId })` - Resets match scores and starts a new session (Host only).
* `kick_player` - `({ roomId, playerId, targetPlayerId })` - Kicks a player from room (Host only).
* `transfer_host` - `({ roomId, playerId, targetPlayerId })` - Transfers host privileges to another player (Host only).

### Server-to-Client (`socket.emit` / broadcast)
* `room_state` - Sends the current room's complete, sanitized state.
* `joined_room` - Confirms successful join with designated user ID.
* `trigger_sfx` - `({ type })` - Tells client synthesizer to trigger sounds (`click`, `join`, `countdown`, `card_flip`, `warning`, `victory`, `defeat`).
* `error` - `({ message })` - Displays general warning messages to the client.

---

## 📦 5. Docker Deployment Guide

The workspace includes a secure production multi-stage `Dockerfile` and `docker-compose.yml`.

### Running Locally with Docker
1. Make sure you have Docker installed on your device.
2. Build and start the container by running:
   ```bash
   docker compose up --build
   ```
3. Open `http://localhost:3000` inside your browser to play.

---

## 🚀 6. Production Cloud Deployment (Vercel + Railway + Supabase)

Follow these steps to deploy this repository to production clouds.

### Step 1: Spin up Supabase Database (Optional)
1. Go to [supabase.com](https://supabase.com) and create a free project.
2. Navigate to **SQL Editor** in the side navigation, paste the schema script provided in Section 3 of this guide, and click **Run**.
3. Obtain your database Connection URL under **Settings -> Database**.

### Step 2: Deploy Backend to Railway (Preferred)
Railway is ideal for handling long-standing WebSocket connections.
1. Connect your GitHub account on [railway.app](https://railway.app).
2. Click **New Project -> Deploy from GitHub repo** and select this repository.
3. Add the following environment variables in Railway's **Variables** panel:
   * `NODE_ENV` = `production`
   * `PORT` = `3000`
   * `APP_URL` = (Your Railway public domain, once generated)
4. Deploy the service. Take note of your public Railway domain (e.g., `https://spyfall-custom-production.up.railway.app`).

### Step 3: Deploy Frontend to Vercel (Optional - Alternative to Monolith serving)
Vercel is great for super-fast global CDN delivery. Because of our consolidated backend design, Vercel will act as the frontend proxy, pointing socket events to Railway.
1. Go to [vercel.com](https://vercel.com) and link your GitHub repository.
2. Build Settings:
   * **Build Command**: `vite build`
   * **Output Directory**: `dist`
3. Add an Environment Variable in Vercel:
   * `VITE_SERVER_URL` = (Your Railway App URL, e.g. `https://spyfall-custom-production.up.railway.app`)
4. Trigger the deployment.

---

## ⚙️ 7. Environment Variables Configuration

An `.env.example` has been established at the root of the project:

```env
# Server deployment parameters
NODE_ENV=production
PORT=3000

# Server public domain for self-referential hooks
APP_URL=https://my-deployment-url.com

# Optional Database integration parameter
DATABASE_URL=postgresql://postgres:password@db.supabase.co:5432/postgres
```

---

## 🛠 8. Troubleshooting & Common Errors

* **Error: `WebSocket connection failed`**
  * *Cause*: Your hosting platform does not support WebSockets, or the URL is using `http` instead of `https`.
  * *Solution*: Verify that your frontend variable `VITE_SERVER_URL` matches your backend address and uses correct security protocols (`https://`).
* **Error: `Port 3000 is already in use`**
  * *Cause*: Another process is listening on your local machine.
  * *Solution*: Terminate the old process or modify the `PORT` environment variable before booting the app.
* **Problem: Client state is not updating**
  * *Cause*: High network latencies or socket disconnection.
  * *Solution*: The application automatically attempts to reconnect and request state sync within a 15-second grace period. Verify internet connection.
