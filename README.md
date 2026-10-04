# BMS - Building Management System

![Main Office Building, the seeded example used by this project](docs/images/main-office-building.jpg)

Local development runs three Docker services: a React frontend, an Express API, and PostgreSQL. Prisma is the database layer for the API.

The API authenticates users with JWT and checks roles before each protected request. After login, the app manages the building hierarchy: Building, Floor, Zone, and Room. Devices, sensors, alarms, and energy stay as placeholders. Socket.IO and live sensor readings are not included yet.

## Architecture

| Service    | Role                                    | Host URL              |
| ---------- | --------------------------------------- | --------------------- |
| frontend   | React app served by the Vite dev server | http://localhost:5173 |
| backend    | Express API                             | http://localhost:3000 |
| postgres   | PostgreSQL 16                           | localhost:5432        |

All three services join one Docker network named `bms`.

- The browser opens the frontend at `localhost:5173`.
- The React app calls the API at `VITE_API_URL`, which is `http://localhost:3000/api/v1` in local Docker. The browser runs on the host, so this is the published API port, not the Docker hostname `backend`.
- The Vite dev server can still proxy `/api` to `http://backend:3000` for requests that stay on the frontend origin.
- The API reads `DATABASE_URL` and connects with Prisma. Inside Docker that hostname is `postgres`, not `localhost`.
- PostgreSQL data is stored in the named volume `postgres_data`.

`GET /api/health` runs `SELECT 1` through Prisma and reports whether the API can reach PostgreSQL.

## Database

The location hierarchy is Building, Floor, Zone, Room. A room contains devices. A device contains sensors. Sensor measurements are stored in `device_readings`. Alarms belong to a device and a building, and can optionally point at a zone.

```text
Building
└── Floor
    └── Zone
        └── Room
            └── Device
                ├── Sensor
                │   └── DeviceReading
                └── Alarm
```

Prisma maps these models to snake_case PostgreSQL tables. `DATABASE_URL` is read from the environment in `prisma/schema.prisma`. Compose builds it from `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB`:

```text
postgresql://POSTGRES_USER:POSTGRES_PASSWORD@postgres:5432/POSTGRES_DB
```

Deleting a building cascades through floors, zones, and rooms. Deleting a device, sensor, or alarm is restricted while related history exists, so device readings are not removed just because a device row is deleted. An optional alarm zone is cleared with `ON DELETE SET NULL` if that zone is removed. Users are stored separately from the building hierarchy. Deleting a user cascades to that user's refresh-token rows. Only a SHA-256 hash of each refresh token is stored.

`device_readings.id` is a sequential integer. Queries by sensor and time use the index on `(sensor_id, recorded_at)`. Sensor type and unit are stored as text so new measurement kinds do not require an application change. Device type, record status, alarm severity, and alarm status are PostgreSQL enums.

## Prerequisites

- Docker Desktop, with the Docker Compose plugin
- On Windows, the WSL 2 backend. That requires the Virtual Machine Platform Windows feature, and virtualization enabled in firmware.
- Copy `.env.example` to `.env` if you want to change the local defaults

Compose has local defaults, so the stack can start even before `.env` exists. Those defaults are for development on your machine. Change `POSTGRES_PASSWORD` before using this project anywhere else.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `POSTGRES_USER` | PostgreSQL user |
| `POSTGRES_PASSWORD` | PostgreSQL password |
| `POSTGRES_DB` | Database name |
| `POSTGRES_PORT` | Host port published for PostgreSQL |
| `BACKEND_PORT` | Host port published for the API |
| `FRONTEND_PORT` | Host port published for the web app |
| `NODE_ENV` | Runtime environment |
| `DATABASE_URL` | Set by Compose for the backend. Prisma uses this variable. |
| `PORT` | Port the API listens on inside the container |
| `FRONTEND_URL` | Browser origin allowed to call the API. Compose sets this to the frontend host URL. Production does not allow every origin. |
| `JWT_ACCESS_SECRET` | Secret used to sign access tokens. Required. Replace the development default before production. |
| `JWT_REFRESH_SECRET` | Secret used to sign refresh tokens. Required. Replace the development default before production. |
| `JWT_ACCESS_EXPIRES_IN` | Access token lifetime. Default `15m`. |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifetime. Default `7d`. |
| `SEED_DEFAULT_PASSWORD` | Password for the five seeded development users. Development only. The seed refuses the default password when `NODE_ENV` is `production`. |
| `AUTH_RATE_LIMIT_MAX` | Authentication attempts allowed per window. Default `100` in development and `20` in production when unset inside the process. |
| `AUTH_RATE_LIMIT_WINDOW_MS` | Authentication rate-limit window. Default `900000` (15 minutes). |
| `VITE_API_URL` | Public API base used by the browser. Compose sets `http://localhost:3000/api/v1`. This value is visible in the browser. Do not put JWT secrets, database passwords, or private keys in any `VITE_` variable. |

## Start

From the project root:

```bash
docker compose up --build
```

Stop the stack with `Ctrl+C`, then:

```bash
docker compose down
```

`docker compose down` removes containers and keeps the `postgres_data` volume. Add `-v` only when you intend to delete the database data.

## Prisma

Run these commands from the project root after the stack is up. They execute inside the backend container, which already has `DATABASE_URL`.

Create a new migration while developing the schema:

```bash
docker compose exec backend npm run db:migrate -- --name init
```

Apply migrations that are already in `backend/prisma/migrations`:

```bash
docker compose exec backend npx prisma migrate deploy
```

Generate the Prisma client after a schema change:

```bash
docker compose exec backend npm run db:generate
```

Load the development building, devices, and sensors:

```bash
docker compose exec backend npm run db:seed
```

The seed creates Main Office Building and does not insert device readings.

## Verify

API health:

```bash
curl http://localhost:3000/api/health
```

Expected response:

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "database": "connected"
  }
}
```

If PostgreSQL is unreachable, the same endpoint returns HTTP 503 with `"status": "unhealthy"`.

Open http://localhost:5173. The page loads that same health check through the frontend proxy.

List the tables:

```bash
docker compose exec postgres psql -U bms_user -d bms -c "\dt"
```

## Project layout

```text
frontend/                 React + Vite application
backend/                  Express API
  prisma/schema.prisma    Database models
  prisma/seed.js          Development data
  prisma/migrations/      SQL migrations
  src/server.js           Process startup and shutdown
  src/app.js              Express application and route registration
  src/config/env.js       Environment variable validation
  src/db/prisma.js        Shared Prisma client
  src/controllers/        HTTP handlers
  src/services/           Prisma queries
  src/routes/             /api/health and /api/v1 routes
  src/validators/         Request validation rules
  src/middleware/         CORS, 404, and error handling
docker/frontend/          Frontend development image
docker/backend/           Backend development image
docker-compose.yml        frontend, backend, and postgres
.env.example              Documented local configuration
```

PostgreSQL uses the official `postgres:16-alpine` image. Its configuration is in `docker-compose.yml`.

## API

Business routes are versioned under `/api/v1`. `GET /api/health` stays unversioned for container checks.

Successful resource response:

```json
{
  "success": true,
  "data": {},
  "message": "Building retrieved successfully"
}
```

Collection response:

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

Error response:

```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Building not found"
  }
}
```

Validation errors include an `error.details` array. Responses do not include stack traces, SQL, or Prisma internals.

List endpoints default to `page=1` and `limit=20`. The maximum `limit` is 100. Readings are sorted by `recordedAt` descending.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/health` | Express and database status |
| GET, POST | `/api/v1/buildings` | |
| GET, PUT, DELETE | `/api/v1/buildings/:id` | Detail includes floors, zones, rooms, and devices |
| GET, POST | `/api/v1/floors` | Filter with `buildingId` |
| GET, PUT, DELETE | `/api/v1/floors/:id` | |
| GET, POST | `/api/v1/zones` | Filter with `floorId` |
| GET, PUT, DELETE | `/api/v1/zones/:id` | |
| GET, POST | `/api/v1/rooms` | Filter with `zoneId` |
| GET, PUT, DELETE | `/api/v1/rooms/:id` | |
| GET, POST | `/api/v1/devices` | Filter with `search`, `roomId`, `buildingId`, `status`, or `deviceType` |
| GET, PUT, DELETE | `/api/v1/devices/:id` | |
| GET, POST | `/api/v1/sensors` | Filter with `deviceId` |
| GET, PUT, DELETE | `/api/v1/sensors/:id` | |
| GET, POST | `/api/v1/readings` | Filter with `sensorId`, `from`, and `to` |
| GET | `/api/v1/readings/:id` | |
| GET, POST | `/api/v1/alarms` | Filter with `status`, `severity`, or `buildingId` |
| GET, PUT | `/api/v1/alarms/:id` | Alarms cannot be deleted |

Device `status` is `ONLINE`, `OFFLINE`, `MAINTENANCE`, or `DISABLED`. Device `deviceType` is one of `HVAC`, `LIGHT`, `ENERGY_METER`, `TEMPERATURE_SENSOR`, `HUMIDITY_SENSOR`, `SMOKE_SENSOR`, `MOTION_SENSOR`, and `WATER_LEAK_SENSOR`. Building `status` stays `ACTIVE` or `INACTIVE`. Alarm `severity` is `LOW`, `MEDIUM`, `HIGH`, or `CRITICAL`. Alarm `status` is `ACTIVE`, `ACKNOWLEDGED`, or `RESOLVED`.

`GET /api/health` is public. Every `/api/v1` route except registration, login, refresh, and logout requires `Authorization: Bearer <accessToken>`.

Create a building after login:

```bash
curl -X POST http://localhost:3000/api/v1/buildings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <accessToken>" \
  -d "{\"name\":\"Annex\",\"code\":\"ANNEX\",\"address\":\"12 Side Street\"}"
```

Read readings for one sensor:

```bash
curl "http://localhost:3000/api/v1/readings?sensorId=<id>&from=2026-01-01T00:00:00.000Z&to=2026-12-31T23:59:59.000Z&page=1&limit=50" \
  -H "Authorization: Bearer <accessToken>"
```

## Authentication

Passwords are hashed with bcrypt before they are stored. API responses never include `passwordHash`. Access tokens are short-lived JWTs signed with `JWT_ACCESS_SECRET`. The payload contains `sub` (the user id), `role`, and a unique `jti`. It does not contain the email or password. Refresh tokens are signed with `JWT_REFRESH_SECRET` and contain `sub` and a unique `jti`. The database stores only the SHA-256 hash of each refresh token, so a stolen database row cannot be replayed as a token. Logout sets `revokedAt` on that row. Refresh rotates the token: the presented refresh token is revoked and a new pair is issued.

```text
Login
  ↓
Access Token
  ↓
Protected API
  ↓
JWT Middleware
  ↓
User
  ↓
Role Authorization
  ↓
Controller
  ↓
Service
  ↓
Prisma
  ↓
PostgreSQL
```

Public registration always creates a `VIEWER`. Sending any other role is rejected. A super admin is created by the development seed, or later by `POST /api/v1/users`, which is limited to `SUPER_ADMIN`.

Login failure always returns `Invalid email or password`. That includes an unknown email, a wrong password, and a disabled account. A disabled user's existing access token is also rejected.

| Method | Path | Access |
| --- | --- | --- |
| POST | `/api/v1/auth/register` | Public. Creates a `VIEWER` only. |
| POST | `/api/v1/auth/login` | Public. Returns the user, `accessToken`, and `refreshToken`. |
| POST | `/api/v1/auth/refresh` | Public. Body `{ "refreshToken": "..." }`. Returns a new access token and refresh token. |
| POST | `/api/v1/auth/logout` | Public. Body `{ "refreshToken": "..." }`. Revokes that refresh token. |
| GET | `/api/v1/auth/me` | Authenticated. Returns the current user without `passwordHash`. |
| GET, POST | `/api/v1/users` | `SUPER_ADMIN` |
| GET, PUT | `/api/v1/users/:id` | `SUPER_ADMIN` |
| PATCH | `/api/v1/users/:id/status` | `SUPER_ADMIN`. Body `{ "isActive": true }` or `{ "isActive": false }`. |

Login:

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"viewer@bms.local\",\"password\":\"ChangeMe-Dev-Only-1\"}"
```

Successful login:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "name": "Viewer",
      "email": "viewer@bms.local",
      "role": "VIEWER"
    },
    "accessToken": "...",
    "refreshToken": "..."
  },
  "message": "Login successful"
}
```

Missing authentication:

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

A role that is not allowed for the route:

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to perform this action"
  }
}
```

### Roles

| Role | Access |
| --- | --- |
| `SUPER_ADMIN` | Full access, including users, buildings, structure, devices, sensors, readings, and alarms. Building deletion is limited to this role. |
| `BUILDING_MANAGER` | View buildings. Create and update buildings. Manage floors, zones, and rooms. Create, update, and delete devices. View sensors and readings. View alarms and acknowledge them. |
| `FACILITY_MANAGER` | View buildings, floors, zones, and rooms. Manage devices and sensors. View readings. Create and update alarms. |
| `TECHNICIAN` | View buildings, structure, devices, sensors, readings, and alarms. Update a device's `status` only. Acknowledge alarms. |
| `VIEWER` | Read-only access to buildings, structure, devices, sensors, readings, and alarms. |

There is no building-assignment table yet, so device access is by role rather than by an assigned building. A technician can read the same records as the other authenticated roles. Technician writes stay limited to device status and alarm acknowledgement.

Authorization is centralized in `backend/src/auth/permissions.js`. Routes call `authorize('permission')` instead of checking roles inside controllers. A technician device update that includes any field other than `status` is rejected. A building manager or technician can set an alarm to `ACKNOWLEDGED` only.

Helmet sets the API security headers. CORS allows only the exact `FRONTEND_URL`, including the `Authorization` header, and never `*`. Login, registration, refresh, and logout are rate limited.

### Development seed users

These accounts are created by `npm run db:seed`. They share `SEED_DEFAULT_PASSWORD` (`ChangeMe-Dev-Only-1` unless you override it). **Development only. Change the password and both JWT secrets before production.**

| Email | Role |
| --- | --- |
| `super.admin@bms.local` | `SUPER_ADMIN` |
| `building.manager@bms.local` | `BUILDING_MANAGER` |
| `facility.manager@bms.local` | `FACILITY_MANAGER` |
| `technician@bms.local` | `TECHNICIAN` |
| `viewer@bms.local` | `VIEWER` |

### How to test authentication

1. Start the stack and run the migration and seed.
2. `POST /api/v1/auth/register` with a name, email, and password of at least 8 characters. The new user is a viewer.
3. `POST /api/v1/auth/login` and keep `accessToken` and `refreshToken`.
4. `GET /api/v1/auth/me` with `Authorization: Bearer <accessToken>`.
5. Call `GET /api/v1/buildings` and `GET /api/v1/devices` with that token.
6. Repeat a delete or other write with the viewer token and expect `403`.
7. Log in as `super.admin@bms.local` and delete an empty building you created.
8. Call a protected route with no token and with `Authorization: Bearer not-a-token`. Both return `401`.
9. Disable a user with `PATCH /api/v1/users/:id/status` and confirm login and the old access token fail.
10. Log in with a wrong password and with an unknown email. Both return `Invalid email or password`.
11. `POST /api/v1/auth/logout` with the refresh token, then confirm `POST /api/v1/auth/refresh` with that same token fails.
12. Log in again, call refresh, and use the new access token on `GET /api/v1/auth/me`.

## Frontend

```text
React
  ↓
Axios
  ↓
Express API
  ↓
JWT Authentication
  ↓
Protected API
```

| Path | Access |
| --- | --- |
| `/login` | Public. An authenticated user is sent to `/dashboard`. |
| `/dashboard` | Authenticated. Shows the signed-in user and live API health. It does not show invented building statistics. |
| `/buildings` | Authenticated. Search, filter, and paginate buildings. |
| `/buildings/:id` | Authenticated building details, with floor, zone, and room counts from the API. |
| `/buildings/:id/floors` | Authenticated floor management for one building. |
| `/floors/:id` | Authenticated floor details and its zones. |
| `/zones/:id` | Authenticated zone details and its rooms. |
| `/rooms/:id` | Authenticated room details. |
| `/devices` | Authenticated device list. Search, filters, and pagination come from the API. |
| `/devices/:id` | Authenticated device details, location, and any configured sensors. |
| `/sensors`, `/alarms`, `/energy` | Authenticated placeholders. |
| `/settings` | Authenticated placeholder. The sidebar link is shown to `SUPER_ADMIN` only. |

The browser keeps the access token and refresh token in `sessionStorage` for the current tab. The password is never stored. Axios adds `Authorization: Bearer <accessToken>` to API requests. A `401` on a protected request refreshes the session once through `POST /api/v1/auth/refresh`. If refresh fails, the app clears the session and returns to `/login`. Logout calls `POST /api/v1/auth/logout`, clears both tokens, and returns to `/login`.

`hasRole` and `hasAnyRole` only change what the interface shows. The API still enforces every permission.

Open http://localhost:5173 after `docker compose up --build`. Sign in with a development user, for example `building.manager@bms.local` and `ChangeMe-Dev-Only-1`. Refresh the browser to confirm the session is restored. Log out and confirm `/dashboard` returns to `/login`.

## Building hierarchy

```text
Building
└── Floor
    └── Zone
        └── Room
```

The browser manages this hierarchy through the API. It does not connect to PostgreSQL. Creating a building calls `POST /api/v1/buildings`, which Prisma writes to PostgreSQL, and the list is loaded again with `GET /api/v1/buildings`.

| Area | List | Create | Update | Delete |
| --- | --- | --- | --- | --- |
| Buildings | `GET /api/v1/buildings` | `POST /api/v1/buildings` | `PUT /api/v1/buildings/:id` | `DELETE /api/v1/buildings/:id` |
| Floors | `GET /api/v1/floors?buildingId=` | `POST /api/v1/floors` | `PUT /api/v1/floors/:id` | `DELETE /api/v1/floors/:id` |
| Zones | `GET /api/v1/zones?floorId=` | `POST /api/v1/zones` | `PUT /api/v1/zones/:id` | `DELETE /api/v1/zones/:id` |
| Rooms | `GET /api/v1/rooms?zoneId=` | `POST /api/v1/rooms` | `PUT /api/v1/rooms/:id` | `DELETE /api/v1/rooms/:id` |

Building search uses `search` for name or code, and `status` for `ACTIVE` or `INACTIVE`. Pagination uses the API `page` and `limit` values. A building code is unique. A floor number is unique inside its building. A zone code is unique on its floor. A room number is unique in its zone.

`SUPER_ADMIN` can create, update, and delete buildings and their structure. `BUILDING_MANAGER` can create and update buildings and manage floors, zones, and rooms. Building deletion stays with `SUPER_ADMIN`. `FACILITY_MANAGER`, `TECHNICIAN`, and `VIEWER` can read the hierarchy. The screens hide actions the role cannot perform. A `403` from the API is still shown as a permission message.

Open Buildings after signing in. The seeded example is **Main Office Building** (`MAIN`), at 100 Market Street.

| Ground Floor — Reception | Ground Floor — Server Room |
| --- | --- |
| ![Reception lobby on the ground floor](docs/images/ground-floor-reception.jpg) | ![Server room in the server zone](docs/images/server-room.jpg) |

| First Floor — Offices |
| --- |
| ![Office floor with enclosed offices](docs/images/office-floor.jpg) |

```text
Main Office Building
├── Ground Floor
│   ├── Reception Zone
│   │   └── Reception
│   └── Server Zone
│       └── Server Room
└── First Floor
    └── Office Zone
        ├── Office 101
        └── Office 102
```

## Devices

A device is equipment installed in a room:

```text
Building
└── Floor
    └── Zone
        └── Room
            └── Device
                └── Sensor
```

Supported types are `HVAC`, `LIGHT`, `ENERGY_METER`, `TEMPERATURE_SENSOR`, `HUMIDITY_SENSOR`, `SMOKE_SENSOR`, `MOTION_SENSOR`, and `WATER_LEAK_SENSOR`. Status is `ONLINE`, `OFFLINE`, `MAINTENANCE`, or `DISABLED`. `lastSeenAt` is displayed when the database has a value and otherwise shows "Never connected". The application does not invent or simulate that timestamp.

| Action | Method and path | Roles |
| --- | --- | --- |
| List | `GET /api/v1/devices` | Every authenticated role |
| Create | `POST /api/v1/devices` | `SUPER_ADMIN`, `BUILDING_MANAGER`, `FACILITY_MANAGER` |
| Read | `GET /api/v1/devices/:id` | Every authenticated role |
| Update | `PUT /api/v1/devices/:id` | Managers can update the record. `TECHNICIAN` can send `status` only. |
| Delete | `DELETE /api/v1/devices/:id` | `SUPER_ADMIN`, `BUILDING_MANAGER`, `FACILITY_MANAGER` |

List filters are `search` (name or code), `deviceType`, `status`, `buildingId`, and `roomId`. Pagination uses `page` (default 1) and `limit` (default 20, maximum 100). Device codes are unique. A device must reference an existing room. Deleting a device is rejected while sensors, readings, or alarms still depend on it. Those historical rows are not cascaded away.

The device form loads buildings, then the floors of the selected building, then zones, then rooms. It does not download the whole hierarchy at once.

Development seed equipment for Main Office Building, with no readings and no live connection:

| Location | Device | Code | Status |
| --- | --- | --- | --- |
| Reception | Reception HVAC | `HVAC-RECEPTION-01` | `ONLINE` |
| Server Room | Server Room HVAC | `HVAC-SERVER-01` | `ONLINE` |
| Server Room | Server Temperature Sensor | `TEMP-SERVER-01` | `ONLINE` |
| Server Room | Server Room Energy Meter | `METER-SERVER-01` | `MAINTENANCE` |
| Office 101 | Office HVAC | `HVAC-OFFICE-101` | `OFFLINE` |
| Office 101 | Office Temperature Sensor | `TEMP-OFFICE-101` | `ONLINE` |

Reception HVAC and the server energy meter also have sensor definitions. The other seed devices have no sensors yet.

Apply the device status migration and refresh seed data from the project root after the stack is up:

```bash
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npm run db:seed
```

## Not in this phase

Socket.IO, sensor management, sensor readings, energy analytics, and alarm automation. The Sensors, Alarms, and Energy sidebar links remain placeholders. The dashboard still shows only the signed-in user and API health.
