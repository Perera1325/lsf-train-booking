import express from "express";
import cors from "cors";
import { config } from "./config";
import { prisma } from "./db";

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

// Stage 2 will add:
//   GET  /stations
//   GET  /trips/:tripId/availability?origin=&destination=
//   POST /trips/:tripId/bookings
app.listen(config.port, () => {
  console.log(`LSF booking API listening on port ${config.port}`);
});
