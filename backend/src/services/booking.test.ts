import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../db";
import { calculateFare, getAvailability, createBooking } from "./booking";
import { AppError } from "../errors";

// These are integration tests: they run against the real Postgres instance
// (via DATABASE_URL, same as the app) rather than mocking Prisma. For a
// system whose entire point is a database-enforced concurrency guarantee,
// mocking the DB would test nothing meaningful — the unique constraint IS
// the behavior under test.
//
// A dedicated Trip is created for this run so these tests never collide
// with data from manual curl testing or the concurrency script.

let tripId: number;
let primarySeatId: number;

beforeAll(async () => {
  const trip = await prisma.trip.create({
    data: { date: new Date("2099-01-01"), routeName: "TEST-Colombo Fort - Badulla" },
  });
  tripId = trip.id;

  const seat = await prisma.seat.findFirst({ where: { coach: { type: "RESERVED" } } });
  if (!seat) throw new Error("No reserved seat found in DB — did the seed script run?");
  primarySeatId = seat.id;
});

afterAll(async () => {
  // BookedLeg rows cascade-delete when their SeatBooking is deleted.
  await prisma.seatBooking.deleteMany({ where: { tripId } });
  await prisma.trip.delete({ where: { id: tripId } });
  await prisma.$disconnect();
});

describe("calculateFare", () => {
  it("charges farePerLeg per leg travelled", () => {
    expect(calculateFare(0, 1)).toBe(150);
    expect(calculateFare(0, 4)).toBe(600);
  });

  it("charges nothing for a zero-length range (defensive check)", () => {
    expect(calculateFare(3, 3)).toBe(0);
  });
});

describe("createBooking", () => {
  it("books a valid segment", async () => {
    const booking = await createBooking({
      tripId,
      seatId: primarySeatId,
      originCode: "COL",
      destinationCode: "KDY",
      passengerName: "Test Passenger A",
    });
    expect(booking.seatId).toBe(primarySeatId);
    expect(Number(booking.fare)).toBeGreaterThan(0);
  });

  it("allows a second, non-overlapping booking on the SAME seat — this is the core requirement", async () => {
    const booking = await createBooking({
      tripId,
      seatId: primarySeatId,
      originCode: "KDY",
      destinationCode: "BDL",
      passengerName: "Test Passenger B",
    });
    expect(booking.seatId).toBe(primarySeatId);
  });

  it("rejects a booking that overlaps an existing one on the same seat", async () => {
    await expect(
      createBooking({
        tripId,
        seatId: primarySeatId,
        originCode: "COL",
        destinationCode: "GMP", // overlaps the COL->KDY booking above
        passengerName: "Should Fail",
      })
    ).rejects.toThrow(AppError);
  });

  it("rejects origin at or after destination", async () => {
    const otherSeat = await prisma.seat.findFirst({
      where: { coach: { type: "RESERVED" }, id: { not: primarySeatId } },
    });
    await expect(
      createBooking({
        tripId,
        seatId: otherSeat!.id,
        originCode: "KDY",
        destinationCode: "COL",
        passengerName: "Backwards Journey",
      })
    ).rejects.toThrow("Origin must come before destination");
  });

  it("rejects unknown station codes", async () => {
    const otherSeat = await prisma.seat.findFirst({
      where: { coach: { type: "RESERVED" }, id: { not: primarySeatId } },
    });
    await expect(
      createBooking({
        tripId,
        seatId: otherSeat!.id,
        originCode: "ZZZ",
        destinationCode: "BDL",
        passengerName: "Nope",
      })
    ).rejects.toThrow("Unknown station code");
  });

  it("rejects booking a seat that doesn't exist", async () => {
    await expect(
      createBooking({
        tripId,
        seatId: 999999,
        originCode: "COL",
        destinationCode: "KDY",
        passengerName: "Ghost Seat",
      })
    ).rejects.toThrow("Seat not found");
  });

  it("rejects a booking against a trip that doesn't exist", async () => {
    await expect(
      createBooking({
        tripId: 999999,
        seatId: primarySeatId,
        originCode: "COL",
        destinationCode: "KDY",
        passengerName: "Ghost Trip",
      })
    ).rejects.toThrow("not found");
  });
});

describe("getAvailability", () => {
  it("excludes a seat that's already booked for an overlapping range", async () => {
    const result = await getAvailability(tripId, "COL", "KDY");
    expect(result.find((s) => s.seatId === primarySeatId)).toBeUndefined();
  });

  it("still includes an untouched seat for the same range", async () => {
    const otherSeat = await prisma.seat.findFirst({
      where: { coach: { type: "RESERVED" }, id: { not: primarySeatId } },
    });
    const result = await getAvailability(tripId, "COL", "KDY");
    expect(result.find((s) => s.seatId === otherSeat!.id)).toBeDefined();
  });
});

describe("concurrency — the core guarantee", () => {
  it("under many simultaneous overlapping requests for the same seat, exactly one succeeds", async () => {
    const freshSeat = await prisma.seat.findFirst({
      where: { coach: { type: "RESERVED" }, id: { notIn: [primarySeatId] } },
      skip: 3,
    });
    if (!freshSeat) throw new Error("Not enough seeded seats to run this test");

    const attempts = await Promise.allSettled(
      Array.from({ length: 8 }).map((_, i) =>
        createBooking({
          tripId,
          seatId: freshSeat.id,
          originCode: "COL",
          destinationCode: "BDL",
          passengerName: `Concurrent Passenger ${i}`,
        })
      )
    );

    const succeeded = attempts.filter((a) => a.status === "fulfilled");
    const failed = attempts.filter((a) => a.status === "rejected");

    expect(succeeded.length).toBe(1);
    expect(failed.length).toBe(7);
  });
});
