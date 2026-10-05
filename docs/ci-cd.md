# CI/CD

GitHub Actions validates this repository before a change is merged. It does not deploy the application. AWS, Terraform, ECS, and EKS are a later phase.

```text
Pull request or push to main
        |
        v
GitHub Actions
        |
        +-- Backend CI
        |
        +-- Frontend CI
        |
        +-- Docker Build
                |
                v
        Security scan (Trivy)
                |
                v
        GHCR push (main only)
```

## Workflows

| Workflow | File | When it runs |
| --- | --- | --- |
| CI | `.github/workflows/ci.yml` | Push and pull request to `main` or `develop` |
| Docker | `.github/workflows/docker.yml` | Pull request to `main` or `develop`. Push to `main` also publishes images. |

A pull request is not ready when any of these checks fail:

- Backend CI
- Frontend CI
- Docker Build (bms-backend)
- Docker Build (bms-frontend)

`GHCR Push` runs only after a push to `main`, and only after both image scans succeed. Pull requests build and scan images. They do not publish them.

There is no `develop` branch yet. The workflows already accept it so the same checks apply when that branch is created.

## Backend CI

The job uses Node.js 22, `backend/package-lock.json`, and a disposable PostgreSQL 16 service. The database URL is the CI-only value `postgresql://bms_test:bms_test_password@localhost:5432/bms_test`. It is not a development, staging, or production database.

Steps:

1. `npm ci`
2. `npx prisma generate`
3. `npx prisma migrate deploy`
4. `npm test`
5. `npm audit --audit-level=high`, then fail unless every high or critical finding is the documented Prisma CLI exception

`npm test` runs Node's built-in test runner (`node --test`). The committed tests are unit tests for energy math, maintenance transitions, and the operational health score. There is no API integration suite for authentication, RBAC, buildings, devices, sensors, readings, or alarms. The migration step is what proves the Prisma history can deploy.

The backend has no lint script and no compile step. The production process is `node src/server.js`. CI does not invent either command.

`npm audit` prints the full report. The job fails on any high or critical finding except the accepted Prisma CLI exception: `deepmerge-ts`, `@prisma/config`, and `prisma` ([GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)). That advisory is in the Prisma CLI used to generate the client, and the suggested fix downgrades Prisma. Any other high or critical package fails the job. CI does not run `npm audit fix` and it does not change the lockfile.

## Frontend CI

Steps, from `frontend/`:

1. `npm ci`
2. `npm run lint` (Oxlint)
3. `npm run build`
4. `npm audit --audit-level=high`

There is no frontend test script. The production build is the frontend quality gate. `VITE_API_URL` is set to `http://localhost:3000/api/v1` for the build. That value is public and is not a credential.

## Docker images

Production images use the production Dockerfiles, not the development files that start Vite and `npm run dev`.

| Image | Dockerfile |
| --- | --- |
| `bms-backend` | `docker/backend/Dockerfile.prod` |
| `bms-frontend` | `docker/frontend/Dockerfile.prod` |

The frontend image builds the Vite app and serves it with nginx. `VITE_API_URL` is baked in at build time. The published image uses `http://localhost:3000/api/v1` until a later deployment phase supplies the real API address.

Published names:

```text
ghcr.io/<owner>/bms-backend:<commit-sha>
ghcr.io/<owner>/bms-backend:latest
ghcr.io/<owner>/bms-frontend:<commit-sha>
ghcr.io/<owner>/bms-frontend:latest
```

`<owner>` is the GitHub repository owner in lowercase. Each image is labeled with `org.opencontainers.image.source`, `org.opencontainers.image.revision` (the commit SHA), and `org.opencontainers.image.created`.

Registry login uses the built-in `GITHUB_TOKEN`. The publish job requests `contents: read` and `packages: write`. Every other job requests `contents: read` only. No personal access token, AWS key, or production secret is stored in the workflow files.

## Security scan

Trivy scans each built image before anything is pushed. The workflow fails on HIGH and CRITICAL findings, including findings that do not have a fix yet. Lower severities are not a failure. They still appear in the Trivy log.

Dependency audit uses the same high/critical threshold for npm. A finding fails the job. It is not silenced with an ignore file.

## Local commands

Backend:

```bash
cd backend
npm ci
npx prisma generate
npx prisma migrate deploy
npm test
npm audit --audit-level=high
```

`migrate deploy` needs a disposable `DATABASE_URL`. Do not point it at a shared database when you only want to reproduce CI.

Frontend:

```bash
cd frontend
npm ci
npm run lint
npm run build
npm audit --audit-level=high
```

Production images:

```bash
docker compose -f docker-compose.prod.yml build
```

The development stack remains `docker compose up --build` with `docker-compose.yml`.

## Branch protection

These settings are recommendations for `main`. This repository has not changed branch protection from the workflow.

- Require a pull request before merging
- Require at least one approval
- Require the status checks listed above
- Require the branch to be up to date before merging
- Require conversation resolution
- Do not allow force pushes
- Do not allow deletions

## Secrets

Workflows must not contain `.env` values, database passwords, JWT secrets, registry tokens, or cloud credentials. The CI database password exists only inside the workflow service definition and is not a deployed credential. Future deployment secrets belong in GitHub Actions secrets, not in git.
