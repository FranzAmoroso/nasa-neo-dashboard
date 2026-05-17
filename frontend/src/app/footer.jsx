"use client";
import React from "react";
import { Box, Typography, Link, Divider } from "@mui/material";
import GitHubIcon from "@mui/icons-material/GitHub";
import { nasaTheme } from "./theme"; 

export default function Footer() {
  return (
    <Box 
      component="footer" 
      sx={{ 
        mt: "auto", 
        background: "rgba(0, 0, 0, 0.4)",
        backdropFilter: "blur(8px)",
        width: "100%",
        boxSizing: "border-box"
      }}
    >
      <Divider 
        sx={{ 
          borderColor: "transparent",
          background: `linear-gradient(90deg, transparent 0%, ${nasaTheme.border.accent} 50%, transparent 100%)`,
          height: "1px",
          boxShadow: "0 0 10px rgba(56,189,248,0.5)"
        }} 
      />

      <Box 
        sx={{ 
          display: "flex",
          flexDirection: { xs: "column", sm: "row" }, 
          justifyContent: { xs: "center", sm: "space-between" }, 
          alignItems: "center",
          padding: { xs: "24px 16px", sm: "24px 40px" }, 
          gap: { xs: 3, sm: 0 }, 
          width: "100%",
          boxSizing: "border-box"
        }}
      >
        
        <Box sx={{ textAlign: { xs: "center", sm: "left" } }}>
          <Typography variant="body2" sx={{ color: nasaTheme.text.primary, fontWeight: "bold" }}>
            Built by Franz Amoroso © 2026
          </Typography>
          <Typography variant="caption" sx={{ color: nasaTheme.text.secondary, display: "block", mt: 0.5 }}>
            Data provided by NASA's NeoWs API
          </Typography>
        </Box>


        <Link 
          href="https://github.com" 
          target="_blank" 
          rel="noopener noreferrer"
          sx={{ 
            display: "flex", 
            alignItems: "center", 
            gap: 1, 
            color: nasaTheme.text.primary, 
            textDecoration: "none",
            fontWeight: "bold",
            fontSize: "0.95rem",
            padding: "8px 16px",
            borderRadius: 2,
            border: `1px solid ${nasaTheme.border.primary}`,
            background: "rgba(255,255,255,0.02)",
            transition: "all 0.2s ease-in-out",
            "&:hover": {
              color: nasaTheme.text.accent,
              borderColor: nasaTheme.border.accent,
              background: "rgba(56,189,248,0.05)",
              boxShadow: nasaTheme.shadow.glowBlue
            }
          }}
        >
          <GitHubIcon sx={{ fontSize: 20 }} />
          View on GitHub
        </Link>

      </Box>
    </Box>
  );
}
