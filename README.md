# BMS - Building Management System

![Main Office Building, the seeded example used by this project](docs/images/main-office-building.jpg)

Local development runs three Docker services: a React frontend, an Express API, and PostgreSQL. Prisma is the database layer for the API.

The API authenticates users with JWT and checks roles before each protected request. After login, the app manages the building hierarchy: Building, Floor, Zone, and Room. Devices, sensors, alarms, live updates, energy analytics, and maintenance work orders are implemented. MQTT and notification delivery are not included yet.

## Architecture

| Service    | Role                                    | Host URL              |
| ---------- | --------------------------------------- | --------------------- |
| frontend   | React app served by the Vite dev server | http://localhost:5173 |
| backend    | Express API and Socket.IO               | http://localhost:3000 |
| postgres   | PostgreSQL 16                           | localhost:5432        |

All three services join one Docker network named `bms`.

- The browser opens the frontend at `localhost:5173`.
- The React app calls the API at `VITE_API_URL`, which is `http://localhost:3000/api/v1` in local Docker. The browser runs on the host, so this is the published API port, not the Docker hostname `backend`.
- The same browser opens one Socket.IO connection to that API origin (`http://localhost:3000`). REST loads each page. Socket.IO applies later changes.
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
| GET, POST | `/api/v1/sensors` | Filter with `search`, `deviceId`, `sensorType`, `roomId`, or `buildingId` |
| GET, PUT, DELETE | `/api/v1/sensors/:id` | |
| GET, POST | `/api/v1/readings` | Filter with `sensorId`, `from`, and `to` |
| GET | `/api/v1/readings/:id` | |
| GET | `/api/v1/alarms` | Filter with `status`, `severity`, `type`, `buildingId`, `deviceId`, `sensorId`, `search`, `from`, and `to` |
| GET | `/api/v1/alarms/summary` | Counts of active alarms by severity |
| GET | `/api/v1/alarms/:id` | Alarm, device, sensor, and location |
| PATCH | `/api/v1/alarms/:id/acknowledge` | `ACTIVE` to `ACKNOWLEDGED` |
| PATCH | `/api/v1/alarms/:id/resolve` | `ACTIVE` or `ACKNOWLEDGED` to `RESOLVED` |

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
| `BUILDING_MANAGER` | View buildings. Create and update buildings. Manage floors, zones, and rooms. Create, update, and delete devices. Create, update, and delete sensors. View readings. View, acknowledge, and resolve alarms. |
| `FACILITY_MANAGER` | View buildings, floors, zones, and rooms. Manage devices and sensors. View and create readings. View, acknowledge, and resolve alarms. |
| `TECHNICIAN` | View buildings, structure, devices, sensors, readings, and alarms. Update a device's `status` only. Create readings. Acknowledge and resolve alarms. |
| `VIEWER` | Read-only access to buildings, structure, devices, sensors, readings, and alarms. |

There is no building-assignment table yet, so device, sensor, and reading access is by role rather than by an assigned building. A technician can read the same records as the other authenticated roles. Technician writes stay limited to device status, manual readings, and alarm acknowledgement. Building managers can manage sensors and can view readings, but they cannot create readings.

Authorization is centralized in `backend/src/auth/permissions.js`. Routes call `authorize('permission')` instead of checking roles inside controllers. A technician device update that includes any field other than `status` is rejected. A building manager or technician can set an alarm to `ACKNOWLEDGED` only.

Helmet sets the API security headers. CORS allows only the exact `FRONTEND_URL`, including the `Authorization` header, and never `*`. Login, registration, refresh, and logout are rate limited.

### Development seed users

These accounts are created by `npm run db:seed`. Every account uses the same development password from `SEED_DEFAULT_PASSWORD`. **Development only. Change the password and both JWT secrets before production.**

Sign in at http://localhost:5173/login.

| Name | Email | Password | Role |
| --- | --- | --- | --- |
| Super Admin | `super.admin@bms.local` | `ChangeMe-Dev-Only-1` | `SUPER_ADMIN` |
| Building Manager | `building.manager@bms.local` | `ChangeMe-Dev-Only-1` | `BUILDING_MANAGER` |
| Facility Manager | `facility.manager@bms.local` | `ChangeMe-Dev-Only-1` | `FACILITY_MANAGER` |
| Technician | `technician@bms.local` | `ChangeMe-Dev-Only-1` | `TECHNICIAN` |
| Viewer | `viewer@bms.local` | `ChangeMe-Dev-Only-1` | `VIEWER` |

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
| `/devices/:id` | Authenticated device details, location, sensors, maintenance, and the latest reading for each sensor. |
| `/sensors` | Authenticated sensor list. Search, filters, and pagination come from the API. |
| `/sensors/:id` | Authenticated sensor details, latest reading, time-series chart, and reading history. |
| `/alarms`, `/alarms/:id` | Authenticated alarm list and detail. |
| `/energy` | Energy summary, trend, building comparison, cost, meters, and period comparison. |
| `/maintenance` | Work orders, filters, and the maintenance summary. |
| `/maintenance/schedules` | Preventive schedules with overdue, due, upcoming, and inactive states. |
| `/maintenance/work-orders/:id` | Work order detail, timeline, activities, costs, and lifecycle actions. |
| `/reports` | Operational reports: health, devices, alarms, energy, maintenance, and building comparison. |
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

Development seed equipment for Main Office Building. These are demo records, not live connections:

| Location | Device | Code | Status |
| --- | --- | --- | --- |
| Reception | Reception HVAC | `HVAC-RECEPTION-01` | `ONLINE` |
| Server Room | Server Room HVAC | `HVAC-SERVER-01` | `ONLINE` |
| Server Room | Server Temperature Sensor | `TEMP-SERVER-01` | `ONLINE` |
| Server Room | Server Room Energy Meter | `METER-SERVER-01` | `MAINTENANCE` |
| Office 101 | Office HVAC | `HVAC-OFFICE-101` | `OFFLINE` |
| Office 101 | Office Temperature Sensor | `TEMP-OFFICE-101` | `ONLINE` |

## Sensors and readings

A sensor is a measurement channel on a device. A device reading is one numeric sample from that sensor:

```text
Device
└── Sensor
    └── DeviceReading
```

Sensor types are `TEMPERATURE`, `HUMIDITY`, `SMOKE`, `MOTION`, `WATER_LEAK`, `ENERGY`, `POWER`, `VOLTAGE`, `CURRENT`, and `PRESSURE`. The unit must match the type. For example, temperature uses `°C` or `°F`, humidity uses `%`, and energy uses `kWh`. `minValue` and `maxValue` are operating thresholds. A reading outside that range is stored and marked `outOfRange`. Creating a reading also evaluates those thresholds and may open, continue, or resolve an alarm. The reading itself is never rejected for being outside the range.

| Action | Method and path | Roles |
| --- | --- | --- |
| List sensors | `GET /api/v1/sensors` | Every authenticated role |
| Create sensor | `POST /api/v1/sensors` | `SUPER_ADMIN`, `BUILDING_MANAGER`, `FACILITY_MANAGER` |
| Read sensor | `GET /api/v1/sensors/:id` | Every authenticated role |
| Update sensor | `PUT /api/v1/sensors/:id` | `SUPER_ADMIN`, `BUILDING_MANAGER`, `FACILITY_MANAGER` |
| Delete sensor | `DELETE /api/v1/sensors/:id` | `SUPER_ADMIN`, `BUILDING_MANAGER`, `FACILITY_MANAGER` |
| List readings | `GET /api/v1/readings` | Every authenticated role |
| Read one reading | `GET /api/v1/readings/:id` | Every authenticated role |
| Create reading | `POST /api/v1/readings` | `SUPER_ADMIN`, `FACILITY_MANAGER`, `TECHNICIAN` |

Sensor list filters are `search` (name), `sensorType`, `deviceId`, `roomId`, and `buildingId`. Reading list filters are `sensorId`, `from`, and `to`. Readings are newest first. If `recordedAt` is omitted, the server uses the current time. Pagination uses `page` (default 1) and `limit` (default 20, maximum 100).

Deleting a sensor that already has readings returns `409` with code `SENSOR_HAS_READINGS`. Historical readings are not cascaded away. Deleting a device that still has sensors is also rejected.

The sensor form selects Building, Floor, Zone, Room, then Device, loading each level from the existing list APIs. The sensor detail page charts readings for the last hour, 24 hours, or 7 days. The chart uses readings returned by the API and draws the configured minimum and maximum as dashed threshold lines. MQTT and IoT gateway ingestion are deferred.

Development seed sensors and a small reading history, treated as demo data:

| Device | Sensor | Unit | Readings |
| --- | --- | --- | --- |
| Reception HVAC | Supply Air Temperature | `°C`, range 18–28 | 12 samples. One historical spike and a current value of 31 |
| Reception HVAC | Supply Air Humidity | `%`, range 30–60 | 12 samples, latest 72 |
| Server Room Energy Meter | Active Energy | `kWh`, minimum 0 | 12 samples inside range |
| Office Temperature Sensor | Office Temperature | `°C`, range 18–26 | 12 samples inside range |
| Office HVAC | Office Humidity | `%`, range 30–60 | none, so deletion can be tried safely |
| Server Temperature Sensor | Rack Temperature | `°C`, range 16–27 | one reading, 36.5 |
| Server Room HVAC | Room Smoke | `ppm`, range 0–50 | one reading, 62 |

Re-running the seed replaces readings on those sensors and replaces demo alarms for Main Office Building. It does not generate a large history.

## Alarms

An alarm is an episode for one abnormal condition. Readings stay stored either way.

```text
Reading
  ↓
Threshold evaluation
  ↓
Inside min/max ─────────→ resolve an open episode, if one exists
  ↓
Outside min/max
  ↓
Open episode for this sensor and type?
  ├── Yes → keep that episode and refresh the message
  └── No  → create a new ACTIVE alarm
```

A later normal reading resolves an `ACTIVE` or `ACKNOWLEDGED` episode and sets `resolvedAt` to the reading time. History is kept. The next abnormal reading starts a new episode. A reading that is older than the sensor's newest sample is stored and does not change the current episode.

Lifecycle:

```text
ACTIVE → ACKNOWLEDGED → RESOLVED
ACTIVE → RESOLVED
```

`RESOLVED` cannot return to `ACTIVE`. Acknowledge and resolve use dedicated endpoints. A generic status update is not accepted.

Severity uses the configured span (`maxValue - minValue`) when both bounds exist:

| Condition | Severity |
| --- | --- |
| Above maximum, excess under half the span | `HIGH` |
| Above maximum, excess at least half the span | `CRITICAL` |
| Above maximum, only a maximum is configured, value at least 1.5 times that maximum | `CRITICAL` |
| Below minimum, deficit under 10% of the span | `LOW` |
| Below minimum, deficit from 10% to under 25% | `MEDIUM` |
| Below minimum, deficit from 25% to under 50% | `HIGH` |
| Below minimum, deficit at least half the span | `CRITICAL` |
| Water leak outside range | `CRITICAL` |

Examples for temperature 18–28 °C: 31 °C is `HIGH`, and 36 °C is `CRITICAL`.

Types follow the sensor: `TEMPERATURE_HIGH`, `TEMPERATURE_LOW`, `HUMIDITY_HIGH`, `HUMIDITY_LOW`, `SMOKE_DETECTED`, `WATER_LEAK`, `ENERGY_THRESHOLD` when energy is above maximum, and `SENSOR_OUT_OF_RANGE` for the other channels. `DEVICE_OFFLINE` is reserved for a later device-status check and is not raised from a reading.

| Action | Method and path | Roles |
| --- | --- | --- |
| List | `GET /api/v1/alarms` | Every authenticated role |
| Summary | `GET /api/v1/alarms/summary` | Every authenticated role |
| Read | `GET /api/v1/alarms/:id` | Every authenticated role |
| Acknowledge | `PATCH /api/v1/alarms/:id/acknowledge` | `SUPER_ADMIN`, `BUILDING_MANAGER`, `FACILITY_MANAGER`, `TECHNICIAN` |
| Resolve | `PATCH /api/v1/alarms/:id/resolve` | `SUPER_ADMIN`, `BUILDING_MANAGER`, `FACILITY_MANAGER`, `TECHNICIAN` |

`VIEWER` can read alarms and cannot acknowledge or resolve them. There is still no per-building assignment table, so an authorized role can act on alarms in every building. List filters are `search` (message), `status`, `severity`, `type`, `buildingId`, `deviceId`, `sensorId`, `from`, and `to`. Results are newest `triggeredAt` first. Pagination uses `page` (default 1) and `limit` (default 20, maximum 100). An invalid transition returns `409` `INVALID_ALARM_TRANSITION`.

The alarm list defaults to `ACTIVE` and can show all statuses. The dashboard summary counts active alarms from `GET /api/v1/alarms/summary`. Device and sensor pages list the five newest related alarms.

Development seed alarms for Main Office Building:

| Scenario | Sensor or device | Status |
| --- | --- | --- |
| Normal temperature | Office Temperature | no alarm |
| Active high temperature | Supply Air Temperature at 31 °C | `ACTIVE` `HIGH` |
| Resolved historical spike | Supply Air Temperature at 33.5 °C | `RESOLVED` `CRITICAL` |
| Active humidity | Supply Air Humidity at 72% | `ACTIVE` `HIGH` |
| Critical temperature | Rack Temperature at 36.5 °C | `ACTIVE` `CRITICAL` |
| Acknowledged smoke | Room Smoke at 62 ppm | `ACKNOWLEDGED` `HIGH` |

Apply migrations and refresh seed data from the project root after the stack is up:

```bash
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npm run db:seed
```

## Real-time updates

Socket.IO is attached to the same HTTP server as Express. `GET /api/health` and the REST API stay the source of truth for the first page load, history, filters, and pagination. Socket.IO only delivers live changes after that.

```text
React frontend
  ├── REST ─────────────► Express routes / services ─► Prisma ─► PostgreSQL
  └── Socket.IO ────────► same HTTP server
                            └── realtime service emits after a successful write
```

The browser sends the current access token in the Socket.IO handshake (`auth.token`). The server verifies that JWT with the existing access-token secret, loads the user, and rejects the connection when the token is missing, invalid, or belongs to an inactive user. The role comes from that user record. The client does not choose its role. Tokens are not written to the server log.

Connection logs look like `Socket connected: <user-id>` and `Socket disconnected: <user-id>`.

Rooms are explicit. After the page loads, the client asks to join `building:<id>`, `device:<id>`, or `sensor:<id>`. The server joins a room only when that record exists and the user's role can read devices. There is no per-building assignment table, matching the REST API: an authenticated reader can open any existing building, device, or sensor. Events are emitted only to those rooms, not to every connected client. A user who has joined Building A does not receive events emitted only to Building B.

| Event | Trigger | Purpose |
| --- | --- | --- |
| `reading:created` | `POST /api/v1/readings` stores a reading | Latest value, chart, device readings, and the visible energy figures |
| `alarm:created` | Evaluation creates a new alarm episode | Dashboard, alarm list, device and sensor alarm lists |
| `alarm:acknowledged` | `PATCH /api/v1/alarms/:id/acknowledge` | Status and active counts |
| `alarm:resolved` | Manual resolve, or a normal reading resolving an open episode | Status and active counts |
| `device:statusChanged` | A device update changes `status` | Device page status |
| `maintenance:created`, `maintenance:assigned`, `maintenance:started`, `maintenance:onHold`, `maintenance:resumed`, `maintenance:completed`, `maintenance:cancelled` | A work order is created or changes status | Maintenance list, work order detail, and the dashboard summary |

Payloads stay small. A reading event includes `id`, `sensorId`, `deviceId`, `buildingId`, `value`, `unit`, `recordedAt`, and `outOfRange`. Alarm events include `id`, `type`, `severity`, `status`, `message`, `deviceId`, `buildingId`, `sensorId`, `triggeredAt`, `acknowledgedAt`, `resolvedAt`, `previousStatus`, and the device and building names. A device event includes `deviceId`, `status`, `updatedAt`, and `buildingId`. `previousStatus` lets the dashboard lower an active count only when the alarm was active. Historical reading lists are not sent on the socket.

The client retries the socket up to 12 times, waiting from 1 second up to 8 seconds. If that budget runs out while the server is still down, it tries four more times, 10 seconds apart, and then stays offline until the next login or page load. After a successful reconnect it reloads the visible page through REST, then keeps listening. An expired access token uses the existing refresh-token request. The new access token is used for the next socket handshake. Logout disconnects the socket and drops its listeners.

The header shows a small status: Live, Reconnecting..., or Offline.

## Energy

An energy meter is a device with `deviceType` `ENERGY_METER`. It uses the existing sensor and reading tables. Cumulative energy is an `ENERGY` sensor in `kWh` or `Wh`. Instantaneous power is a `POWER` sensor in `kW` or `W`. Voltage and current use `V` and `A`. There is no separate meter table.

```text
Building
  └── Energy meter device
        └── Energy sensor
              └── DeviceReading
                    └── EnergyService
                          ├── Consumption
                          ├── Estimated cost
                          ├── Trend
                          ├── Building comparison
                          └── Period comparison
```

A cumulative register is not summed. Consumption for a period is the increase between samples inside that window:

```text
1000 kWh at the first sample
1080 kWh at the last sample
Consumption = 1080 - 1000 = 80 kWh
```

With `ENERGY_COST_PER_KWH=0.25`, the estimated cost is `80 × 0.25`. The API labels this estimated cost. It is not a utility bill. `CURRENCY_CODE` defaults to `USD`. `ENERGY_DAILY_TARGET_KWH` is optional. These values are backend environment variables and are not exposed as `VITE_` variables.

`Wh` is converted to kWh before the difference is taken. A drop in the register, such as `1000 kWh` followed by `20 kWh`, sets `meterResetDetected` and does not count as negative consumption. Movement after the reset can still count. The unknown energy across the reset is omitted.

Power is not treated as energy. When a meter has no cumulative register, energy is estimated with trapezoidal integration of power samples, and the response `source` is `ESTIMATED`. Gaps longer than two hours are not filled in. Measured and estimated results are not added together. Building totals use measured `ENERGY` sensors only.

Timestamps are stored in UTC. Trend buckets use UTC hour, day, or month boundaries. A requested window is `[from, to]` inclusive. The previous comparison window is the same length and ends one millisecond before `from`, so the two windows do not share a sample. If the previous consumption is zero and the current consumption is not, `changePercent` is null and `direction` is `INCREASE` or `DECREASE`. Equal periods are `UNCHANGED` with `0`. The API does not return `Infinity` or `NaN`.

| Action | Method and path | Roles |
| --- | --- | --- |
| Summary | `GET /api/v1/energy/summary` | Every authenticated role |
| Trend | `GET /api/v1/energy/trend` | Every authenticated role |
| Buildings | `GET /api/v1/energy/buildings` | Every authenticated role |
| Compare | `GET /api/v1/energy/compare` | Every authenticated role |
| Device | `GET /api/v1/energy/devices/:id` | Every authenticated role |

Filters include `buildingId`, `from`, and `to`. Trend and device requests also accept `interval` of `hour`, `day`, or `month`. A device that is not an energy meter, or has no energy, power, voltage, or current sensor, returns `404` `ENERGY_DATA_NOT_AVAILABLE`. A `buildingId` that does not exist returns `404`. There is still no per-building assignment table, so every authenticated role can read energy for every building. The role is still checked on the server.

`reading:created` updates the latest energy or power figure on the dashboard and energy page. Historical trends stay on REST and are refreshed when the socket reconnects. Threshold alarms continue to use the existing alarm evaluation. An energy reading above its maximum opens `ENERGY_THRESHOLD`. Power, voltage, and current outside their configured range open `SENSOR_OUT_OF_RANGE`.

The development seed includes Main Building Energy Meter on the server-room meter and Annex Energy Meter in Annex Office. Each has cumulative kWh samples every six hours across several days, plus power samples. Re-seeding replaces those readings.

Reading queries use the existing `(sensor_id, recorded_at)` index. Consumption is calculated in PostgreSQL from the difference between consecutive samples in the requested window, not by loading the full history.

## Maintenance

A work order is maintenance work for one device. The building is taken from the device location on the server. The client does not choose `buildingId`. An optional alarm must belong to that same device. Work order numbers are generated on the server as `WO-2026-000001`.

```text
Device
  └── Maintenance schedule
  └── Work order
        └── Technician
              └── Maintenance activity
                    └── Completion
                          └── Service history
```

Service history is the completed and cancelled work orders plus their activities. There is no separate history table. Deleting a device that still has work orders or schedules returns `409` `DEVICE_HAS_MAINTENANCE_HISTORY`. Those rows are not cascade-deleted.

Status moves only through dedicated actions:

```text
OPEN → ASSIGNED → IN_PROGRESS → COMPLETED
IN_PROGRESS → ON_HOLD → IN_PROGRESS
OPEN, ASSIGNED, or ON_HOLD → CANCELLED
```

Completed and cancelled work orders stay in history. They are not reopened in this phase. A technician can start, hold, resume, add activities, and complete only a work order assigned to that technician. Viewers can read maintenance data and cannot change it. Super admins, building managers, and facility managers can create work orders, assign technicians, cancel open work, and manage schedules. A viewer cannot be assigned. The assignee must be an active user.

Priority is independent of alarm severity. Creating a work order from an alarm is manual. The alarm page prefills the device and alarm, and the user can edit the title before saving. The same alarm can have more than one work order; the alarm page lists the ones already linked.

Activity cost is the sum of activity lines. `actualCost` is an additional completion cost, not a second copy of those lines. Total cost is the activity sum plus that additional amount. Estimated cost is planning only and is not included in the total.

Preventive schedules store a frequency and `nextDueAt`. They do not generate work orders. Due state uses UTC days: overdue before today, due during today, upcoming after today, and inactive when `isActive` is false. `GET /maintenance/schedules?due=true` returns active schedules whose `nextDueAt` is at or before the current time.

Maintenance events are emitted to `building:<id>` and `device:<id>`. The payload contains the work order id, number, title, status, priority, assignee, device, building, and `updatedAt`. Historical activity lists stay on REST.

| Action | Method and path | Roles |
| --- | --- | --- |
| Summary | `GET /api/v1/maintenance/summary` | Every authenticated role |
| Work orders | `GET /api/v1/maintenance/work-orders` | Every authenticated role |
| Create | `POST /api/v1/maintenance/work-orders` | Super admin, building manager, facility manager |
| Detail | `GET /api/v1/maintenance/work-orders/:id` | Every authenticated role |
| Edit fields | `PATCH /api/v1/maintenance/work-orders/:id` | Super admin, building manager, facility manager |
| Assign | `PATCH /api/v1/maintenance/work-orders/:id/assign` | Super admin, building manager, facility manager |
| Start, hold, resume, complete | `PATCH /api/v1/maintenance/work-orders/:id/...` | Those managers, and the assigned technician |
| Cancel | `PATCH /api/v1/maintenance/work-orders/:id/cancel` | Super admin, building manager, facility manager |
| Activities | `GET` and `POST /api/v1/maintenance/work-orders/:id/activities` | Read: every role. Create: managers and the assigned technician, while the order is in progress |
| Schedules | `GET /api/v1/maintenance/schedules` | Every authenticated role |
| Create, update, delete schedules | `POST`, `PUT`, `DELETE /api/v1/maintenance/schedules` | Super admin, building manager, facility manager |

List filters are `search`, `status`, `priority`, `deviceId`, `buildingId`, `assignedToId`, `alarmId`, `from`, and `to`. The date range filters `createdAt`. There is still no per-building assignment table, so an authenticated reader can see maintenance for every building. An unknown device or work order returns `404`. An illegal status change returns `409` `INVALID_STATE_TRANSITION`. Validation errors use the existing `400` `VALIDATION_ERROR` response.

The development seed includes open, assigned, in-progress, on-hold, completed, and cancelled work orders, plus monthly, quarterly, and annual schedules. One completed order is linked to the resolved reception temperature alarm. Re-seeding replaces that maintenance data for the seeded buildings.

## Reports

Reports aggregate the existing building, device, alarm, energy, and maintenance services. They do not store a separate reporting table and they do not recalculate cumulative kWh with a second formula. Energy figures come from `EnergyService`.

```text
GET /api/v1/reports/executive-summary
GET /api/v1/reports/building-health
GET /api/v1/reports/device-status
GET /api/v1/reports/alarm-trends
GET /api/v1/reports/energy-trends
GET /api/v1/reports/maintenance-kpis
GET /api/v1/reports/buildings
```

Every authenticated role can read reports. There is still no per-building assignment table, so a reader sees every building, matching the rest of the API. An unknown `buildingId` returns `404`. Date ranges are checked on the server and cannot exceed 366 days. Timestamps stay in UTC. Trend intervals are `hour`, `day`, `week`, and `month`.

Operational health is a dashboard score, not a certified assessment. The weights are device availability 40%, active-alarm condition 30%, maintenance condition 20%, and sensor health 10%. A component is left out when it cannot be measured: no devices, no maintenance records, or no sensor that has both a threshold and a reading. The overall score uses only the components that exist. Status bands are 90–100 excellent, 75–89 good, 60–74 warning, and 0–59 critical.

Device availability is online devices divided by all devices. Alarm condition starts at 100 and subtracts 25, 10, 4, or 1 for each active critical, high, medium, or low alarm. Maintenance condition starts at 100 and subtracts 20 for each overdue schedule, 15 for each open critical work order, and 5 for each other open work order. Sensor health is the share of thresholded sensors whose latest reading is inside range.

Maintenance completion rate is completed work divided by work that was not cancelled, for orders created in the selected window. Average resolution is `completedAt - createdAt` for completed orders in that window that have both timestamps. If there are no such orders, the value is null and the page says the figure was not calculated. Recorded cost is the sum of activity costs plus the additional completion cost.

`/reports` can export the current building, maintenance, and alarm rows as CSV and can be printed from the browser. Print hides the sidebar, header, and filter buttons. Live alarm, device, reading, and maintenance events refresh the open report after a short pause instead of once per event.

The dashboard operations panel uses the same report APIs for today's KPIs, building health, critical alarms, and offline devices.

## CI/CD

Pull requests and pushes to `main` run GitHub Actions. The pipeline installs dependencies from the lockfiles, applies Prisma migrations to a disposable database, runs the backend unit tests, lints and builds the frontend, builds the production Docker images, and scans those images. A push to `main` publishes the scanned images to GitHub Container Registry. Pull requests do not publish images. Nothing in this pipeline deploys to AWS.

```text
Pull request
     |
     v
GitHub Actions
     |
     +-- Backend CI
     +-- Frontend CI
     +-- Docker build and Trivy scan
             |
             v
     GHCR image (main only)
```

Required pull request checks are `Backend CI`, `Frontend CI`, `Docker Build (bms-backend)`, and `Docker Build (bms-frontend)`. Image names are `ghcr.io/<owner>/bms-backend` and `ghcr.io/<owner>/bms-frontend`, tagged with the commit SHA and `latest`. Details, local commands, and the recommended `main` branch protection settings are in [docs/ci-cd.md](docs/ci-cd.md).

## Not in this phase

MQTT, IoT gateway ingestion, email, SMS, push notifications, utility billing, forecasting, and automatic creation of work orders from schedules. Manual readings through the API are temporary until a later ingestion phase. `DEVICE_OFFLINE` is not raised automatically.
