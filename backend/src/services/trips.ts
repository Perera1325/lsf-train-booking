import { prisma } from "../db";
import { AppError } from "../errors";

export async function getTripOrThrow(tripId: number) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) throw new AppError(404, `Trip ${tripId} not found`);
  return trip;
}

export async function listTrips() {
  return prisma.trip.findMany({ orderBy: { date: "asc" } });
}

export async function listBookingsForTrip(tripId: number) {
  await getTripOrThrow(tripId);
  return prisma.seatBooking.findMany({
    where: { tripId },
    include: {
      seat: { include: { coach: true } },
      originStation: true,
      destinationStation: true,
    },
    orderBy: { createdAt: "desc" },
  });
}
