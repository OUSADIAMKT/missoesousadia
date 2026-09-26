import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Missões da Ousadia — Central de Operações",
    short_name: "Missões Ousadia",
    description:
      "Central de operações da Ousadia Marketing: o que fazer agora, por cliente e projeto.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f0e8",
    theme_color: "#0d0d0d",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
