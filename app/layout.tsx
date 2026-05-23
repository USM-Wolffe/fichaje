import type { Metadata, Viewport } from "next";
import AccessKeyGate from "@/components/AccessKeyGate";
import "./globals.css";

export const metadata: Metadata = {
  title: "FichaScan",
  description: "Digitaliza fichas de contacto Admisión USM",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Fichaje",
  },
  icons: {
    apple: "/icons/icon-192x192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <AccessKeyGate>{children}</AccessKeyGate>
      </body>
    </html>
  );
}
