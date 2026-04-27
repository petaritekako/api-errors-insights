import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  MONGODB_URI: z.string().min(1),
  MONGODB_DB: z.string().min(1),
  ELASTICSEARCH_NODE: z.url(),
  ELASTICSEARCH_INDEX: z.string().min(1).default("error_events"),
  REDIS_URL: z.string().min(1),
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(): AppEnv {
  return envSchema.parse(process.env);
}
