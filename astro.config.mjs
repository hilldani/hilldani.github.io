import { defineConfig } from "astro/config";
import { settings } from "./src/data/settings";
import sitemap from "@astrojs/sitemap";
import mdx from "@astrojs/mdx";

// https://astro.build/config
export default defineConfig({
  site: "https://astronaut.github.io",
});
