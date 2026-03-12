import { Router, Request, Response } from 'express';
import db from '../db';
import {
  isTemplateCacheValid,
  getTemplatesCache,
  setTemplatesCache,
  invalidateTemplatesCache,
} from '../cache';
import { TemplateRow } from '../types';
import { CreateTemplateSchema, UpdateTemplateSchema } from '../schemas';

const router = Router();

// Reused by GET /, GET /search, and GET /:id — always fetches categories in the same query
// to avoid N+1 queries. The FILTER clause ensures templates with no categories return []
// instead of [null].
const TEMPLATES_WITH_CATEGORIES_SQL = `
  SELECT t.id, t.title, t.source, t.order_index, t.created_at, t.updated_at,
         coalesce(array_agg(c.slug) FILTER (WHERE c.slug IS NOT NULL), '{}') AS categories
  FROM templates t
  LEFT JOIN template_categories tc ON tc.template_id = t.id
  LEFT JOIN categories c ON c.id = tc.category_id
`;

// Return the full template list. Results are cached for 60s to reduce DB load.
router.get('/', async (_req: Request, res: Response) => {
  try {
    if (isTemplateCacheValid()) {
      return res.json(getTemplatesCache());
    }
    const { rows } = await db.query<TemplateRow>(
      TEMPLATES_WITH_CATEGORIES_SQL + ' GROUP BY t.id ORDER BY t.order_index ASC'
    );
    setTemplatesCache(rows);
    res.json(rows);
  } catch (e) {
    console.error('GET /templates error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search by title or id. Falls back to cache when no search term is given.
router.get('/search', async (req: Request, res: Response) => {
  const searchTerm = typeof req.query.q === 'string' ? req.query.q : '';
  try {
    if (!searchTerm && isTemplateCacheValid()) {
      return res.json(getTemplatesCache());
    }
    const { rows } = await db.query<TemplateRow>(
      TEMPLATES_WITH_CATEGORIES_SQL +
        ` WHERE t.title ILIKE '%' || $1 || '%' OR t.id ILIKE '%' || $1 || '%'
         GROUP BY t.id ORDER BY t.order_index ASC`,
      [searchTerm]
    );
    res.json(rows);
  } catch (e) {
    console.error('GET /templates/search error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch a single template by id, including its category slugs
router.get('/:id', async (req: Request, res: Response) => {
  const templateId = req.params.id;
  try {
    const { rows } = await db.query<TemplateRow>(
      TEMPLATES_WITH_CATEGORIES_SQL + ' WHERE t.id = $1 GROUP BY t.id',
      [templateId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json({ template: rows[0], categorySlugs: rows[0].categories });
  } catch (e) {
    console.error('GET /templates/:id error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  const parsed = CreateTemplateSchema.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue.path.length > 0 ? String(issue.path[0]) : 'input';
    return res.status(400).json({ error: `${field}: ${issue.message}` });
  }
  const data = parsed.data;

  try {
    await db.query(
      'INSERT INTO templates (id, title, source, order_index) VALUES ($1, $2, $3, $4)',
      [data.id, data.title, JSON.stringify(data.source), data.order_index ?? 0]
    );

    // Link each provided category slug to the new template
    if (data.categories) {
      for (const catSlug of data.categories) {
        const { rows } = await db.query<{ id: number }>(
          'SELECT id FROM categories WHERE slug = $1',
          [catSlug]
        );
        if (rows.length > 0) {
          await db.query(
            'INSERT INTO template_categories (template_id, category_id) VALUES ($1, $2)',
            [data.id, rows[0].id]
          );
        }
      }
    }

    invalidateTemplatesCache();
    res.status(201).json({ success: true, id: data.id });
  } catch (e) {
    console.error('POST /templates error:', e);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Partial update — only the fields provided are changed; updated_at is always refreshed
router.patch('/:id', async (req: Request<{ id: string }>, res: Response) => {
  const parsed = UpdateTemplateSchema.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue.path.length > 0 ? String(issue.path[0]) : 'input';
    return res.status(400).json({ error: `${field}: ${issue.message}` });
  }
  const updates = parsed.data;
  const templateId = req.params.id;

  try {
    // Build the SET clause dynamically based on which fields were provided
    let query = 'UPDATE templates SET ';
    const values: unknown[] = [];
    let paramCount = 1;

    if (updates.title !== undefined) {
      query += `title = $${paramCount}, `;
      values.push(updates.title);
      paramCount++;
    }
    if (updates.source !== undefined) {
      query += `source = $${paramCount}, `;
      values.push(JSON.stringify(updates.source));
      paramCount++;
    }
    if (updates.order_index !== undefined) {
      query += `order_index = $${paramCount}, `;
      values.push(updates.order_index);
      paramCount++;
    }

    query += `updated_at = now() WHERE id = $${paramCount}`;
    values.push(templateId);

    const result = await db.query(query, values);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    invalidateTemplatesCache();
    res.json({ updated: true });
  } catch (e) {
    console.error('PATCH /templates/:id error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  const templateId = req.params.id;
  try {
    const result = await db.query('DELETE FROM templates WHERE id = $1', [templateId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    // Invalidate so the deleted template doesn't keep appearing in cached list responses
    invalidateTemplatesCache();
    res.json({ ok: true, id: templateId });
  } catch (e) {
    console.error('DELETE /templates/:id error:', e);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

export default router;
