import type { NextConfig } from "next";

// Cabeceras de seguridad. Vercel ya manda HSTS solo; el resto no viene por defecto y son
// cuatro líneas que cierran clases enteras de problema.
//
// Lo que NO está acá, a propósito:
//  - CSP: habría que inventariar cada script inline y cada dominio de terceros (Tiendanube,
//    GA4, Clarity, YouTube) antes de activarla. Mal puesta rompe la tienda en silencio, así
//    que va en su propia pasada y primero en modo Report-Only.
//  - X-Frame-Options DENY: no se puede. El panel muestra la vista previa de widgets dentro
//    de un iframe de nuestro propio sitio (/dashboard/widgets/vista-previa), así que el
//    máximo que se banca es SAMEORIGIN.
const cabeceras = [
  // Impide que el navegador "adivine" el tipo de un archivo. Sin esto, algo subido como
  // imagen —una foto de reseña, por ejemplo— puede terminar interpretado como script.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Nadie puede meter nuestras páginas en un iframe salvo nosotros: es lo que frena el
  // clickjacking sobre el panel.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // No filtrar la URL completa al salir del sitio. Importa porque los links de acceso de los
  // clientes llevan el token EN la URL: sin esto, el primer click a un sitio externo desde
  // esa página se lo regala al destino en el Referer.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // No usamos ninguna de estas APIs. Apagarlas evita que un script de terceros las pida en
  // nuestro nombre y le aparezca al visitante un cartel con nuestro dominio.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: cabeceras }];
  },
};

export default nextConfig;
