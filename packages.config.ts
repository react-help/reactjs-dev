/**
 * The packages this site tracks. To add one, append an entry to a group.
 *
 * - `repo`: GitHub `owner/name` used for release notes.
 * - `tag`: release tag template; `{version}` is replaced. Defaults to `v{version}`.
 *   Set to `null` when the repo publishes no per-package tags or releases.
 * - `changelog`: path to a changelog in `repo`, used when no GitHub release exists.
 *
 * Release-notes lookup order: GitHub release for `tag` → `changelog` → tag page
 * → the repo's releases list → the npm page.
 */
export interface PackageConfig {
  name: string;
  repo: string | null;
  tag?: string | null;
  changelog?: string;
}

export interface GroupConfig {
  id: string;
  name: string;
  packages: PackageConfig[];
}

export const groups: GroupConfig[] = [
  {
    id: "core",
    name: "Core",
    packages: [
      { name: "react", repo: "react/react" },
      { name: "react-dom", repo: "react/react" },
      { name: "react-native", repo: "react/react-native" },
      { name: "@types/react", repo: "DefinitelyTyped/DefinitelyTyped", tag: null },
    ],
  },
  {
    id: "frameworks",
    name: "Frameworks",
    packages: [
      { name: "next", repo: "vercel/next.js" },
      { name: "expo", repo: "expo/expo", tag: "expo@{version}", changelog: "packages/expo/CHANGELOG.md" },
      { name: "astro", repo: "withastro/astro", tag: "astro@{version}", changelog: "packages/astro/CHANGELOG.md" },
      { name: "vite", repo: "vitejs/vite", changelog: "packages/vite/CHANGELOG.md" },
    ],
  },
  {
    id: "routing-data",
    name: "Routing & data",
    packages: [
      { name: "react-router", repo: "remix-run/react-router", tag: "react-router@{version}" },
      { name: "@tanstack/react-query", repo: "TanStack/query", tag: "@tanstack/react-query@{version}" },
      { name: "@tanstack/react-router", repo: "TanStack/router", tag: "@tanstack/react-router@{version}" },
      { name: "swr", repo: "vercel/swr" },
      { name: "@apollo/client", repo: "apollographql/apollo-client", tag: "@apollo/client@{version}", changelog: "CHANGELOG.md" },
    ],
  },
  {
    id: "state",
    name: "State",
    packages: [
      { name: "zustand", repo: "pmndrs/zustand" },
      { name: "@reduxjs/toolkit", repo: "reduxjs/redux-toolkit" },
      { name: "jotai", repo: "pmndrs/jotai" },
      { name: "valtio", repo: "pmndrs/valtio" },
    ],
  },
  {
    id: "forms-ui",
    name: "Forms & UI",
    packages: [
      { name: "react-hook-form", repo: "react-hook-form/react-hook-form" },
      { name: "motion", repo: "motiondivision/motion", changelog: "CHANGELOG.md" },
      { name: "@radix-ui/react-dialog", repo: "radix-ui/primitives", tag: null, changelog: "packages/react/dialog/CHANGELOG.md" },
      { name: "@mui/material", repo: "mui/material-ui", changelog: "CHANGELOG.md" },
    ],
  },
  {
    id: "native",
    name: "Native",
    packages: [
      { name: "@react-navigation/native", repo: "react-navigation/react-navigation", tag: "@react-navigation/native@{version}" },
      { name: "react-native-reanimated", repo: "software-mansion/react-native-reanimated", tag: "{version}" },
      { name: "react-native-gesture-handler", repo: "software-mansion/react-native-gesture-handler" },
      { name: "react-native-screens", repo: "software-mansion/react-native-screens", tag: "{version}" },
    ],
  },
  {
    id: "tooling",
    name: "Tooling",
    packages: [
      { name: "babel-plugin-react-compiler", repo: "react/react", tag: null, changelog: "compiler/CHANGELOG.md" },
      { name: "eslint-plugin-react-hooks", repo: "react/react", tag: null, changelog: "packages/eslint-plugin-react-hooks/CHANGELOG.md" },
      { name: "@vitejs/plugin-react", repo: "vitejs/vite-plugin-react", tag: "plugin-react@{version}" },
      { name: "react-devtools", repo: "react/react", tag: null, changelog: "packages/react-devtools/CHANGELOG.md" },
      { name: "@testing-library/react", repo: "testing-library/react-testing-library" },
    ],
  },
];

/** Prerelease dist-tags worth showing. Everything else (e.g. `0.80-stable`, `next--foo`) is ignored. */
export const PRERELEASE_TAGS = ["next", "canary", "experimental", "rc", "beta", "alpha"] as const;

/** Packages whose latest/canary/experimental tags appear in the top strip. */
export const CANARY_STRIP = ["react", "react-dom"];
export const CANARY_STRIP_TAGS = ["latest", "canary", "experimental"];
