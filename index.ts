import 'dotenv/config';
import http from 'http';
import debug from 'debug';
import { Request, Response } from 'express';
import app from './src/app';
import db from './src/db';

const log = debug('appostrophe-backend-case-study:server');

// Health check hits the DB so we know both the app and the database are reachable
app.get('/health', async (_req: Request, res: Response) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (e) {
    console.error('Health check failed:', e);
    res.status(503).json({ status: 'error', timestamp: new Date().toISOString() });
  }
});

const port = process.env.PORT ?? '5003';
const server = http.createServer(app);

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

function onError(error: NodeJS.ErrnoException): void {
  if (error.syscall !== 'listen') throw error;
  const bind = typeof port === 'string' ? `Pipe ${port}` : `Port ${port}`;
  if (error.code === 'EACCES') {
    console.error(`${bind} requires elevated privileges`);
    process.exit(1);
  } else if (error.code === 'EADDRINUSE') {
    console.error(`${bind} is already in use`);
    process.exit(1);
  } else {
    throw error;
  }
}

function onListening(): void {
  const addr = server.address();
  const bind = typeof addr === 'string' ? `pipe ${addr}` : `port ${addr?.port}`;
  log(`Listening on ${bind}`);
}

// Graceful shutdown: stop accepting new requests, then drain the DB pool before exiting.
// This prevents dropped connections when the process is killed by the OS or a deploy.
function shutdown(signal: string): void {
  console.log(`${signal} received, shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed');
    db.end(() => {
      console.log('Database pool closed');
      process.exit(0);
    });
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
