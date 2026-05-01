# Collab System

A production-oriented Google Docs-like collaborative SaaS application built as a TypeScript monorepo.

## Stack

- Frontend: React, TypeScript, Vite, TipTap, Yjs
- Backend: NestJS services behind an API gateway
- Database: PostgreSQL
- Cache and realtime scale-out: Redis
- Realtime: Socket.IO with Yjs CRDT updates and awareness
- Object storage: S3-compatible storage, MinIO locally
- Deployment: Docker Compose, Nginx, AWS EC2 friendly

## Folder Structure

```text
collab-system/
  apps/
    frontend/
    api-gateway/
  services/
    auth-service/
    document-service/
    collaboration-service/
    notification-service/
  packages/
    common/
    types/
  infra/
    docker/
      postgres/
    nginx/
    aws/
  docker-compose.yml
```

## Run Locally

Prerequisites:

- Docker Desktop with the Linux engine running
- Ports `8080`, `3000-3004`, `5432`, `6379`, `9000`, and `9001` available

Start everything:

```bash
docker compose up --build
```

Open:

- App: `http://localhost:8080`
- API gateway: `http://localhost:3000/health`
- MinIO console: `http://localhost:9001`

Seeded accounts:

- `owner@example.com` / `password123`
- `editor@example.com` / `password123`
- `viewer@example.com` / `password123`

## Environment

Copy `.env.example` to `.env` for local overrides. The default Compose setup uses:

- Postgres database `collab`
- Redis at `redis://redis:6379`
- MinIO bucket `collab-uploads`
- JWT fallback authentication

For AWS S3, replace the MinIO values with real `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY`. Leave `AWS_S3_ENDPOINT` empty for real S3.

## API Routes

API gateway proxies all REST traffic through `/api` in the Nginx setup, or directly through `http://localhost:3000` during service development.

Auth and users:

- `POST /auth/register`
- `POST /auth/login`
- `GET /users/me`
- `PATCH /users/me`

Workspaces:

- `GET /workspaces`
- `POST /workspaces`
- `GET /workspaces/:workspaceId`
- `POST /workspaces/join`
- `POST /workspaces/:workspaceId/invites`

Documents:

- `GET /workspaces/:workspaceId/documents`
- `POST /workspaces/:workspaceId/documents`
- `GET /documents/:documentId`
- `PATCH /documents/:documentId`
- `DELETE /documents/:documentId`
- `POST /documents/:documentId/share`
- `GET /documents/:documentId/permissions`

Comments:

- `GET /documents/:documentId/comments`
- `POST /documents/:documentId/comments`
- `POST /comments/:commentId/replies`
- `PATCH /comments/:commentId/resolve`

Notifications:

- `GET /notifications`
- `PATCH /notifications/:notificationId/read`
- `PATCH /notifications/read-all`

Files:

- `GET /documents/:documentId/files`
- `POST /documents/:documentId/files/presign`
- `POST /documents/:documentId/files/complete`

## WebSocket Contract

Socket.IO namespace: `/collaboration`

Client auth:

```ts
io('/collaboration', { auth: { token: jwt } });
```

Events:

- `document:join` `{ documentId }`
- `document:sync` `{ documentId, update, role }`
- `document:update` `{ documentId, update }`
- `presence:update` `{ documentId, update }`
- `presence:users` `CollaboratorPresence[]`
- `collaboration:error` `{ message }`

The collaboration service enforces backend permissions before joining, editing, or relaying presence. Yjs updates are persisted to `documents.ydoc_state`, while structured JSON is autosaved through the document REST API.

## Database Schema

The canonical schema is in `infra/docker/postgres/01-init.sql`. Required tables are included:

- `users`
- `workspaces`
- `workspace_members`
- `documents`
- `document_permissions`
- `comments`
- `notifications`

Additional production table:

- `files`

Key indexes cover user email lookup, workspace membership lookup, document listing, document permissions, comments by document, unread notifications, and files by document.

## Permission Model

Document roles:

- `owner`: read, edit, share, delete
- `editor`: read, edit, comment, upload files
- `viewer`: read-only

Workspace roles map to default document access:

- `owner` -> document owner-level access inside the workspace
- `admin` -> editor-level access
- `member` -> viewer-level access

Direct `document_permissions` can grant owner, editor, or viewer roles. Backend guards and services enforce the effective role for every document, comment, upload, and collaboration operation.

## Development Without Docker

If Node.js is installed locally:

```bash
npm install
npm run build
npm run seed
```

Run each service with its workspace script, for example:

```bash
npm run start:dev -w @collab/auth-service
npm run start:dev -w @collab/document-service
npm run start:dev -w @collab/collaboration-service
npm run start:dev -w @collab/notification-service
npm run start:dev -w @collab/api-gateway
npm run dev -w @collab/frontend
```

## Deployment

See `infra/aws/ec2-deploy.md` for EC2, Docker Compose, Nginx, and Let's Encrypt steps.

