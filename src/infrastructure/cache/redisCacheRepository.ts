import { injectable } from "inversify";
import type { CacheRepository } from "../../domain/repositories.js";
import type { AppRedisClient } from "./redisClient.js";

@injectable()
export class RedisCacheRepository implements CacheRepository {
  public constructor(private readonly client: AppRedisClient) {}

  public async get<T>(key: string): Promise<T | null> {
    const cachedValue = await this.client.get(key);
    if (!cachedValue) {
      return null;
    }

    return JSON.parse(cachedValue) as T;
  }

  public async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.client.set(key, JSON.stringify(value), {
      expiration: {
        type: "EX",
        value: ttlSeconds,
      },
    });
  }
}
