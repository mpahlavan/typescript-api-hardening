import express, { Request, Response } from 'express';
import morgan from 'morgan';
import { rateLimit } from 'express-rate-limit';
import templateRoutes from './routes/templates';
import categoryRoutes from './routes/categories';

const app = express();

// Log every HTTP request in production; skip in test to keep output clean
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Limit each IP to 100 requests per minute to prevent abuse, especially on /search
app.use(rateLimit({ windowMs: 60_000, limit: 100 }));

// Track total requests so /stats can report a live count
let requestCount = 0;
app.use((_req: Request, _res: Response, next) => { requestCount++; next(); });

app.get('/stats', (_req: Request, res: Response) => {
  res.json({ requests: requestCount });
});

app.use('/templates', templateRoutes);
app.use('/categories', categoryRoutes);

export default app;
