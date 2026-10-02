/** Shape of data/releases.json, also served publicly at /releases.json. */

export type Bump = "major" | "minor" | "patch";

export interface VersionInfo {
  version: string;
  /** ISO timestamp from the npm `time` map, or null if npm doesn't report one. */
  publishedAt: string | null;
}

export interface Prerelease extends VersionInfo {
  /** Dist-tags pointing at this version, e.g. ["canary", "next"]. */
  tags: string[];
}

export type ReleaseNotesKind = "release" | "changelog" | "tag" | "releases" | "npm";

export interface PackageData {
  name: string;
  group: string;
  npmUrl: string;
  repoUrl: string | null;
  latest: VersionInfo;
  /** Highest stable version below `latest`, used to classify the bump. */
  previous: VersionInfo | null;
  bump: Bump | null;
  /** Prerelease dist-tags published after `latest`. Stale tags are omitted. */
  prereleases: Prerelease[];
  /** `latest` plus every tracked prerelease dist-tag, stale or not. */
  distTags: Record<string, VersionInfo>;
  weeklyDownloads: number | null;
  releaseNotes: { url: string; kind: ReleaseNotesKind };
}

export interface RecentRelease extends VersionInfo {
  name: string;
  group: string;
  bump: Bump | null;
  url: string;
}

export interface Group {
  id: string;
  name: string;
  packages: string[];
}

export interface ReleasesFile {
  schemaVersion: 1;
  /** When the data last changed (not when the fetch last ran). */
  updatedAt: string;
  sources: string[];
  groups: Group[];
  packages: Record<string, PackageData>;
  /** Latest stable releases across all packages, newest first. Feeds /feed.xml. */
  recent: RecentRelease[];
}
