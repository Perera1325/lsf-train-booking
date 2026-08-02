import { prisma } from "../db";
import { AppError } from "../errors";

export async function listStations() {
  return prisma.station.findMany({ orderBy: { sequence: "asc" } });
}

export async function getStationByCode(code: string) {
  const station = await prisma.station.findUnique({ where: { code } });
  if (!station) {
    throw new AppError(404, `Unknown station code: ${code}`);
  }
  return station;
}
