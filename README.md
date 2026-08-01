# LSF Train Booking — Segment-Based Seat Booking System

A booking system for the Colombo Fort–Badulla line that lets a single
reserved seat be booked independently for multiple, non-overlapping legs of
the same journey (e.g. one passenger travels Colombo Fort → Kandy, another
takes Kandy → Badulla, same physical seat, each charged only for the
distance they actually travel).

> **Status:** Work in progress, built in stages. See commit history for
> progression. This README is updated at the end of each stage.

## Quick start

```bash
cp backend/.env.example backend/.env
docker compose up --build
```

- Backend API: http://localhost:4000
- Frontend: http://localhost:5173
- Postgres: localhost:5432 (user `lsf`, password `lsf_dev_password`, db `lsf_booking`)

On first boot the backend runs pending migrations and seeds the database
from `backend/config/route.json` (stations, coaches, seats, fare-per-leg —
see "Configurability" below).

## Tech stack

- **Backend:** Node.js, TypeScript, Express, Prisma ORM
- **Frontend:** React, TypeScript, Vite
- **Database:** PostgreSQL
- **Orchestration:** Docker Compose

## Core design decisions

### 1. Modeling segment occupancy: per-leg rows + a unique constraint

Every station has a `sequence` number (0-based position along the route). A
**leg** is the stretch of track between consecutive stations — a journey
from sequence 2 to sequence 5 occupies legs `[2, 3, 4]`.

Occupancy is tracked in a `booked_legs` table: **one row per (trip, seat,
leg)**, with a unique constraint on `(tripId, seatId, legIndex)`.

To book a seat for a range of stations, the backend opens a single database
transaction and inserts one `BookedLeg` row per leg in that range. If any of
those legs is already taken, the unique constraint throws, the whole
transaction rolls back, and the caller gets a `409 Conflict`. No seat is
ever double-booked, and no application-level locking code is needed —
correctness is enforced by the database itself.

**Alternative considered — bitmask per (seat, trip):** store occupancy as an
integer/bit-string per seat and do an atomic
`UPDATE ... SET mask = mask | :range WHERE (mask & :range) = 0`. This is a
single round-trip and avoids N row inserts, but it's harder to query
("which legs are free right now?" needs bit-unpacking instead of a plain
`WHERE` clause), harder to debug, and doesn't scale cleanly if the route
gains stations beyond a fixed integer width. The normalized-row approach
trades a little write throughput for a model that's transparent, easy to
query, and easy to explain in a live walkthrough — the right trade for this
system's actual load (a train schedule, not a high-frequency exchange).

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

### 5. Schema sync via `prisma db push` (for now)

The container currently boots with `prisma db push` rather than versioned
`prisma migrate` files, since generating a migration requires a live DB
connection at dev time. Once the schema is stable (end of Stage 2), this
will be replaced with a proper `migrate dev`-generated migration checked
into the repo, and the Dockerfile switched to `migrate deploy` — the
correct approach for a real deployment.

## Concurrency guarantee

Documented in detail with the booking endpoint in Stage 2, including the
approach used to test it (parallel requests racing for the same seat/leg).

## Project stages

1. **Foundations & design** (this commit) — repo scaffold, data model, docker-compose
2. Backend core: stations, seats, segment availability, booking engine
3. Fare logic, validation, concurrency tests
4. Frontend booking UI
5. Productionizing, extra credit, submission polish

## Repository

https://github.com/Perera1325/lsf-train-booking
