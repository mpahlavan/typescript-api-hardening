# Template API: hardening a TypeScript backend for production

A refactor of a deliberately broken Express + PostgreSQL API (design templates and their categories) into a backend that is safe, typed, tested and observable. The starting code had SQL injection, a leaking database client, an N+1 query, a cache that returned the wrong data, raw stack traces in responses and no tests.

Every change, and the reason for it, is written up in **[CHANGES.md](CHANGES.md)**.

## What changed

| Problem in the original | Fix |
|---|---|
| SQL built by string concatenation (injectable) | Parameterized queries everywhere |
| New DB client per request, never released | One shared `pg` Pool, idle-client error handler |
| N+1 query on `GET /templates` | Single `LEFT JOIN` + `array_agg` query |
| Cache overwritten by search results | Cache module with 60 s TTL and invalidation on every write |
| Raw errors and stack traces sent to clients | Logged server-side, generic 500 to the client |
| `/templates/search` shadowed by `/:id` | Route order fixed |
| No input validation | Zod schemas, structured 400s naming the bad field |
| No throttling | Rate limit: 100 requests per IP per minute |
| Process killed mid-request on deploy | Graceful shutdown on SIGTERM/SIGINT (stop accepting, drain pool) |
| Join table with a stray column, no indexes | Migration `002_improvements.sql`: drop column, add CHECK and indexes |
| No tests, app not importable | App factory + 27 Jest/Supertest tests, DB mocked |

## Quick start

Needs Node.js 20+ and Docker.

```bash
git clone https://github.com/mpahlavan/typescript-api-hardening.git
cd typescript-api-hardening
npm run setup        # copies .env.example to .env and installs dependencies
npm run start-dev    # starts PostgreSQL in Docker, waits for it, starts the API on :5003
```

Then, in another terminal:

```bash
curl localhost:5003/health
./test_api.sh        # hits every endpoint, including the expected 400 and 404 cases
```

Stop and remove the database with `npm run db:down`.

## Tests

```bash
npm test             # 27 tests, no database or server needed
npm run typecheck
```

## API

| Method | Path | Description |
|---|---|---|
| GET | `/templates` | List templates with their categories (cached) |
| GET | `/templates/search?q=...` | Search templates |
| GET | `/templates/:id` | One template |
| POST | `/templates` | Create a template |
| PATCH | `/templates/:id` | Update a template |
| DELETE | `/templates/:id` | Delete a template |
| GET | `/categories` | List categories |
| POST | `/categories` | Create a category |
| GET | `/stats` | Request count since start |
| GET | `/health` | Health check |

## Layout

```
index.ts            server start and graceful shutdown
src/app.ts          Express app factory (middleware, routes)
src/db.ts           pg Pool
src/cache.ts        TTL cache with invalidation
src/schemas.ts      Zod request validation
src/types.ts        row and request types
src/routes/         templates and categories routes
db/init/            original schema and the improvement migration
tests/              Jest + Supertest suites
```

## Deliberately left out

Redis (one process doesn't need a shared cache), authentication (out of scope), per-query retries (the pool already handles transient connection errors). The request counter is in memory and resets on restart; a metrics library such as `prom-client` would replace it in production. Details in [CHANGES.md](CHANGES.md).
