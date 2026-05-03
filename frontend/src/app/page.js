"use client";
import React, { useEffect, useState } from "react";
import {
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Avatar,
  CircularProgress,
  TextField,
  Stack,
  Alert,
} from "@mui/material";

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

  const firstAsteroid =
    data?.near_earth_objects && Object.values(data.near_earth_objects)[0]?.[0];

  return (
<Container
  maxWidth="lg"
  sx={{
    py: 6,
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top, #1b2735 0%, #090a0f 40%, #000000 100%)",
    color: "white",
  }}
>
  <Typography
    variant="h3"
    gutterBottom
    sx={{
      fontWeight: "bold",
      letterSpacing: 2,
      textAlign: "center",
      mb: 5,
      background: "linear-gradient(90deg, #ffffff, #7dd3fc)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      textShadow: "0 0 20px rgba(125,211,252,0.5)",
    }}
  >
    🚀 NASA Asteroid Dashboard
  </Typography>

  <Stack
    direction={{ xs: "column", md: "row" }}
    spacing={2}
    mb={4}
    sx={{
      background: "rgba(255,255,255,0.05)",
      backdropFilter: "blur(10px)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 4,
      p: 3,
      boxShadow: "0 0 25px rgba(0,0,0,0.5)",
    }}
  >
    <TextField
      label=""
      type="date"
      value={startDate}
      onChange={(e) => setStartDate(e.target.value)}
      InputLabelProps={{ shrink: true }}
      sx={{
        flex: 1,
        input: { color: "white" },
        label: { color: "#94a3b8" },
        "& .MuiOutlinedInput-root": {
          "& fieldset": {
            borderColor: "rgba(255,255,255,0.2)",
          },
          "&:hover fieldset": {
            borderColor: "#38bdf8",
          },
        },
      }}
    />

    <TextField
      label=""
      type="date"
      value={endDate}
      onChange={(e) => setEndDate(e.target.value)}
      InputLabelProps={{ shrink: true }}
      sx={{
        flex: 1,
        input: { color: "white" },
        label: { color: "#94a3b8" },
        "& .MuiOutlinedInput-root": {
          "& fieldset": {
            borderColor: "rgba(255,255,255,0.2)",
          },
          "&:hover fieldset": {
            borderColor: "#38bdf8",
          },
        },
      }}
    />

    <Button
      variant="contained"
      onClick={fetchData}
      sx={{
        px: 4,
        borderRadius: 3,
        background:
          "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)",
        boxShadow: "0 0 20px rgba(14,165,233,0.5)",
        fontWeight: "bold",
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: "0 0 30px rgba(14,165,233,0.8)",
        },
      }}
    >
      Carica dati
    </Button>
  </Stack>

  {loading && (
    <Stack alignItems="center" mt={4}>
      <CircularProgress color="info" />
    </Stack>
  )}

  {error && (
    <Alert
      severity="error"
      sx={{
        background: "rgba(255,0,0,0.1)",
        color: "white",
        border: "1px solid rgba(255,0,0,0.3)",
      }}
    >
      {error}
    </Alert>
  )}

  {firstAsteroid && (
    <Card
      sx={{
        mt: 4,
        display: "flex",
        alignItems: "center",
        p: 3,
        borderRadius: 5,
        background: "rgba(255,255,255,0.05)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 0 30px rgba(0,0,0,0.6)",
        transition: "0.3s",
        "&:hover": {
          transform: "scale(1.02)",
          boxShadow: "0 0 40px rgba(56,189,248,0.3)",
        },
      }}
    >
      <Avatar
        src="/meteorite.png"
        alt="meteorite"
        sx={{
          width: 90,
          height: 90,
          mr: 3,
          border: "2px solid #38bdf8",
          boxShadow: "0 0 20px rgba(56,189,248,0.6)",
        }}
      />

      <CardContent sx={{ flex: 1 }}>
        <Typography
          variant="h5"
          sx={{
            fontWeight: "bold",
            color: "#e2e8f0",
          }}
        >
          {firstAsteroid.name}
        </Typography>

        <Typography
          variant="body1"
          sx={{
            color: "#94a3b8",
            mt: 1,
          }}
        >
          ID: {firstAsteroid.id}
        </Typography>
      </CardContent>

      <Button
        variant="outlined"
        sx={{
          color: "#38bdf8",
          borderColor: "#38bdf8",
          borderRadius: 3,
          "&:hover": {
            borderColor: "#7dd3fc",
            background: "rgba(56,189,248,0.1)",
          },
        }}
      >
        Details
      </Button>
    </Card>
  )}
</Container>
  );
}
