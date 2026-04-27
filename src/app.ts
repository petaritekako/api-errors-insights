import express from "express";
import type { Container } from "inversify";
import { registerRoutes } from "./http/route.js";
import { errorHandler } from "./http/errorHandler.js";

export function createApp(container: Container) {
  const app = express();

  app.use(express.json());
  registerRoutes(app, container);

  app.use(errorHandler);

  return app;
}
