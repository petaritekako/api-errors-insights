import { createClient } from "redis";

export type AppRedisClient = ReturnType<typeof createClient>;
