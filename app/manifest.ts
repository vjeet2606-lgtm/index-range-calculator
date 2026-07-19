import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LYNX ONE — Trading Terminal",
    short_name: "LYNX ONE",
    description:
      "Calculate the expected trading range for NIFTY, BANKNIFTY, FINNIFTY, SENSEX, and stock options.",
    start_url: "/",
    display: "standalone",
    background_color: "#07090D",
    theme_color: "#07090D",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
