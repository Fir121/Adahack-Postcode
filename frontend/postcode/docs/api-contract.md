# Our Patch backend integration

The implemented transport contract is the [updated Swagger spec](backend-swagger.json).
Default upstream: https://chivalry-handlebar-hangover.ngrok-free.dev/api/v1.
API_BASE_URL includes /api/v1; browser requests use the same-origin /api/backend proxy.

## Connected endpoints

| Endpoint | Application integration |
| --- | --- |
| GET /coordinates/ | Map centroids and supported signup postcodes |
| GET /coordinates/{postcode} | Selected postcode details/focus |
| GET /tasks | Action catalogue, names/descriptions and points |
| GET /tasks/{task_id} | Fresh details before recording an action |
| GET /users | Email login lookup, duplicate-email precheck and leaderboard membership |
| GET /users/{user_id} | Login details, restore saved user, account and activity history |
| POST /users | Signup with exactly name, email, postcode |
| PUT /users/{user_id}, DELETE /users/{user_id} | Typed services provided; account profile remains read-only |
| GET /activities/{user_id} | Personal history; leaderboard point totals |
| GET /activities/{user_id}?date=YYYY-MM-DD | Check whether an action has already been recorded today |
| POST /activities/{user_id} | Record an action with exactly task_id and date; use returned points |
| PUT /activities/{user_id} | Typed update service; edit UI awaits precise activity targeting semantics |
| DELETE /activities/{user_id}?task_id=... | Typed delete service; always supplies task_id; no ambiguous delete-history UI |

User IDs and postcode path segments are URL encoded (including user IDs that happen to be email addresses). Activity date/task_id filters are preserved by the proxy; unrelated query parameters are not forwarded.

## POC email-only login

Login fetches GET /users, finds the entered email case-insensitively after trimming whitespace, then fetches GET /users/{user_id} for fresh profile details. It persists only the selected user ID in browser local storage under the existing key our-patch-development-profile for compatibility. Refresh uses that ID to fetch current details; sign-out clears it. A deleted user clears the selection. No password, token or session API is required for this POC. The former profile dropdown is removed.

Signup POSTs name, normalized lowercase email and a supported postcode. A duplicate email precheck helps avoid ambiguous login, but the backend should also enforce uniqueness. Multiple users matching the login email produce an explicit error rather than picking an arbitrary identity. Supported postcodes still come from the coordinate endpoint.

Mock mode also uses email-only login/signup. Legacy browser database fields remain readable for compatibility, but passwords are no longer collected, hashed or checked. Mock mode's selected-user field contains only a user ID.

## Activity recording and history

The activity DTO is task_id, user_id, date (YYYY-MM-DD), points. Recording sends only task_id and date to POST /activities/{user_id}. No client points or proof are submitted. The resulting activity supplies authoritative awarded points.

Until task metadata defines repeat rules, the POC allows each action once per London calendar day. The UI disables already-recorded actions for today, and the service checks GET activities before POSTing. This is a POC convention; backend uniqueness/idempotency must enforce it across tabs/retries. Daily rules must be agreed rather than inferred from the date field alone.

Activities display as **recorded**, not approved: the schema has no approval/proof status. The confirmation checkbox is a local self-report, not backend proof verification. History joins activities with tasks for names, dates and points; a task missing from the current catalogue is shown as Action {task_id}. Activity dates use noon UTC internally only for date formatting across UK timezone changes; they are not actual event timestamps. Display keys are synthetic because the API does not provide activity IDs.

Recording invalidates history and leaderboard queries. It does not fabricate a community score: coordinate labels remain neutral/pending, the selected postcode has one full-colour still house and one still tree, and environmental indicators/statistics stay unavailable. Activity points alone do not specify the community Green Score scale or calculation.

## Live community leaderboard

The prepared GET /postcodes/{postcode}/leaderboard is not in the supplied spec. On 404/501, the app now fetches GET /users, filters current members by postcode, and fetches their activities to sum real points. At most four member requests run concurrently. All member requests must succeed: a partial response is not shown as a complete ranking.

This provides a working leaderboard with the existing API, including the current user's highlighted row, zero-point members and competition ties (1, 1, 3). Scope is all recorded activities/all-time. Because activity records have no postcode, users are grouped by their **current** profile postcode; historic points follow a profile change. A dedicated aggregate response would be more efficient and could preserve historical community attribution.

The existing optional dedicated response adapter accepts:
```json
{
  "postcode": "EH9 1AB",
  "entries": [
    { "user_id": "member-1", "name": "Jamie", "rank": 1, "points": 12 },
    { "user_id": "current-user-id", "name": "Alex", "rank": 2, "points": 8 }
  ]
}
```
If implemented, it is preferred automatically. Return all members including the current user, with stable user IDs, names, positive integer ranks and nonnegative integer points. Failed/invalid responses surface errors; there is no fake live data fallback. The sidebar button always opens the signed-in user's home postcode, even while exploring neighbours.

## Pending APIs/data

| Capability | Missing API/data |
| --- | --- |
| Community Green Score | GET /postcodes/{postcode}/progress with score, scale/max, authoritative formula, caps/period, monthly change |
| Scores across map labels | Scores keyed by postcode in the coordinate list or GET /postcodes/progress |
| Environmental indicators | GET /postcodes/{postcode}/indicators with values/units, status, trends, sources, timestamps and provenance |
| Community statistics | Backend-scoped totals/statistics, period and units; can share the progress endpoint |
| Proof upload/verification | Text/photo/QR support, allowed types/sizes, storage and verification/review statuses; current ActivityInput has no proof fields |
| Task rules/recommendations | Add category, effort/time, target indicator IDs, daily/one-off repeat policy and proof requirements to existing task responses |
| Efficient authoritative leaderboard (optional) | GET /postcodes/{postcode}/leaderboard; current implementation already works via users + activities |
| Precise activity editing/deletion | Stable activity_id or explicit (user, task, original date) identity and documented PUT/DELETE semantics |

Authentication/session APIs are deliberately outside this POC scope, not a blocker or pending requirement.

## Backend limitations to resolve

1. Activity has no unique ID. DELETE is filtered only by task_id and PUT has no activity ID/original-date selector; it is unclear how either selects one occurrence when tasks recur on multiple dates. Services are connected, but edit/delete UI waits for that definition.
2. Document/enforce the repeat policy and uniqueness of (user_id, task_id, date) or provide an idempotency key. A client GET-before-POST cannot prevent races across tabs/network retries.
3. Activities lack proof/status, completion timestamps, task-title snapshots and postcode attribution. The app does not claim actions have been verified; historical names and community membership are inferred from current task/user data.
4. Enforce case-insensitive email uniqueness and supported postcodes on POST/PUT users. Frontend prechecks improve UX but do not define server consistency.
5. Define community scoring separately from individual activity points. The frontend leaves Green Score pending until this is supplied.

## Browser access and verification

The proxy forwards only Swagger resources/methods plus the optional leaderboard GET, supplies ngrok-skip-browser-warning, disables response caching, and keeps upstream JSON status/errors. Framework HTML 404/501 from the optional leaderboard becomes JSON so activity aggregation can proceed. API and tunnel failures remain visible. NEXT_PUBLIC_API_BASE_URL optionally bypasses the proxy, requiring browser CORS. NEXT_PUBLIC_USE_MOCK_API=true enables the browser-local demo; public env changes need a restart/rebuild.

Read-only live checks confirmed users/tasks/activity list responses on 3 October 2026. Live users and activities were not created, edited or deleted during testing. Unit/contract tests exercise CRUD payloads, date filtering, scoped identity, duplicate recording, email lookup and leaderboard aggregation; browser fixtures exercise POST recording and signup safely. The optional live browser smoke uses GETs only.
