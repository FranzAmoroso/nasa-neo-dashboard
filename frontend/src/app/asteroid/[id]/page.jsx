"use client";
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation"; 
import { Container, Typography, Button, Card, CardContent, Stack, Box } from "@mui/material";
import { nasaTheme } from "../../theme"; 
import { jsPDF } from "jspdf";

export default function AsteroidDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [asteroid, setAsteroid] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem("nasa_asteroids_cache");
    if (saved) {
      const cache = JSON.parse(saved);
      const found = cache.find((item) => item.id === params.id);
      setAsteroid(found);
    }
  }, [params.id]);

  const exportToPDF = () => {
    if (!asteroid) return;
    const doc = new jsPDF();
    const isHazardous = asteroid.is_potentially_hazardous_asteroid;
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text(`NASA NEO REPORT: ${asteroid.name}`, 15, 20);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`Unique Identifier ID: ${asteroid.id}`, 15, 27);
    doc.text(`Report Generated On: ${new Date().toLocaleDateString()}`, 15, 32);
    
    doc.line(15, 37, 195, 37);
    
    if (isHazardous) {
      doc.setDrawColor(244, 63, 94);
      doc.setTextColor(244, 63, 94);
      doc.rect(140, 45, 50, 18);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("DANGEROUS", 147, 54);
    } else {
      doc.setDrawColor(16, 185, 129);
      doc.setTextColor(16, 185, 129);
      doc.rect(140, 45, 50, 18);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("SAFE SYSTEM", 144, 55);
    }
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("Technical Specifications", 15, 50);
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 50);
    
    const maxDia = Math.round(asteroid.estimated_diameter?.meters?.estimated_diameter_max) || "N/A";
    const minDia = Math.round(asteroid.estimated_diameter?.meters?.estimated_diameter_min) || "N/A";
    doc.text(`- Maximum Estimated Diameter: ${maxDia} meters`, 15, 60);
    doc.text(`- Minimum Estimated Diameter: ${minDia} meters`, 15, 68);
    
    doc.save(`NASA_Report_${asteroid.name.replace(/\s+/g, "_")}.pdf`);
  };

  if (!asteroid) {
    return (
      <Container sx={{ py: 6, textAlign: "center", color: "#ffffff" }}>
        <Typography variant="h5">Asteroid file not found or loading..</Typography>
        <Button variant="contained" sx={{ mt: 3 }} onClick={() => router.push("/")}>Return to Home</Button>
      </Container>
    );
  }

  const isHazardous = asteroid.is_potentially_hazardous_asteroid;

  return (
    <Container maxWidth="md" sx={{ py: 6, minHeight: "100vh", color: nasaTheme.text.primary }}>
      <Button 
        variant="text" 
        onClick={() => router.push("/")} 
        sx={{ color: nasaTheme.text.accent, mb: 4, fontWeight: "bold" }}
      >
        ← return to Dashboard
      </Button>

      <Card
        sx={{
          background: nasaTheme.background.card,
          backdropFilter: "blur(16px)",
          border: `1px solid ${nasaTheme.border.primary}`,
          borderRadius: 6,
          pt: 4,
          pl: 4,
          pr: 4,
          pb: 10, // Aumentato il padding inferiore per non far sovrapporre il testo al bottone assoluto
          boxShadow: nasaTheme.shadow.primary,
          position: "relative", // Rende la card il punto di riferimento per il posizionamento assoluto
          overflow: "hidden"
        }}
      >
        {/* Timbro Digitale di Sicurezza (In alto a destra) */}
        <Box
          sx={{
            position: "absolute",
            top: 24,
            right: 24,
            border: `3px double ${isHazardous ? "#f43f5e" : "#10b981"}`,
            color: isHazardous ? "#f43f5e" : "#10b981",
            padding: "6px 14px",
            borderRadius: 2,
            fontWeight: 900,
            fontSize: "0.85rem",
            letterSpacing: "2px",
            textTransform: "uppercase",
            transform: "rotate(-8deg)",
            boxShadow: `0 0 12px ${isHazardous ? "rgba(244, 63, 94, 0.2)" : "rgba(16, 185, 129, 0.2)"}`,
            background: "rgba(0,0,0,0.4)",
            userSelect: "none",
            zIndex: 10,
            textAlign: "center"
          }}
        >
          <div>{isHazardous ? "⚠️ DANGEROUS" : "✅ SAFE SYSTEM"}</div>
          <div style={{ fontSize: "0.55rem", marginTop: "2px", opacity: 0.8 }}>CLASSIFIED DATA</div>
        </Box>

        <CardContent sx={{ p: 0 }}>
          <Box sx={{ maxWidth: { xs: "100%", sm: "70%" }, mb: 4 }}>
            <Typography variant="h4" sx={{ fontWeight: "bold", mb: 1, color: nasaTheme.text.accent }}>
              Details file: {asteroid.name}
            </Typography>
            <Typography variant="body2" sx={{ color: nasaTheme.text.primary, opacity: 0.7 }}>
              ID unique identifier: {asteroid.id}
            </Typography>
          </Box>

          <Stack spacing={2}>
            <Box sx={{ p: 2, background: "rgba(255,255,255,0.04)", borderRadius: 2, color: nasaTheme.text.primary }}>
              <Typography variant="body1">
                <Box component="span" sx={{ fontWeight: "bold", color: nasaTheme.text.accent }}>Maximum estimated diameter:</Box>{" "}
                {Math.round(asteroid.estimated_diameter?.meters?.estimated_diameter_max)} meter
              </Typography>
            </Box>

            <Box sx={{ p: 2, background: "rgba(255,255,255,0.04)", borderRadius: 2, color: nasaTheme.text.primary }}>
              <Typography variant="body1">
                <Box component="span" sx={{ fontWeight: "bold", color: nasaTheme.text.accent }}>Minimum estimated diameter:</Box>{" "}
                {Math.round(asteroid.estimated_diameter?.meters?.estimated_diameter_min)} meter
              </Typography>
            </Box>

            {asteroid.close_approach_data?.[0] && (
              <>
                <Box sx={{ p: 2, background: "rgba(255,255,255,0.04)", borderRadius: 2, color: nasaTheme.text.primary }}>
                  <Typography variant="body1">
                    <Box component="span" sx={{ fontWeight: "bold", color: nasaTheme.text.accent }}>Date of closest approach to Earth:</Box>{" "}
                    {asteroid.close_approach_data[0].close_approach_date_full || asteroid.close_approach_data[0].close_approach_date}
                  </Typography>
                </Box>

                <Box sx={{ p: 2, background: "rgba(255,255,255,0.04)", borderRadius: 2, color: nasaTheme.text.primary }}>
                  <Typography variant="body1">
                    <Box component="span" sx={{ fontWeight: "bold", color: nasaTheme.text.accent }}>Relative velocity of the object:</Box>{" "}
                    {Math.round(asteroid.close_approach_data[0].relative_velocity?.kilometers_per_hour)} km/h
                  </Typography>
                </Box>

                <Box sx={{ p: 2, background: "rgba(255,255,255,0.04)", borderRadius: 2, color: nasaTheme.text.primary }}>
                  <Typography variant="body1">
                    <Box component="span" sx={{ fontWeight: "bold", color: nasaTheme.text.accent }}>Minimum distance from Earth:</Box>{" "}
                    {Math.round(asteroid.close_approach_data[0].miss_distance?.kilometers)} km
                  </Typography>
                </Box>

                <Box sx={{ p: 2, background: "rgba(255,255,255,0.04)", borderRadius: 2, color: nasaTheme.text.primary }}>
                  <Typography variant="body1">
                    <Box component="span" sx={{ fontWeight: "bold", color: nasaTheme.text.accent }}>Orbiting celestial body locked:</Box>{" "}
                    {asteroid.close_approach_data[0].orbiting_body}
                  </Typography>
                </Box>
              </>
            )}
          </Stack>
        </CardContent>

        {/* Pulsante Esporta PDF (In basso a destra dentro la Card) */}
        <Button 
          variant="contained" 
          onClick={exportToPDF}
          sx={{ 
            position: "absolute",
            right: "24px",
            bottom: "24px",
            background: nasaTheme.button.primary,
            fontWeight: "bold",
            borderRadius: 2,
            boxShadow: nasaTheme.shadow.glowBlue,
            zIndex: 10,
            "&:hover": { background: nasaTheme.button.hover }
          }}
        >
          🖨️ Export Official PDF
        </Button>
      </Card>
    </Container>
  );
}
