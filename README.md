# API Errors Insights

Backend API for the Real-Time Error Insights Dashboard.

## Overview

This API ingests frontend error events, stores the raw payloads in MongoDB, indexes
searchable documents in Elasticsearch, caches expensive read queries in Redis, and exposes
REST endpoints for search and statistics.

Main responsibilities:

- ingest error events from a JSON file or HTTP request
- store raw events in MongoDB
- index searchable event documents in Elasticsearch
- cache search and stats responses in Redis
- expose search and aggregation endpoints for the Angular dashboard

## Stack

- Node.js
- TypeScript
- Express
- InversifyJS
- MongoDB native driver
- Elasticsearch official client
- Redis official client
- Zod
- Vitest

## Architecture

Request flow:

```text
HTTP request
  -> Express route/controller
  -> service layer
  -> repositories
     -> MongoDB for raw event storage
     -> Elasticsearch for search and aggregations
     -> Redis for cache
```

Storage split:

- MongoDB stores the raw ingested error event
- Elasticsearch stores the searchable/indexed version of the same event
- Redis stores cached results for `/events/search` and `/events/stats`

## Project Structure

```text
src/
  app.ts
  server.ts
  config/            environment parsing
  container/         Inversify bindings
  controllers/       HTTP controllers
  domain/            schemas and shared types
  http/              Express error handling
  infrastructure/    MongoDB / Elasticsearch / Redis repositories
  scripts/           local utility scripts
  services/          application logic
  utils/             small pure helpers
data/
  sample-error-events.json
test/
  service and endpoint regression tests
docker-compose.yml
```

## Prerequisites

- Node.js 20 recommended
- npm
- Docker + Docker Compose

## Environment Setup

Create `.env` in the project root.

Example:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=error_insights
ELASTICSEARCH_NODE=http://localhost:9200
ELASTICSEARCH_INDEX=error_events
REDIS_URL=redis://localhost:6379
CACHE_TTL_SECONDS=60
```

Required variables:

- `PORT`
- `MONGODB_URI`
- `MONGODB_DB`
- `ELASTICSEARCH_NODE`
- `ELASTICSEARCH_INDEX`
- `REDIS_URL`
- `CACHE_TTL_SECONDS`

## Running Infrastructure With Docker

Start MongoDB, Elasticsearch, and Redis:

```bash
docker compose up -d
```

Useful commands:

```bash
docker compose ps
docker compose logs -f
docker compose down
```

If ports like `27017` or `6379` are already used by services on your host machine, stop the
local service first or adjust the Docker port mapping.

## Install Dependencies

```bash
npm install
```

## Running The API

Development mode with file watching:

```bash
npm run dev
```

Production-style build:

```bash
npm run build
npm run start
```

Combined build and start:

Note:

- the code currently typechecks and tests fine on this machine as well, but some dependency
  packages warn on older Node 18 patch versions
```bash
npm run bs
```

Typecheck only:

```bash
npm run typecheck
```

Run tests:

```bash
npm test
```

## Ingesting Sample Data

Sample events are stored in [data/sample-error-events.json](./data/sample-error-events.json).

To ingest them:

```bash
npm run ingest:sample
```

What this does:

- reads the JSON file
- validates each event
- stores raw events in MongoDB
- ensures the Elasticsearch index exists
- bulk-indexes searchable documents into Elasticsearch

## API Endpoints

### Health Check

```http
GET /health
```

Example:

```bash
curl http://localhost:3000/health
```

Response:

```json
{ "status": "ok" }
```

### Ingest Events

```http
POST /events/ingest
```

Example:

```bash
curl -X POST http://localhost:3000/events/ingest \
  -H 'Content-Type: application/json' \
  -d '{
    "events": [
      {
        "timestamp": "2025-07-15T10:10:00Z",
        "userId": "user-123",
        "browser": "Chrome",
        "url": "/dashboard",
        "errorMessage": "Uncaught TypeError: undefined is not a function",
        "stackTrace": "at DashboardPageComponent.render (dashboard.ts:22)"
      }
    ]
  }'
```

Success response:

```json
{
  "received": 1,
  "stored": 1,
  "indexed": 1
}
```

### Search Events

```http
GET /events/search
```

Supported query params:

- `from`
- `to`
- `userId`
- `browser`
- `url`
- `keyword`
- `page`
- `pageSize`

Example:

```bash
curl "http://localhost:3000/events/search?from=2025-07-15T10:10:00Z&to=2025-07-15T10:29:55Z&browser=Chrome&url=%2Ftasks&keyword=selectTask&page=1&pageSize=10"
```

Response shape:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "pageSize": 10,
  "cached": false
}
```

Notes:

- results are sorted by `timestamp` descending
- `keyword` searches across `errorMessage`, `stackTrace`, `url`, `userId`, and `errorType`
- `cached` tells whether the response came from Redis

### Event Stats

```http
GET /events/stats
```

Supported query params:

- `from`
- `to`
- `userId`
- `browser`
- `url`
- `keyword`

Example:

```bash
curl "http://localhost:3000/events/stats?browser=Chrome"
```

Response shape:

```json
{
  "totalEvents": 0,
  "byBrowser": [],
  "topErrorMessages": [],
  "topErrorTypes": [],
  "cached": false
}
```

Current aggregation behavior:

- top 5 browsers
- top 5 exact error messages
- top 5 error types

## Elasticsearch Notes

- one Elasticsearch index is used for the error-event domain
- each ingested event becomes one Elasticsearch document
- `errorMessage` is indexed as `text` and also has a `keyword` subfield for exact aggregations
- `stackTrace` uses a custom analyzer so function names and stack-frame identifiers are searchable

## Testing

Current test coverage includes:

- service-level tests for ingestion, cache hit/miss behavior, and repository orchestration
- endpoint regression tests for ingest, search, and stats
- happy-path responses
- validation failures (`400`)
- unexpected server failures (`500`)

Run all tests:

```bash
npm test
```

## Notes For Review

- collection name is owned directly by the MongoDB repository because it is application structure,
  not environment-specific infrastructure
- a separate `tsconfig.build.json` is used so production builds emit only runtime app code into
  `dist/`, while `tsconfig.json` still typechecks both source and test files
- search and stats responses are cached in Redis using stable cache keys derived from validated filters
