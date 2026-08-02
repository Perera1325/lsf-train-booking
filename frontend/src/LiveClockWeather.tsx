import { useEffect, useState } from "react";

interface WeatherData {
  temperature: number;
  weatherCode: number;
}

const WEATHER_LABELS: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Foggy",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  80: "Rain showers",
  81: "Rain showers",
  82: "Violent showers",
  95: "Thunderstorm",
};

// Colombo, Sri Lanka
const COLOMBO_LAT = 6.9271;
const COLOMBO_LON = 79.8612;

export default function LiveClockWeather() {
  const [now, setNow] = useState(new Date());
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function fetchWeather() {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${COLOMBO_LAT}&longitude=${COLOMBO_LON}&current=temperature_2m,weather_code`
        );
        const data = await res.json();
        setWeather({
          temperature: data.current.temperature_2m,
          weatherCode: data.current.weather_code,
        });
      } catch {
        setWeather(null);
      }
    }
    fetchWeather();
    const interval = setInterval(fetchWeather, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const timeStr = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);

  const dateStr = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo",
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(now);

  const weatherLabel = weather ? WEATHER_LABELS[weather.weatherCode] ?? "—" : null;

  return (
    <div className="live-strip">
      <div className="live-item">
        <span className="live-dot" />
        <span className="live-time">{timeStr}</span>
        <span className="live-date">{dateStr}, Sri Lanka</span>
      </div>
      {weather && (
        <div className="live-item">
          <span className="live-temp">{Math.round(weather.temperature)}°C</span>
          <span className="live-weather-label">{weatherLabel}, Colombo</span>
        </div>
      )}
    </div>
  );
}
