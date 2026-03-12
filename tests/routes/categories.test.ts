import request from 'supertest';
import app from '../../src/app';
import db from '../../src/db';

jest.mock('../../src/db', () => ({
  query: jest.fn(),
  on: jest.fn(),
}));

const mockQuery = db.query as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /categories', () => {
  it('returns 200 with category list', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, slug: 'minimal' }] });
    const res = await request(app).get('/categories');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 1, slug: 'minimal' }]);
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/categories');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });
});

describe('POST /categories', () => {
  it('returns 400 when slug is missing', async () => {
    const res = await request(app).post('/categories').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/slug/);
  });

  it('returns 400 when slug is not a string', async () => {
    const res = await request(app).post('/categories').send({ slug: 123 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/slug/);
  });

  it('returns 201 with created category', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 7 }] });
    const res = await request(app).post('/categories').send({ slug: 'new-category' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: 7, slug: 'new-category' });
  });
});
