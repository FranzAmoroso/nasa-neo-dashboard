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

        const response = await fetch(
          `/api/asteroids/feed?start_date=${start}&end_date=${end}`,
        );

        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error("Errore nel recupero dati:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <p>Caricamento dati dalla cache...</p>;

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Dati NASA (da Cache Redis)</h1>
      <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
        {JSON.stringify(data, null, 2)}
      </pre>
    </main>
  );
}
