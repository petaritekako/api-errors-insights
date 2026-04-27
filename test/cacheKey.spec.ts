import { describe, expect, it } from "vitest";
import { buildCacheKey } from "../src/utils/cacheKey.js";

describe("buildCacheKey", () => {
  it("creates stable keys for equivalent objects", () => {
    const left = buildCacheKey("events:search", {
      from: undefined,
      to: undefined,
      userId: "user-123",
      browser: "Chrome",
      url: undefined,
      keyword: undefined,
      page: 1,
      pageSize: 25,
    });
    const right = buildCacheKey("events:search", {
      from: undefined,
      to: undefined,
      pageSize: 25,
      page: 1,
      browser: "Chrome",
      userId: "user-123",
      url: undefined,
      keyword: undefined,
    });

    expect(left).toBe(right);
  });
});
