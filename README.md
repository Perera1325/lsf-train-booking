# LSF Train Booking — Segment-Based Seat Booking System

A booking system for the Colombo Fort–Badulla scenic line that lets a
single reserved seat be booked independently for multiple, non-overlapping
legs of the same journey — e.g. one passenger travels Colombo Fort → Kandy
and another takes Kandy → Badulla on the exact same physical seat, each
paying only for the distance they actually travel.

## Quick start

```bash
cp backend/.env.example backend/.env
docker compose up --build
```

- Frontend (booking UI): http://localhost:5173
- Backend API: http://localhost:4000
- Postgres: localhost:5432 (user `lsf`, password `lsf_dev_password`, db `lsf_booking`)

On first boot the backend applies the committed Prisma migration and seeds
the database from `backend/config/route.json` (stations, coaches, seats,
fare-per-leg).

## Tech stack

- **Backend:** Node.js, TypeScript, Express, Prisma ORM
- **Frontend:** React, TypeScript, Vite
- **Database:** PostgreSQL
- **Testing:** Vitest (integration tests against the real DB)
- **Orchestration:** Docker Compose

## Core design decisions

### 1. Modeling segment occupancy: per-leg rows + a unique constraint

Every station has a `sequence` number (0-based position along the route). A
**leg** is the stretch of track between consecutive stations — a journey
from sequence 2 to sequence 5 occupies legs `[2, 3, 4]`.

Occupancy is tracked in a `booked_legs` table: **one row per (trip, seat,
leg)**, with a unique constraint on `(tripId, seatId, legIndex)`.

To book a seat for a range of stations, the backend opens a single database
transaction, creates the `SeatBooking` row, then inserts one `BookedLeg`
row per leg in that range. If any of those legs is already taken, the
unique constraint throws, the whole transaction rolls back (including the
`SeatBooking` row), and the caller gets a `409 Conflict`. No seat is ever
double-booked, and there's no application-level locking code — correctness
is enforced by the database itself, not by careful sequencing in JS.

**Proof, not just a claim:** `backend/scripts/concurrency-test.ts` fires 10
simultaneous booking requests at the same seat/segment against the running
API. Result every time: exactly 1 succeeds, 9 get `409`. The same guarantee
is also covered by an automated test (`backend/src/services/booking.test.ts`)
that fires 8 concurrent requests directly against the service layer.

**Alternative considered — bitmask per (seat, trip):** store occupancy as
an integer/bit-string per seat and do an atomic
`UPDATE ... SET mask = mask | :range WHERE (mask & :range) = 0`. Faster in
theory (one row, one round trip) but harder to query ("which legs are free
right now?" needs bit-unpacking instead of a plain `WHERE`), harder to
debug, and doesn't scale cleanly if the route grows past a fixed integer
width. The normalized-row approach trades a little write throughput for a
model that's transparent, queryable, and easy to explain live — the right
trade for a train schedule's actual load, not a high-frequency exchange.

### 2. Trips are date-scoped

A `Trip` represents one scheduled run of the route on a specific date.
Occupancy is scoped to `(tripId, seatId, legIndex)`, so seat availability
naturally resets every day, matching how the real railway timetable works.

### 3. Configurability

Stations, coaches, seats-per-coach, and fare-per-leg all live in
[`backend/config/route.json`](./backend/config/route.json), consumed by the
seed script — not hardcoded in application logic. Adding a coach or
extending the route to a new terminus is a config change, not a code
change.

### 4. Unreserved coaches are out of scope for seat-level booking

The assignment is specifically about reserved-coach seats becoming
resellable per-segment. Unreserved coaches are first-come-first-served with
no seat assignment, so they're modeled as coaches (for completeness/future
capacity reporting) but have no `Seat` rows and no booking flow.

### 5. Schema managed via a committed Prisma migration

The project started with `prisma db push` for fast iteration during early
development, then moved to a proper `prisma migrate dev`-generated
migration (checked into `backend/prisma/migrations/`) once the schema
stabilized, with the container now running `prisma migrate deploy` on
boot — the standard, reproducible way to apply schema changes in any
environment.

## API reference

| Method | Path                              | Description                                      |
|--------|-----------------------------------|---------------------------------------------------|
| GET    | `/health`                         | DB connectivity check                              |
| GET    | `/stations`                       | List all stations in route order                   |
| GET    | `/trips`                          | List scheduled trips                                |
| GET    | `/trips/:tripId/availability`     | `?origin=CODE&destination=CODE` — free seats for that segment |
| GET    | `/trips/:tripId/bookings`         | List all bookings for a trip                        |
| GET    | `/trips/:tripId/stats`            | Revenue and occupancy stats for a trip               |
| POST   | `/trips/:tripId/bookings`         | Book a seat: `{ seatId, originStationCode, destinationStationCode, passengerName }` |

## Testing

```bash
docker compose exec backend npm test              # automated integration tests
docker compose exec backend npm run test:concurrency   # manual concurrency proof against the live API
```

Tests run against the real Postgres instance (not mocks) since the system's
entire correctness guarantee lives in the database's unique constraint —
mocking it would test nothing meaningful.

## Extra credit implemented

- **Admin view** (`/trips/:tripId/stats` + the "Admin" tab in the UI):
  total bookings, total revenue, and seat-leg occupancy percentage for a
  trip.
- **Graceful conflict UX:** if a booking request 409s because someone else
  took an overlapping leg between the user's availability check and their
  click, the UI shows a clear error and automatically refreshes the seat
  grid rather than leaving a stale, unbookable seat on screen.

## Extra credit considered but not built

Per the assignment's own guidance ("a focused, well-reasoned core beats an
impressive list of extras"), these were scoped out to keep the core solid:

- **Seat map visualization** (a literal train-carriage diagram) — the seat
  grid UI already conveys availability by coach/seat number; a visual
  floor-plan would be a nice-to-have polish item, not core value.
- **Waitlisting for full segments** — meaningfully changes the data model
  (needs a queue + notification concept) and felt like scope creep for the
  time available.

## Challenges faced

- **Prisma + Alpine Linux/OpenSSL:** `node:20-alpine` doesn't ship OpenSSL
  by default, which broke Prisma's query engine at container startup with a
  garbled error message. Fixed by installing `openssl` in the Dockerfile
  and explicitly setting `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]`
  in `schema.prisma`.
- **Concurrency correctness under real parallel load:** the design
  decision to use a unique constraint on `(tripId, seatId, legIndex)` was
  validated empirically, not just reasoned about — the concurrency test
  script and the automated Vitest suite both fire many simultaneous
  requests at the same seat and assert exactly one wins.
- **Migrating from prototyping to a committed migration:** started with
  `prisma db push` for speed, then generated a proper `prisma migrate dev`
  migration once the schema was stable, switching the container's boot
  command to `migrate deploy` to match how a real deployment would work.

## Project stages (see commit history for full progression)

1. Foundations & design — repo scaffold, data model, docker-compose
2. Backend core — stations, availability, transactional booking engine
3. Fare logic, input hardening, automated + concurrency tests
4. Frontend booking UI
5. Production migration, admin extra credit, final polish

## Repository

https://github.com/Perera1325/lsf-train-booking
