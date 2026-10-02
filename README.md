# reactjs.dev

Independent, auto-updating release tracker for the React ecosystem. Not affiliated with the React Foundation.

**[reactjs.dev](https://reactjs.dev)** shows the current release state of the React ecosystem on one page: latest versions, canary and experimental channels, prereleases, weekly downloads and links to release notes for 30 packages, refreshed every six hours.

> This is an independent community project. It is not affiliated with, endorsed by, or connected to the React Foundation. For React's documentation, go to [react.dev](https://react.dev).

No accounts, ads, sponsors, newsletter or tracking cookies. Analytics are cookie-free (Cloudflare Web Analytics).

## Public data

| URL | What |
| --- | --- |
| [`/releases.json`](https://reactjs.dev/releases.json) | Everything the page shows, as JSON (CORS enabled). Shape: [`src/lib/types.ts`](src/lib/types.ts). |
| [`/feed.xml`](https://reactjs.dev/feed.xml) | RSS feed of the 50 newest stable releases across all tracked packages. |

## How it works

```
GitHub Actions (every 6 h)            Netlify (on every push to main)
  node scripts/fetch.ts                 npm run build
    ├─ npm registry  (dist-tags, publish times)   reads data/releases.json only
    ├─ npm downloads (last-week counts)            → static HTML, /releases.json, /feed.xml
    └─ GitHub API    (release-notes links)
  → data/releases.json
  → commit "data: refresh releases" if it changed ──push──▶
```

- **`scripts/fetch.ts`** pulls from:
  - `https://registry.npmjs.org/<pkg>`: dist-tags (`latest`, `next`, `canary`, `experimental`, `rc`, `beta`, `alpha`) and the `time` map.
  - `https://api.npmjs.org/downloads/point/last-week/<pkg>`: unscoped packages in one bulk request, scoped ones individually.
  - The GitHub Releases API, for a release-notes link. If there's no GitHub release, it falls back to the configured changelog, then the tag page, then the repo's releases list, then the npm versions page.
- **It's resilient.** If any source fails for a package, that package keeps its last-good data and a warning is logged. The script never exits non-zero because an API is down.
- **It's deterministic.** `updatedAt` only changes when the data changes, and the file is only rewritten (and committed) when something actually changed.
- **The site build never fetches.** Netlify builds from the committed `data/releases.json`, so deploys don't depend on third-party APIs.

## Adding a package

Edit [`packages.config.ts`](packages.config.ts) and add an entry to a group:

```ts
{ name: "some-package", repo: "owner/repo" }
```

Optional fields:

- `tag`: the GitHub release tag template. Use `{version}` for the version. The default is `v{version}`, so monorepos usually need something like `"@scope/pkg@{version}"`. Set it to `null` if the repo has no per-package tags.
- `changelog`: a path to a changelog in the repo, used when there's no GitHub release.

Then run `npm run fetch` and check the new entry in `data/releases.json`.

## Running locally

Requires Node 22.18 or newer, which runs TypeScript directly.

```bash
npm install
npm run fetch      # optional: refreshes data/releases.json (GITHUB_TOKEN optional)
npm run dev        # http://localhost:4321
npm run build      # static output in dist/
```

`npm run fetch && npm run build` works from a clean clone with no secrets. Without `GITHUB_TOKEN`, GitHub allows 60 API requests per hour, which is enough for a normal run.

## Scheduled refresh

[`.github/workflows/refresh.yml`](.github/workflows/refresh.yml) runs every six hours (at minute 17) and can also be started by hand from the Actions tab. It runs the fetch with the workflow's built-in `GITHUB_TOKEN`, then commits `data/releases.json` as `data: refresh releases` if the file changed. That push triggers Netlify's normal deploy; no build hook is needed.

The workflow needs `contents: write`, which it requests itself. If `main` is branch-protected, `github-actions[bot]` must be allowed to push.

## Secrets and environment variables

| Name | Where | Required | Purpose |
| --- | --- | --- | --- |
| `GITHUB_TOKEN` | GitHub Actions (automatic) / local shell | No | Raises the GitHub API rate limit for the fetch. |
| `PUBLIC_CF_BEACON_TOKEN` | Netlify environment variables | No | Cloudflare Web Analytics token. When it's unset (e.g. local builds), no analytics snippet is included. |

No other secrets are used.

## Regenerating the social image and icon

`public/og.png` and `public/apple-touch-icon.png` are rendered from the HTML in [`scripts/og/`](scripts/og) with a local Chrome: `./scripts/og/render.sh`. This isn't part of the build.

## Contributing

Missing a package the React community relies on? Open a PR adding it to [`packages.config.ts`](packages.config.ts). Bug reports and design fixes are welcome too.

## Licence

[MIT](LICENSE)
