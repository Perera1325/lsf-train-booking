import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { AppError } from "../errors";
import { getStationByCode } from "./stations";
import { getTripOrThrow } from "./trips";
import { getRouteConfig } from "../config-loader";

export interface AvailableSeat {
  seatId: number;
  seatNumber: number;
  coachCode: string;
}

// A journey from sequence 2 to sequence 5 occupies legs [2, 3, 4] — the
// stretches of track *between* consecutive stations, not the stations
// themselves. Destination sequence is exclusive.
function legRange(originSeq: number, destSeq: number): number[] {
  const legs: number[] = [];
  for (let i = originSeq; i < destSeq; i++) legs.push(i);
  return legs;
}

async function resolveAndValidateRoute(originCode: string, destinationCode: string) {
  const origin = await getStationByCode(originCode);
  const destination = await getStationByCode(destinationCode);

  if (origin.sequence >= destination.sequence) {
    throw new AppError(400, "Origin must come before destination along the route");
  }

  return { origin, destination };
}

export function calculateFare(originSeq: number, destSeq: number): number {
  const { farePerLeg } = getRouteConfig();
  return (destSeq - originSeq) * farePerLeg;
}

export async function getAvailability(
  tripId: number,
  originCode: string,
  destinationCode: string
): Promise<AvailableSeat[]> {
  await getTripOrThrow(tripId);
  const { origin, destination } = await resolveAndValidateRoute(originCode, destinationCode);
  const legs = legRange(origin.sequence, destination.sequence);

  // Fetch every reserved-coach seat along with any bookings it already has
  // that overlap the requested leg range. A seat with zero overlapping
  // BookedLeg rows is free for this exact range.
  const seats = await prisma.seat.findMany({
    where: { coach: { type: "RESERVED" } },
    include: {
      coach: true,
      bookedLegs: {
        where: { tripId, legIndex: { in: legs } },
      },
    },
    orderBy: [{ coach: { code: "asc" } }, { seatNumber: "asc" }],
  });

  return seats
    .filter((seat) => seat.bookedLegs.length === 0)
    .map((seat) => ({
      seatId: seat.id,
      seatNumber: seat.seatNumber,
      coachCode: seat.coach.code,
    }));
}

export async function createBooking(params: {
  tripId: number;
  seatId: number;
  originCode: string;
  destinationCode: string;
  passengerName: string;
}) {
  const { tripId, seatId, originCode, destinationCode, passengerName } = params;
  await getTripOrThrow(tripId);
  const { origin, destination } = await resolveAndValidateRoute(originCode, destinationCode);

  const seat = await prisma.seat.findUnique({ where: { id: seatId }, include: { coach: true } });
  if (!seat) throw new AppError(404, "Seat not found");
  if (seat.coach.type !== "RESERVED") {
    throw new AppError(400, "This seat is in an unreserved coach and cannot be individually booked");
  }

  const legs = legRange(origin.sequence, destination.sequence);
  const fare = calculateFare(origin.sequence, destination.sequence);

  try {
    return await prisma.$transaction(async (tx) => {
      const booking = await tx.seatBooking.create({
        data: {
          tripId,
          seatId,
          originStationId: origin.id,
          destinationStationId: destination.id,
          passengerName,
          fare,
        },
      });

      // THE concurrency guarantee: (tripId, seatId, legIndex) is a unique
      // constraint. If a concurrent request booked any leg in this range
      // between our availability check and now, this insert throws, and
      // Prisma rolls back the whole transaction — including the SeatBooking
      // row created above. Either every leg gets booked or none do, and two
      // overlapping bookings can never both succeed.
      await tx.bookedLeg.createMany({
        data: legs.map((legIndex) => ({
          tripId,
          seatId,
          legIndex,
          seatBookingId: booking.id,
        })),
      });

      return booking;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new AppError(
        409,
        "This seat is no longer available for the full requested range — someone booked an overlapping leg first"
      );
    }
    throw err;
  }
}
