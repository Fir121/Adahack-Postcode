# Our Patch backend integration

The implemented contract is [the supplied Swagger 2.0 spec](backend-swagger.json).
Default upstream: https://chivalry-handlebar-hangover.ngrok-free.dev/api/v1.
Set server environment variable API_BASE_URL to change it. The URL must include /api/v1.

## Implemented now

| Endpoint | Frontend use |
| --- | --- |
| GET /coordinates/ | Map centroids; supported postcode list and signup validation |
| GET /coordinates/{postcode} | Selected postcode details and map focus |
| GET /tasks | Action catalogue, names, descriptions and points |
| GET /tasks/{task_id} | Fresh action details when its dialog opens |
| GET /users | Development profile selector |
| GET /users/{user_id} | Selected profile, profile restoration and My Account |
| POST /users | Create a profile with name, email and supported postcode |
| PUT /users/{user_id} | Typed service provided; account remains read-only |
| DELETE /users/{user_id} | Typed service provided; no delete-account UI |

User create/update bodies contain exactly name, email, postcode. Passwords are not sent: the spec does not define authentication. Profile selection stores only the chosen user ID in browser local storage and fetches its current data from GET /users/{user_id}. This is a development convenience, not an authenticated session. A deleted profile clears the browser selection.

The frontend maps user_id to id and task_id/name to id/title. Postcode membership is derived from the user's postcode, not a backend community ID. Coordinates are latitude/longitude centroids; no polygons or GeoJSON areas are required. Postcodes in detail URLs are normalized and URL encoded. The trailing slash on the coordinate list endpoint is retained upstream.

Coordinates do not contain scores or indicators. API-mode postcode labels therefore use a neutral background and say Pending; Green Score shows pending, environmental indicators and history show unavailable, and activity totals are hidden. The selected postcode retains one full-colour house and one still tree as a visual placeholder. Score-driven shading, saturation, tree counts and animation resume once a genuine community score is supplied. Task points are displayed as defined by the API; they are not treated as a postcode score. Completion and proof controls are not offered without an implementation.

## Browser access and errors

The browser calls /api/backend, a Next.js server route limited to the three Swagger resources and their documented methods, plus the proposed read-only leaderboard route. It forwards to API_BASE_URL, sends ngrok-skip-browser-warning, disables response caching and retains upstream JSON/status codes. This avoids both the ngrok browser warning and the currently absent CORS headers. Network failures and non-JSON tunnel responses return an actionable 502 error; the client has a 15-second timeout. There is no silent mock fallback.

NEXT_PUBLIC_API_BASE_URL is an optional direct browser URL override. If using it, the backend must provide browser CORS headers and handle ngrok warnings as appropriate. The default proxy is for the current unauthenticated contract; cookie/token forwarding and authorization must be implemented with the future authentication contract.

NEXT_PUBLIC_USE_MOCK_API=true explicitly selects the original local demo. Default is false. Public configuration changes require a restart/rebuild.

## Still required for the full dynamic app

The following are proposed paths, not implemented endpoints:

| Capability | Suggested endpoint | Required contract |
| --- | --- | --- |
| Secure signup/sign-in/session | POST /auth/signup, POST /auth/login, POST /auth/logout, GET /users/me | Credentials or chosen auth provider, session/token behavior, expiry, current user, field errors, authorization of user resources |
| Community progress | GET /postcodes/{postcode}/progress | Green Score and its scale/max, authoritative scoring rules, monthly change, total actions, activity by indicator and community statistics |
| Map-wide scores | Extend GET /coordinates/ or provide GET /postcodes/progress | Score keyed by postcode so unselected labels can also be coloured; nullable/missing scores must stay distinguishable from zero |
| Environmental indicators | GET /postcodes/{postcode}/indicators | Indicator IDs/types, labels, values/units, normalized scores/status, trends, source, update time, measured/derived provenance and coverage |
| Submit a contribution | POST /completions | Authenticated user, task/postcode, task-specific text/declaration/photo proof, pending/approved/rejected status; server enforces supported membership and repeat rules |
| Personal history | GET /completions (authenticated current user) | Completion IDs, task ID/title, postcode, submitted time, review/proof status; do not trust a client-supplied user ID for access control |
| Proof uploads/review | Multipart /completions or dedicated upload endpoint | Accepted media types, size limits, storage/upload behavior, verification/review lifecycle and validation errors |

An approved completion should return the saved completion and updated community progress (or provide a reliable refetch), so all scores/map labels and history can synchronize. Define how task points accumulate into a 0–100 Green Score, score caps/period resets, daily timezone and repeat limits; the frontend must not invent that rule. Pending/rejected contributions should not award progress.

Extend existing task responses with target indicator IDs, category, estimated time, effort, repeat policy and proof requirements (type, label, required flag, text minimum length, image type/size limits). Those fields enable meaningful recommendations, daily/one-off eligibility and the existing proof UI. They do not require a separate task endpoint.

Backend user creation/update must also enforce supported postcodes, unique/valid emails and structured field errors. If the lottery membership badge should reflect verified membership, add that status to the user response; the current schema only supplies name, email and postcode. Community statistics should include explicit units and scope/period (e.g. monthly versus all-time). If the coordinate collection grows substantially, add viewport/bounds or postcode-search filtering with pagination.

## Live observations and verification

Read-only checks on 3 October 2026 returned 513 coordinate records, eight tasks and one user profile. The existing profile's postcode EH9 1AB is supported. EH3 9GD returned 404, so it remains available only in explicit mock mode until the backend supplies it. No live users were created, edited or deleted during verification.

Contract tests exercise the exact Swagger DTOs, all user service methods against fixtures, missing fields, escaping, unsupported-postcode rejection, unavailable features, proxy allowlisting and errors. Browser tests exercise API-driven selection, refresh, map focus, task detail, signup payloads, error retry and icon metadata. The optional live browser smoke uses GET requests only.

## Community leaderboard (proposed endpoint)

The sidebar's **My community leaderboard** button always opens the current user's own postcode, including while they explore a neighbouring postcode. Opening the dialog loads fresh rankings, including when it is closed and reopened. Rankings are invalidated after a contribution is submitted. User identity is matched by user_id, not by name.

Implement GET /api/v1/postcodes/{postcode}/leaderboard (postcode is URL encoded):

```json
{
  "postcode": "EH9 1AB",
  "entries": [
    { "user_id": "neighbour-1", "name": "Jamie", "rank": 1, "points": 12 },
    { "user_id": "current-user-id", "name": "Alex", "rank": 2, "points": 8 }
  ]
}
```

Return the full community leaderboard, including the current user and zero-point members, with stable user IDs, nonempty names, nonnegative integer points and positive integer ranks. The postcode must match the requested community. Rank and points are authoritative backend values: sort by points descending, equal totals share competition ranks (e.g. 1, 1, 3). Points are approved individual contributions to that community, separate from its Green Score. Initial scope is all-time; define the points period explicitly before changing it. Do not include email addresses or unrelated profile details.

The frontend displays Rank / Name / Points, highlights the current user's row and summarizes their rank/points. If the member is absent from the response it says their position is unavailable; it does not invent a rank. Empty successful responses have a distinct empty state. HTTP 404/501 show a coming-soon state; other errors offer retry. There is no live fallback to fabricated rankings. The same-origin proxy permits only this extra GET route, in addition to the existing Swagger resources.

Once authentication is implemented, enforce community access/membership on the backend using the authenticated identity. Return 401/403 for denied access. If pagination is added later, include the current user's ranking separately so they can still see their position outside the first page; the current UI contract expects all members.

In mock mode rankings use actual saved browser-local profiles from the user's community and their approved completions, including the existing seeded demo history. Each approved demo action is one point; pending/rejected actions and other postcodes do not count. No fictional neighbours are added.
