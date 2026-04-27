import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { EventsController } from "../src/controllers/eventsController.js";
import type {
  CacheRepository,
  EventSearchRepository,
  RawEventRepository,
} from "../src/domain/repositories.js";
import { errorHandler } from "../src/http/errorHandler.js";
import { EventIngestionService } from "../src/services/eventIngestionService.js";
import { EventReadService } from "../src/services/eventReadService.js";

type MockResponse = Response & {
  body?: unknown;
  statusCode: number;
};

function createController(options?: {
  rawEventRepository?: RawEventRepository;
  eventSearchRepository?: EventSearchRepository;
  cacheRepository?: CacheRepository;
  cacheTtlSeconds?: number;
}) {
  const rawEventRepository: RawEventRepository = options?.rawEventRepository ?? {
    insertMany: vi.fn().mockResolvedValue(1),
  };
  const eventSearchRepository: EventSearchRepository = options?.eventSearchRepository ?? {
    ensureIndex: vi.fn(),
    bulkIndex: vi.fn().mockResolvedValue(1),
    search: vi.fn().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 25,
    }),
    stats: vi.fn().mockResolvedValue({
      totalEvents: 0,
      byBrowser: [],
      topErrorMessages: [],
      topErrorTypes: [],
    }),
  };
  const cacheRepository: CacheRepository = options?.cacheRepository ?? {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  };
  const cacheTtlSeconds = options?.cacheTtlSeconds ?? 60;

  const ingestionService = new EventIngestionService(rawEventRepository, eventSearchRepository);
  const readService = new EventReadService(eventSearchRepository, cacheRepository, cacheTtlSeconds);

  return new EventsController(ingestionService, readService);
}

function createMockResponse(): MockResponse {
  const response: {
    body: unknown;
    statusCode: number;
    status(code: number): unknown;
    json(payload: unknown): unknown;
  } = {
    body: undefined,
    statusCode: 200,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };

  return response as MockResponse;
}

async function executeHandler(
  handler: (request: Request, response: Response, next: NextFunction) => Promise<void>,
  request: Partial<Request>,
) {
  const response = createMockResponse();
  let forwardedError: unknown;

  const next: NextFunction = (error?: unknown) => {
    forwardedError = error;
  };

  await handler(request as Request, response, next);

  if (forwardedError) {
    errorHandler(forwardedError, request as Request, response, vi.fn() as NextFunction);
  }

  return response;
}

describe("Events API behavior", () => {
  describe("search endpoint", () => {
    it("returns 200 with paginated search results", async () => {
      const eventSearchRepository: EventSearchRepository = {
        ensureIndex: vi.fn(),
        bulkIndex: vi.fn(),
        search: vi.fn().mockResolvedValue({
          items: [
            {
              timestamp: "2025-07-15T10:20:05Z",
              userId: "user-111",
              browser: "Chrome",
              url: "/tasks",
              errorMessage: "ReferenceError: taskId is not defined",
              stackTrace: "at TasksPageComponent.selectTask (tasks.ts:44)",
              errorType: "ReferenceError",
            },
          ],
          total: 1,
          page: 1,
          pageSize: 10,
        }),
        stats: vi.fn(),
      };
      const controller = createController({ eventSearchRepository });

      const response = await executeHandler(controller.search, {
        query: {
          browser: "Chrome",
          url: "/tasks",
          keyword: "taskId",
          page: "1",
          pageSize: "10",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({
        items: [
          {
            timestamp: "2025-07-15T10:20:05Z",
            userId: "user-111",
            browser: "Chrome",
            url: "/tasks",
            errorMessage: "ReferenceError: taskId is not defined",
            stackTrace: "at TasksPageComponent.selectTask (tasks.ts:44)",
            errorType: "ReferenceError",
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
        cached: false,
      });
    });

    it("returns 400 when search filters are invalid", async () => {
      const controller = createController();
      const response = await executeHandler(controller.search, {
        query: {
          from: "not-a-date",
          page: "0",
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.body).toMatchObject({
        message: "Validation failed.",
      });
    });

    it("returns 500 when search execution fails", async () => {
      const eventSearchRepository: EventSearchRepository = {
        ensureIndex: vi.fn(),
        bulkIndex: vi.fn(),
        search: vi.fn().mockRejectedValue(new Error("Search execution failed.")),
        stats: vi.fn(),
      };
      const controller = createController({ eventSearchRepository });

      const response = await executeHandler(controller.search, {
        query: {
          page: "1",
          pageSize: "10",
        },
      });

      expect(response.statusCode).toBe(500);
      expect(response.body).toEqual({
        message: "Search execution failed.",
      });
    });
  });

  describe("stats endpoint", () => {
    it("returns 200 with aggregation results", async () => {
      const eventSearchRepository: EventSearchRepository = {
        ensureIndex: vi.fn(),
        bulkIndex: vi.fn(),
        search: vi.fn(),
        stats: vi.fn().mockResolvedValue({
          totalEvents: 6,
          byBrowser: [
            { key: "Chrome", count: 4 },
            { key: "Firefox", count: 2 },
          ],
          topErrorMessages: [
            { key: "ReferenceError: taskId is not defined", count: 2 },
          ],
          topErrorTypes: [
            { key: "ReferenceError", count: 3 },
            { key: "TypeError", count: 2 },
          ],
        }),
      };
      const controller = createController({ eventSearchRepository });

      const response = await executeHandler(controller.stats, {
        query: {
          browser: "Chrome",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({
        totalEvents: 6,
        byBrowser: [
          { key: "Chrome", count: 4 },
          { key: "Firefox", count: 2 },
        ],
        topErrorMessages: [
          { key: "ReferenceError: taskId is not defined", count: 2 },
        ],
        topErrorTypes: [
          { key: "ReferenceError", count: 3 },
          { key: "TypeError", count: 2 },
        ],
        cached: false,
      });
    });

    it("returns 400 when stats filters are invalid", async () => {
      const controller = createController();
      const response = await executeHandler(controller.stats, {
        query: {
          from: "still-not-a-date",
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.body).toMatchObject({
        message: "Validation failed.",
      });
    });

    it("returns 500 when stats execution fails", async () => {
      const eventSearchRepository: EventSearchRepository = {
        ensureIndex: vi.fn(),
        bulkIndex: vi.fn(),
        search: vi.fn(),
        stats: vi.fn().mockRejectedValue(new Error("Stats execution failed.")),
      };
      const controller = createController({ eventSearchRepository });

      const response = await executeHandler(controller.stats, {
        query: {},
      });

      expect(response.statusCode).toBe(500);
      expect(response.body).toEqual({
        message: "Stats execution failed.",
      });
    });
  });

  describe("ingest endpoint", () => {
    it("returns 202 when events are ingested successfully", async () => {
      const controller = createController();
      const response = await executeHandler(controller.ingest, {
        body: {
          events: [
            {
              timestamp: "2025-07-15T10:10:00Z",
              userId: "user-123",
              browser: "Chrome",
              url: "/dashboard",
              errorMessage: "Uncaught TypeError: undefined is not a function",
              stackTrace: "at DashboardPageComponent.render (dashboard.ts:22)",
            },
          ],
        },
      });

      expect(response.statusCode).toBe(202);
      expect(response.body).toEqual({
        received: 1,
        stored: 1,
        indexed: 1,
      });
    });

    it("returns 400 when ingest payload is invalid", async () => {
      const controller = createController();
      const response = await executeHandler(controller.ingest, {
        body: {
          events: [
            {
              timestamp: "not-a-date",
              userId: "user-123",
              browser: "Chrome",
              url: "/dashboard",
              errorMessage: "Broken event",
              stackTrace: "at something",
            },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.body).toMatchObject({
        message: "Validation failed.",
      });
    });

    it("returns 500 when ingest storage fails", async () => {
      const rawEventRepository: RawEventRepository = {
        insertMany: vi.fn().mockRejectedValue(new Error("Failed to store raw events.")),
      };
      const controller = createController({ rawEventRepository });

      const response = await executeHandler(controller.ingest, {
        body: {
          events: [
            {
              timestamp: "2025-07-15T10:10:00Z",
              userId: "user-123",
              browser: "Chrome",
              url: "/dashboard",
              errorMessage: "Uncaught TypeError: undefined is not a function",
              stackTrace: "at DashboardPageComponent.render (dashboard.ts:22)",
            },
          ],
        },
      });

      expect(response.statusCode).toBe(500);
      expect(response.body).toEqual({
        message: "Failed to store raw events.",
      });
    });
  });
});
