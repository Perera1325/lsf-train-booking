import fs from "node:fs";
import path from "node:path";

interface RouteConfig {
  routeName: string;
  farePerLeg: number;
}

let cached: RouteConfig | null = null;

// Reads the same config/route.json the seed script uses. Cached after first
// read since the file doesn't change at runtime. Keeping fare-per-leg here
// (rather than hardcoded) is part of the "configurable, not hardcoded"
// requirement from the assignment.
export function getRouteConfig(): RouteConfig {
  if (!cached) {
    const configPath = path.join(__dirname, "..", "config", "route.json");
    cached = JSON.parse(fs.readFileSync(configPath, "utf-8")) as RouteConfig;
  }
  return cached;
}
