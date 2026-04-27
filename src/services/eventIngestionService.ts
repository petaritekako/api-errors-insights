import { inject, injectable } from "inversify";
import { z } from "zod";
import { errorEventSchema } from "../domain/errorEvent.js";
import type { EventSearchRepository, RawEventRepository } from "../domain/repositories.js";
import { TYPES } from "../container/types.js";

export type EventIngestionSummary = {
  received: number;
  stored: number;
  indexed: number;
};

@injectable()
export class EventIngestionService {
  public constructor(
    @inject(TYPES.RawEventRepository) private readonly rawEventRepository: RawEventRepository,
    @inject(TYPES.EventSearchRepository) private readonly eventSearchRepository: EventSearchRepository,
  ) {}

  public async ingestBatch(payload: unknown): Promise<EventIngestionSummary> {
    const events = z.array(errorEventSchema).min(1).parse(payload);
    const indexedEvents = events.map((event) => ({
      ...event,
      errorType: this.extractErrorType(event.errorMessage),
    }));

    const stored = await this.rawEventRepository.insertMany(events);
    const indexed = await this.eventSearchRepository.bulkIndex(indexedEvents);

    return {
      received: events.length,
      stored,
      indexed,
    };
  }

  private extractErrorType(errorMessage: string): string {
    const match = errorMessage.match(/([A-Za-z]+Error|[A-Za-z]+Exception|TypeError|ReferenceError|SyntaxError)/);
    return match?.[1] ?? "UnknownError";
  }
}
