# Voco API Backend 🎙️

Lightweight Node.js + Express backend designed for seamless deployment on **Render**, integrated with the **MongoDB native driver** (Atlas) and **@sentry/node** with **@sentry/profiling-node** for performance and latency transaction tracing.

---

## ⚡ Tech Stack & Architecture

- **Runtime**: Node.js 20+ (ES Modules)
- **Framework**: Express 5.x
- **Database**: MongoDB Native Driver (`mongodb` v7.x)
  - Collections: `events`, `attendees`
  - Automated index creation and connection pooling
  - Built-in fallback in-memory adapter for offline local testing
- **Observability**: `@sentry/node` & `@sentry/profiling-node` (v11)
  - Continuous CPU profiling enabled via `nodeProfilingIntegration`
  - Transaction spans wrapping all routes and external AI API calls (`ai.external.*`)
- **File Upload**: `multer` memory storage for fast CSV parsing without disk I/O

---

## 📁 Endpoints

### 1. `POST /api/upload-rsvps`
Accepts a CSV file upload (`multipart/form-data` with `file`) or JSON body `{ "csvText": "..." }`.
- Parses and validates headers: `Name`, `Phone`, `Role`, `Event`
- Inserts attendees into the `attendees` collection
- Upserts and increments RSVP counts in the `events` collection
- Wrapped in Sentry transaction spans:
  - `POST /api/upload-rsvps` (HTTP transaction)
  - `csv.parse_and_validate` (CSV parsing span)
  - `mongodb.events.upsert` (Database span)
  - `ai.voice_prompt_synthesis_prep` (AI latency simulation span)
  - `mongodb.attendees.insertMany` (Database span)

### 2. `POST /api/generate-scripts`
Iterates through pending attendees in MongoDB, passes their data (`Name`, `Role`, `Event`) to the open-weight model (`Llama-3` or `Mistral`), enforces a strictly 2-sentence warm personalized reminder script, and persists the script back to the attendee's MongoDB document.
- Body (optional): `{ "event": "AI Frontiers Summit 2026", "limit": 50 }`
- Traced in Sentry with timeout handling (`OPENWEIGHT_AI_TIMEOUT_MS`)

### 3. `GET /api/events`
Returns all events from MongoDB `events` collection.

### 4. `GET /api/attendees`
Returns attendees with optional `?event=EventName` filter.

### 5. `POST /api/generate-voice`
Simulates or dispatches voice synthesis with Sentry latency tracing (`ai.external.gemini_or_elevenlabs_voice`).

### 6. `GET /health`
Health check endpoint for Render.

---

## 🚀 Local Development

```bash
cd api
pnpm install
pnpm dev
```

Build:
```bash
pnpm build
pnpm start
```

---

## ☁️ Deploy to Render

### Option A: Render Blueprint
Use the included `render.yaml` specification directly in Render by choosing **New > Blueprint**.

### Option B: Manual Web Service
1. Create a **New Web Service** on [Render](https://render.com).
2. Root Directory: `api`
3. Environment: `Node`
4. Build Command: `pnpm install && pnpm build`
5. Start Command: `pnpm start`
6. Health Check Path: `/health`
7. Set Environment Variables:
   - `MONGODB_URI`: your MongoDB Atlas connection string (`mongodb+srv://...`)
   - `MONGODB_DB_NAME`: `voco`
   - `SENTRY_DSN`: your Sentry project DSN
   - `SENTRY_ENVIRONMENT`: `production`
