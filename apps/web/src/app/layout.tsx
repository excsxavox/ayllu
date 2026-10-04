import type { Metadata } from "next";
import { IS_FLOOR_APP } from "@/lib/app-mode";
import "./globals.css";

export const metadata: Metadata = {
  title: IS_FLOOR_APP ? "AYLLU Piso — Reservas del equipo" : "Aylluu WA — Operaciones WhatsApp",
  description: IS_FLOOR_APP
    ? "Acceso, reserva rápida y disponibilidad del lago para el equipo"
    : "Panel multiempresa para conversaciones, catálogo y reservas de WhatsApp",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: IS_FLOOR_APP ? "AYLLU Piso" : "Aylluu WA",
    statusBarStyle: "black-translucent",
  },
  other: {
    google: "notranslate",
  },
};

export const viewport = {
  themeColor: "#102e2c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" translate="no" suppressHydrationWarning className="notranslate">
      <body translate="no" className="notranslate" suppressHydrationWarning style={{ fontFamily: "var(--font-body), 'DM Sans', 'Segoe UI', system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
