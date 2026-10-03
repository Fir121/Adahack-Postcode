# Provisional backend contract

The frontend already implements every real request below. These paths and shapes are provisional: agree them with the backend developer, then change endpoint constants and service adapters rather than UI components.

Set `NEXT_PUBLIC_USE_MOCK_API=false` and `NEXT_PUBLIC_API_BASE_URL` before starting or building Next.js. The client sends `credentials: "include"` and expects JSON responses, except `204` responses. There is a 15-second request timeout.

## Endpoints

| Method | Path                      | Request                                    | Response                                                   |
| ------ | ------------------------- | ------------------------------------------ | ---------------------------------------------------------- |
| POST   | `/auth/signup`            | `{ name, email, postcode, password }` JSON | `{ user: User }`; establish session cookie                 |
| POST   | `/auth/login`             | `{ email, password }` JSON                 | `{ user: User }`; establish session cookie                 |
| POST   | `/auth/logout`            | No body                                    | `204`; clear session cookie                                |
| GET    | `/users/me`               | Session cookie                             | `User`; `401` if signed out                                |
| GET    | `/postcodes/supported`    | Public                                     | `string[]` of supported, existing postcodes                |
| GET    | `/postcodes`              | Session cookie                             | `PostcodeCommunity[]` for communities available to explore |
| GET    | `/postcodes/:communityId` | Session cookie                             | `PostcodeCommunity`                                        |
| GET    | `/tasks`                  | Session cookie                             | `Task[]`                                                   |
| GET    | `/completions`            | Session cookie                             | `TaskCompletion[]` for the current user, newest first      |
| POST   | `/completions`            | Multipart form, described below            | `CompletionResponse`                                       |

The canonical frontend models live in [`types/domain.ts`](../types/domain.ts). Services are in `lib/api/`; mock persistence and fixtures are in `lib/mock/`. Error responses use `{ "message": "Readable error", "fields": { "text": "Optional field error" } }`. Use `401` for expired sessions, `403` for wrong community membership, `409` for duplicate completions/accounts, and `422` for validation.

## User and community

```json
{
  "id": "resident-id",
  "name": "Alex Green",
  "email": "alex@example.test",
  "postcode": "EH3 9GD",
  "communityId": "eh3-9gd"
}
```

A community includes `id`, `postcode`, `name`, `city`, `centroid`, optional `boundary`, `geometryProvenance`, `indicators`, `progress`, and `decorations`.

```json
{
  "centroid": { "latitude": 55.943437, "longitude": -3.192934 },
  "geometryProvenance": "demo",
  "boundary": {
    "type": "Feature",
    "properties": { "communityId": "eh3-9gd", "demoGeometry": true },
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [-3.193, 55.943],
          [-3.192, 55.943],
          [-3.192, 55.944],
          [-3.193, 55.944],
          [-3.193, 55.943]
        ]
      ]
    }
  }
}
```

GeoJSON coordinates are **longitude, latitude**, not latitude, longitude. Polygon rings must close. MultiPolygon is also supported. A unit postcode does not imply an authoritative polygon: omit `boundary` when none exists, and the map will still focus on the centroid. Set `geometryProvenance: "authoritative"` only when the geometry has that provenance.

## Indicators and progress are separate

An indicator has `id`, `type`, `label`, `displayValue`, `status`, and `provenance` (`mock`, `measured`, or `derived`). Optional value, unit, normalized 0–100 score, description, trend, source, timestamp, and coverage render only when supplied. Indicator IDs are data-driven; tasks link to them via `targetIndicators`.

Progress is the platform's gamified community metric:

```json
{
  "score": 68,
  "scoreMax": 100,
  "level": 3,
  "monthlyChange": 3,
  "totalActions": 204,
  "activityByIndicator": { "transport": 84, "energy": 47 },
  "stats": [
    {
      "key": "participants",
      "label": "Neighbours taking part",
      "value": 86,
      "icon": "users"
    }
  ]
}
```

`scoreMax` is an optional wire field handled in adapters; use `1` for a 0–1 score, or `100` for a 0–100 score. The UI always receives 0–100 and derives its visual level centrally. `monthlyChange` is in normalized 0–100 points. Individual indicator scores must already be normalized by the data provider; the frontend does not invent thresholds from raw environmental values.

Completion updates only activity/progress and decorative visuals. Environmental measurements and their normalized indicator scores must continue to come from their sources. An action can relate to multiple indicators, so activity-by-indicator totals need not sum to total actions.

## Tasks and submissions

Tasks define `repeat: "daily" | "once"` and a typed array of `proofRequirements`. Declaration, text, image, and combinations are supported. Text requirements specify `minLength`; image requirements specify `maxBytes` and `acceptedTypes`. Daily eligibility is checked against dates in `Europe/London`.

`POST /completions` uses these multipart fields:

- `taskId`: string
- `communityId`: string
- `proof`: JSON string, e.g. `{"declaration":true,"text":"Moved laundry to the morning."}`
- `image`: optional uploaded file

The browser supplies the multipart boundary. The client does not manually set `Content-Type` for uploads.

Return:

```json
{
  "completion": {
    "id": "completion-id",
    "userId": "resident-id",
    "communityId": "eh3-9gd",
    "taskId": "save-energy",
    "taskTitle": "Give peak hours a break",
    "category": "Energy",
    "targetIndicators": ["energy"],
    "completedAt": "2026-10-03T12:00:00Z",
    "status": "approved",
    "proofStatus": "approved"
  },
  "progress": {
    "score": 69,
    "level": 3,
    "monthlyChange": 4,
    "totalActions": 205,
    "activityByIndicator": { "energy": 48 },
    "stats": []
  },
  "decoration": {
    "id": "solar-completion-id",
    "type": "solar-panel",
    "longitude": -3.1927,
    "latitude": 55.9434,
    "animation": "grow",
    "minGreenLevel": 0,
    "indicator": "energy"
  }
}
```

Return complete current `progress`, not a partial patch. A pending submission should return unchanged progress, `status: "pending"`, and no new decoration. Rejected submissions also have no contribution effect. The account and modal support all three statuses.

The backend must enforce session authorization, supported/existing postcodes, community membership, repeat eligibility, proof requirements, and upload validation. Cookie authentication should use HttpOnly cookies with suitable Secure/SameSite settings and CSRF protection; cross-origin deployments require a specific allowed frontend origin with credentials enabled. Browser-local mock sessions are demo state, not a production authentication system.

## Replace artwork and recommendations

The map asset registry is `lib/map/config.ts`. Replace the referenced SVGs in `public/map-assets/` or extend the registry with another renderer; marker coordinates and event handling stay in the map component. Decorative points express gamified progress, not measured physical trees or installations.

The small deterministic ranking in `lib/tasks.ts` prioritizes tasks related to the weakest indicator. It can be replaced with a backend recommendation service when that contract exists.
