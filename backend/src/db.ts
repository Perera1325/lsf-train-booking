import { PrismaClient } from "@prisma/client";

// Single shared Prisma instance across the app (standard practice — avoids
// exhausting the DB connection pool by creating a new client per request).
export const prisma = new PrismaClient();
