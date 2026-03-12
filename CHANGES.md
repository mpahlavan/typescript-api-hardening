# Refactoring Changes & Decisions

This document explains every significant change made, why it was made, and any trade-offs considered.

---

## 1. SQL Injection — Parameterized Queries

**Problem:** All queries were built with string concatenation, e.g.:
```js
`SELECT * FROM templates WHERE id = '${id}'`
```
A caller passing `' OR '1'='1` as an id would return all rows. A more destructive payload could drop tables.

**Fix:** Replaced every query with parameterized form using `$1`, `$2`, etc., which `pg` sends as separate protocol values — the driver never interpolates user input into SQL text.

---

## 2. Database Connection — Pool Instead of Client

**Problem:** The original code created a new `Client`, called `client.connect()` manually, and never released it. Under load this exhausts available connections and the server hangs.

**Fix:** Replaced with a single shared `Pool`. `pg` manages a pool of reusable connections automatically. Each `db.query()` borrows a connection and returns it immediately — no manual lifecycle management needed.

Added `pool.on('error', ...)` to log unexpected errors from idle clients, which would otherwise surface as unhandled rejections and crash the process.

---

## 3. N+1 Query Eliminated

**Problem:** The original `GET /templates` looped over every template and issued a separate `SELECT` per template to fetch its categories — O(n) queries for n templates.

**Fix:** Replaced with a single `LEFT JOIN` + `array_agg` query that fetches all templates and their categories in one round-trip:

```sql
SELECT t.*, coalesce(array_agg(c.slug) FILTER (WHERE c.slug IS NOT NULL), '{}') AS categories
FROM templates t
LEFT JOIN template_categories tc ON tc.template_id = t.id
LEFT JOIN categories c ON c.id = tc.category_id
GROUP BY t.id
```

The `FILTER (WHERE c.slug IS NOT NULL)` clause ensures templates with no categories return `[]` instead of `[null]`.

This query is extracted into a named constant `TEMPLATES_WITH_CATEGORIES_SQL` and reused by `GET /`, `GET /search`, and `GET /:id` to avoid duplication.

---

## 4. Caching — TTL + Invalidation

**Problem:** The original cache was a single variable that was overwritten by search results, so a search for "banner" would cause the next `GET /templates` to return only banners until the next restart.

**Fix:** Extracted a proper cache module (`src/cache.ts`) with four named functions:
- `isTemplateCacheValid()` — checks both presence and TTL (60 seconds)
- `getTemplatesCache()` / `setTemplatesCache()` — read and write
- `invalidateTemplatesCache()` — called after every write (POST, PATCH, DELETE)

Search results are intentionally **not** cached — only the full unfiltered list is, since search results are query-specific and would require cache keying by query string.

---

## 5. Error Handling — No Internal Leakage

**Problem:** `catch` blocks sent raw error objects or stack traces directly to the client, e.g.:
```js
res.status(500).json({ error: err.message })
```
This leaks internal details (table names, file paths, query strings) that help attackers.

**Fix:** Every `catch` block now:
1. Logs the full error server-side with `console.error`
2. Returns a generic `{ error: 'Internal server error' }` to the client

---

## 6. Route Ordering — `/search` Before `/:id`

**Problem:** Express matches routes in registration order. If `GET /:id` is registered before `GET /search`, a request to `/templates/search` is matched by `/:id` with `id = "search"`, returning 404 instead of search results.

**Fix:** Registered `GET /search` before `GET /:id`.

---

## 7. Testability — App Factory Pattern

**Problem:** The server started listening immediately when the file was imported, making it impossible to test routes without binding a real port.

**Fix:** Extracted Express app setup into `src/app.ts` (exported without listening) and kept the `http.createServer` + `server.listen` in `index.ts`. Tests import `app` directly and use `supertest` to make in-process HTTP calls — no port needed.

---

## 8. Graceful Shutdown

**Problem:** No shutdown handling — a `SIGTERM` (sent by Docker, Kubernetes, or a deploy script) would kill the process immediately, dropping in-flight requests and leaving the DB pool in an undefined state.

**Fix:** Added `SIGTERM` and `SIGINT` handlers that:
1. Stop accepting new connections (`server.close`)
2. Drain and close the DB pool (`db.end`)
3. Exit cleanly

---

## 9. Request Counter Middleware Ordering

**Problem:** The `requestCount` middleware was registered in `index.ts` *after* routes were already mounted inside `src/app.ts`. Express runs middleware in registration order, so the counter never fired for `/templates` or `/categories` — only for `/stats` and `/health`.

**Fix:** Moved the counter middleware into `src/app.ts` *before* route mounting, so it intercepts every request.

---

## 10. Database Schema Improvements (`002_improvements.sql`)

**Added as a migration on top of the original schema:**

- `DROP COLUMN template_categories.title` — this column existed on the join table but served no purpose; a join table should only contain foreign keys
- `CHECK (id <> '')` constraint on `templates.id` — prevents empty-string ids from being inserted, which would pass application validation but corrupt lookups
- Indexes on `template_categories(template_id)` and `template_categories(category_id)` — the JOIN query does full scans of this table without them; with thousands of templates this becomes slow
- Index on `templates(order_index ASC)` — supports the `ORDER BY t.order_index ASC` in every list query

---

## 11. Logging

Added `morgan('combined')` for HTTP access logging in non-test environments. This gives a standard log line per request (method, path, status, response time, user-agent) which is the minimum needed for production observability.

Disabled in test (`NODE_ENV === 'test'`) to keep test output clean.

---

## 12. Type Safety

All data shapes are defined in `src/types.ts`:
- `TemplateRow` — shape returned from DB queries
- `CreateTemplateBody` / `UpdateTemplateBody` — request body shapes for POST and PATCH
- `CategoryRow` / `CreateCategoryBody` — same for categories

Every route handler is typed against these interfaces so TypeScript catches mismatches at compile time rather than at runtime in production.

---

## 13. Tests

Added three test suites covering all routes and the cache module:

- `tests/cache.test.ts` — unit tests for cache validity, TTL expiry, and invalidation
- `tests/routes/templates.test.ts` — all six template endpoints including cache behavior
- `tests/routes/categories.test.ts` — both category endpoints

The DB is fully mocked via `jest.mock('../../src/db')` — tests run without a real database and complete in under 2 seconds. `invalidateTemplatesCache()` is called in `beforeEach` to ensure cache state doesn't leak between tests.

---

## What Was Intentionally Left Out

- **Redis / external cache**: The in-memory TTL cache is sufficient for a single-process server. Moving to Redis would only be needed for horizontal scaling (multiple instances). Adding it here would be over-engineering.
- **Authentication / authorization**: Not in scope for this API.
- **Per-query retry logic**: `pg` Pool handles transient connection errors at the pool level. Adding per-query retry in application code would duplicate that responsibility.
- **Request body size limits**: Express's default JSON body parser has a 100kb limit, which is appropriate here.

---

## 14. Runtime Validation — Zod

**Problem:** TypeScript types in `src/types.ts` only exist at compile time. A caller sending `{ "order_index": "banana" }` over HTTP would pass TypeScript checks but fail at the database with a cryptic error.

**Fix:** Added `src/schemas.ts` with Zod schemas for all write operations. Each route now calls `.safeParse()` on the request body and returns a structured 400 with the field name and reason before touching the database.

Error messages include the field path (`"order_index: Invalid input: expected number, received string"`) so API consumers know exactly what to fix.

---

## 15. Rate Limiting

**Problem:** `/search` and write endpoints had no request throttling — a single client could flood the server with queries.

**Fix:** Added `express-rate-limit` capped at 100 requests per IP per minute. This is applied globally (before route handlers) so it covers all endpoints including `/search`.

The limit is intentionally generous for normal use but will reject abusive patterns with a `429 Too Many Requests` response.

---

## Known Limitations

- **`requestCount` resets on restart** — the counter lives in memory, so every deploy or crash resets it to zero. For accurate long-term metrics, this should be written to a persistent store or replaced with a proper metrics library (e.g. `prom-client`). For this scope, the in-memory counter is sufficient.
