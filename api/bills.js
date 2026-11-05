import pg from 'pg';
import { verifyToken } from '@clerk/backend';

const { Pool } = pg;
let pool;

function getPool() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 2,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
      ssl: { rejectUnauthorized: false }
    });
  }
  return pool;
}

async function requireUser(req) {
  const authorization = req.headers.authorization || '';
  const match = authorization.match(/^Bearer (.+)$/i);
  if (!match) return null;
  if (!process.env.CLERK_SECRET_KEY) throw new Error('CLERK_SECRET_KEY is not configured');

  const claims = await verifyToken(match[1], {
    secretKey: process.env.CLERK_SECRET_KEY,
    authorizedParties: [
      'https://lilynt-smartbijli-lilynt.vercel.app',
      'https://lilynt-smartbijli.vercel.app'
    ]
  });
  return typeof claims.sub === 'string' ? claims.sub : null;
}

async function getOwnerId(db, clerkUserId) {
  const result = await db.query(
    `INSERT INTO app_users (clerk_user_id)
     VALUES ($1)
     ON CONFLICT (clerk_user_id)
     DO UPDATE SET clerk_user_id = EXCLUDED.clerk_user_id
     RETURNING id`,
    [clerkUserId]
  );
  return result.rows[0].id;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');

  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let clerkUserId;
  try {
    clerkUserId = await requireUser(req);
  } catch (error) {
    console.error('Clerk token verification failed:', error.message);
    return res.status(401).json({ error: 'Invalid or expired sign-in session' });
  }
  if (!clerkUserId) return res.status(401).json({ error: 'Sign in required' });

  let db;
  try {
    db = getPool();
    const ownerId = await getOwnerId(db, clerkUserId);

    if (req.method === 'GET') {
      const result = await db.query(
        `SELECT id, provider, billing_period, units_consumed, total_amount,
                fixed_charges, energy_charges, taxes, other_charges, currency, created_at
         FROM bills WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 100`,
        [ownerId]
      );
      return res.status(200).json({ bills: result.rows });
    }

    const body = req.body || {};
    const units = Number(body.units_consumed);
    const amount = Number(body.total_amount);
    if (!Number.isFinite(units) || units < 0 || units > 10000000 ||
        !Number.isFinite(amount) || amount < 0 || amount > 100000000) {
      return res.status(400).json({ error: 'Valid non-negative units_consumed and total_amount are required' });
    }

    const provider = typeof body.provider === 'string' ? body.provider.slice(0, 80) : null;
    const billingPeriod = typeof body.billing_period === 'string' ? body.billing_period.slice(0, 30) : null;
    const result = await db.query(
      `INSERT INTO bills (owner_id, provider, billing_period, units_consumed, total_amount,
                          fixed_charges, energy_charges, taxes, other_charges)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id, provider, billing_period, units_consumed, total_amount, created_at`,
      [
        ownerId, provider, billingPeriod, units, amount,
        Math.max(0, Number(body.fixed_charges) || 0),
        Math.max(0, Number(body.energy_charges) || 0),
        Math.max(0, Number(body.taxes) || 0),
        Math.max(0, Number(body.other_charges) || 0)
      ]
    );
    return res.status(201).json({ bill: result.rows[0] });
  } catch (error) {
    console.error('Bills API error:', error.message);
    return res.status(500).json({ error: 'Unable to process bills request' });
  }
}
