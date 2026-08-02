import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { getAvailability, createBooking } from "../services/booking";
import { AppError } from "../errors";

export const tripsRouter = Router();

tripsRouter.get("/", async (_req, res, next) => {
  try {
    const trips = await prisma.trip.findMany({ orderBy: { date: "asc" } });
    res.json(trips);
  } catch (err) {
    next(err);
  }
});

const availabilityQuerySchema = z.object({
  origin: z.string().min(1),
  destination: z.string().min(1),
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

const createBookingSchema = z.object({
  seatId: z.number().int().positive(),
  originStationCode: z.string().min(1),
  destinationStationCode: z.string().min(1),
  passengerName: z.string().min(1).max(120),
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
