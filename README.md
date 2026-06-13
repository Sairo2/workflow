# Workflow Approval System

Multi-tenant workflow and approval system built with Node.js, TypeScript, PostgreSQL, and React.

## Stack

- Backend: Node.js, Express, TypeScript, Prisma, PostgreSQL, Zod
- Frontend: React, TypeScript, Vite, React Query, Zustand, Axios
- Tooling: npm workspaces, ESLint, strict TypeScript

## Repository Structure

```txt
backend/
  prisma/
    schema.prisma
    seed.ts
    migrations/
  src/
    config/
    controllers/
    middleware/
    routes/
    services/
    repositories/
    validators/
    utils/

frontend/
  src/
    app/
    features/
    shared/
```

The backend uses a layered structure:

```txt
routes -> middleware -> controllers -> services -> repositories -> Prisma/PostgreSQL
```

The frontend uses feature-based organization. Shared pieces stay in `shared/`; domain code lives under `features/`.

## Local Setup

Install dependencies:

```bash
npm install
```

Create app-wise env files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Update `backend/.env` if your local PostgreSQL user, password, or database name is different.

Create the database if it does not exist:

```bash
createdb workflow_approval_system
```

Run migrations:

```bash
npm run prisma:migrate --workspace backend
```

Seed demo data:

```bash
npm run seed --workspace backend
```

Start both apps:

```bash
npm run dev
```

Backend runs on `http://localhost:4000`.
Frontend runs on `http://localhost:5173`.

## Useful Commands

```bash
npm run typecheck
npm run lint
npm run build
npm run prisma:generate --workspace backend
npm run seed --workspace backend
```

## Implemented API Surface

Auth:

```txt
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
```

Tenants:

```txt
GET /api/tenants
```

Workflows:

```txt
GET  /api/workflows
POST /api/workflows
GET  /api/workflows/:id
GET  /api/workflows/:id/versions
POST /api/workflows/:id/versions
```

Items:

```txt
GET  /api/items
POST /api/items
GET  /api/items/:id
POST /api/items/:id/transitions
```

Tenant-scoped routes use `Authorization: Bearer <token>` and, when the route needs tenant context, `X-Tenant-ID: <tenant id>`.

## Seed Data

All demo users use this password:

```txt
Password123!
```

### Acme Corp

```txt
alice@acme.com   ADMIN
bob@acme.com     APPROVER
carol@acme.com   MEMBER
```

Workflow:

```txt
Ticket Workflow
NEW -> IN_PROGRESS       no approval
IN_PROGRESS -> DONE      SINGLE approval by APPROVER
SLA: 60 minutes
```

Items:

```txt
Item A   NEW
Item B   IN_PROGRESS with pending approval assigned to Bob
Item C   DONE, approved by Bob
```

Delegation:

```txt
Bob delegates approval authority to Carol for 30 days
```

### Northwind Ops

```txt
maya@northwind.test    ADMIN
arjun@northwind.test   APPROVER
```

Workflow:

```txt
Purchase Request
DRAFT -> REVIEW           no approval
REVIEW -> APPROVED        ALL approval by APPROVER
SLA: 120 minutes
```

Item:

```txt
Renew Postgres monitoring subscription
state: REVIEW
approval assigned to Arjun
```

## Architecture Decisions

- Tenant isolation is app-enforced with authenticated membership checks and tenant-scoped database queries.
- Tenant-scoped tables carry `tenant_id` and have indexes for common tenant-filtered reads.
- Workflow definitions are versioned. Items reference `workflow_version_id`, so future workflow edits do not break existing items.
- Approval rows are attached to `approval_requests`, not only to `(item, transition)`, to avoid reusing stale approvals across repeated transition attempts.
- Item concurrency will use optimistic locking through the `items.version` column.
- Audit logs are append-only in application code and are indexed by tenant, entity, item, and timestamp.
- Env files are app-wise. Backend secrets stay in `backend/.env`; frontend only uses public `VITE_` variables.

## Current Limitations

- Approval action APIs are not implemented yet; the item transition engine can create and inspect approval requests, but approvers cannot approve/reject through an endpoint until the next slice.
- Quorum approval is modeled but not implemented in service logic yet.
- SLA escalation is modeled for later service work; no cron behavior is implemented yet.
- Tenant isolation is currently enforced at the application/query layer, not PostgreSQL row-level security.
- No automated tests have been added yet.
