# CertifyTube Frontend

Frontend client for CertifyTube, an AI-assisted learning verification platform that tracks real learner engagement on YouTube-based educational content, supports quiz and certificate workflows, and provides admin review interfaces.

This repository is structured as a production-style frontend codebase for an academic capstone implementation. It provides learner-facing flows, authenticated navigation, telemetry batching, progress recovery, certificate access, and admin-facing insight screens.

## Project Context

CertifyTube Frontend is part of an IIT final-year project.

The objective of the system is to provide a frontend experience where a learner can:

- discover and start learning sessions from YouTube content
- generate verifiable engagement evidence through tracked playback behavior
- complete quiz and certificate workflows after meeting backend thresholds
- manage learner history, profile, and certified outcomes

## Core Capabilities

- public landing, authentication, email verification, and password recovery flows
- learner search and session entry points
- YouTube watch experience with batched playback telemetry capture
- resilient event queue persistence and retry behavior for watch tracking
- engagement analysis, quiz, result, and certificate flows
- learner dashboard, profile management, and certified history
- admin learner overview and learner-level insight pages
- SPA-ready deployment configuration for route rewrites

## High-Level Flow

```text
Learner opens the frontend
-> searches and starts a learning session
-> frontend captures player events such as play, pause, seek, buffering, and rate changes
-> frontend sends event batches to the backend
-> learner completes the session
-> learner continues to analysis, quiz, and result flows
-> certificate is issued and later verified through the public verification flow
```

## Architecture

```text
Browser
  -> React + Vite Frontend
      -> Spring Boot Backend API
          -> MySQL
          -> External ML Service
          -> YouTube Data API
          -> Email Provider
```

## Technology Stack

| Area | Technology |
|------|------------|
| Language | TypeScript |
| UI Framework | React 19 |
| Build Tool | Vite 7 |
| Routing | React Router 7 |
| Data Fetching | TanStack React Query |
| HTTP Client | Axios |
| Client State | Zustand |
| UI Icons | Lucide React |
| Testing | Vitest + Testing Library |
| Deployment Routing | Vercel rewrite configuration |

## Repository Layout

```text
src
|- api          API clients and HTTP helpers
|- app          app shell, routes, query client
|- features     feature modules grouped by domain
|- store        global auth state
|- test         test setup
`- types        shared frontend request/response types
```

## Functional Areas

### Public and Auth

- landing page
- signup, login, verify email, forgot password, reset password
- public certificate verification route

### Learner Experience

- search and start learning flows
- tracked watch session and progress recovery
- engagement analysis handoff
- quiz generation, attempt flow, and result review
- certificate viewing and learner-certified history
- profile and password management

### Admin Experience

- learner listing
- learner profile deep-dive
- ML engagement review, quiz, session, and certificate visibility

## Runtime Requirements

- Node.js 20 or newer recommended
- npm
- running backend API for full application behavior

## Required Configuration

The frontend reads configuration from environment variables and local Vite config.

Primary variable:

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | Base URL of the backend API in deployed or non-proxied environments |

Notes:

- when `VITE_API_BASE_URL` is empty, local development uses the Vite proxy for `/api`
- the current dev proxy forwards `/api` requests to `http://localhost:8080`

Example `.env`:

```env
VITE_API_BASE_URL=
```

## Local Development

Install dependencies:

```bash
npm install
```

Start the frontend:

```bash
npm run dev
```

Default local URL:

```text
http://localhost:5173
```

For a typical local setup, run the backend on:

```text
http://localhost:8080
```

## Build and Test

Run the production build:

```bash
npm run build
```

Run tests:

```bash
npm run test:run
```

Run lint checks:

```bash
npm run lint
```

Preview the built app:

```bash
npm run preview
```

## Deployment Notes

- `vercel.json` rewrites all routes to `index.html` for SPA navigation
- set `VITE_API_BASE_URL` in the deployment environment when the backend is hosted separately
- ensure the backend allows the deployed frontend origin for authenticated API calls

## Security and Operational Notes

- JWT-based authenticated sessions are consumed from the backend
- protected routes are guarded in the frontend before rendering learner and admin pages
- watch telemetry is queued, batched, persisted locally, and retried until accepted by the backend
- this frontend depends on backend ownership and authorization checks for protected resources

## Ownership and Usage Notice

This repository is an IIT final-year project and the original work of its author.

No permission is granted to copy, redistribute, reuse, publish, submit, present, or claim this codebase or its contents as another person's work without the author's explicit written approval.

This repository is provided as proprietary academic project material. All rights are reserved by the author.

## License

See [LICENSE](./LICENSE) for the repository usage restrictions.
