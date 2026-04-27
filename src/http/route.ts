import type { Express } from "express";
import type { Container } from "inversify";
import { TYPES } from "../container/types.js";
import { EventsController } from "../controllers/eventsController.js";

export function registerRoutes(app: Express, container: Container): void {
  const eventsController = container.get<EventsController>(TYPES.EventsController);

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.post("/events/ingest", eventsController.ingest);
  app.get("/events/search", eventsController.search);
  app.get("/events/stats", eventsController.stats);
}
