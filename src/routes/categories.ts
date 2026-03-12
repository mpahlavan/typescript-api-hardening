import { Router, Request, Response } from 'express';
import db from '../db';
import { CategoryRow } from '../types';
import { CreateCategorySchema } from '../schemas';

const router = Router();

// List all categories, ordered by insertion so the UI renders them consistently
router.get('/', async (_req: Request, res: Response) => {
  try {
    const { rows } = await db.query<CategoryRow>('SELECT id, slug FROM categories ORDER BY id ASC');
    res.json(rows);
  } catch (e) {
    console.error('GET /categories error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new category. Slugs are used as identifiers in the UI (e.g. "minimal", "modern")
router.post('/', async (req: Request, res: Response) => {
  const parsed = CreateCategorySchema.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue.path.length > 0 ? String(issue.path[0]) : 'input';
    return res.status(400).json({ error: `${field}: ${issue.message}` });
  }
  const { slug } = parsed.data;

  try {
    const { rows } = await db.query<{ id: number }>(
      'INSERT INTO categories (slug) VALUES ($1) RETURNING id',
      [slug]
    );
    res.status(201).json({ id: rows[0].id, slug });
  } catch (e) {
    console.error('POST /categories error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
