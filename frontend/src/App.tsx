import { useEffect, useMemo, useState } from "react";
import "./App.css";
import AdminPanel from "./AdminPanel";
import {
  Station,
  Trip,
  AvailableSeat,
  Booking,
  getStations,
  getTrips,
  getAvailability,
  getBookings,
  createBooking,
} from "./api";

export default function App() {
  const [activeTab, setActiveTab] = useState<"book" | "admin">("book");

  const [stations, setStations] = useState<Station[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripId, setTripId] = useState<number | null>(null);

  const [originCode, setOriginCode] = useState("");
  const [destinationCode, setDestinationCode] = useState("");

  const [availableSeats, setAvailableSeats] = useState<AvailableSeat[]>([]);
  const [selectedSeatId, setSelectedSeatId] = useState<number | null>(null);
  const [passengerName, setPassengerName] = useState("");

  const [bookings, setBookings] = useState<Booking[]>([]);

  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [s, t] = await Promise.all([getStations(), getTrips()]);
        setStations(s);
        setTrips(t);
        if (s.length >= 2) {
          setOriginCode(s[0].code);
          setDestinationCode(s[Math.min(4, s.length - 1)].code);
        }
        if (t.length > 0) setTripId(t[0].id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load initial data");
      }
    })();
  }, []);

  const originStation = useMemo(
    () => stations.find((s) => s.code === originCode),
    [stations, originCode]
  );

  const destinationOptions = useMemo(
    () => (originStation ? stations.filter((s) => s.sequence > originStation.sequence) : stations),
    [stations, originStation]
  );

  async function refreshAvailability() {
    if (!tripId || !originCode || !destinationCode) return;
    setLoadingAvailability(true);
    setError(null);
    setSelectedSeatId(null);
    try {
      const { availableSeats } = await getAvailability(tripId, originCode, destinationCode);
      setAvailableSeats(availableSeats);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load availability");
      setAvailableSeats([]);
    } finally {
      setLoadingAvailability(false);
    }
  }

  async function refreshBookings() {
    if (!tripId) return;
    try {
      const list = await getBookings(tripId);
      setBookings(list);
    } catch {
      // Non-critical.
    }
  }

  useEffect(() => {
    refreshAvailability();
    refreshBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, originCode, destinationCode]);

  const seatsByCoach = useMemo(() => {
    const groups = new Map<string, AvailableSeat[]>();
    for (const seat of availableSeats) {
      const list = groups.get(seat.coachCode) ?? [];
      list.push(seat);
      groups.set(seat.coachCode, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [availableSeats]);

  async function handleBook() {
    if (!tripId || !selectedSeatId || !passengerName.trim()) return;
    setBooking(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await createBooking({
        tripId,
        seatId: selectedSeatId,
        originStationCode: originCode,
        destinationStationCode: destinationCode,
        passengerName: passengerName.trim(),
      });
      setSuccess(
        `Booked! ${originCode} \u2192 ${destinationCode}, fare Rs. ${result.fare} — confirmation #${result.id}`
      );
      setPassengerName("");
      setSelectedSeatId(null);
      await Promise.all([refreshAvailability(), refreshBookings()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Booking failed");
      await refreshAvailability();
    } finally {
      setBooking(false);
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>LSF Train Booking</h1>
        <p>Colombo Fort → Badulla — book a reserved seat for exactly the segment you're travelling.</p>
      </header>

      <div className="tabs">
        <button className={`tab${activeTab === "book" ? " active" : ""}`} onClick={() => setActiveTab("book")}>
          Book a seat
        </button>
        <button className={`tab${activeTab === "admin" ? " active" : ""}`} onClick={() => setActiveTab("admin")}>
          Admin: occupancy & revenue
        </button>
      </div>

      {activeTab === "admin" ? (
        <section className="panel">
          <h2>Trip stats</h2>
          <AdminPanel tripId={tripId} />
        </section>
      ) : (
        <>
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <section className="panel">
            <h2>1. Choose your journey</h2>
            <div className="route-form">
              <div className="field">
                <label htmlFor="trip">Trip</label>
                <select id="trip" value={tripId ?? ""} onChange={(e) => setTripId(Number(e.target.value))}>
                  {trips.map((t) => (
                    <option key={t.id} value={t.id}>
                      {new Date(t.date).toDateString()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="origin">From</label>
                <select id="origin" value={originCode} onChange={(e) => setOriginCode(e.target.value)}>
                  {stations.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="destination">To</label>
                <select
                  id="destination"
                  value={destinationCode}
                  onChange={(e) => setDestinationCode(e.target.value)}
                >
                  {destinationOptions.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <button className="btn-primary" onClick={refreshAvailability} disabled={loadingAvailability}>
                {loadingAvailability ? "Checking..." : "Refresh availability"}
              </button>
            </div>
          </section>

          <section className="panel">
            <h2>2. Pick a seat ({availableSeats.length} available for this segment)</h2>
            {loadingAvailability ? (
              <div className="empty-state">Loading seats...</div>
            ) : seatsByCoach.length === 0 ? (
              <div className="empty-state">No seats available for this segment.</div>
            ) : (
              seatsByCoach.map(([coachCode, seats]) => (
                <div className="coach-group" key={coachCode}>
                  <h3>Coach {coachCode}</h3>
                  <div className="seat-grid">
                    {seats.map((seat) => (
                      <div
                        key={seat.seatId}
                        className={`seat-card${selectedSeatId === seat.seatId ? " selected" : ""}`}
                        onClick={() => setSelectedSeatId(seat.seatId)}
                      >
                        <span className="coach">{seat.coachCode}</span>
                        <span className="num">{seat.seatNumber}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>

          <section className="panel">
            <h2>3. Passenger details</h2>
            <div className="route-form">
              <div className="field" style={{ flex: 2 }}>
                <label htmlFor="passenger">Passenger name</label>
                <input
                  id="passenger"
                  type="text"
                  value={passengerName}
                  onChange={(e) => setPassengerName(e.target.value)}
                  placeholder="Full name"
                />
              </div>
              <button
                className="btn-primary"
                onClick={handleBook}
                disabled={!selectedSeatId || !passengerName.trim() || booking}
              >
                {booking ? "Booking..." : "Book seat"}
              </button>
            </div>
          </section>

          <section className="panel">
            <h2>Bookings on this trip ({bookings.length})</h2>
            {bookings.length === 0 ? (
              <div className="empty-state">No bookings yet.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Passenger</th>
                    <th>Coach / Seat</th>
                    <th>Route</th>
                    <th>Fare</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.id}>
                      <td>{b.passengerName}</td>
                      <td>
                        {b.seat?.coach.code} / {b.seat?.seatNumber}
                      </td>
                      <td>
                        {b.originStation?.code} → {b.destinationStation?.code}
                      </td>
                      <td>Rs. {b.fare}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
