import { PrismaClient, CoachType } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

interface RouteConfig {
  routeName: string;
  stations: { code: string; name: string }[];
  farePerLeg: number;
  coaches: { code: string; type: "RESERVED" | "UNRESERVED"; seatCount: number }[];
}

async function main() {
  const configPath = path.join(__dirname, "..", "config", "route.json");
  const raw = fs.readFileSync(configPath, "utf-8");
  const cfg: RouteConfig = JSON.parse(raw);

  const stationCount = await prisma.station.count();
  if (stationCount > 0) {
    console.log("Database already seeded — skipping. Delete data to reseed.");
    return;
  }

  console.log(`Seeding stations for route "${cfg.routeName}"...`);
  for (let i = 0; i < cfg.stations.length; i++) {
    const s = cfg.stations[i];
    await prisma.station.create({
      data: { code: s.code, name: s.name, sequence: i },
    });
  }

  console.log("Seeding coaches and seats...");
  for (const c of cfg.coaches) {
    const coach = await prisma.coach.create({
      data: { code: c.code, type: c.type as CoachType, seatCount: c.seatCount },
    });
    // Only reserved coaches get individually numbered, bookable seats —
    // unreserved coaches have no seat assignment (first-come-first-served).
    if (c.type === "RESERVED") {
      for (let n = 1; n <= c.seatCount; n++) {
        await prisma.seat.create({
          data: { coachId: coach.id, seatNumber: n },
        });
      }
    }
  }

  console.log("Creating today's trip...");
  await prisma.trip.create({
    data: {
      date: new Date(new Date().toDateString()),
      routeName: cfg.routeName,
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
