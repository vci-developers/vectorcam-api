# Review Action Log API

The review action log is an audit trail of changes made during **session review** — certifying sessions, editing household data, resolving conflicts, and correcting specimen/image predictions.

Use this endpoint to power a review history panel, activity feed, or audit export in the frontend.

```
GET /sessions/review/logs
```

Results are returned **newest first** and scoped to sites the current user can access.

---

## Authentication

Requires a valid auth token (same as other session routes). Users only see logs for sites they have read access to, including child sites in the hierarchy.

| Status | Meaning |
|--------|---------|
| `401` | Not authenticated |
| `403` | No access to the requested site (when filtering by `siteId`) |
| `500` | Server error |

---

## Query parameters

All parameters are optional. Combine them to narrow the list.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `siteId` | number | — | Filter to a site and its descendant sites |
| `year` | number | — | Filter by review year (matches review task grouping) |
| `month` | number | — | Filter by review month, `1`–`12` |
| `collectionCycleId` | number | — | Filter by collection cycle |
| `action` | string | — | Filter by action type (see [Action types](#action-types)) |
| `userId` | number | — | Filter by the user who performed the action |
| `hasChanges` | boolean | — | `true` = only entries with field changes; `false` = no-op updates |
| `page` | number | `1` | Page number |
| `size` | number | `20` | Page size, max `100` |

### Example requests

```http
GET /sessions/review/logs?page=1&size=20
```

```http
GET /sessions/review/logs?siteId=42&year=2025&month=6&action=certify_session
```

```http
GET /sessions/review/logs?collectionCycleId=12&siteId=42
```

```http
GET /sessions/review/logs?hasChanges=true&userId=7
```

---

## Response

```json
{
  "logs": [ /* see Log entry below */ ],
  "pagination": {
    "page": 1,
    "size": 20,
    "totalPages": 3,
    "totalItems": 52
  }
}
```

### Pagination

| Field | Type | Description |
|-------|------|-------------|
| `page` | number | Current page |
| `size` | number | Items per page |
| `totalPages` | number | Total number of pages |
| `totalItems` | number | Total matching log entries |

---

## Log entry

Each item in `logs` has the following shape.

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Unique log entry ID |
| `siteId` | number | Site the reviewed session belongs to |
| `year` | number | Review year — aligns with `GET /sessions/review/task` grouping |
| `month` | number | Review month (`1`–`12`) |
| `collectionCycleId` | number \| null | Collection cycle assigned to the session, if any. Use `GET /programs/:program_id/collection-cycles` to resolve cycle labels/dates. |
| `action` | string | What happened (see [Action types](#action-types)) |
| `userId` | number \| null | User who performed the action. `null` if unavailable. |
| `hasChanges` | boolean | Whether any tracked fields actually changed |
| `changes` | object \| null | Before/after diffs when `hasChanges` is `true` (see [Reading `changes`](#reading-changes)) |
| `fields` | object \| null | IDs and context for linking to the affected record (see [Reading `fields`](#reading-fields)) |
| `metadata` | object \| null | Extra action-specific context (see [Reading `metadata`](#reading-metadata)) |
| `createdAt` | number | When the action was logged (Unix ms) |
| `updatedAt` | number | Last update time (Unix ms) |

### Reading `changes`

When present, each key is a field name (or grouped section) with this shape:

```json
{
  "fieldName": {
    "before": <previous value>,
    "after": <new value>
  }
}
```

Date values in diffs are **Unix timestamps in milliseconds**.

Some actions nest changes under groups:

| Group key | Used for |
|-----------|----------|
| `image` | Specimen image field or file changes |
| `inferenceResult` | Model prediction corrections |
| `specimen` | Specimen-level changes during image upload |
| `sessions` | Resolved session data during conflict merge |
| `surveillanceForm` | Resolved surveillance form fields |
| `formAnswers` | Resolved dynamic form answers (`question:{id}` keys) |

When `hasChanges` is `false`, `changes` is `null`.

### Reading `fields`

Use this object to deep-link into the review UI or fetch related records.

| Key | Present when | Use for |
|-----|--------------|---------|
| `sessionId` | Session, specimen, or image actions | Open the parent session |
| `specimenId` | Specimen or image actions | Open the specimen |
| `imageId` | Image actions | Open the specific image |
| `entityId` | Always | Primary record ID for the action |
| `entityType` | Always | `session`, `specimen`, `specimen_image`, or `session_conflict_resolution` |
| `sessionIds` | Conflict resolution | All sessions involved in the merge |
| `sessionUnitIds` | Session-unit conflict resolution | All session units involved |
| `requestSessionId` | Session update | Session identifier from the original request (may be numeric ID or `frontendId`) |

`endpoint` and `httpMethod` are also included for debugging but are usually not shown in the UI.

### Reading `metadata`

Varies by action. Common keys:

| Key | Action(s) | Meaning |
|-----|-----------|---------|
| `bodyKeys` | Session/specimen/image updates | Request fields that were sent |
| `resolutionId` | Conflict resolution | ID of the conflict resolution record |
| `updatedSessionCount` | Conflict resolution | Number of sessions updated |
| `updatedSessionUnitCount` | Conflict resolution | Number of session units updated |
| `contentType` | Image file replace | Uploaded file MIME type |

---

## Action types

| `action` value | User-facing meaning |
|----------------|---------------------|
| `certify_session` | Session was certified |
| `update_session_household_info` | Session household/collector details were edited |
| `resolve_session_conflicts` | Duplicate sessions were merged |
| `resolve_session_unit_conflicts` | Duplicate session units were merged |
| `update_specimen_thumbnail_prediction` | Specimen review fields were updated (thumbnail, processing flag, etc.) |
| `update_specimen_image_prediction` | Image labels or inference data were corrected |
| `replace_specimen_image_file` | The underlying image file was re-uploaded |

### Fields tracked in `changes` by action

**`certify_session` / `update_session_household_info`**

`state`, `certifiedBy`, `collectorTitle`, `collectorName`, `collectionDate`, `collectionMethod`, `specimenCondition`, `notes`, `siteId`, `deviceId`, `collectionCycleId`, `latitude`, `longitude`, `type`, `collectorLastTrainedOn`, `hardwareId`, `expectedSpecimens`, and related session metadata.

**`update_specimen_thumbnail_prediction`**

`specimenId`, `sessionUnitId`, `thumbnailImageId`, `shouldProcessFurther`, `expectedImages`

**`update_specimen_image_prediction`**

Image fields sent in the request (`species`, `sex`, `abdomenStatus`, `metadata`, `capturedAt`) and inference result fields when present.

**`replace_specimen_image_file`**

Image file reference (`imageKey`, `filemd5`) and specimen `thumbnailImageId`.

**`resolve_session_conflicts` / `resolve_session_unit_conflicts`**

Resolved session data, surveillance form fields, and form answers — grouped under `sessions`, `surveillanceForm`, and `formAnswers` in `changes`.

---

## Examples

### Certify session

```json
{
  "id": 101,
  "siteId": 42,
  "year": 2025,
  "month": 6,
  "collectionCycleId": 12,
  "action": "certify_session",
  "userId": 7,
  "hasChanges": true,
  "changes": {
    "state": { "before": "IN_REVIEW", "after": "CERTIFIED" },
    "certifiedBy": { "before": null, "after": 7 }
  },
  "fields": {
    "entityType": "session",
    "entityId": 1001,
    "sessionId": 1001
  },
  "metadata": {
    "bodyKeys": ["state"]
  },
  "createdAt": 1718123456789,
  "updatedAt": 1718123456789
}
```

### Edit household info

```json
{
  "id": 102,
  "siteId": 42,
  "year": 2025,
  "month": 6,
  "collectionCycleId": 12,
  "action": "update_session_household_info",
  "userId": 7,
  "hasChanges": true,
  "changes": {
    "collectorName": { "before": "Jane Doe", "after": "Jane D. Smith" },
    "notes": { "before": null, "after": "Corrected household name spelling" }
  },
  "fields": {
    "entityType": "session",
    "entityId": 1001,
    "sessionId": 1001
  },
  "metadata": {
    "bodyKeys": ["collectorName", "notes"]
  },
  "createdAt": 1718123500000,
  "updatedAt": 1718123500000
}
```

### Resolve session conflicts

```json
{
  "id": 103,
  "siteId": 42,
  "year": 2025,
  "month": 6,
  "collectionCycleId": 12,
  "action": "resolve_session_conflicts",
  "userId": 7,
  "hasChanges": true,
  "changes": {
    "sessions": {
      "1001": { "before": null, "after": { "collectorName": "Jane Doe" } },
      "1002": { "before": null, "after": { "collectorName": "Jane Doe" } }
    },
    "surveillanceForm": {
      "numPeopleSleptInHouse": { "before": null, "after": 4 }
    },
    "formAnswers": {
      "question:55": { "before": null, "after": "yes" }
    }
  },
  "fields": {
    "entityType": "session_conflict_resolution",
    "entityId": 15,
    "sessionIds": [1001, 1002]
  },
  "metadata": {
    "resolutionId": 15,
    "updatedSessionCount": 2,
    "updatedSessionUnitCount": 0
  },
  "createdAt": 1718123600000,
  "updatedAt": 1718123600000
}
```

For session-unit merges, `action` is `resolve_session_unit_conflicts` and `fields.sessionUnitIds` is set instead of session household data in `changes`.

### Correct image prediction

```json
{
  "id": 105,
  "siteId": 42,
  "year": 2025,
  "month": 6,
  "collectionCycleId": 12,
  "action": "update_specimen_image_prediction",
  "userId": 7,
  "hasChanges": true,
  "changes": {
    "image": {
      "species": { "before": "Anopheles_gambiae", "after": "Anopheles_funestus" },
      "sex": { "before": "unknown", "after": "female" }
    }
  },
  "fields": {
    "entityType": "specimen_image",
    "entityId": 502,
    "sessionId": 1001,
    "specimenId": 200,
    "imageId": 502
  },
  "metadata": {
    "bodyKeys": ["species", "sex"]
  },
  "createdAt": 1718123800000,
  "updatedAt": 1718123800000
}
```

### No-op update (`hasChanges: false`)

A log is still created when a review API call succeeds but nothing actually changed.

```json
{
  "id": 107,
  "siteId": 42,
  "year": 2025,
  "month": 6,
  "collectionCycleId": null,
  "action": "update_session_household_info",
  "userId": 7,
  "hasChanges": false,
  "changes": null,
  "fields": {
    "entityType": "session",
    "entityId": 1001,
    "sessionId": 1001
  },
  "metadata": {
    "bodyKeys": ["notes"]
  },
  "createdAt": 1718124000000,
  "updatedAt": 1718124000000
}
```
