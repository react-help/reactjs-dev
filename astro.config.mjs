import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://reactjs.dev",
  output: "static",
  build: { format: "file" },
});
