import { parse } from "./semver.ts";
import type { Bump } from "./types.ts";

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function isNew(iso: string | null, now = Date.now()): boolean {
  return !!iso && now - Date.parse(iso) < WEEK_MS;
}

/** 214361643 → "214.4M". */
export function compactNumber(n: number | null): string {
  if (n === null) return "–";
  const units: [number, string][] = [[1e9, "B"], [1e6, "M"], [1e3, "k"]];
  for (const [size, suffix] of units) {
    if (n >= size) {
      const v = n / size;
      return (v >= 100 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, "")) + suffix;
    }
  }
  return String(n);
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];
const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "3 days ago", "yesterday", "just now". */
export function relativeTime(iso: string | null, now = Date.now()): string {
  if (!iso) return "–";
  const secs = (Date.parse(iso) - now) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(secs) >= size) return rtf.format(Math.round(secs / size), unit);
  }
  return "just now";
}

const abs = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

/** "Sep 9, 2026, 5:21 PM UTC". The client rewrites this in the viewer's time zone. */
export function absoluteTime(iso: string | null): string {
  return iso ? `${abs.format(new Date(iso))} UTC` : "unknown";
}

export interface VersionPart {
  text: string;
  changed: boolean;
}

/**
 * Splits a version so the segments that changed since `previous` can be styled:
 * 19.2.8 → 19.3.0 gives [{19.}, {3.0, changed}].
 */
export function versionParts(version: string, previous: string | null | undefined, bump: Bump | null): VersionPart[] {
  const p = parse(version);
  if (!p || !previous || !bump) return [{ text: version, changed: false }];
  const segs = [String(p.major), String(p.minor), String(p.patch)];
  const from = bump === "major" ? (p.major === 0 ? 1 : 0) : bump === "minor" ? 1 : 2;
  const head = segs.slice(0, from).map((s) => s + ".").join("");
  const tail = segs.slice(from).join(".") + (p.pre ? `-${p.pre}` : "");
  return [
    ...(head ? [{ text: head, changed: false }] : []),
    { text: tail, changed: true },
  ];
}

export const NOTES_LABEL = {
  release: "Release notes",
  changelog: "Changelog",
  tag: "Tag",
  releases: "Releases",
  npm: "npm versions",
} as const;
