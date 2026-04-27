import { describe, expect, it, vi } from "vitest";
import { EventIngestionService } from "../src/services/eventIngestionService.js";
import { EventReadService } from "../src/services/eventReadService.js";
import type {
  CacheRepository,
  EventSearchRepository,
  RawEventRepository,
} from "../src/domain/repositories.js";

describe("EventIngestionService", () => {
  it("stores raw events and indexes structured events", async () => {
    const rawEventRepository: RawEventRepository = {
      insertMany: vi.fn().mockResolvedValue(2),
    };
    const eventSearchRepository: EventSearchRepository = {
      ensureIndex: vi.fn(),
      bulkIndex: vi.fn().mockResolvedValue(2),
      search: vi.fn(),
      stats: vi.fn(),
    };

    const service = new EventIngestionService(rawEventRepository, eventSearchRepository);
    const result = await service.ingestBatch([
      {
        timestamp: "2025-07-15T10:10:00Z",
        userId: "user-123",
        browser: "Chrome",
        url: "/dashboard",
        errorMessage: "Uncaught TypeError: undefined is not a function",
        stackTrace: "at Object.<anonymous> (main.ts:22)",
      },
      {
        timestamp: "2025-07-15T10:11:30Z",
        userId: "user-456",
        browser: "Firefox",
        url: "/settings",
        errorMessage: "ReferenceError: config is not defined",
        stackTrace: "at SettingsPageComponent.save (settings.ts:48)",
      },
    ]);

    expect(result).toEqual({
      received: 2,
      stored: 2,
      indexed: 2,
    });
    expect(rawEventRepository.insertMany).toHaveBeenCalledOnce();
    expect(eventSearchRepository.bulkIndex).toHaveBeenCalledOnce();
  });
});

describe("EventReadService", () => {
  it("returns cached search results when available", async () => {
    const eventSearchRepository: EventSearchRepository = {
      ensureIndex: vi.fn(),
      bulkIndex: vi.fn(),
      search: vi.fn(),
      stats: vi.fn(),
    };
    const cacheRepository: CacheRepository = {
      get: vi.fn().mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 25,
      }),
      set: vi.fn(),
    };

    const service = new EventReadService(eventSearchRepository, cacheRepository, 60);
    const result = await service.search({
      page: 1,
      pageSize: 25,
    });

    expect(result.cached).toBe(true);
    expect(eventSearchRepository.search).not.toHaveBeenCalled();
  });

  it("queries Elasticsearch and populates the cache when stats are uncached", async () => {
    const eventSearchRepository: EventSearchRepository = {
      ensureIndex: vi.fn(),
      bulkIndex: vi.fn(),
      search: vi.fn(),
      stats: vi.fn().mockResolvedValue({
        totalEvents: 3,
        byBrowser: [{ key: "Chrome", count: 2 }],
        topErrorMessages: [{ key: "ReferenceError: config is not defined", count: 1 }],
        topErrorTypes: [{ key: "ReferenceError", count: 1 }],
      }),
    };
    const cacheRepository: CacheRepository = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    };

    const service = new EventReadService(eventSearchRepository, cacheRepository, 60);
    const result = await service.stats({});

    expect(result.cached).toBe(false);
    expect(eventSearchRepository.stats).toHaveBeenCalledOnce();
    expect(cacheRepository.set).toHaveBeenCalledOnce();
  });
});
