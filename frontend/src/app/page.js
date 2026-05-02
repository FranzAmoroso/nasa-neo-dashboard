  useEffect(() => {
    async function fetchData() {
      try {
        const start = "10-04-2026";
        const end = "11-04-2026";
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || "https://nasa-neo-dashboard-production.up.railway.app";
        
        const url = `${baseUrl}/asteroids/feed?start_date=${start}&end_date=${end}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error("Errore nella risposta del server");
        
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
