# CMS content synchronisation

How editorial content authored in the headless CMS reaches the website.

## The model

The CMS is the **authoring** system of record. PostgreSQL holds the
**projection** the API serves. Request handlers read PostgreSQL and never call
the CMS.

```
Editor publishes in CMS
        │
        ▼
CMS webhook ──► POST /api/integrations/cms-webhooks
                    │
                    ├─ verify signature (HMAC over the raw body, or bearer token)
                    ├─ upsert into PostgreSQL, keyed on (cms_source, cms_id)
                    ├─ record the delivery in cms_sync_log
                    ├─ enqueue a search index update
                    ├─ invalidate the Redis cache prefix
                    └─ revalidate the affected ISR pages
```

### Why not read the CMS per request

The specification (§5) has the CMS owning Projects and News, while §2 defines
PostgreSQL tables for the same content and §12's samples query PostgreSQL
directly. Serving reads from PostgreSQL resolves that, and buys three things:

1. **The website survives a CMS outage.** A CMS at the origin of every page
   render makes CMS uptime the website's uptime.
2. **Content stays queryable.** Generated `tsvector` columns, faceted filtering
   and the Passport join all need the content in the database. A CMS API cannot
   answer "ongoing residential projects in Lagos, with milestone progress".
3. **Latency.** A CDN-cached PostgreSQL read beats a round trip to a CMS API,
   which matters for the LCP ≤ 2.5 s target (§12).

Editors lose nothing: they still work entirely in the CMS admin.

## Webhook contract

`POST /api/integrations/cms-webhooks`

Authenticate with **either**:

- `X-CMS-Signature: sha256=<hex>` — HMAC-SHA256 of the raw body, keyed on
  `CMS_WEBHOOK_SECRET`; or
- `Authorization: Bearer <CMS_WEBHOOK_SECRET>` — Strapi's default.

The signature is verified against the **raw** bytes, so the route disables
Next.js's body parser. Re-serialising a parsed body produces different bytes and
will not verify.

```json
{
  "event": "entry.publish",
  "model": "project",
  "entry": { "id": 42, "title": "Ocean Ridge Residences", "publishedAt": "..." }
}
```

| Field | Notes |
|---|---|
| `event` | `entry.create`, `entry.update`, `entry.publish`, `entry.unpublish`, `entry.delete` |
| `model` | `project`, `news-article`, `faq`, `leadership`. Anything else is recorded and skipped. |
| `entry` | Strapi v4 (`attributes`-nested) and v5 (flat) shapes are both read. |

Send `X-Delivery-Id` (or `Idempotency-Key`) if the CMS can: it makes the
`cms_sync_log` entry unique per delivery.

Response:

```json
{ "received": true, "status": "applied", "model": "project",
  "entryId": "42", "revalidated": ["/projects", "/projects/ocean-ridge-residences"] }
```

`status` is `applied`, `skipped` (model not synced) or `failed`. A `failed`
response carries HTTP 500 so the CMS retries.

## Idempotency

Upserts are keyed on `(cms_source, cms_id)`, a unique constraint on every synced
table. A redelivered webhook updates the same row rather than creating a
duplicate — which matters, because a duplicated project is immediately visible
to the public.

## Event semantics

| Event | Effect |
|---|---|
| `entry.create` / `update` / `publish` | Upsert. `published_at` comes from the payload; a draft has none and stays invisible. |
| `entry.unpublish` | `published_at` is cleared. The row survives, the content leaves the website. |
| `entry.delete` | Projects and news are soft-deleted (`deleted_at`); FAQs and leadership rows are removed. |

## Observability

Every delivery writes a `cms_sync_log` row — model, entry, event, status, error
and payload. To answer "did that publish land?":

```sql
SELECT received_at, model, entry_id, event, status, error
  FROM cms_sync_log
 ORDER BY received_at DESC
 LIMIT 20;
```

## Reconciliation

If webhooks are missed — CMS downtime, a misconfigured endpoint — re-pull from
the CMS:

```bash
npm run search:reindex   # rebuild search from PostgreSQL
```

`src/lib/cms/strapi.ts` exposes `fetchAll(model)` for a full re-import; the
upserts are idempotent, so replaying every entry is safe.

## Setup

In Strapi: **Settings → Webhooks → Create**

- URL: `https://api.cobuilt.com/api/integrations/cms-webhooks`
- Header: `Authorization: Bearer <CMS_WEBHOOK_SECRET>`
- Events: `entry.create`, `entry.update`, `entry.publish`, `entry.unpublish`,
  `entry.delete`

Then set `CMS_WEBHOOK_SECRET`, `STRAPI_API_URL` and `STRAPI_API_TOKEN` in the
application environment.
