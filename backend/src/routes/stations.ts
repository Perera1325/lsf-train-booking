import { Router } from "express";
import { listStations } from "../services/stations";

export const stationsRouter = Router();

stationsRouter.get("/", async (_req, res, next) => {
  try {
    const stations = await listStations();
    res.json(stations);
  } catch (err) {
    next(err);
  }
});
