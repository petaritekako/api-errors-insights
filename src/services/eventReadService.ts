import { inject, injectable } from "inversify";
import {
  eventSearchFiltersSchema,
  eventStatsFiltersSchema,
  type EventSearchFilters,
  type EventSearchResult,
  type EventStatsFilters,
  type EventStatsResult,
} from "../domain/errorEvent.js";
import type { CacheRepository, EventSearchRepository } from "../domain/repositories.js";
import { TYPES } from "../container/types.js";
import { buildCacheKey } from "../utils/cacheKey.js";

@injectable()
export class EventReadService {
  public constructor(
    @inject(TYPES.EventSearchRepository) private readonly eventSearchRepository: EventSearchRepository,
    @inject(TYPES.CacheRepository) private readonly cacheRepository: CacheRepository,
    @inject(TYPES.CacheTtlSeconds) private readonly cacheTtlSeconds: number,
  ) {}

  public async search(filters: unknown): Promise<EventSearchResult> {
    const validatedFilters = eventSearchFiltersSchema.parse(filters);
    const cacheKey = buildCacheKey("events:search", validatedFilters);
    const cachedResponse = await this.cacheRepository.get<Omit<EventSearchResult, "cached">>(cacheKey);

    if (cachedResponse) {
      return {
        ...cachedResponse,
        cached: true,
      };
    }

    const freshResponse = await this.eventSearchRepository.search(validatedFilters);
    await this.cacheRepository.set(cacheKey, freshResponse, this.cacheTtlSeconds);

    return {
      ...freshResponse,
      cached: false,
    };
  }

  public async stats(filters: unknown): Promise<EventStatsResult> {
    const validatedFilters = eventStatsFiltersSchema.parse(filters);
    const cacheKey = buildCacheKey("events:stats", validatedFilters);
    const cachedResponse = await this.cacheRepository.get<Omit<EventStatsResult, "cached">>(cacheKey);

    if (cachedResponse) {
      return {
        ...cachedResponse,
        cached: true,
      };
    }

    const freshResponse = await this.eventSearchRepository.stats(validatedFilters);
    await this.cacheRepository.set(cacheKey, freshResponse, this.cacheTtlSeconds);

    return {
      ...freshResponse,
      cached: false,
    };
  }
}
