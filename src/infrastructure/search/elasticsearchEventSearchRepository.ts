import { Client } from "@elastic/elasticsearch";
import { injectable } from "inversify";
import type {
  EventSearchFilters,
  EventSearchResult,
  EventStatsFilters,
  EventStatsResult,
  IndexedErrorEvent,
  RankedBucket,
} from "../../domain/errorEvent.js";
import type { EventSearchRepository } from "../../domain/repositories.js";

type ElasticsearchEventHit = {
  timestamp: string;
  userId: string;
  browser: string;
  url: string;
  errorMessage: string;
  stackTrace: string;
  errorType: string;
};

@injectable()
export class ElasticsearchEventSearchRepository implements EventSearchRepository {
  public constructor(
    private readonly client: Client,
    private readonly indexName: string,
  ) {}

  public async ensureIndex(): Promise<void> {
    const existsResponse: unknown = await this.client.indices.exists({
      index: this.indexName,
    });
    const indexExists =
      typeof existsResponse === "boolean"
        ? existsResponse
        : typeof existsResponse === "object" &&
            existsResponse !== null &&
            "body" in existsResponse &&
            typeof (existsResponse as { body?: unknown }).body === "boolean"
          ? (existsResponse as { body: boolean }).body
          : false;

    if (indexExists) {
      return;
    }

    await this.client.indices.create({
      index: this.indexName,
      settings: {
        analysis: {
          filter: {
            stack_trace_word_delimiter: {
              type: "word_delimiter_graph",
              preserve_original: true,
            },
          },
          analyzer: {
            stack_trace_analyzer: {
              type: "custom",
              tokenizer: "whitespace",
              filter: ["lowercase", "stack_trace_word_delimiter"],
            },
          },
        },
      },
      mappings: {
        properties: {
          timestamp: { type: "date" },
          userId: { type: "keyword" },
          browser: { type: "keyword" },
          url: { type: "keyword" },
          errorMessage: {
            type: "text",
            fields: {
              keyword: { type: "keyword", ignore_above: 512 },
            },
          },
          stackTrace: {
            type: "text",
            analyzer: "stack_trace_analyzer",
          },
          errorType: { type: "keyword" },
        },
      },
    });
  }

  public async bulkIndex(events: IndexedErrorEvent[]): Promise<number> {
    if (events.length === 0) {
      return 0;
    }

    const operations = events.flatMap((event) => [{ index: { _index: this.indexName } }, event]);
    const response = await this.client.bulk({
      refresh: true,
      operations,
    });

    if (response.errors) {
      const failedItems = response.items.filter((item) => item.index?.error);
      throw new Error(`Elasticsearch bulk indexing failed for ${failedItems.length} events.`);
    }

    return events.length;
  }

  public async search(filters: EventSearchFilters): Promise<Omit<EventSearchResult, "cached">> {
    const response = await this.client.search<ElasticsearchEventHit>({
      index: this.indexName,
      from: (filters.page - 1) * filters.pageSize,
      size: filters.pageSize,
      sort: [{ timestamp: "desc" }],
      query: this.buildEventQuery(filters),
    });

    const items = response.hits.hits
      .map((hit) => hit._source)
      .filter((value): value is ElasticsearchEventHit => Boolean(value));

    const total = typeof response.hits.total === "number"
      ? response.hits.total
      : (response.hits.total?.value ?? 0);

    return {
      items,
      total,
      page: filters.page,
      pageSize: filters.pageSize,
    };
  }

  public async stats(filters: EventStatsFilters): Promise<Omit<EventStatsResult, "cached">> {
    const response = await this.client.search<ElasticsearchEventHit>({
      index: this.indexName,
      size: 0,
      query: this.buildEventQuery(filters),
      aggs: {
        by_browser: {
          terms: {
            field: "browser",
            size: 5,
          },
        },
        top_error_messages: {
          terms: {
            field: "errorMessage.keyword",
            size: 5,
          },
        },
        top_error_types: {
          terms: {
            field: "errorType",
            size: 5,
          },
        },
      },
    });

    const total = typeof response.hits.total === "number"
      ? response.hits.total
      : (response.hits.total?.value ?? 0);

    return {
      totalEvents: total,
      byBrowser: this.mapBuckets(response, "by_browser"),
      topErrorMessages: this.mapBuckets(response, "top_error_messages"),
      topErrorTypes: this.mapBuckets(response, "top_error_types"),
    };
  }

  /**
   * Builds the shared Elasticsearch query used by both search and stats endpoints.
   *
   * Logic:
   * - `from` / `to` become a `range` filter on `timestamp`
   * - exact-value filters (`userId`, `browser`, `url`) become `term` filters
   * - the free-text `keyword` search becomes a `multi_match` clause in `bool.must`
   * - if no filters are provided at all, the function returns `{ match_all: {} }`
   *
   * Example input:
   * `{ browser: "Chrome", userId: "user-123", keyword: "typeerror" }`
   *
   * Example output shape:
   * `{
   *   bool: {
   *     filter: [{ term: { browser: "Chrome" } }, { term: { userId: "user-123" } }],
   *     must: [{ multi_match: { query: "typeerror", fields: ["errorMessage^3", "stackTrace", "url", "userId", "errorType^2"] } }]
   *   }
   * }`
   */
  private buildEventQuery(filters: EventSearchFilters | EventStatsFilters) {
    const filterClauses: object[] = [];
    const mustClauses: object[] = [];

    if (filters.from || filters.to) {
      const range: Record<string, string> = {};

      if (filters.from) {
        range.gte = filters.from;
      }

      if (filters.to) {
        range.lte = filters.to;
      }

      filterClauses.push({
        range: {
          timestamp: range,
        },
      });
    }

    if (filters.userId) {
      filterClauses.push({
        term: {
          userId: filters.userId,
        },
      });
    }

    if (filters.browser) {
      filterClauses.push({
        term: {
          browser: filters.browser,
        },
      });
    }

    if (filters.url) {
      filterClauses.push({
        term: {
          url: filters.url,
        },
      });
    }

    if (filters.keyword) {
      mustClauses.push({
        multi_match: {
          query: filters.keyword,
          fields: ["errorMessage^3", "stackTrace", "url", "userId", "errorType^2"],
        },
      });
    }

    if (filterClauses.length === 0 && mustClauses.length === 0) {
      return { match_all: {} };
    }

    return {
      bool: {
        filter: filterClauses,
        must: mustClauses,
      },
    };
  }

  private mapBuckets(
    response: { aggregations?: Record<string, unknown> },
    aggregationName: string,
  ): RankedBucket<string>[] {
    const aggregation = response.aggregations?.[aggregationName];
    const buckets =
      aggregation && typeof aggregation === "object" && "buckets" in aggregation
        ? (aggregation as { buckets: unknown }).buckets
        : [];

    if (!Array.isArray(buckets)) {
      return [];
    }

    return buckets.map((bucket) => ({
      key: typeof bucket === "object" && bucket && "key" in bucket ? String(bucket.key) : "",
      count:
        typeof bucket === "object" && bucket && "doc_count" in bucket && typeof bucket.doc_count === "number"
          ? bucket.doc_count
          : 0,
    }));
  }
}
