/**
 * Pulls release data from npm and GitHub and writes data/releases.json.
 *
 * Resilient by design: if any source fails for a package, that package keeps its
 * last-good data and a warning is logged. The script never exits non-zero because
 * a third-party API is down.
 *
 * Usage: node scripts/fetch.ts   (GITHUB_TOKEN optional; raises GitHub's rate limit)
 */
import { readFile, writeFile } from "node:fs/promises";
import { groups, PRERELEASE_TAGS, type PackageConfig } from "../packages.config.ts";
import { bump, compare, isStable } from "../src/lib/semver.ts";
import type {
  PackageData,
  Prerelease,
  RecentRelease,
  ReleasesFile,
  VersionInfo,
} from "../src/lib/types.ts";

const OUT = new URL("../data/releases.json", import.meta.url);
const RECENT_LIMIT = 50;
const CONCURRENCY = 6;
const TIMEOUT_MS = 30_000;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const UA = "reactjs.dev release tracker (+https://github.com/react-help/reactjs-dev)";

// ---------- logging ----------

const inActions = !!process.env.GITHUB_ACTIONS;
let warnings = 0;
function warn(msg: string) {
  warnings++;
  console.warn(inActions ? `::warning::${msg}` : `warn: ${msg}`);
}

// ---------- http ----------

class HttpError extends Error {
  status: number;
  constructor(status: number, url: string) {
    super(`HTTP ${status} for ${url}`);
    this.status = status;
  }
}

async function getJson<T>(url: string, headers: Record<string, string> = {}, retries = 2): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": UA, accept: "application/json", ...headers },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.ok) return (await res.json()) as T;
      // Retry server errors and rate limits; other 4xx won't get better.
      const retryable = res.status >= 500 || res.status === 429;
      if (!retryable || attempt >= retries) throw new HttpError(res.status, url);
      const after = Number(res.headers.get("retry-after"));
      if (after > 0) await new Promise((r) => setTimeout(r, Math.min(after, 60) * 1000));
    } catch (err) {
      if (err instanceof HttpError || attempt >= retries) throw err;
    }
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
  }
}

const npmPath = (name: string) => name.replace("/", "%2F");

// ---------- npm ----------

interface Packument {
  "dist-tags": Record<string, string>;
  time: Record<string, string>;
  versions: Record<string, { deprecated?: string }>;
}

async function fetchPackument(name: string) {
  return getJson<Packument>(`https://registry.npmjs.org/${npmPath(name)}`);
}

/**
 * Weekly downloads for every package. The npm downloads API rate-limits bursts, so
 * unscoped packages go in one bulk request; scoped ones (not supported in bulk) go
 * one at a time. Missing entries mean "keep the last value".
 */
async function fetchAllDownloads(names: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const base = "https://api.npmjs.org/downloads/point/last-week/";
  const unscoped = names.filter((n) => !n.startsWith("@"));
  try {
    const bulk = await getJson<Record<string, { downloads: number } | null>>(base + unscoped.join(","), {}, 3);
    for (const [name, r] of Object.entries(bulk)) if (r) out.set(name, r.downloads);
  } catch (err) {
    warn(`bulk downloads unavailable (${(err as Error).message}); keeping last values`);
  }
  for (const name of names.filter((n) => n.startsWith("@"))) {
    try {
      out.set(name, (await getJson<{ downloads: number }>(base + name, {}, 3)).downloads);
    } catch (err) {
      warn(`${name}: downloads unavailable (${(err as Error).message}); keeping last value`);
    }
  }
  return out;
}

/** Stable, non-deprecated versions with publish times, newest publish first. */
function stableVersions(p: Packument): VersionInfo[] {
  return Object.keys(p.versions)
    .filter((v) => isStable(v) && !p.versions[v].deprecated && p.time[v])
    .map((v) => ({ version: v, publishedAt: p.time[v] }))
    .sort((a, b) => b.publishedAt!.localeCompare(a.publishedAt!));
}

// ---------- GitHub ----------

let githubRateLimited = false;

async function github<T>(path: string): Promise<T> {
  if (githubRateLimited) throw new Error("GitHub rate limit reached earlier in this run");
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
  };
  if (GITHUB_TOKEN) headers.authorization = `Bearer ${GITHUB_TOKEN}`;
  try {
    return await getJson<T>(`https://api.github.com/${path}`, headers, 1);
  } catch (err) {
    if (err instanceof HttpError && (err.status === 403 || err.status === 429)) {
      githubRateLimited = true;
      warn(`GitHub rate limit hit${GITHUB_TOKEN ? "" : " (set GITHUB_TOKEN to raise it)"}; using fallbacks`);
    }
    throw err;
  }
}

const notFound = (err: unknown) => err instanceof HttpError && err.status === 404;

function staticNotes(cfg: PackageConfig): PackageData["releaseNotes"] {
  if (cfg.repo && cfg.changelog)
    return { kind: "changelog", url: `https://github.com/${cfg.repo}/blob/HEAD/${cfg.changelog}` };
  if (cfg.repo && cfg.tag !== null) return { kind: "releases", url: `https://github.com/${cfg.repo}/releases` };
  return { kind: "npm", url: `https://www.npmjs.com/package/${cfg.name}?activeTab=versions` };
}

/** Order: GitHub release → changelog → tag page → releases list → npm. */
async function resolveReleaseNotes(
  cfg: PackageConfig,
  version: string,
  prev: PackageData | undefined,
): Promise<PackageData["releaseNotes"]> {
  // A resolved release for the same version never changes; skip the API.
  if (prev?.latest.version === version && prev.releaseNotes.kind === "release") return prev.releaseNotes;

  const fallback = staticNotes(cfg);
  if (!cfg.repo || cfg.tag === null) return fallback;

  const tag = (cfg.tag ?? "v{version}").replace("{version}", version);
  const encTag = encodeURIComponent(tag);
  try {
    const rel = await github<{ html_url: string }>(`repos/${cfg.repo}/releases/tags/${encTag}`);
    return { kind: "release", url: rel.html_url };
  } catch (err) {
    if (!notFound(err)) {
      warn(`${cfg.name}: GitHub release lookup failed (${(err as Error).message})`);
      return prev?.latest.version === version ? prev.releaseNotes : fallback;
    }
  }
  if (cfg.changelog) return fallback;
  try {
    await github(`repos/${cfg.repo}/git/ref/tags/${encTag}`);
    return { kind: "tag", url: `https://github.com/${cfg.repo}/releases/tag/${encTag}` };
  } catch (err) {
    if (!notFound(err)) warn(`${cfg.name}: GitHub tag lookup failed (${(err as Error).message})`);
    return fallback;
  }
}

// ---------- per package ----------

interface Fetched {
  data: PackageData;
  /** Stable versions at or below `latest`, for the RSS feed. */
  history: VersionInfo[];
}

async function fetchPackage(
  cfg: PackageConfig,
  group: string,
  prev: PackageData | undefined,
  downloads: number | undefined,
): Promise<Fetched> {
  const p = await fetchPackument(cfg.name);

  const at = (v: string): VersionInfo => ({ version: v, publishedAt: p.time[v] ?? null });
  const latestVersion = p["dist-tags"].latest;
  if (!latestVersion) throw new Error("no `latest` dist-tag");
  const latest = at(latestVersion);

  const distTags: Record<string, VersionInfo> = { latest };
  for (const tag of PRERELEASE_TAGS) {
    const v = p["dist-tags"][tag];
    if (v) distTags[tag] = at(v);
  }

  // Prereleases worth showing: published after latest, grouped by version.
  const byVersion = new Map<string, Prerelease>();
  for (const tag of PRERELEASE_TAGS) {
    const info = distTags[tag];
    if (!info || info.version === latestVersion) continue;
    if (latest.publishedAt && info.publishedAt && info.publishedAt <= latest.publishedAt) continue;
    const entry = byVersion.get(info.version) ?? { ...info, tags: [] };
    entry.tags.push(tag);
    byVersion.set(info.version, entry);
  }
  const prereleases = [...byVersion.values()].sort((a, b) =>
    (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""),
  );

  // Stable-looking versions above `latest` (e.g. Expo's next SDK on the `next`
  // tag) haven't been promoted yet, so they're not stable releases for our purposes.
  const history = stableVersions(p).filter((h) => compare(h.version, latestVersion) <= 0);
  const below = history
    .filter((h) => compare(h.version, latestVersion) < 0)
    .sort((a, b) => compare(b.version, a.version));
  const previous = below[0] ?? null;

  return {
    data: {
      name: cfg.name,
      group,
      npmUrl: `https://www.npmjs.com/package/${cfg.name}`,
      repoUrl: cfg.repo ? `https://github.com/${cfg.repo}` : null,
      latest,
      previous,
      bump: bump(previous?.version, latestVersion),
      prereleases,
      distTags,
      weeklyDownloads: downloads ?? prev?.weeklyDownloads ?? null,
      releaseNotes: await resolveReleaseNotes(cfg, latestVersion, prev),
    },
    history,
  };
}

// ---------- main ----------

async function readPrevious(): Promise<ReleasesFile | null> {
  try {
    return JSON.parse(await readFile(OUT, "utf8")) as ReleasesFile;
  } catch {
    return null;
  }
}

async function pool<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return out;
}

function recentFrom(previous: ReleasesFile | null, fetched: Map<string, Fetched>, packages: Record<string, PackageData>) {
  const all: RecentRelease[] = [];
  for (const [name, pkg] of Object.entries(packages)) {
    const f = fetched.get(name);
    if (!f) {
      // Package failed this run: carry over its previous feed entries.
      all.push(...(previous?.recent.filter((r) => r.name === name) ?? []));
      continue;
    }
    const sorted = [...f.history].sort((a, b) => compare(a.version, b.version));
    const prevOf = new Map(sorted.map((h, i) => [h.version, sorted[i - 1]?.version]));
    for (const h of f.history.slice(0, RECENT_LIMIT)) {
      all.push({
        name,
        group: pkg.group,
        version: h.version,
        publishedAt: h.publishedAt,
        bump: bump(prevOf.get(h.version), h.version),
        url:
          h.version === pkg.latest.version
            ? pkg.releaseNotes.url
            : `https://www.npmjs.com/package/${name}/v/${h.version}`,
      });
    }
  }
  return all
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "") || a.name.localeCompare(b.name))
    .slice(0, RECENT_LIMIT);
}

/** Everything except `updatedAt`, for change detection. */
const fingerprint = (f: ReleasesFile) => JSON.stringify({ ...f, updatedAt: undefined });

async function main() {
  const previous = await readPrevious();
  const jobs = groups.flatMap((g) => g.packages.map((cfg) => ({ cfg, group: g.id })));
  const downloads = await fetchAllDownloads(jobs.map((j) => j.cfg.name));

  const results = await pool(jobs, async ({ cfg, group }) => {
    const prev = previous?.packages[cfg.name];
    try {
      return { name: cfg.name, fetched: await fetchPackage(cfg, group, prev, downloads.get(cfg.name)), data: undefined };
    } catch (err) {
      if (prev) warn(`${cfg.name}: fetch failed (${(err as Error).message}); keeping last-good data`);
      else warn(`${cfg.name}: fetch failed (${(err as Error).message}) and no previous data; omitting`);
      return { name: cfg.name, fetched: undefined, data: prev ? { ...prev, group } : undefined };
    }
  });

  const packages: Record<string, PackageData> = {};
  const fetched = new Map<string, Fetched>();
  for (const r of results) {
    const data = r.fetched?.data ?? r.data;
    if (!data) continue;
    packages[r.name] = data;
    if (r.fetched) fetched.set(r.name, r.fetched);
  }

  const next: ReleasesFile = {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    sources: ["https://registry.npmjs.org", "https://api.npmjs.org/downloads", "https://api.github.com"],
    groups: groups.map((g) => ({ id: g.id, name: g.name, packages: g.packages.map((p) => p.name).filter((n) => n in packages) })),
    packages,
    recent: recentFrom(previous, fetched, packages),
  };

  if (previous && fingerprint(previous) === fingerprint(next)) {
    console.log(`No changes (${fetched.size}/${jobs.length} packages fetched, ${warnings} warnings).`);
    return;
  }
  await writeFile(OUT, JSON.stringify(next, null, 2) + "\n");
  console.log(`Wrote data/releases.json (${fetched.size}/${jobs.length} packages fetched, ${warnings} warnings).`);
}

main().catch((err) => {
  // Unexpected bug, not an API outage. Log it but don't fail the workflow;
  // the previous data file stays in place.
  warn(`fetch aborted: ${(err as Error).stack ?? err}`);
});
