import type { Metadata } from "next";
import { Manrope, DM_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { MARCA } from "@/lib/marca";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

// Títulos editoriales — misma serif que el store y las guías (sistema de diseño 23/07).
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  display: "swap",
});

// El título sale de la marca de la instancia: el mismo repo sirve varios paneles y la
// pestaña del navegador no puede decir "Micelium" en la tienda de otro.
export const metadata: Metadata = {
  title: MARCA.clave === 'micelium' ? "Motor WhatsApp — Micelium" : `Panel — ${MARCA.nombre}`,
  description: MARCA.subtitulo,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${manrope.variable} ${dmMono.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
