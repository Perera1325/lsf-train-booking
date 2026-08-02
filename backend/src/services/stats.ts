import { prisma } from "../db";
import { getTripOrThrow } from "./trips";

export async function getTripStats(tripId: number) {
  await getTripOrThrow(tripId);

  const [bookings, totalReservedSeats, stationCount, bookedLegCount] = await Promise.all([
    prisma.seatBooking.findMany({ where: { tripId }, select: { fare: true } }),
    prisma.seat.count({ where: { coach: { type: "RESERVED" } } }),
    prisma.station.count(),
    prisma.bookedLeg.count({ where: { tripId } }),
  ]);

  const totalRevenue = bookings.reduce((sum, b) => sum + Number(b.fare), 0);
  const totalLegs = Math.max(stationCount - 1, 0);
  const totalCapacityLegs = totalReservedSeats * totalLegs;
  const occupancyPercent = totalCapacityLegs === 0 ? 0 : (bookedLegCount / totalCapacityLegs) * 100;

  return {
    tripId,
    totalBookings: bookings.length,
    totalRevenue,
    totalReservedSeats,
    totalLegs,
    bookedLegCount,
    totalCapacityLegs,
    occupancyPercent: Math.round(occupancyPercent * 100) / 100,
  };
}
