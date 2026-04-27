import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export function errorHandler(error: unknown, _request: Request, response: Response, _next: NextFunction): void {
  if (error instanceof ZodError) {
    response.status(400).json({
      message: "Validation failed.",
      issues: error.issues,
    });
    return;
  }

  const message = error instanceof Error ? error.message : "Internal server error.";
  response.status(500).json({ message });
}
