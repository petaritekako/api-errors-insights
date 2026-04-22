# api-errors-insights
API for displaying errors in real time

## Title: Real-Time Error Insights Dashboard

### Problem Context
You are tasked with building a web app of a Real-Time Error Insights Dashboard for internal
teams. The goal is to collect, store, and display frontend application error events (e.g.
TypeScript exceptions, network failures) with filtering and visualization support. This version
focuses only on error events, with real-time and analytics components.

### Requirements:
Build a functional and well-architected MVP that:
1. Simulates event ingestion (e.g. JSON-formatted error events)
2. Stores raw events in MongoDB
3. Indexes structured data into Elasticsearch for querying
4. Exposes REST API endpoints for filtering/search
5. Caches expensive search queries using Redis
6. Displays results in an Angular dashboard with filtering options

### Tech-stack:
*Backend*: Node.js (TypeScript), MongoDB, Elasticsearch, Redis, Kafka
*Frontend*: Angular (TypeScript)

#### Backend Scope
Build a TypeScript-based Node.js backend that:
1. Ingests a batch of error events from a static JSON file or simulated Kafka
(mocked/optional)
○ Example
{
"timestamp": "2025-07-15T10:10:00Z",
"userId": "user-123",
"browser": "Chrome",
"url": "/dashboard",
"errorMessage": "Uncaught TypeError: undefined is not a function",
"stackTrace": "at Object.<anonymous> (main.ts:22)"
}

2. Stores raw event data in MongoDB
3. Indexes structured versions in Elasticsearch with mappings for:
○ timestamp
○ userId
○ browser
○ url
○ errorMessage
○ stackTrace
4. Provides the following APIs:
○ GET /events/search: Accepts filters like date range, userId, URL, or keyword

○ GET /events/stats: Returns aggregation by browser, error type, etc.
5. Uses Redis to cache the latest search and stats queries with TTL
6. Includes basic unit tests (e.g. for indexing, query handling, Redis caching)

#### Frontend Scope
Use Angular to build a simple frontend dashboard:
1. List of error events sorted by timestamp that handles a large number of rows - Section
"Errors"
2. Filters: date range, userId, browser, error keyword - Section “Filters”
3. Display Elasticsearch-backed results and Redis-cached stats - Section “Results and Stats”
4. Widget(s) with summarized data (e.g. stats for top 3-5 error messages or browsers) -
Section “Widget(s)”
5. Don't spend too much time on polished UI design

## Requirements Summary

Area                Requirement

Event Storage       MongoDB (raw events), Elasticsearch (indexed searchable format)

Caching             Redis (cache search and stats queries with TTL)

API                 RESTful (filters + aggregations)

Frontend            Angular UI with filtering + simple visualization (chart.js, ngx-charts OK)

Docs                README

### Expected Deliverables
1. GitHub repo
2. README
