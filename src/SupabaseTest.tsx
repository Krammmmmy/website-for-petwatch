
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

type SensorReading = {
  id: number;
  food_weight: number | null;
  water_weight: number | null;
  temperature: number | null;
  humidity: number | null;
  water_level: number | null;
  created_at: string;
};

export default function SupabaseTest() {
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [status, setStatus] = useState("Connecting...");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadReadings() {
      const { data, error } = await supabase
        .from("sensor_readings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      if (!active) return;

      if (error) {
        setStatus("Connection failed");
        setErrorMessage(error.message);
        return;
      }

      setReadings(data ?? []);
      setStatus("Connected to Supabase");
    }

    loadReadings();

    const channel = supabase
      .channel("petwatch-sensor-test")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sensor_readings",
        },
        (payload) => {
          const newReading = payload.new as SensorReading;

          setReadings((previous) =>
            [newReading, ...previous].slice(0, 10)
          );
        }
      )
      .subscribe((subscriptionStatus) => {
        if (!active) return;

        if (subscriptionStatus === "SUBSCRIBED") {
          setStatus("Connected — Realtime is active");
        }

        if (
          subscriptionStatus === "CHANNEL_ERROR" ||
          subscriptionStatus === "TIMED_OUT"
        ) {
          setStatus("Realtime connection failed");
        }
      });

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <section
      style={{
        margin: "20px",
        padding: "20px",
        border: "1px solid #ddd",
        borderRadius: "12px",
      }}
    >
      <h2>PetWatch Live Sensor Test</h2>

      <p>
        <strong>Status:</strong> {status}
      </p>

      {errorMessage && (
        <p style={{ color: "red" }}>{errorMessage}</p>
      )}

      <h3>Latest Sensor Readings</h3>

      {readings.length === 0 ? (
        <p>No sensor readings yet. This is normal if your ESP32 has not uploaded data.</p>
      ) : (
        readings.map((reading) => (
          <div
            key={reading.id}
            style={{
              padding: "12px",
              marginBottom: "10px",
              border: "1px solid #ddd",
              borderRadius: "8px",
            }}
          >
            <p>Food weight: {reading.food_weight ?? "—"} g</p>
            <p>Water weight: {reading.water_weight ?? "—"}</p>
            <p>Temperature: {reading.temperature ?? "—"} °C</p>
            <p>Humidity: {reading.humidity ?? "—"}%</p>
            <p>Water level: {reading.water_level ?? "—"}</p>
            <small>
              {new Date(reading.created_at).toLocaleString()}
            </small>
          </div>
        ))
      )}
    </section>
  );
}
