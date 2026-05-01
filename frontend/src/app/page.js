"use client";
import { useEffect, useState } from "react";

export default function Home() { 
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const start = "10-04-2026";
        const end = "16-04-2026";
        const url = `/api/asteroids/feed?start_date=${start}&end_date=${end}`;
        const response = await fetch(url);
        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error("Errore:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <p>Caricamento...</p>;

  return (
    <main>
      <h1>Dati NASA</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </main>
  );
}
