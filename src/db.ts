import { Pool } from 'pg';

// Single shared connection pool — pg manages idle connections automatically.
// All config comes from environment variables so credentials never touch source control.
const db = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? +process.env.DB_PORT : undefined,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

// Log unexpected errors from idle clients so they don't silently crash the process
db.on('error', (err: Error) => {
  console.error('Unexpected database pool error:', err);
});

export default db;
