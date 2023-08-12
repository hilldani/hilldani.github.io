import { defineConfig } from "astro/config";
import partytown from "@astrojs/partytown";

export default defineConfig({
  site: "https://astronaut.github.io",
  integrations: [
    partytown({
      config: {
        forward: ["dataLayer.push"],
      },
    }),
  ],
});
