import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Next Inventory",
    short_name: "Next Inventory",
    description: "Internal inventory management portal for Next Trading.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#7CCBE6",
    theme_color: "#7CCBE6",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
