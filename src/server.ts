import "reflect-metadata";
import { Client as ElasticsearchClient } from "@elastic/elasticsearch";
import { MongoClient } from "mongodb";
import { createClient as createRedisClient } from "redis";
import { loadEnv } from "./config/env.js";
import { createApp } from "./app.js";
import { buildContainer } from "./container/buildContainer.js";
import type { EventSearchRepository } from "./domain/repositories.js";
import { TYPES } from "./container/types.js";

async function bootstrap() {
  const env = loadEnv();

  const mongoClient = new MongoClient(env.MONGODB_URI);
  const elasticsearchClient = new ElasticsearchClient({
    node: env.ELASTICSEARCH_NODE,
  });
  const redisClient = createRedisClient({
    url: env.REDIS_URL,
  });

  redisClient.on("error", (error) => {
    console.error("Redis connection error:", error);
  });

  await mongoClient.connect();
  await redisClient.connect();

  const mongoDb = mongoClient.db(env.MONGODB_DB);

  const container = buildContainer({
    env,
    mongoDb,
    elasticsearchClient,
    redisClient,
  });

  const eventSearchRepository = container.get<EventSearchRepository>(TYPES.EventSearchRepository);
  await eventSearchRepository.ensureIndex();

  const app = createApp(container);
  const server = app.listen(env.PORT, () => {
    console.log(`API listening on port ${env.PORT}`);
  });

  const shutdown = async () => {
    server.close();
    await Promise.allSettled([
      mongoClient.close(),
      redisClient.disconnect(),
    ]);
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

bootstrap().catch((error) => {
  console.error("Failed to bootstrap API:", error);
  process.exit(1);
});
