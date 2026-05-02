"use client";
import React, { useEffect, useState } from "react";

export default function Home() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [startDate, setStartDate] = useState("10-04-2026");
  const [endDate, setEndDate] = useState("11-04-2026");
  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL;
      const url = `${baseUrl}?start_date=${startDate}&end_date=${endDate}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Errore server: ${response.status}`);
      }
      
      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error("Errore durante il fetch:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    fetchData();
  }, []);

  return (
    <main style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>NASA Asteroid Dashboard</h1>
      <div style={{ marginBottom: "20px", display: "flex", gap: "10px", alignItems: "flex-end" }}>
        <div>
          <label style={{ display: "block" }}>Inizio (DD-MM-YYYY):</label>
          <input 
            type="text" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)}
            placeholder="GG-MM-AAAA"
          />
        </div>
        <div>
          <label style={{ display: "block" }}>Fine (DD-MM-YYYY):</label>
          <input 
            type="text" 
            value={endDate} 
            onChange={(e) => setEndDate(e.target.value)}
            placeholder="GG-MM-AAAA"
          />
        </div>
        <button onClick={fetchData} disabled={loading}>
          {loading ? "Caricamento..." : "Aggiorna Dati"}
        </button>
      </div>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <div style={{ background: "#f4f4f4", padding: "15px", borderRadius: "8px" }}>
        <h2>Risultati:</h2>
        {loading ? (
          <p>Recupero dati in corso...</p>
        ) : (
          <pre style={{ overflowX: "auto" }}>
            {data ? JSON.stringify(data, null, 2) : "Nessun dato trovato per queste date."}
          </pre>
        )}
      </div>
    </main>
  );
}
