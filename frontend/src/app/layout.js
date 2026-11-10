import { Archivo } from "next/font/google";
import "./globals.css";

// Archivo con asse di larghezza: stretto per i dati, largo per i titoli.
const archivo = Archivo({ variable: "--font-ui-face", subsets: ["latin"], axes: ["wdth"] });

export const metadata = {
  title: "NASA NEO Dashboard",
  description:
    "Near-Earth asteroids in 3D: upcoming close approaches, their classification and the ones that already passed, from NASA NeoWs data.",
};

export const viewport = { themeColor: "#03050a", viewportFit: "cover" };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={archivo.variable}>
      <body>{children}</body>
    </html>
  );
}
