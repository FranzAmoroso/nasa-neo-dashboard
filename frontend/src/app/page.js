"use client";
import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";

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
      const baseUrl =
        "https://nasa-neo-dashboard-production.up.railway.app/asteroids/feed";

      const url = `${baseUrl}?start_date=${startDate}&end_date=${endDate}`;

      console.log("URL:", url);

      const response = await fetch(url.toString());

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
    <main style={{ padding: "20px" }}>
      <h1>NASA Asteroid Dashboard</h1>

      <button onClick={fetchData}>Carica dati</button>

      {loading && <p>Loading...</p>}

      {error && <p>{error}</p>}

      <pre>
        {JSON.stringify(data, null, 2)}
        <div>
        <Item variant="Outline">
          <ItemMedia className="flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background *:data-[slot=avatar]:grayscale">
            <Avatar className="hidden sm:flex">
              <AvatarImage
                src="/frontend/public/item/meteorite/meteor.svg"
                alt="meteorite"
              />
              <AvatarFallback>ON</AvatarFallback>
            </Avatar>
          </ItemMedia>
          <ItemContent>
            {data?.near_earth_objects?.["2026-05-10"]?.[0]?.name}
          </ItemContent>
          <ItemActions>
            <Button size="sm" variant="outline">
              Details
            </Button>
          </ItemActions>
        </Item>
        </div>

      </pre>
    </main>
  );
}
