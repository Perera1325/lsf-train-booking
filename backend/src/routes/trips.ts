import { Router } from "express";
import { z } from "zod";
import { getAvailability, createBooking } from "../services/booking";
import { listTrips, listBookingsForTrip } from "../services/trips";
import { getTripStats } from "../services/stats";
import { AppError } from "../errors";

export const tripsRouter = Router();

tripsRouter.get("/", async (_req, res, next) => {
  try {
    const trips = await listTrips();
    res.json(trips);
  } catch (err) {
    next(err);
  }
});

const stationCodeSchema = z
  .string()
  .trim()
  .min(1)
  .transform((s) => s.toUpperCase());

const availabilityQuerySchema = z.object({
  origin: stationCodeSchema,
  destination: stationCodeSchema,
});

tripsRouter.get("/:tripId/availability", async (req, res, next) => {
  try {
    const tripId = Number(req.params.tripId);
    if (Number.isNaN(tripId)) throw new AppError(400, "Invalid tripId");

    const { origin, destination } = availabilityQuerySchema.parse(req.query);
    const availableSeats = await getAvailability(tripId, origin, destination);
    res.json({ tripId, origin, destination, availableSeats });
  } catch (err) {
    next(err);
  }
});

tripsRouter.get("/:tripId/bookings", async (req, res, next) => {
  try {
    const tripId = Number(req.params.tripId);
    if (Number.isNaN(tripId)) throw new AppError(400, "Invalid tripId");

    const bookings = await listBookingsForTrip(tripId);
    res.json(bookings);
  } catch (err) {
    next(err);
  }
});

tripsRouter.get("/:tripId/stats", async (req, res, next) => {
  try {
    const tripId = Number(req.params.tripId);
    if (Number.isNaN(tripId)) throw new AppError(400, "Invalid tripId");

    const stats = await getTripStats(tripId);
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

const createBookingSchema = z.object({
  seatId: z.number().int().positive(),
  originStationCode: stationCodeSchema,
  destinationStationCode: stationCodeSchema,
  passengerName: z.string().trim().min(1).max(120),
});

tripsRouter.post("/:tripId/bookings", async (req, res, next) => {
  try {
    const tripId = Number(req.params.tripId);
    if (Number.isNaN(tripId)) throw new AppError(400, "Invalid tripId");

    const body = createBookingSchema.parse(req.body);
    const booking = await createBooking({
      tripId,
      seatId: body.seatId,
      originCode: body.originStationCode,
      destinationCode: body.destinationStationCode,
      passengerName: body.passengerName,
    });
    res.status(201).json(booking);
  } catch (err) {
    next(err);
  }
});
