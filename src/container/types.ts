export const TYPES = {
  Env: Symbol.for("Env"),
  CacheTtlSeconds: Symbol.for("CacheTtlSeconds"),
  MongoDb: Symbol.for("MongoDb"),
  RawEventRepository: Symbol.for("RawEventRepository"),
  EventSearchRepository: Symbol.for("EventSearchRepository"),
  CacheRepository: Symbol.for("CacheRepository"),
  EventIngestionService: Symbol.for("EventIngestionService"),
  EventReadService: Symbol.for("EventReadService"),
  EventsController: Symbol.for("EventsController"),
} as const;
