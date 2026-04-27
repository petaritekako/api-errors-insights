import { z } from "zod";

export const errorEventSchema = z.object({
  timestamp: z.iso.datetime(),
  userId: z.string().min(1),
  browser: z.string().min(1),
  url: z.string().min(1),
  errorMessage: z.string().min(1),
  stackTrace: z.string().min(1),
});

export type ErrorEvent = z.infer<typeof errorEventSchema>;

export type IndexedErrorEvent = ErrorEvent & {
  errorType: string;
};

const optionalString = z
  .string()
  .optional()
  .transform((value: string | undefined, _ctx): string | undefined =>
    (typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined)
  );

const optionalDatetime = optionalString.refine(
  (value) => value === undefined || !Number.isNaN(Date.parse(value)),
  "Expected an ISO datetime string.",
);

const optionalNumber = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === "") {
      return undefined;
    }

    const numericValue = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numericValue) ? numericValue : undefined;
  });

export const eventSearchFiltersSchema = z.object({
  from: optionalDatetime,
  to: optionalDatetime,
  userId: optionalString,
  browser: optionalString,
  url: optionalString,
  keyword: optionalString,
  page: optionalNumber.pipe(z.number().int().positive().default(1)),
  pageSize: optionalNumber.pipe(z.number().int().min(1).max(100).default(25)),
});

export const eventStatsFiltersSchema = z.object({
  from: optionalDatetime,
  to: optionalDatetime,
  userId: optionalString,
  browser: optionalString,
  url: optionalString,
  keyword: optionalString,
});

export type EventSearchFilters = z.infer<typeof eventSearchFiltersSchema>;
export type EventStatsFilters = z.infer<typeof eventStatsFiltersSchema>;

export type EventSearchResult = {
  items: IndexedErrorEvent[];
  total: number;
  page: number;
  pageSize: number;
  cached: boolean;
};

export type RankedBucket<T extends string> = {
  key: T;
  count: number;
};

export type EventStatsResult = {
  totalEvents: number;
  byBrowser: RankedBucket<string>[];
  topErrorMessages: RankedBucket<string>[];
  topErrorTypes: RankedBucket<string>[];
  cached: boolean;
};
