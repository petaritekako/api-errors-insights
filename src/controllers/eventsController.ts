import type { NextFunction, Request, Response } from "express";
import { injectable, inject } from "inversify";
import { TYPES } from "../container/types.js";
import { EventIngestionService } from "../services/eventIngestionService.js";
import { EventReadService } from "../services/eventReadService.js";

@injectable()
export class EventsController {
  public constructor(
    @inject(TYPES.EventIngestionService) private readonly ingestionService: EventIngestionService,
    @inject(TYPES.EventReadService) private readonly readService: EventReadService,
  ) {}

  public ingest = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const payload = Array.isArray(request.body) ? request.body : request.body?.events;
      const summary = await this.ingestionService.ingestBatch(payload);
      response.status(202).json(summary);
    } catch (error) {
      next(error);
    }
  };

  public search = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.readService.search(request.query);
      response.json(result);
    } catch (error) {
      next(error);
    }
  };

  public stats = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.readService.stats(request.query);
      response.json(result);
    } catch (error) {
      next(error);
    }
  };
}
