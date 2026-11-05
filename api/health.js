import pg from 'pg';

const { Pool } = pg;
let pool;

function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000
    });
  }
  return pool;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const db = getPool();
  if (!db) {
    return res.status(503).json({
      ok: false,
      error: 'DATABASE_URL is not configured for this deployment'
    });
  }

  try {
    await db.query('SELECT 1');
    return res.status(200).json({
      ok: true,
      service: 'LILYNT SmartBijli API',
      database: 'connected'
    });
  } catch (error) {
    console.error('Database health check failed:', error.message);
    return res.status(503).json({
      ok: false,
      service: 'LILYNT SmartBijli API',
      database: 'unavailable'
    });
  }
}
