# Our Patch

An independent sustainability hackathon frontend. Understand your postcode's environmental indicators, choose a relevant action, submit task-specific proof, and watch community progress grow.

## Run locally

From `frontend/postcode`:

```sh
pnpm install
cp .env.example .env.local
pnpm dev
```

Open http://localhost:3000. The default mode calls the supplied development API through a same-origin server proxy. Sign in with your email, or create a user with name, email and a postcode supplied by the API. No password is used for this POC. Recorded actions and history use the updated activities API. Metrics provide postcode Green Scores, electricity carbon intensity, air quality and community rankings.

The root Icon.png is used unchanged for the header logo, browser favicon, Apple touch icon and app manifest.

For the original interactive mock demo, set NEXT_PUBLIC_USE_MOCK_API=true and restart/rebuild. Click **Try the demo** or sign up with a supported demo postcode.

Demo email: `demo@greentogether.test` (no password).

Supported demo postcodes: **EH3 9GD**, **EH3 9FG**, **EH8 9LJ**. All are explorable; actions contribute only to your account's community.

## Demo journey

1. Sign in or create an account. The map focuses on your postcode.
2. Read the separate community Green Score and environmental indicators.
3. Select an indicator to see source/context, related activity, and actions.
4. Open the recommended action or browse all actions.
5. Submit declaration, text, photo, or combined proof as required by that task.
6. Activity and gamified score increase; house saturation and tree count follow the new score. Environmental measurements stay unchanged.
7. View completion history in My Account. Refreshes preserve the selected user ID and mock progress.

Daily tasks can be completed once per London calendar day; one-off tasks remain completed. Demo proof is immediately approved. Files are validated but not retained in browser storage. Reset demo on the sign-in/account page clears browser-local demo accounts and progress.

Environmental values, scores, activity totals and decorations are illustrative. Postcode centroids were checked against [postcodes.io](https://postcodes.io/). The map draws no postcode polygons: labels at latitude/longitude centroids carry a continuous red → yellow → green score colour. Only the selected postcode shows its decorative scene; tapping another label swaps scenes and replays eligible animations. The map uses [OpenFreeMap](https://openfreemap.org/quick_start/) tiles with muted coloured streets, provider-failure messaging and a centroid-label fallback. Street colours describe road styling, not community scores.

The top bars use `#E30027`; the rest of the interface retains its green palette. Frontend rules in `lib/map/decorations.ts` define one house directly above the selected postcode label and 1–10 trees, alternating left/right with a small overlap. Tree count is `max(1, ceil(score / 10))`; house saturation is `score / 100` (grayscale at 0, original colour at 100). The scene fits narrower maps and keeps its spacing when zooming. House and tree source animations run at every score, including when the API has no score yet. Score changes update the count and saturation; the current scene uses houses and trees only. Environmental measurements stay unchanged after completion. Backend community data requires a centroid and score, with optional earned decorations.

The Postcode Lottery navigation item is an external link. This project is independent and uses its own wordmark and artwork.

## Backend integration

The live Swagger integration is enabled by default. API_BASE_URL configures the server-side upstream and defaults to https://chivalry-handlebar-hangover.ngrok-free.dev/api/v1. Browser requests use /api/backend so the currently missing CORS headers and ngrok interstitial do not prevent access.

Coordinates populate map centroids and supported postcodes; task list/detail endpoints provide actions and points; user list/detail/create endpoints provide POC profiles. Typed update/delete services are available, while the account UI remains read-only. Email login looks up GET /users then GET /users/{user_id}, and persists the selected ID. GET /activities uses user_id/date/task_id filters for history and eligibility. POST/PUT/DELETE /activities/{date}/{user_id}/{task_id} target one dated action, with a points-only write body. GET /metrics/ joins total_points to postcode labels; the POC Green Score is 1 point per score point, capped at 100, with the full total shown separately. GET /metrics/{postcode} supplies carbon intensity, air quality and member point totals. Missing metrics remain unavailable with visible errors/retry; metric failures do not block signup or tasks.

See [the backend contract and remaining endpoints](docs/api-contract.md) for exact mappings, configuration and the additions needed to make the full app dynamic.

## Project layout

- `app/`: server-rendered route shells for `/`, `/account`, `/login`, and `/signup`.
- `components/`: protected navigation, authentication, map, indicators, proof dialogs, and account UI.
- `hooks/queries.ts`: TanStack Query server-state hooks and shared keys.
- `types/domain.ts`: canonical product models.
- `lib/api/`: configuration switch, typed client, endpoint constants, and real/mock services.
- `lib/mock/`: fixture data, browser storage, and validated mock mutations.
- `lib/tasks.ts`: task eligibility, proof validation, and deterministic recommendations.
- `lib/scoring.ts`: normalized scoring and status presentation.
- `lib/map/config.ts`: basemap settings, artwork registry, and score shading.
- `lib/map/decorations.ts`: score-dependent scene and animation rules.
- `lib/map/basemap.ts`: street colours for the default basemap.
- `app/globals.css`: centralized colours, typography, radii, map palette, and responsive styles.
- `public/map-assets/`: supplied house artwork and replaceable placeholder SVGs for other assets.
- `scripts/copy-maplibre-worker.mjs`: copies MapLibre v6's worker and shared module to `public/maplibre/` before development/build, as required for Turbopack. Generated vendor files are ignored in Git and regenerated from the installed version.

The map is dynamically loaded through a client wrapper. Server layouts remain server components; the selected-user shell checks the current-user query before rendering protected content. React state handles sidebar selection, modal visibility, and mobile drawer state. TanStack Query synchronizes API state and invalidates community/history queries after completion.

## Community leaderboard

Use **My community leaderboard** in the right sidebar to open your own postcode's Rank / Name / Points table. Your row is highlighted and your rank/points appear above it. The popup works from any sidebar view, supports keyboard dismissal and mobile layouts, and refreshes on opening.

GET /metrics/{postcode}.users supplies member point totals directly. The frontend assigns competition ranks for ties, highlights the current user and always targets the home postcode. The former proposed leaderboard endpoint and per-member activity aggregation are removed. Mock mode uses saved profiles and approved demo actions. See [the backend integration contract and remaining work](docs/api-contract.md).

## Resprite artwork

`House.resprite` and `Tree.resprite` in the repository root supply the house and tree visuals. The tree has nine 32×32 frames at 12 fps, rendered at 2× scale; its source transparency and timing are preserved. `House.resprite` supplies the house visual. Its 32×32 canvas, eight frames at 12 fps, transparency, offsets, layer order and frame durations are preserved. The selected postcode loops the original chimney-smoke animation at a crisp 3× scale independently of its Green Score. Authentication uses the first frame at 6× scale. Reduced motion shows the first frame and also responds to preference changes while the page is open. The house/tree composition is attached above the centroid label using pixel offsets; scale, spacing, saturation and sprite timing are configured in the frontend.

To regenerate the browser assets from `frontend/postcode`:

```sh
node scripts/import-resprite.mjs ../../House.resprite house
node scripts/import-resprite.mjs ../../Tree.resprite tree
```

The importer requires `unzip` (included on macOS). It produces a static SVG, a horizontal SVG sprite sheet, and a JSON timing manifest in `public/map-assets/`. These SVGs contain the original PNG cels without tracing or recompressing them. The frontend serves these generated files, so deployment does not require Resprite or the source archive. Register new artwork in `lib/map/config.ts`; source timeline playback is handled by `lib/map/asset-visual.ts` and is cleaned up with its marker.

This importer handles Resprite format 2 with visible normal-blend raster layers and independent cels. Groups, clipping masks, linked cels, tilesets, named/directional clips or other blend modes require a flattened transparent PNG sprite-sheet export plus frame dimensions, frame order and per-frame timing. It fails explicitly on unsupported features. For future visuals, provide the file and rules for when it appears, which frames/clips play, looping, display size and geographic anchor. Gameplay rules are configured separately from artwork.

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

For API browser tests, build with NEXT_PUBLIC_USE_MOCK_API=false and run E2E_API=true pnpm test:e2e. Add E2E_LIVE_API=true for the optional read-only smoke against the configured server. For the original regression suite, build with NEXT_PUBLIC_USE_MOCK_API=true and run E2E_API=false pnpm test:e2e.

The desktop demo target is Chrome; the mobile experience uses a bottom drawer rather than a narrow desktop sidebar. Primary actions use visible controls, the proof dialog traps/restores focus, and animations respect reduced motion.

## Task feedback

Every suggested action and task card has a round feedback link with the tooltip “Give feedback on this task”. Completed tasks retain their feedback link. By default it opens `/feedback?task_id=...`, a simple task-specific form with a rating and written feedback. Until a feedback API is provided, submissions are saved only in this browser (`our-patch-task-feedback-v1`) and can be downloaded as JSON to share. Set `NEXT_PUBLIC_TASK_FEEDBACK_URL` to use a static external form instead; rebuild/restart after changing it.
