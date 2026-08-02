-- CreateEnum
CREATE TYPE "CoachType" AS ENUM ('RESERVED', 'UNRESERVED');

-- CreateTable
CREATE TABLE "stations" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,

    CONSTRAINT "stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coaches" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "type" "CoachType" NOT NULL,
    "seatCount" INTEGER NOT NULL,

    CONSTRAINT "coaches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seats" (
    "id" SERIAL NOT NULL,
    "coachId" INTEGER NOT NULL,
    "seatNumber" INTEGER NOT NULL,

    CONSTRAINT "seats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "routeName" TEXT NOT NULL DEFAULT 'Colombo Fort - Badulla',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seat_bookings" (
    "id" SERIAL NOT NULL,
    "tripId" INTEGER NOT NULL,
    "seatId" INTEGER NOT NULL,
    "originStationId" INTEGER NOT NULL,
    "destinationStationId" INTEGER NOT NULL,
    "passengerName" TEXT NOT NULL,
    "fare" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seat_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booked_legs" (
    "id" SERIAL NOT NULL,
    "tripId" INTEGER NOT NULL,
    "seatId" INTEGER NOT NULL,
    "legIndex" INTEGER NOT NULL,
    "seatBookingId" INTEGER NOT NULL,

    CONSTRAINT "booked_legs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stations_code_key" ON "stations"("code");

-- CreateIndex
CREATE UNIQUE INDEX "stations_sequence_key" ON "stations"("sequence");

-- CreateIndex
CREATE UNIQUE INDEX "coaches_code_key" ON "coaches"("code");

-- CreateIndex
CREATE UNIQUE INDEX "seats_coachId_seatNumber_key" ON "seats"("coachId", "seatNumber");

-- CreateIndex
CREATE UNIQUE INDEX "trips_date_routeName_key" ON "trips"("date", "routeName");

-- CreateIndex
CREATE UNIQUE INDEX "booked_legs_tripId_seatId_legIndex_key" ON "booked_legs"("tripId", "seatId", "legIndex");

-- AddForeignKey
ALTER TABLE "seats" ADD CONSTRAINT "seats_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coaches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_bookings" ADD CONSTRAINT "seat_bookings_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_bookings" ADD CONSTRAINT "seat_bookings_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "seats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_bookings" ADD CONSTRAINT "seat_bookings_originStationId_fkey" FOREIGN KEY ("originStationId") REFERENCES "stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_bookings" ADD CONSTRAINT "seat_bookings_destinationStationId_fkey" FOREIGN KEY ("destinationStationId") REFERENCES "stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booked_legs" ADD CONSTRAINT "booked_legs_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booked_legs" ADD CONSTRAINT "booked_legs_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "seats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booked_legs" ADD CONSTRAINT "booked_legs_seatBookingId_fkey" FOREIGN KEY ("seatBookingId") REFERENCES "seat_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
