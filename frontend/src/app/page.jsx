"use client";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Container,
  Typography,
  CircularProgress,
  Stack,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
} from "@mui/material";
import { nasaTheme } from "./theme";

export default function Home() {
  const router = useRouter();

  const [asteroidsCache, setAsteroidsCache] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getDynamicDate = (daysToAdd) => {
    const date = new Date();
    date.setDate(date.getDate() + daysToAdd);
    
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    
    return `${day}-${month}-${year}`; 
  };


  const [startDate] = useState(() => getDynamicDate(1));
  const [endDate] = useState(() => getDynamicDate(5));

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const baseUrl =
        "https://nasa-neo-dashboard-production.up.railway.app/asteroids/feed";
      const url = `${baseUrl}?start_date=${startDate}&end_date=${endDate}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error(`Errore server: ${response.status}`);

      const result = await response.json();

      if (result.near_earth_objects) {
        const fetchedAsteroids = Object.values(
          result.near_earth_objects,
        ).flat(); // tiene solo i value scartando le key

        // elimina i duplicati e unisce nuovi con vecchi asteroidi
        setAsteroidsCache((prevCache) => {
          const combined = [...prevCache, ...fetchedAsteroids];
          const uniqueAsteroids = Array.from(
            new Map(combined.map((item) => [item.id, item])).values(),
          );

          // setta in locale i dati in json
          localStorage.setItem(
            "nasa_asteroids_cache",
            JSON.stringify(uniqueAsteroids),
          );
          return uniqueAsteroids;
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Caricamento iniziale
  useEffect(() => {
    const saved = localStorage.getItem("nasa_asteroids_cache");
    if (saved) {
      setAsteroidsCache(JSON.parse(saved));
    }
    fetchData();
  }, []);

  //  normalizzazione data (sistemare)
  const formatDisplayDate = (dateString) => {
    if (!dateString) return "";
    if (dateString.includes("-") && dateString.indexOf("-") === 2) {
      return dateString.replace(/-/g, "/");
    }
    // Sicurezza temporanea (AAAA-MM-GG)
    if (dateString.includes("-") && dateString.indexOf("-") === 4) {
      const [year, month, day] = dateString.split("-");
      return `${day}/${month}/${year}`;
    }
    return dateString;
  };

  const getAsteroidMetrics = (asteroid) => {
    const maxDiameter =
      Math.round(asteroid.estimated_diameter?.meters?.estimated_diameter_max) ||
      0;

    const currentSpeed =
      Math.round(
        asteroid.close_approach_data?.[0]?.relative_velocity
          ?.kilometers_per_hour,
      ) || 0;

    const currentDistance =
      Math.round(
        asteroid.close_approach_data?.[0]?.miss_distance?.kilometers,
      ) || 0;

    const distanceFactor = Math.min((currentDistance / 60000000) * 100, 100);
    const asteroidXPosition = 25 + distanceFactor * 1.5;
    const asteroidRadius = Math.max(
      4,
      Math.min((maxDiameter / 1000) * 30 + 4, 32),
    );
    return {
      maxDiameter,
      currentSpeed,
      currentDistance,
      asteroidXPosition,
      asteroidRadius,
    };
  };

  return (
    <Container
      maxWidth="lg"
      sx={{
        py: 6,
        background: nasaTheme.background.primary,
        color: nasaTheme.text.primary,
      }}
    >
      <Typography
        variant="h3"
        gutterBottom // variabile booleana per contenuto sottostante
        sx={{
          fontWeight: "bold",
          letterSpacing: 2,
          textAlign: "center",
          mb: 2,
          background: `linear-gradient(90deg, ${nasaTheme.text.primary}, ${nasaTheme.text.accent})`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          textShadow: `0 0 20px ${nasaTheme.text.accent}80`,
        }}
      >
        🚀 NASA Asteroid Dashboard
      </Typography>

      <Typography
        variant="body1"
        sx={{
          color: nasaTheme.text.secondary,
          mb: 5,
          letterSpacing: 0.5,
          textAlign: "center",
        }}
      >
        Scansione automatica attiva dal{" "}
        <strong style={{ color: nasaTheme.text.accent }}>
          {formatDisplayDate(startDate)}
        </strong>{" "}
        al{" "}
        <strong style={{ color: nasaTheme.text.accent }}>
          {formatDisplayDate(endDate)}
        </strong>
      </Typography>

      {loading && (
        <Stack
          direction="row"
          spacing={2}
          sx={{ alignItems: "center", justifyContent: "center", mb: 4 }}
        >
          <CircularProgress size={20} color="info" />
          <Typography variant="body2" sx={{ color: nasaTheme.text.secondary }}>
            Aggiornamento file spaziali in corso...
          </Typography>
        </Stack>
      )}


      <Stack spacing={3} mt={0}>
        {asteroidsCache.map((asteroid) => {
          const metrics = getAsteroidMetrics(asteroid);

          return (
            <Card
              key={asteroid.id}
              sx={{
                background: nasaTheme.background.card,
                backdropFilter: "blur(12px)",
                border: `1px solid ${nasaTheme.border.primary}`,
                borderRadius: "20px",
                boxShadow: nasaTheme.shadow.primary,
                position: "relative",
                pr: { xs: 3, sm: 3, md: 22 },
                p: 3,
                transition: "0.3s",
                "&:hover": { boxShadow: nasaTheme.shadow.glowStrong },
              }}
            >
              <Box
                sx={{
                  px: 2,
                  py: 0.5,
                  mb: 2,
                  borderRadius: "12px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "fit-content",
                  // cambia il colore in base al pericolo ( da sistemare nel thema)
                  background: asteroid.is_potentially_hazardous_asteroid
                    ? "rgba(244, 63, 94, 0.15)"
                    : "rgba(16, 185, 129, 0.15)",
                  border: asteroid.is_potentially_hazardous_asteroid
                    ? "1px solid #f43f5e"
                    : "1px solid #10b981",
                  boxShadow: asteroid.is_potentially_hazardous_asteroid
                    ? "0 0 10px rgba(244, 63, 94, 0.3)"
                    : "0 0 10px rgba(16, 185, 129, 0.3)",
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: "bold",
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                    color: asteroid.is_potentially_hazardous_asteroid
                      ? "#f43f5e"
                      : "#10b981",
                  }}
                >
                  {asteroid.is_potentially_hazardous_asteroid
                    ? "Dangerous"
                    : "Safe"}
                </Typography>
              </Box>

              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={3}
                alignItems="center"
                sx={{ width: "100%", pb: { xs: 6, sm: 0 } }}
              >
                <CardContent sx={{ flex: 1, p: "0 !important", width: "100%" }}>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={{ xs: 3, md: 4 }}
                    alignItems="center"
                  >
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={4}
                      sx={{ width: "100%", mt: 2, alignItems: "center" }}
                    >
                      <Box
                        sx={{
                          textAlign: "center",
                          flex: 1,
                          width: "100%",
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            color: nasaTheme.text.secondary,
                            display: "block",
                            mb: 1,
                            fontWeight: "bold",
                            letterSpacing: 0.5,
                          }}
                        ></Typography>

                        <Box
                          sx={{
                            width: "100%",
                            height: "100px",
                            background: "rgba(0,0,0,0.4)",
                            borderRadius: "12px",
                            border: `1px solid ${nasaTheme.border.primary}`,
                            position: "relative",
                            overflow: "hidden",
                          }}
                        >
                          <svg
                            width="100%"
                            height="100%"
                            style={{ display: "block" }}
                          >
                            {/* Griglia degli Assi Cartesiani dello spazio */}
                            <line
                              x1="30"
                              y1="10"
                              x2="30"
                              y2="90"
                              stroke="rgba(255,255,255,0.15)"
                              strokeWidth="1"
                            />
                            <line
                              x1="10"
                              y1="80"
                              x2="95%"
                              y2="80"
                              stroke="rgba(255,255,255,0.15)"
                              strokeWidth="1"
                            />

                            {/* Scritte degli assi */}
                            <text
                              x="20"
                              y="15"
                              fill="rgba(255,255,255,0.3)"
                              fontSize="9"
                            >
                              Y
                            </text>
                            <text
                              x="93%"
                              y="92"
                              fill="rgba(255,255,255,0.3)"
                              fontSize="9"
                            >
                              X
                            </text>

                            {/* OGGETTO FISSO: LA TERRA (Posizionata all'incrocio degli assi) */}
                            <circle
                              cx="30"
                              cy="80"
                              r="10"
                              fill="#0ea5e9"
                              opacity="0.4"
                            />
                            <circle
                              cx="30"
                              cy="80"
                              r="6"
                              fill="#38bdf8"
                              style={{
                                filter: "drop-shadow(0 0 4px #38bdf8)",
                              }}
                            />
                            <text
                              x="15"
                              y="62"
                              fill="#38bdf8"
                              fontSize="10"
                              fontWeight="bold"
                            >
                              Terra
                            </text>

                            {/* Linea tratteggiata di orbita e distanza */}
                            <line
                              x1="30"
                              y1="80"
                              x2={metrics.asteroidXPosition}
                              y2="40"
                              stroke={
                                asteroid.is_potentially_hazardous_asteroid
                                  ? "#f43f5e"
                                  : "#7dd3fc"
                              }
                              strokeWidth="1"
                              strokeDasharray="4 4"
                              opacity="0.6"
                            />

                            {/* OGGETTO MOBILE: L'ASTEROIDE (Si sposta lungo l'asse X in base alla vicinanza reale) */}
                            <circle
                              cx={metrics.asteroidXPosition}
                              cy="40"
                              r={
                                asteroid.is_potentially_hazardous_asteroid
                                  ? 9
                                  : 6
                              }
                              fill={
                                asteroid.is_potentially_hazardous_asteroid
                                  ? "#f43f5e"
                                  : "#94a3b8"
                              }
                              style={{
                                filter:
                                  asteroid.is_potentially_hazardous_asteroid
                                    ? "drop-shadow(0 0 6px #f43f5e)"
                                    : "drop-shadow(0 0 4px #94a3b8)",
                                transition: "cx 0.5s ease-in-out",
                              }}
                            />
                            <text
                              x={metrics.asteroidXPosition - 20}
                              y="25"
                              fill="#e2e8f0"
                              fontSize="10"
                            >
                              {asteroid.name}
                            </text>
                          </svg>
                        </Box>
                      </Box>

                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "repeat(2, 1fr)",
                          placeItems: "center",
                          width: { sx: "100%", md: "auto" },
                          gap: { xs: 10, sm: 9, md: 3 },
                          minWidth: "160px",
                        }}
                      >
                        <Stack direction="row" spacing={2} alignItems="center">
                          {/* BLOCCO DEL TESTO CON I VALORI NUMERICI NUMERICI */}
                          <Box>
                            <Image
                              src="/meteorite_02.png"
                              alt="Meteorite in corsa"
                              width={100}
                              height={100}
                            />
                            <Typography
                              variant="h6"
                              sx={{
                                fontWeight: "bold",
                                color: "#f59e0b",
                                lineHeight: 1.1,
                                display: "block",
                                textAlign: "center",
                                fontWeight: "bold",
                                fontSize: "1rem",
                                letterSpacing: 0.5,
                              }}
                            >
                              {metrics.currentSpeed.toLocaleString("it-IT")}{" "}
                              Km/h
                            </Typography>
                          </Box>
                        </Stack>

                        <Stack
                          sx={{
                            alignItems: "center",
                            width: { xs: "100%", sm: "140px" },
                          }}
                        >
                          {/* CONTAINER DEL RADAR DI GRANDEZZA */}
                          <Box
                            sx={{
                              width: "100px",
                              height: "100px",
                              background: "rgba(0,0,0,0.4)",
                              border: `1px solid ${nasaTheme.border.primary}`,
                              borderRadius: "50%",
                              position: "relative",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              boxShadow: "inset 0 0 15px rgba(0,0,0,0.6)",
                              mb: 1,
                            }}
                          >
                            {/* Raggi infrarossi fissi del mirino radar (linee a croce sullo sfondo) */}
                            <Box
                              sx={{
                                position: "absolute",
                                width: "100%",
                                height: "1px",
                                background: "rgba(255,255,255,0.05)",
                              }}
                            />
                            <Box
                              sx={{
                                position: "absolute",
                                width: "1px",
                                height: "100%",
                                background: "rgba(255,255,255,0.05)",
                              }}
                            />

                            <svg
                              width="100"
                              height="100"
                              style={{
                                display: "block",
                                position: "absolute",
                              }}
                            >
                              {/* CERCHIO DI RIFERIMENTO FISSO (Scala 100 metri - Grigio/Azzurro opaco) */}
                              <circle
                                cx="50"
                                cy="50"
                                r="20"
                                fill="none"
                                stroke="rgba(56, 189, 248, 0.2)"
                                strokeWidth="1"
                                strokeDasharray="2 2"
                              />

                              {/* Cerchio dinamico proporzionale al diametro del meteorite */}

                              <circle
                                cx="50"
                                cy="50"
                                r={metrics.asteroidRadius}
                                fill={
                                  asteroid.is_potentially_hazardous_asteroid
                                    ? "rgba(244, 63, 94, 0.2)"
                                    : "rgba(125, 211, 252, 0.15)"
                                }
                                stroke={
                                  asteroid.is_potentially_hazardous_asteroid
                                    ? "#f43f5e"
                                    : nasaTheme.text.accent
                                }
                                strokeWidth="1.5"
                                style={{
                                  filter:
                                    asteroid.is_potentially_hazardous_asteroid
                                      ? "drop-shadow(0 0 6px rgba(244, 63, 94, 0.6))"
                                      : "drop-shadow(0 0 6px rgba(125, 211, 252, 0.5))",
                                  transition: "r 0.5s ease-out",
                                }}
                              />

                              {/* Nucleo minuscolo centrale dell'impatto */}
                              <circle cx="50" cy="50" r="2" fill="white" />
                            </svg>
                          </Box>

                          {/* informazione testuale */}
                          <Box sx={{ width: "100%" }}>
                            <Typography
                              variant="caption"
                              sx={{
                                color: nasaTheme.text.secondary,
                                display: "block",
                                textAlign: "center",
                                fontWeight: "bold",
                                fontSize: "0.75rem",
                                letterSpacing: 0.5,
                              }}
                            >
                              DIAMETRO
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                color: nasaTheme.text.accent,
                                display: "block",
                                textAlign: "center",
                                fontWeight: "bold",
                                mt: -0.5,
                              }}
                            >
                              {metrics.maxDiameter} m
                            </Typography>
                          </Box>
                        </Stack>
                      </Box>
                    </Stack>
                  </Stack>
                </CardContent>
              </Stack>

              <Button
                variant="outlined"
                onClick={() => router.push(`/asteroid/${asteroid.id}`)}
                sx={{
                  position: "absolute",
                  right: "20px",
                  bottom: "20px",
                  alignSelf: { xs: "center", sm: "center" },
                  px: 3,
                  color: nasaTheme.border.accent,
                  borderColor: nasaTheme.border.accent,
                  borderRadius: 3,
                  fontWeight: "bold",
                  textTransform: "none",
                  whiteSpace: "nowrap",
                  "&:hover": {
                    borderColor: nasaTheme.text.accent,
                    background: nasaTheme.background.cardHover,
                  },
                }}
              >
                Open File
              </Button>
            </Card>
          );
        })}
      </Stack>
    </Container>
  );
}
