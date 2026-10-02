import type { APIRoute } from "astro";
import data from "../../data/releases.json";

/** Public copy of data/releases.json. Headers are set in netlify.toml. */
export const GET: APIRoute = () =>
  new Response(JSON.stringify(data, null, 2) + "\n", {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
