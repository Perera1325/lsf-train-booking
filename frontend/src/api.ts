const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

export interface Station {
  id: number;
  code: string;
  name: string;
  sequence: number;
}

export interface Trip {
  id: number;
  date: string;
  routeName: string;
}

export interface AvailableSeat {
  seatId: number;
  seatNumber: number;
  coachCode: string;
}

export interface Booking {
  id: number;
  tripId: number;
  seatId: number;
  originStationId: number;
  destinationStationId: number;
  passengerName: string;
  fare: string;
  createdAt: string;
  seat?: { seatNumber: number; coach: { code: string } };
  originStation?: Station;
  destinationStation?: Station;
}

export interface TripStats {
  tripId: number;
  totalBookings: number;
  totalRevenue: number;
  totalReservedSeats: number;
  totalLegs: number;
  bookedLegCount: number;
  totalCapacityLegs: number;
  occupancyPercent: number;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed with status ${res.status}`);
  }
  return res.json();
}

export async function getStations(): Promise<Station[]> {
  return handle(await fetch(`${API_BASE}/stations`));
}

export async function getTrips(): Promise<Trip[]> {
  return handle(await fetch(`${API_BASE}/trips`));
}

export async function getAvailability(
  tripId: number,
  originCode: string,
  destinationCode: string
): Promise<{ availableSeats: AvailableSeat[] }> {
  const params = new URLSearchParams({ origin: originCode, destination: destinationCode });
  return handle(await fetch(`${API_BASE}/trips/${tripId}/availability?${params}`));
}

export async function getBookings(tripId: number): Promise<Booking[]> {
  return handle(await fetch(`${API_BASE}/trips/${tripId}/bookings`));
}

export async function getTripStats(tripId: number): Promise<TripStats> {
  return handle(await fetch(`${API_BASE}/trips/${tripId}/stats`));
}

export async function createBooking(params: {
  tripId: number;
  seatId: number;
  originStationCode: string;
  destinationStationCode: string;
  passengerName: string;
}): Promise<Booking> {
  return handle(
    await fetch(`${API_BASE}/trips/${params.tripId}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seatId: params.seatId,
        originStationCode: params.originStationCode,
        destinationStationCode: params.destinationStationCode,
        passengerName: params.passengerName,
      }),
    })
  );
}
