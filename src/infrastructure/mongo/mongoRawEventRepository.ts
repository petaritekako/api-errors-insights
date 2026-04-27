import type { Collection, Db } from "mongodb";
import { inject, injectable } from "inversify";
import { TYPES } from "../../container/types.js";
import type { ErrorEvent } from "../../domain/errorEvent.js";
import type { RawEventRepository } from "../../domain/repositories.js";

@injectable()
export class MongoRawEventRepository implements RawEventRepository {
  private static readonly COLLECTION_NAME = "raw_events";

  private readonly collection: Collection<ErrorEvent>;

  public constructor(@inject(TYPES.MongoDb) db: Db) {
    this.collection = db.collection<ErrorEvent>(MongoRawEventRepository.COLLECTION_NAME);
  }

  public async insertMany(events: ErrorEvent[]): Promise<number> {
    if (events.length === 0) {
      return 0;
    }

    const result = await this.collection.insertMany(events);
    return result.insertedCount;
  }
}
