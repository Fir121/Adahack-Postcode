import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Our Patch",
    short_name: "Our Patch",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f8f2",
    theme_color: "#E30027",
    icons: [
      {
        src: "/brand/icon.png",
        sizes: "640x640",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
