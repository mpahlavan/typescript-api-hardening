import request from 'supertest';
import app from '../../src/app';
import db from '../../src/db';
import { invalidateTemplatesCache } from '../../src/cache';

jest.mock('../../src/db', () => ({
  query: jest.fn(),
  on: jest.fn(),
}));

const mockQuery = db.query as jest.Mock;

const mockTemplate = {
  id: 'tpl_001',
  title: 'Test Template',
  source: { type: 'canvas' },
  order_index: 1,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  categories: ['minimal'],
};

beforeEach(() => {
  jest.clearAllMocks();
  invalidateTemplatesCache();
});

describe('GET /templates', () => {
  it('returns 200 with template list', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockTemplate] });
    const res = await request(app).get('/templates');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([mockTemplate]);
  });

  it('returns cached result on second call', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockTemplate] });
    await request(app).get('/templates');
    await request(app).get('/templates');
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/templates');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });
});

describe('GET /templates/search', () => {
  it('returns 200 with matching templates', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockTemplate] });
    const res = await request(app).get('/templates/search?q=test');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([mockTemplate]);
  });

  it('returns cache when no search term and cache is valid', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockTemplate] });
    await request(app).get('/templates');
    const res = await request(app).get('/templates/search');
    expect(res.status).toBe(200);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });
});

describe('GET /templates/:id', () => {
  it('returns 200 with template when found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockTemplate] });
    const res = await request(app).get('/templates/tpl_001');
    expect(res.status).toBe(200);
    expect(res.body.template).toMatchObject({ id: 'tpl_001' });
  });

  it('returns 404 when template not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/templates/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Template not found' });
  });
});

describe('POST /templates', () => {
  it('returns 400 when id is missing', async () => {
    const res = await request(app).post('/templates').send({ title: 'T', source: {} });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/id/);
  });

  it('returns 400 when title is missing', async () => {
    const res = await request(app).post('/templates').send({ id: 'x', source: {} });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title/);
  });

  it('returns 400 when source is missing', async () => {
    const res = await request(app).post('/templates').send({ id: 'x', title: 'T' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/source/);
  });

  it('returns 400 when order_index is not a number', async () => {
    const res = await request(app)
      .post('/templates')
      .send({ id: 'x', title: 'T', source: {}, order_index: 'bad' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/order_index/);
  });

  it('returns 201 with valid payload', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const res = await request(app)
      .post('/templates')
      .send({ id: 'tpl_new', title: 'New', source: { type: 'canvas' } });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, id: 'tpl_new' });
  });
});

describe('PATCH /templates/:id', () => {
  it('returns 400 when no fields provided', async () => {
    const res = await request(app).patch('/templates/tpl_001').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at least one field/);
  });

  it('returns 400 when title is not a string', async () => {
    const res = await request(app).patch('/templates/tpl_001').send({ title: 123 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title/);
  });

  it('returns 404 when template not found', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0 });
    const res = await request(app).patch('/templates/nonexistent').send({ title: 'New Title' });
    expect(res.status).toBe(404);
  });

  it('returns 200 when update succeeds', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    const res = await request(app).patch('/templates/tpl_001').send({ title: 'Updated' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ updated: true });
  });
});

describe('DELETE /templates/:id', () => {
  it('returns 404 when template not found', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0 });
    const res = await request(app).delete('/templates/nonexistent');
    expect(res.status).toBe(404);
  });

  it('returns 200 and invalidates cache on success', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [mockTemplate] });
    await request(app).get('/templates');

    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    const res = await request(app).delete('/templates/tpl_001');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, id: 'tpl_001' });

    // Cache should now be invalidated — next GET hits DB again
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await request(app).get('/templates');
    expect(mockQuery).toHaveBeenCalledTimes(3);
  });
});
