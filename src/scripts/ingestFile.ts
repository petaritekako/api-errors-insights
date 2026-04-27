import "reflect-metadata";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client as ElasticsearchClient } from "@elastic/elasticsearch";
import { MongoClient } from "mongodb";
import { createClient as createRedisClient } from "redis";
import { loadEnv } from "../config/env.js";
import { buildContainer } from "../container/buildContainer.js";
import { TYPES } from "../container/types.js";
import { EventIngestionService } from "../services/eventIngestionService.js";
import type { EventSearchRepository } from "../domain/repositories.js";

async function main() {
  const env = loadEnv();
  const inputPath = process.argv[2];

  if (!inputPath) {
    throw new Error("Missing input file path. Example: npm run ingest:sample");
  }

  const mongoClient = new MongoClient(env.MONGODB_URI);
  const elasticsearchClient = new ElasticsearchClient({
    node: env.ELASTICSEARCH_NODE,
  });
  const redisClient = createRedisClient({
    url: env.REDIS_URL,
  });

  await mongoClient.connect();
  await redisClient.connect();

  try {
    const fileContents = await readFile(resolve(inputPath), "utf8");
    const payload = JSON.parse(fileContents) as unknown;

    const mongoDb = mongoClient.db(env.MONGODB_DB);

    const container = buildContainer({
      env,
      mongoDb,
      elasticsearchClient,
      redisClient,
    });

    const eventSearchRepository = container.get<EventSearchRepository>(TYPES.EventSearchRepository);
    await eventSearchRepository.ensureIndex();

    const ingestionService = container.get<EventIngestionService>(TYPES.EventIngestionService);
    const summary = await ingestionService.ingestBatch(payload);

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await Promise.allSettled([
      mongoClient.close(),
      redisClient.disconnect(),
    ]);
  }
}

main().catch((error) => {
  console.error("Failed to ingest events:", error);
  process.exit(1);
});
