import { useEffect, useState } from "react";
import { getTripStats, TripStats } from "./api";

export default function AdminPanel({ tripId }: { tripId: number | null }) {
  const [stats, setStats] = useState<TripStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tripId) return;
    setLoading(true);
    setError(null);
    getTripStats(tripId)
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load stats"))
      .finally(() => setLoading(false));
  }, [tripId]);

  if (!tripId) return <div className="empty-state">Select a trip first.</div>;
  if (loading) return <div className="empty-state">Loading stats...</div>;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (!stats) return null;

  return (
    <div className="stats-grid">
      <div className="stat-card">
        <span className="stat-label">Total bookings</span>
        <span className="stat-value">{stats.totalBookings}</span>
      </div>
      <div className="stat-card">
        <span className="stat-label">Total revenue</span>
        <span className="stat-value">Rs. {stats.totalRevenue.toFixed(2)}</span>
      </div>
      <div className="stat-card">
        <span className="stat-label">Seat-legs occupied</span>
        <span className="stat-value">
          {stats.bookedLegCount} / {stats.totalCapacityLegs}
        </span>
      </div>
      <div className="stat-card">
        <span className="stat-label">Occupancy</span>
        <span className="stat-value">{stats.occupancyPercent}%</span>
      </div>
    </div>
  );
}
