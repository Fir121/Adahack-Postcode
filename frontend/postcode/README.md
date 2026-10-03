# PL Green Together

An independent sustainability hackathon frontend. Understand your postcode's environmental indicators, choose a relevant action, submit task-specific proof, and watch community progress grow.

## Run locally

From `frontend/postcode`:

```sh
pnpm install
cp .env.example .env.local
pnpm dev
```

Open http://localhost:3000. Click **Try the demo**, or sign up with a supported postcode.

Demo account: `demo@greentogether.test` / `GreenTogether!`.

Supported demo postcodes: **EH3 9GD**, **EH3 9FG**, **EH8 9LJ**. All are explorable; actions contribute only to your account's community.

## Demo journey

1. Sign in or create an account. The map focuses on your postcode.
2. Read the separate community Green Score and environmental indicators.
3. Select an indicator to see source/context, related activity, and actions.
4. Open the recommended action or browse all actions.
5. Submit declaration, text, photo, or combined proof as required by that task.
6. Activity and gamified score increase; an SVG decoration appears on the map. Environmental measurements stay unchanged.
7. View completion history in My Account. Refreshes preserve mock sessions and progress.

Daily tasks can be completed once per London calendar day; one-off tasks remain completed. Demo proof is immediately approved. Files are validated but not retained in browser storage. Reset demo on the sign-in/account page clears browser-local demo accounts and progress.

All environmental values, scores, activity totals, polygons, and decorations are illustrative. Postcode centroids were checked against [postcodes.io](https://postcodes.io/); polygons are not authoritative postcode boundaries. The map uses [OpenFreeMap](https://openfreemap.org/quick_start/) tiles, with built-in provider-failure messaging and an illustrative map fallback. Decorations are geographically anchored through MapLibre markers.

The Postcode Lottery navigation item is an external link. This project is independent and uses its own wordmark and artwork.

## Backend integration

Set `NEXT_PUBLIC_USE_MOCK_API=false` and configure `NEXT_PUBLIC_API_BASE_URL`. Restart development or rebuild after changing public environment variables.

Real implementations exist for authentication, current user, supported postcodes, communities, tasks, history, and multipart completion submission. Endpoint constants live in `lib/api/endpoints.ts`; DTO normalization lives in the services. The backend is developed separately, so paths and payloads remain provisional. See [the backend contract](docs/api-contract.md) before connecting it.

## Project layout

- `app/`: server-rendered route shells for `/`, `/account`, `/login`, and `/signup`.
- `components/`: protected navigation, authentication, map, indicators, proof dialogs, and account UI.
- `hooks/queries.ts`: TanStack Query server-state hooks and shared keys.
- `types/domain.ts`: canonical product models.
- `lib/api/`: configuration switch, typed client, endpoint constants, and real/mock services.
- `lib/mock/`: fixture data, browser storage, and validated mock mutations.
- `lib/tasks.ts`: task eligibility, proof validation, and deterministic recommendations.
- `lib/scoring.ts`: normalized scoring and status presentation.
- `lib/map/config.ts`: basemap settings, artwork registry, and theme-driven shading.
- `app/globals.css`: centralized colours, typography, radii, map palette, and responsive styles.
- `public/map-assets/`: replaceable original placeholder SVGs.
- `scripts/copy-maplibre-worker.mjs`: copies MapLibre v6's worker and shared module to `public/maplibre/` before development/build, as required for Turbopack. Generated vendor files are ignored in Git and regenerated from the installed version.

The map is dynamically loaded through a client wrapper. Server layouts remain server components; the authenticated shell checks the current-user query before rendering protected content. React state handles sidebar selection, modal visibility, and mobile drawer state. TanStack Query synchronizes API state and invalidates community/history queries after completion.

## Verification

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm exec playwright install chromium  # first time on a new machine
pnpm test:e2e
```

Browser tests start the production build on port 3100. They cover auth protection/persistence, local contributions, unchanged environmental data, neighbouring map selection, text/photo proof, mobile drawers, reduced motion, provider failure, and keyboard modal dismissal. Screenshots and failure traces go to ignored `test-results/`.

The desktop demo target is Chrome; the mobile experience uses a bottom drawer rather than a narrow desktop sidebar. Primary actions use visible controls, the proof dialog traps/restores focus, and animations respect reduced motion.
