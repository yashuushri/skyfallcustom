import pg from 'pg';
import { RoomSettings, RoomStats, WordPack } from './src/types';

const { Pool } = pg;

// Connection string from environment variables
const DATABASE_URL = process.env.DATABASE_URL;

let pool: pg.Pool | null = null;
let isDbConnected = false;

if (DATABASE_URL) {
  try {
    console.log('DATABASE_URL detected. Connecting to PostgreSQL...');
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false },
      max: 20, // optimized for ~100 concurrent users
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000, // short connection timeout (2s)
      query_timeout: 2000, // short query timeout (2s)
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client:', err);
    });
  } catch (err) {
    console.error('Failed to create PostgreSQL pool. Falling back to memory mode.', err);
    pool = null;
    isDbConnected = false;
  }
} else {
  console.warn('DATABASE_URL is not configured. Running in high-performance IN-MEMORY fallback mode.');
}

/**
 * Initialize database schema and tables automatically
 */
export async function initDatabase() {
  if (!pool) return;
  try {
    const client = await pool.connect();
    console.log('Successfully connected to PostgreSQL database!');
    isDbConnected = true;

    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id VARCHAR(10) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        settings JSONB NOT NULL,
        stats JSONB NOT NULL,
        custom_packs JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS custom_packs (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        words TEXT[] NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS match_history (
        id SERIAL PRIMARY KEY,
        room_id VARCHAR(10) NOT NULL,
        round INT NOT NULL,
        winner VARCHAR(20) NOT NULL,
        players_count INT NOT NULL,
        played_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Indexes for optimized query speeds
    await client.query(`CREATE INDEX IF NOT EXISTS idx_rooms_updated_at ON rooms(updated_at);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_match_history_room ON match_history(room_id);`);

    client.release();
    console.log('PostgreSQL database tables and indexes verified successfully.');
  } catch (error) {
    console.error('PostgreSQL initialization failed. Falling back to memory mode.', error);
    isDbConnected = false;
  }
}

/**
 * Persist or update a room's configuration, stats, and custom packs
 */
export async function saveRoom(
  roomId: string,
  name: string,
  settings: RoomSettings,
  stats: RoomStats,
  customPacks: WordPack[]
) {
  if (!pool || !isDbConnected) return false;
  const upperId = roomId.toUpperCase().trim();
  try {
    await pool.query(
      `INSERT INTO rooms (id, name, settings, stats, custom_packs, updated_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         settings = EXCLUDED.settings,
         stats = EXCLUDED.stats,
         custom_packs = EXCLUDED.custom_packs,
         updated_at = CURRENT_TIMESTAMP`,
      [upperId, name, JSON.stringify(settings), JSON.stringify(stats), JSON.stringify(customPacks)]
    );
    return true;
  } catch (error) {
    console.error(`Failed to save room ${upperId} to database:`, error);
    return false;
  }
}

/**
 * Load a room's configuration, stats, and custom packs
 */
export async function loadRoom(roomId: string): Promise<{
  name: string;
  settings: RoomSettings;
  stats: RoomStats;
  customPacks: WordPack[];
} | null> {
  if (!pool || !isDbConnected) return null;
  const upperId = roomId.toUpperCase().trim();
  try {
    const res = await pool.query('SELECT name, settings, stats, custom_packs FROM rooms WHERE id = $1', [upperId]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      name: row.name,
      settings: row.settings as RoomSettings,
      stats: row.stats as RoomStats,
      customPacks: row.custom_packs as WordPack[],
    };
  } catch (error) {
    console.error(`Failed to load room ${upperId} from database:`, error);
    return null;
  }
}

/**
 * Delete stale rooms (e.g. older than 24 hours) from database to save space
 */
export async function cleanStaleRooms() {
  if (!pool || !isDbConnected) return;
  try {
    const res = await pool.query(`DELETE FROM rooms WHERE updated_at < NOW() - INTERVAL '24 hours'`);
    if (res.rowCount && res.rowCount > 0) {
      console.log(`Cleaned up ${res.rowCount} stale inactive rooms from PostgreSQL database.`);
    }
  } catch (error) {
    console.error('Failed to clean stale database rooms:', error);
  }
}

/**
 * Save custom word deck globally to survive resets
 */
export async function saveCustomPack(pack: WordPack) {
  if (!pool || !isDbConnected) return false;
  try {
    await pool.query(
      `INSERT INTO custom_packs (id, name, words)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         words = EXCLUDED.words`,
      [pack.id, pack.name, pack.words]
    );
    return true;
  } catch (error) {
    console.error(`Failed to save custom pack ${pack.id} to database:`, error);
    return false;
  }
}

/**
 * Load all globally persisted custom word packs
 */
export async function loadCustomPacks(): Promise<WordPack[]> {
  if (!pool || !isDbConnected) return [];
  try {
    const res = await pool.query('SELECT id, name, words FROM custom_packs');
    return res.rows.map(row => ({
      id: row.id,
      name: row.name,
      words: row.words,
      isCustom: true,
    }));
  } catch (error) {
    console.error('Failed to load custom packs from database:', error);
    return [];
  }
}

/**
 * Log match history record
 */
export async function logMatch(roomId: string, round: number, winner: string, playersCount: number) {
  if (!pool || !isDbConnected) return false;
  try {
    await pool.query(
      `INSERT INTO match_history (room_id, round, winner, players_count)
       VALUES ($1, $2, $3, $4)`,
      [roomId.toUpperCase().trim(), round, winner, playersCount]
    );
    return true;
  } catch (error) {
    console.error(`Failed to log match for room ${roomId}:`, error);
    return false;
  }
}
