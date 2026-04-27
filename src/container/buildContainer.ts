import { Container } from "inversify";
import type { Db } from "mongodb";
import type { Client as ElasticsearchClient } from "@elastic/elasticsearch";
import type { AppEnv } from "../config/env.js";
import { TYPES } from "./types.js";
import { RedisCacheRepository } from "../infrastructure/cache/redisCacheRepository.js";
import { MongoRawEventRepository } from "../infrastructure/mongo/mongoRawEventRepository.js";
import { ElasticsearchEventSearchRepository } from "../infrastructure/search/elasticsearchEventSearchRepository.js";
import { EventIngestionService } from "../services/eventIngestionService.js";
import { EventReadService } from "../services/eventReadService.js";
import { EventsController } from "../controllers/eventsController.js";
import type { AppRedisClient } from "../infrastructure/cache/redisClient.js";

type BuildContainerDependencies = {
  env: AppEnv;
  mongoDb: Db;
  elasticsearchClient: ElasticsearchClient;
  redisClient: AppRedisClient;
};

export function buildContainer(dependencies: BuildContainerDependencies): Container {
  const container = new Container();

  container.bind(TYPES.Env).toConstantValue(dependencies.env);
  container.bind(TYPES.CacheTtlSeconds).toConstantValue(dependencies.env.CACHE_TTL_SECONDS);
  container.bind(TYPES.MongoDb).toConstantValue(dependencies.mongoDb);
  container.bind(TYPES.RawEventRepository).to(MongoRawEventRepository).inSingletonScope();
  container
    .bind(TYPES.EventSearchRepository)
    .toConstantValue(
      new ElasticsearchEventSearchRepository(
        dependencies.elasticsearchClient,
        dependencies.env.ELASTICSEARCH_INDEX,
      ),
    );
  container.bind(TYPES.CacheRepository).toConstantValue(new RedisCacheRepository(dependencies.redisClient));
  container.bind(TYPES.EventIngestionService).to(EventIngestionService).inSingletonScope();
  container.bind(TYPES.EventReadService).to(EventReadService).inSingletonScope();
  container.bind(TYPES.EventsController).to(EventsController).inSingletonScope();

  return container;
}
