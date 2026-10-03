# Our Patch backend integration

The implemented transport contract is the [updated Swagger spec](backend-swagger.json).
Default upstream: https://chivalry-handlebar-hangover.ngrok-free.dev/api/v1.
API_BASE_URL includes /api/v1; browser requests use the same-origin /api/backend proxy.

## Connected endpoints

| Endpoint | Application integration |
| --- | --- |
| GET /coordinates/ | Map centroids and supported signup postcodes |
| GET /coordinates/{postcode} | Selected postcode details/focus |
| GET /metrics/ | Join total_points to coordinate labels by normalized postcode; Green Score, house saturation and tree count |
| GET /metrics/{postcode} | Electricity carbon intensity, air quality index and community leaderboard |
| GET /tasks, GET /tasks/{task_id} | Action catalogue, fresh details and points before recording |
| GET /users, GET /users/{user_id} | Email login, duplicate-email precheck, profile restoration and account details |
| POST /users | Signup with exactly name, email and postcode |
| PUT /users/{user_id}, DELETE /users/{user_id} | Typed services; account profile remains read-only |
| GET /activities | Optional date, user_id and task_id filters; personal history and today's task eligibility |
| POST /activities/{date}/{user_id}/{task_id} | Record one dated action with a points-only body |
| PUT /activities/{date}/{user_id}/{task_id} | Typed service updates points on the precisely identified activity |
| DELETE /activities/{date}/{user_id}/{task_id} | Typed service deletes the precisely identified activity |

Activity writes no longer use /activities/{user_id}; the date/user/task triple identifies one occurrence. Writes encode each path segment separately, including user IDs that are emails. The list proxy forwards only the three documented filters. Update/delete services are integrated and tested; history remains read-only because this request updates the integration rather than adding editing controls.

## Green Score and environmental values

The metric list returns total_points rather than a normalized green_score or scale. The POC display rule is **one point = one Green Score point, capped at 100**. The full uncapped total appears separately under Community points. This is a frontend display convention, not a backend formula. Zero is a valid supplied score; a postcode absent from the list remains pending rather than silently acquiring zero. Map shading and selected-scene tree count/saturation use the displayed 0–100 score. Source animations remain independent of score and respect reduced motion.

Coordinates and metrics load concurrently. Selected postcode details fetch the point, score list and postcode metric concurrently. Metric failures keep the map and task flow available, leave failed values unavailable, and show errors with retry. Supported signup postcodes depend only on coordinates.

Postcode detail supplies carbon_intensity in gCO₂/kWh and air_quality on a documented 1–10 index. Carbon intensity zero is displayed as a real value; null/omitted environmental values display Unavailable. A live check returned air_quality=0, outside the documented range: the frontend treats that as unavailable. A later check returned a valid index of 3, which is displayed normally. Negative/invalid values fail visibly. No environmental score thresholds, trend, update timestamp or underlying data-source attribution are invented. Indicator badges show the returned values rather than claiming Doing well/Needs a little love without defined thresholds. Unrated API indicators do not drive fabricated recommendations or related-action totals.

## POC email-only login

Login fetches GET /users, matches email case-insensitively after trimming whitespace, then GET /users/{user_id} for fresh details. Only the selected ID is persisted in local storage (our-patch-development-profile). Refresh fetches that user; sign-out clears the ID, and a deleted user clears the selection. Signup POSTs name, lowercase email and a supported postcode. Duplicate matches produce a visible error; backend case-insensitive uniqueness is still needed to prevent races. Password/token/session APIs are outside this POC's scope. Mock mode also uses email-only selection.

## Activities, history and refresh

The Activity schema requires task_id, user_id and date; points and postcode are optional. The UI reads the latest task points before POST, puts the London calendar date/user/task in the URL, and sends only {"points": task.points}. It displays returned activity points when present; missing points are not fabricated as zero. The server should determine or validate awards against the task catalogue, even though this POC accepts a points field.

The frontend allows each task once per London day until task repeat metadata is supplied. It checks GET /activities?date=...&user_id=...&task_id=... before POST and disables already-recorded tasks. Backend uniqueness/idempotency must still protect against simultaneous tabs/retries. The composite date/user/task key provides stable display identity; duplicate list identities are rejected.

History joins tasks for titles and uses the activity's returned postcode for historical community attribution when present. If postcode is omitted it uses the current user's postcode; deleted tasks display Action {task_id}. The API supplies a day, not a timestamp; noon UTC is only a formatting placeholder. Activities are labelled Recorded because proof/approval status is absent. The local confirmation checkbox is self-report, not verification.

After recording, the app refetches community metrics, map totals, personal history and leaderboard. It does not optimistically overwrite the existing Green Score with an unavailable placeholder or add points to environmental measurements. A successful write remains recorded even if a later metrics read fails.

## Community leaderboard

GET /metrics/{postcode}.users now supplies member IDs, names and points directly. The popup always uses the signed-in user's home postcode, including when exploring another postcode. It sorts the returned totals descending and assigns competition ranks (1, 1, 3 for ties), retaining zero-point members and highlighting the current user by ID. Missing users means rankings are unavailable; an empty array is an available empty leaderboard; failures surface errors.

The old proposed /postcodes/{postcode}/leaderboard endpoint and per-member activity aggregation are removed. No dedicated leaderboard endpoint remains necessary for the existing feature. The metrics API does not specify the ranking period; the app does not label it monthly or claim historical attribution beyond the backend totals. Mock rankings continue to use saved approved demo actions.

## Remaining data/API gaps

| Capability | Remaining contract/API work |
| --- | --- |
| Score semantics | Backend-defined score scale, conversion from total points, caps/period and monthly changes; current POC convention is explicit above |
| More environmental detail | Additional indicators if desired; statuses/thresholds, trends, timestamps, coverage and underlying sources for existing values |
| Community statistics | Actual action/member aggregates and reporting periods beyond the supplied total points |
| Proof verification | Text/photo/QR support, uploads and review/verification status |
| Task rules | Categories, effort/time, target indicator IDs, repeat policy and proof requirements in task responses |
| Task feedback collection | Optional feedback POST if responses should be stored in-app; the configured external form already collects feedback, with a local downloadable form available as the default fallback |
| Activity completeness | Consistently returned points/postcode, completion timestamps, title snapshots and documented uniqueness/idempotency |

Precise activity targeting and API-backed community ranking are now supplied. Authentication/session APIs remain outside the requested POC scope.

## Browser access and validation

The proxy forwards only documented Swagger resources/methods, adds ngrok-skip-browser-warning, disables caching and preserves upstream JSON status/errors. Old activity paths and the proposed leaderboard path are rejected. Non-JSON successes fail visibly; upstream error statuses are retained. NEXT_PUBLIC_API_BASE_URL optionally bypasses the proxy and requires browser CORS. NEXT_PUBLIC_USE_MOCK_API=true enables the browser-local demo; public env changes require a restart/rebuild.

Read-only live checks on 3 October 2026 confirmed GET metrics/list/detail, activities/filters and tasks. Live detail checks returned carbon_intensity=0, and air_quality values of 0 and later 3; carbon is displayed as returned, and invalid-range AQI is unavailable. A temporary non-JSON metrics failure was also observed; the UI exposes a retry state. No live users or activities were created, edited or deleted during verification. Fixtures test signup and recording safely; contract tests cover point-only writes, exact composite identity, filtering, metric validation, missing/zero values, ranking ties and graceful failures.
