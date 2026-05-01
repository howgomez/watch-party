import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "WatchParty — Mira videos con amigos en tiempo real",
  description: "Crea una sala, comparte el código y disfruta videos sincronizados con tus amigos. Chat en vivo incluido.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <html lang="es">
      <body className={`${inter.className} min-h-screen bg-bg-primary text-text-primary antialiased`}>
        {children}
      </body>
    </html>
  );
}
