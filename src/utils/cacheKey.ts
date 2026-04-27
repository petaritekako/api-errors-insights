import type { EventSearchFilters, EventStatsFilters } from "../domain/errorEvent.js";

type CacheKeyPayload = EventSearchFilters | EventStatsFilters;
type CacheKeyField = keyof EventSearchFilters | keyof EventStatsFilters;
type CacheKeyShape = Partial<Record<CacheKeyField, string | number | undefined>>;

function stableSort(payload: CacheKeyPayload): CacheKeyShape {
  const normalizedPayload = payload as CacheKeyShape;

  return Object.keys(normalizedPayload)
    .sort()
    .reduce<CacheKeyShape>((accumulator, key) => {
      const typedKey = key as CacheKeyField;
      accumulator[typedKey] = normalizedPayload[typedKey];
      return accumulator;
    }, {});
}

export function buildCacheKey(prefix: string, payload: CacheKeyPayload): string {
  return `${prefix}:${JSON.stringify(stableSort(payload))}`;
}
