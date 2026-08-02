import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { ZodError } from "zod";
import { config } from "./config";
import { prisma } from "./db";
import { AppError } from "./errors";
import { stationsRouter } from "./routes/stations";
import { tripsRouter } from "./routes/trips";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "connected" });
  } catch (err) {
    res.status(503).json({ status: "error", db: "unreachable" });
  }
});

app.use("/stations", stationsRouter);
app.use("/trips", tripsRouter);

// Central error handler — AppError carries an intentional HTTP status
// (404 unknown station, 400 bad range, 409 booking conflict, etc.);
// anything else is logged and returned as a generic 500 so internals never
// leak to the client.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "Validation failed", details: err.errors });
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(config.port, () => {
  console.log(`LSF booking API listening on port ${config.port}`);
});
