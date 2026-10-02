import type { Bump } from "./types.ts";

export interface Parsed {
  major: number;
  minor: number;
  patch: number;
  pre: string | null;
}

const RE = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

export function parse(version: string): Parsed | null {
  const m = RE.exec(version);
  if (!m) return null;
  return { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] ?? null };
}

export function isStable(version: string): boolean {
  const p = parse(version);
  return p !== null && p.pre === null;
}

/** Compares stable versions only (prerelease suffixes are ignored). */
export function compare(a: string, b: string): number {
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb) return 0;
  return pa.major - pb.major || pa.minor - pb.minor || pa.patch - pb.patch;
}

/** Classifies `to` relative to `from`. 0.x minors count as major, per semver's caret semantics. */
export function bump(from: string | null | undefined, to: string): Bump | null {
  if (!from) return null;
  const a = parse(from);
  const b = parse(to);
  if (!a || !b) return null;
  if (b.major !== a.major) return "major";
  if (b.minor !== a.minor) return b.major === 0 ? "major" : "minor";
  if (b.patch !== a.patch) return "patch";
  return null;
}
