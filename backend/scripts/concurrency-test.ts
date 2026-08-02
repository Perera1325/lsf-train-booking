// Fires N concurrent booking requests for the SAME seat and overlapping legs
// against a running API, to prove the transactional unique-constraint insert
// actually prevents double-booking under real concurrency — not just in
// theory. Requires the API to already be running (docker compose up).
//
// Usage:
//   npx tsx scripts/concurrency-test.ts

const API = process.env.API_URL ?? "http://localhost:4000";
const CONCURRENT_REQUESTS = 10;

async function main() {
  const trips = await fetch(`${API}/trips`).then((r) => r.json());
  if (!trips.length) throw new Error("No trips found — did the seed script run?");
  const tripId = trips[0].id;

  const avail = await fetch(`${API}/trips/${tripId}/availability?origin=COL&destination=KDY`).then((r) =>
    r.json()
  );
  if (!avail.availableSeats?.length) throw new Error("No available seats to test with");
  const seatId = avail.availableSeats[0].seatId;

  console.log(
    `Firing ${CONCURRENT_REQUESTS} concurrent booking requests for seat ${seatId}, COL -> KDY...`
  );

  const statuses = await Promise.all(
    Array.from({ length: CONCURRENT_REQUESTS }).map((_, i) =>
      fetch(`${API}/trips/${tripId}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seatId,
          originStationCode: "COL",
          destinationStationCode: "KDY",
          passengerName: `Test Passenger ${i}`,
        }),
      }).then((r) => r.status)
    )
  );

  const successes = statuses.filter((s) => s === 201).length;
  const conflicts = statuses.filter((s) => s === 409).length;

  console.log(`Statuses: ${JSON.stringify(statuses)}`);
  console.log(`Successful bookings: ${successes} (expected: 1)`);
  console.log(`Conflicts: ${conflicts} (expected: ${CONCURRENT_REQUESTS - 1})`);

  if (successes !== 1) {
    console.error("FAILED — expected exactly 1 successful booking. Seat may have been double-booked!");
    process.exit(1);
  }
  console.log("PASSED — no double-booking under concurrency.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
