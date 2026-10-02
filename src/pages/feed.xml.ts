import type { APIRoute } from "astro";
import data from "../../data/releases.json";
import type { ReleasesFile } from "../lib/types.ts";

/** RSS 2.0 feed of the latest stable releases across all tracked packages, newest first. */
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rfc822 = (iso: string | null) => new Date(iso ?? 0).toUTCString();

export const GET: APIRoute = ({ site }) => {
  const releases = data as ReleasesFile;
  const base = site!.toString().replace(/\/$/, "");
  const groupName = new Map(releases.groups.map((g) => [g.id, g.name]));

  const items = releases.recent
    .map((r) => {
      const kind = r.bump ? `${r.bump[0].toUpperCase()}${r.bump.slice(1)} release` : "Release";
      return `    <item>
      <title>${esc(`${r.name} ${r.version}`)}</title>
      <link>${esc(r.url)}</link>
      <guid isPermaLink="false">${esc(`${r.name}@${r.version}`)}</guid>
      <pubDate>${rfc822(r.publishedAt)}</pubDate>
      <category>${esc(groupName.get(r.group) ?? r.group)}</category>
      <description>${esc(`${kind} of ${r.name}: ${r.version}.`)}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>React ecosystem releases</title>
    <link>${base}/</link>
    <description>New stable releases across the React ecosystem, from reactjs.dev, an independent release tracker. Not affiliated with the React Foundation.</description>
    <language>en</language>
    <lastBuildDate>${rfc822(releases.updatedAt)}</lastBuildDate>
    <ttl>360</ttl>
    <atom:link href="${base}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8" } });
};
