import type { ErrorEvent, EventSearchFilters, EventSearchResult, EventStatsFilters, EventStatsResult, IndexedErrorEvent } from "./errorEvent.js";

export interface RawEventRepository {
  insertMany(events: ErrorEvent[]): Promise<number>;
}

export interface EventSearchRepository {
  ensureIndex(): Promise<void>;
  bulkIndex(events: IndexedErrorEvent[]): Promise<number>;
  search(filters: EventSearchFilters): Promise<Omit<EventSearchResult, "cached">>;
  stats(filters: EventStatsFilters): Promise<Omit<EventStatsResult, "cached">>;
}

export interface CacheRepository {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
}
